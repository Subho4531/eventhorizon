"""
agent/agents/market_resolver.py

Market Resolver Agent — autonomous oracle for resolving prediction markets:
  1. Fetch markets past their close date
  2. For each: search for resolution evidence via SerpAPI
  3. Use Gemini LLM to determine YES/NO outcome with confidence
  4. Call Next.js API to resolve on-chain + update DB
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional

from google import genai
from google.genai import types
from langchain_core.output_parsers import PydanticOutputParser

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import (
    GOOGLE_API_KEY,
    LLM_MODEL,
)
from tools import serp_tool, nextjs_tool
from schemas.market import ResolutionDecision


def _get_genai_client():
    if not GOOGLE_API_KEY:
        print("[MarketResolver] ⚠️  GOOGLE_API_KEY is empty in config!")
        return None
    
    return genai.Client(api_key=GOOGLE_API_KEY)


# ── Oracle System Prompt ──────────────────────────────────────────────────────

RESOLVER_SYSTEM_PROMPT = """You are GravityFlow's autonomous resolution oracle — an impartial judge that determines the outcome of prediction markets on the Stellar blockchain.

Your decision directly controls real money payouts. Be rigorous, fair, and evidence-based.

═══ RESOLUTION PROTOCOL ═══

1. ANALYZE all provided evidence carefully.
2. DETERMINE if the market condition was MET (YES) or NOT MET (NO).
3. CITE specific sources in your evidence field.
4. ASSIGN confidence honestly:
   - 0.9–1.0: Definitive proof (official results, confirmed data)
   - 0.7–0.89: Strong evidence from credible sources
   - 0.5–0.69: Mixed signals, lean towards conservative answer
   - Below 0.5: Insufficient evidence — default to NO

═══ CRITICAL RULES ═══

- When in DOUBT, resolve NO. This is the conservative safe default.
- NEVER guess. If evidence is insufficient, say so and resolve NO.
- The close_date is the DEADLINE. Only events BEFORE the close_date count.
- Use exact numbers, dates, and facts from the evidence.
- Your "evidence" field must cite at least one source.

═══ CURRENT TIMESTAMP ═══
{current_datetime}

═══ OUTPUT FORMAT ═══
{format_instructions}
"""


def resolve_pending_markets() -> list[dict]:
    """
    Main entry point — scan for markets ready to resolve and process them.

    Returns:
        List of resolution results for each processed market.
    """
    print("\n" + "="*60)
    print("[MarketResolver] Scanning for markets to resolve...")
    print("="*60)

    # Fetch all markets from the API
    try:
        all_markets = nextjs_tool.get_open_markets()
    except Exception as e:
        print(f"[MarketResolver] Failed to fetch markets: {e}")
        return []

    now = datetime.now(timezone.utc)
    to_resolve = []

    for m in all_markets:
        status = m.get("status", "")
        # Only OPEN or CLOSED markets past their close date
        if status not in ("OPEN", "CLOSED"):
            continue

        close_date_str = m.get("closeDate")
        if not close_date_str:
            continue

        try:
            close_date = datetime.fromisoformat(
                close_date_str.replace("Z", "+00:00")
            )
        except ValueError:
            continue

        if close_date <= now:
            to_resolve.append(m)

    print(f"[MarketResolver] Found {len(to_resolve)} market(s) ready to resolve")

    results = []
    for market in to_resolve:
        result = _resolve_single_market(market)
        if result:
            results.append(result)

    return results


def _resolve_single_market(market: dict) -> Optional[dict]:
    """Resolve a single market using LLM + web evidence."""
    market_id = market["id"]
    title = market.get("title", "Unknown")
    description = market.get("description", "")
    close_date = market.get("closeDate", "")
    category = market.get("category", "General")

    print(f"\n[MarketResolver] Resolving: {title!r}")

    # ── Step 1: Gather evidence from multiple queries ────────────────────────
    evidence_pieces = []

    # Primary search: direct title
    news = serp_tool.search_news(title, num=5)
    if news:
        evidence_pieces.extend(
            f"[{n['source']}] {n.get('date', 'N/A')}: {n['title']} — {n['snippet']}"
            for n in news
        )
    
    # Secondary search: extract key terms for broader context
    key_terms = title.replace("Will ", "").replace("?", "").strip()
    if len(key_terms.split()) > 3:
        extra_news = serp_tool.search_news(key_terms, num=3)
        if extra_news:
            evidence_pieces.extend(
                f"[{n['source']}] {n.get('date', 'N/A')}: {n['title']} — {n['snippet']}"
                for n in extra_news
                if n['title'] not in [e.split(': ', 1)[-1].split(' — ')[0] for e in evidence_pieces]  # Deduplicate
            )

    evidence_text = "\n".join(evidence_pieces) if evidence_pieces else "No recent news found. Insufficient evidence to determine outcome."
    
    print(f"[MarketResolver] Gathered {len(evidence_pieces)} evidence items")

    # ── Step 2: LLM decision ────────────────────────────────────────────────
    client = _get_genai_client()
    if not client:
        print("[MarketResolver] ⚠️ No Gemini client — cannot resolve intelligently")
        return None

    now = datetime.now(timezone.utc)
    parser = PydanticOutputParser(pydantic_object=ResolutionDecision)
    
    formatted_prompt = f"""{RESOLVER_SYSTEM_PROMPT.format(
        current_datetime=now.isoformat(),
        format_instructions=parser.get_format_instructions(),
    )}

═══ MARKET TO RESOLVE ═══
Title: {title}
Description: {description}
Category: {category}
Close Date: {close_date}
Market ID: {market_id}

═══ GATHERED EVIDENCE ═══
{evidence_text}

═══ TASK ═══
Based on the evidence above, did this market resolve YES or NO?
Return ONLY valid JSON matching the schema above. Set market_id to "{market_id}"."""

    try:
        response = client.models.generate_content(
            model=LLM_MODEL,
            contents=formatted_prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,  # Ultra-low for factual resolution
                response_mime_type="application/json",
            )
        )
        
        if not response.text:
            raise Exception("Empty response from Gemini")
            
        decision_dict = json.loads(response.text)
        decision = ResolutionDecision(**decision_dict)

        # Force market_id to match (in case LLM hallucinated)
        decision.market_id = market_id

        print(
            f"[MarketResolver] Decision: {decision.outcome} "
            f"(confidence={decision.confidence:.2f})"
        )

        # Only resolve if confidence is high enough
        if decision.confidence < 0.55:
            print(
                f"[MarketResolver] ⚠️  Low confidence ({decision.confidence:.2f}) "
                "— skipping resolution, will retry next scan"
            )
            return None

    except Exception as e:
        print(f"[MarketResolver] LLM decision failed: {e}")
        return None

    # ── Step 3: Submit resolution ───────────────────────────────────────────
    try:
        result = nextjs_tool.resolve_market(
            market_id=market_id,
            outcome=decision.outcome,
            payout_bps=decision.payout_bps,
            evidence=decision.evidence,
        )

        print(
            f"[MarketResolver] ✅ Resolved market {market_id}: "
            f"{decision.outcome} (tx={result.get('chain', {}).get('hash', 'N/A')})"
        )

        return {
            "marketId": market_id,
            "title": title,
            "outcome": decision.outcome,
            "confidence": decision.confidence,
            "evidence": decision.evidence[:200],
            "txHash": result.get("chain", {}).get("hash"),
        }

    except Exception as e:
        print(f"[MarketResolver] ❌ Resolution API call failed: {e}")
        return None
