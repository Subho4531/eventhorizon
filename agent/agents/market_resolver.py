"""
agent/agents/market_resolver.py

Market Resolver Agent — finds markets ready to resolve and determines outcomes:
  1. Fetch markets past their close date
  2. For each: search for resolution evidence via SerpAPI
  3. Use LLM to determine YES/NO outcome with confidence
  4. Call Next.js API to resolve on-chain + update DB
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    LLM_MODEL,
)
from tools import serp_tool, nextjs_tool
from schemas.market import ResolutionDecision


def _get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=LLM_MODEL,
        openai_api_key=OPENROUTER_API_KEY,
        openai_api_base=OPENROUTER_BASE_URL,
        temperature=0.2,  # Low temperature for factual decisions
        max_tokens=512,
        default_headers={
            "HTTP-Referer": "https://gravityflow.io",
            "X-Title": "GravityFlow Resolver",
        },
    )


RESOLUTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an impartial oracle for a blockchain prediction market.
Your task is to determine whether a market resolved YES or NO based on available evidence.

Be conservative: if you cannot determine the outcome with confidence >= 0.7, output "NO" as the safe default.
Always cite your sources in the evidence field.

{format_instructions}"""),
    ("human", """Market Title: {title}
Description: {description}

News & evidence gathered:
{evidence}

Based on the evidence above, did the market resolve YES or NO?
Market close date was: {close_date}
"""),
])


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
    """Resolve a single market using LLM + news evidence."""
    market_id = market["id"]
    title = market.get("title", "Unknown")
    description = market.get("description", "")
    close_date = market.get("closeDate", "")

    print(f"\n[MarketResolver] Resolving: {title!r}")

    # ── Step 1: Gather evidence ─────────────────────────────────────────────
    news = serp_tool.search_news(title, num=5)
    evidence_text = "\n".join(
        f"[{n['source']}] {n['date']}: {n['title']} — {n['snippet']}"
        for n in news
    ) if news else "No recent news found. Insufficient evidence."

    # ── Step 2: LLM decision ────────────────────────────────────────────────
    parser = PydanticOutputParser(pydantic_object=ResolutionDecision)
    llm = _get_llm()
    chain = RESOLUTION_PROMPT | llm | parser

    try:
        decision: ResolutionDecision = chain.invoke({
            "title": title,
            "description": description,
            "evidence": evidence_text,
            "close_date": close_date,
            "format_instructions": parser.get_format_instructions(),
        })

        # Force market_id to match
        decision.market_id = market_id

        print(
            f"[MarketResolver] Decision: {decision.outcome} "
            f"(confidence={decision.confidence:.2f})"
        )

        # Only resolve if confidence is high enough
        if decision.confidence < 0.6:
            print(
                f"[MarketResolver] ⚠️  Low confidence ({decision.confidence:.2f}) "
                "— skipping resolution"
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
            "txHash": result.get("chain", {}).get("hash"),
        }

    except Exception as e:
        print(f"[MarketResolver] ❌ Resolution API call failed: {e}")
        return None
