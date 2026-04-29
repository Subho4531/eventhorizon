"""
agent/agents/topic_discovery.py

Topic Discovery Agent — uses LLM + SerpAPI news to:
  1. Find trending topics suitable for prediction markets
  2. Generate market templates with title, description, close date
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

import google.generativeai as genai
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import (
    GOOGLE_API_KEY,
    LLM_MODEL,
    MARKET_DURATION_HOURS,
    CATEGORIES,
)
from tools import serp_tool
from schemas.market import MarketTemplate


def _setup_gemini():
    if not GOOGLE_API_KEY:
        print("[TopicDiscovery] ⚠️  GOOGLE_API_KEY is empty in config!")
        return None
    
    genai.configure(api_key=GOOGLE_API_KEY)
    return genai.GenerativeModel(model_name=LLM_MODEL)


# ── Prompt ────────────────────────────────────────────────────────────────────

DISCOVERY_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert prediction market designer for GravityFlow, a Stellar blockchain prediction market platform.

Your job is to create a single high-quality binary prediction market from trending news.

Rules:
- The market must be resolvable with a clear YES/NO outcome
- The close date must be realistic (usually 7-30 days from now)
- Title must be clear, specific, and engaging (max 80 characters)
- Description must explain the resolution criteria exactly
- Avoid vague topics — the outcome must be objectively verifiable

Current date: {current_date}
Category focus: {category}

{format_instructions}"""),
    ("human", """Recent trending news for context:
{news_context}

Generate one high-quality prediction market for the "{category}" category.
If the news doesn't suggest a good topic, use your knowledge to create a relevant, timely market."""),
])


# ── Agent ─────────────────────────────────────────────────────────────────────

def discover_market(
    category: Optional[str] = None,
    topic_hint: Optional[str] = None,
) -> Optional[MarketTemplate]:
    """
    Discover a trending topic and generate a market template.

    Args:
        category: Force a specific category, or None to pick randomly.
        topic_hint: Optional keyword to guide the search.

    Returns:
        MarketTemplate if successful, None otherwise.
    """
    chosen_category = category or random.choice(CATEGORIES)
    print(f"[TopicDiscovery] Discovering market for category: {chosen_category}")

    # ── Fetch trending news for context ──────────────────────────────────────
    news_query = topic_hint or f"{chosen_category} latest news 2025"
    news = serp_tool.search_news(news_query, num=5)

    if news:
        news_context = "\n".join(
            f"- [{n['source']}] {n['title']}: {n['snippet']}"
            for n in news
        )
    else:
        news_context = f"No recent news fetched. Use your knowledge of {chosen_category} trends."

    # ── LLM generation (Direct Gemini API call) ──────────────────────────────
    model = _setup_gemini()
    if not model:
        return _fallback_market(chosen_category)

    # Prepare prompt with Pydantic schema instructions
    parser = PydanticOutputParser(pydantic_object=MarketTemplate)
    formatted_prompt = f"""
    Current date: {datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    Category: {chosen_category}
    
    Recent news for context:
    {news_context}
    
    TASK: Create a single high-quality binary prediction market for the "{chosen_category}" category.
    Output MUST be a valid JSON object matching this schema:
    {parser.get_format_instructions()}
    
    Return ONLY the raw JSON object.
    """

    try:
        response = model.generate_content(
            formatted_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                response_mime_type="application/json",
            )
        )
        
        if not response.text:
            raise Exception("Empty response from Gemini")
            
        market_dict = json.loads(response.text)
        
        # Convert dict to Pydantic object
        market = MarketTemplate(**market_dict)

        # Validate close date — must be in future
        now = datetime.now(timezone.utc)
        if market.close_date.tzinfo is None:
            market.close_date = market.close_date.replace(tzinfo=timezone.utc)

        if market.close_date <= now:
            market.close_date = now + timedelta(hours=MARKET_DURATION_HOURS)

        # Cap max duration at 90 days
        max_close = now + timedelta(days=90)
        if market.close_date > max_close:
            market.close_date = now + timedelta(hours=MARKET_DURATION_HOURS)

        print(
            f"[TopicDiscovery] ✅ Generated: {market.title!r} "
            f"(confidence={market.confidence_score:.2f}, closes={market.close_date.date()})"
        )
        return market

    except Exception as e:
        print(f"[TopicDiscovery] LLM generation failed: {e}")
        # Graceful fallback — generate a simple time-based market
        return _fallback_market(chosen_category)


def _fallback_market(category: str) -> MarketTemplate:
    """Generate a simple deterministic market if LLM fails."""
    now = datetime.now(timezone.utc)
    close_date = now + timedelta(hours=MARKET_DURATION_HOURS)

    fallback_markets = {
        "Crypto": MarketTemplate(
            title="Will Bitcoin exceed $100,000 within the next 7 days?",
            description="Resolves YES if BTC/USD closes above $100,000 on any major exchange within 7 days.",
            category="Crypto",
            close_date=close_date,
            resolution_criteria="BTC/USD price on Binance, Coinbase, or Kraken closes above $100,000.",
            confidence_score=0.5,
        ),
        "Technology": MarketTemplate(
            title="Will a major tech company announce an AI breakthrough this week?",
            description="Resolves YES if any of the top-10 tech companies announce a significant AI model or product.",
            category="Technology",
            close_date=close_date,
            resolution_criteria="Official press release or product launch from Apple, Google, Microsoft, Meta, Amazon, NVIDIA, OpenAI, Anthropic, xAI, or Mistral.",
            confidence_score=0.5,
        ),
    }

    return fallback_markets.get(
        category,
        MarketTemplate(
            title=f"Will there be a significant {category} development this week?",
            description=f"Resolves YES if a major verified {category} event occurs within 7 days.",
            category=category,
            close_date=close_date,
            resolution_criteria=f"A verifiable, widely reported {category} event confirmed by 3+ credible sources.",
            confidence_score=0.4,
        ),
    )
