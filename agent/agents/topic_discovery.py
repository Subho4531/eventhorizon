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

from google import genai
from google.genai import types
from langchain_core.output_parsers import PydanticOutputParser

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import (
    GOOGLE_API_KEY,
    LLM_MODEL,
    CATEGORIES,
)
from tools import serp_tool
from schemas.market import MarketTemplate


def _get_genai_client():
    if not GOOGLE_API_KEY:
        print("[TopicDiscovery] ⚠️  GOOGLE_API_KEY is empty in config!")
        return None
    
    return genai.Client(api_key=GOOGLE_API_KEY)


# ── System Prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are GravityFlow's autonomous market designer — an AI oracle that creates compelling, tradeable prediction markets on the Stellar blockchain.

You have ONE job: Generate the single BEST prediction market based on what's trending right now.

═══ DYNAMIC DURATION RULES ═══

You MUST choose close_date intelligently based on the event's natural timeline:

┌─────────────────┬──────────────────────┬────────────────────────────────────────┐
│ Market Type      │ Duration             │ Examples                               │
├─────────────────┼──────────────────────┼────────────────────────────────────────┤
│ ⚡ FLASH          │ 5–30 minutes         │ BTC price spike, breaking news outcome │
│ 🔥 HOT            │ 1–6 hours            │ Live match result, stock market close  │
│ 📅 DAILY          │ 12–48 hours          │ Daily crypto price, next-day headline  │
│ 📰 WEEKLY         │ 3–14 days            │ Product launch, regulatory decision    │
│ 🏆 SEASONAL       │ 1–6 months           │ League standings, quarterly earnings   │
│ 🌍 MACRO          │ 6 months – 2 years   │ Elections, technological milestones    │
└─────────────────┴──────────────────────┴────────────────────────────────────────┘

═══ MARKET QUALITY RULES ═══

1. TITLE: Must be a clear YES/NO question, max 80 characters, no ambiguity.
2. DESCRIPTION: 2-3 sentences explaining exactly what resolves YES and what resolves NO.
3. RESOLUTION CRITERIA: Must be objectively verifiable from public sources. Name the exact data source.
4. CLOSE DATE: Must be an ISO 8601 datetime string with timezone (e.g. "2026-04-30T18:00:00+00:00").
5. CONFIDENCE: Your honest assessment of how good this market is (0.0 to 1.0).
6. CATEGORY: Must be exactly one of: Crypto, Finance, Technology, Politics, Sports, Science, Entertainment.

═══ WHAT MAKES A GREAT MARKET ═══

- Controversial topics people want to bet on
- Clear, objective resolution (no "significant" or "major" — use numbers)
- Timely — connected to something happening RIGHT NOW
- High engagement potential — something people have strong opinions about

═══ CURRENT TIMESTAMP ═══
{current_datetime}

═══ CATEGORY FOCUS ═══
{category}

═══ OUTPUT FORMAT ═══
{format_instructions}
"""


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
    news_query = topic_hint or f"{chosen_category} latest news today"
    news = serp_tool.search_news(news_query, num=5)

    if news:
        news_context = "\n".join(
            f"- [{n['source']}] {n['title']}: {n['snippet']}"
            for n in news
        )
    else:
        news_context = f"No recent news fetched. Use your knowledge of current {chosen_category} trends."

    # ── LLM generation (Direct Gemini API call) ──────────────────────────────
    client = _get_genai_client()
    if not client:
        return _fallback_market(chosen_category)

    now = datetime.now(timezone.utc)
    parser = PydanticOutputParser(pydantic_object=MarketTemplate)
    
    formatted_prompt = f"""{SYSTEM_PROMPT.format(
        current_datetime=now.isoformat(),
        category=chosen_category,
        format_instructions=parser.get_format_instructions(),
    )}

═══ TRENDING NEWS (live data) ═══
{news_context}

Generate one prediction market for "{chosen_category}". Return ONLY valid JSON."""

    try:
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=formatted_prompt,
            config=types.GenerateContentConfig(
                temperature=0.8,  # Higher creativity for diverse markets
                response_mime_type="application/json",
            )
        )
        
        if not response.text:
            raise Exception("Empty response from Gemini")
            
        market_dict = json.loads(response.text)
        market = MarketTemplate(**market_dict)

        # ── Validate close date ──────────────────────────────────────────────
        if market.close_date.tzinfo is None:
            market.close_date = market.close_date.replace(tzinfo=timezone.utc)

        # Safety: If LLM picked a past date, fallback to 24h
        if market.close_date <= now:
            print(f"[TopicDiscovery] ⚠️ LLM picked past date {market.close_date}, auto-correcting to +24h.")
            market.close_date = now + timedelta(hours=24)

        # Cap max duration at 2 years
        max_close = now + timedelta(days=730)
        if market.close_date > max_close:
            market.close_date = max_close

        # Calculate human-readable duration
        delta = market.close_date - now
        if delta.total_seconds() < 3600:
            duration_str = f"{int(delta.total_seconds() / 60)}m"
        elif delta.total_seconds() < 86400:
            duration_str = f"{delta.total_seconds() / 3600:.1f}h"
        else:
            duration_str = f"{delta.days}d"

        print(
            f"[TopicDiscovery] ✅ Generated: {market.title!r} "
            f"(confidence={market.confidence_score:.2f}, duration={duration_str}, closes={market.close_date.isoformat()})"
        )
        return market

    except Exception as e:
        print(f"[TopicDiscovery] LLM generation failed: {e}")
        return _fallback_market(chosen_category)


def _fallback_market(category: str) -> MarketTemplate:
    """Generate a simple deterministic market if LLM fails."""
    now = datetime.now(timezone.utc)
    close_date = now + timedelta(hours=24)

    fallback_markets = {
        "Crypto": MarketTemplate(
            title="Will Bitcoin exceed $100,000 within the next 24 hours?",
            description="Resolves YES if BTC/USD closes above $100,000 on any major exchange within 24 hours.",
            category="Crypto",
            close_date=close_date,
            resolution_criteria="BTC/USD price on Binance, Coinbase, or Kraken closes above $100,000.",
            confidence_score=0.5,
        ),
        "Technology": MarketTemplate(
            title="Will a major tech company announce an AI product today?",
            description="Resolves YES if any of the top-10 tech companies announce a significant AI model or product.",
            category="Technology",
            close_date=close_date,
            resolution_criteria="Official press release or product launch from Apple, Google, Microsoft, Meta, Amazon, NVIDIA, OpenAI, Anthropic, xAI, or Mistral.",
            confidence_score=0.5,
        ),
        "Sports": MarketTemplate(
            title="Will there be an upset in today's top sports fixture?",
            description="Resolves YES if the underdog wins in the highest-profile match of the day.",
            category="Sports",
            close_date=close_date,
            resolution_criteria="Official result from the league's governing body.",
            confidence_score=0.4,
        ),
    }

    return fallback_markets.get(
        category,
        MarketTemplate(
            title=f"Will there be a major {category} event in the next 24 hours?",
            description=f"Resolves YES if a verified, newsworthy {category} event occurs within 24 hours.",
            category=category,
            close_date=close_date,
            resolution_criteria=f"A verifiable {category} event confirmed by 3+ credible news sources.",
            confidence_score=0.4,
        ),
    )
