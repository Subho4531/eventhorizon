"""
agent/agents/market_creator.py

Market Creator Agent — orchestrates the full market creation pipeline:
  1. Discover trending topic (topic_discovery)
  2. Find relevant image (image_searcher)
  3. Call Next.js API to create on-chain + index in DB
"""
from __future__ import annotations

from typing import Optional

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agents.topic_discovery import discover_market
from agents.image_searcher import find_market_image
from tools import nextjs_tool
from schemas.market import CreatedMarket, MarketTemplate


def run_creation_pipeline(
    category: Optional[str] = None,
    topic_hint: Optional[str] = None,
) -> Optional[CreatedMarket]:
    """
    Full autonomous market creation pipeline.

    Steps:
      1. Topic Discovery → MarketTemplate
      2. Image Search → best image URL
      3. Create via Next.js API (on-chain + DB + schedule jobs)

    Returns:
        CreatedMarket if successful, None on failure.
    """
    print("\n" + "="*60)
    print("[MarketCreator] Starting market creation pipeline")
    print("="*60)

    # ── Step 1: Topic Discovery ───────────────────────────────────────────────
    template: Optional[MarketTemplate] = discover_market(
        category=category,
        topic_hint=topic_hint,
    )

    if not template:
        print("[MarketCreator] ❌ Topic discovery failed")
        return None

    print(f"[MarketCreator] Topic: {template.title}")

    # ── Step 2: Image Search ──────────────────────────────────────────────────
    image_result = find_market_image(
        market_title=template.title,
        category=template.category,
        verify_urls=False,  # Fast mode — skip URL verification
    )

    image_url = image_result.selected_url or ""
    print(
        f"[MarketCreator] Image: {image_url[:80] if image_url else 'none'}... "
        f"(source={image_result.source})"
    )

    # ── Step 3: Create via API ────────────────────────────────────────────────
    try:
        created = nextjs_tool.create_market(
            title=template.title,
            description=f"{template.description}\n\n**Resolution criteria:** {template.resolution_criteria}",
            category=template.category,
            close_date=template.close_date,
            image_url=image_url,
            image_source=image_result.source if image_url else None,
            image_search_query=image_result.search_query if image_url else None,
        )

        print(
            f"\n[MarketCreator] ✅ Market created successfully!\n"
            f"  DB id: {created.id}\n"
            f"  Contract id: {created.contract_market_id}\n"
            f"  Close date: {created.close_date}\n"
            f"  Tx hash: {created.tx_hash or 'N/A'}"
        )
        return created

    except Exception as e:
        print(f"[MarketCreator] ❌ API creation failed: {e}")
        return None
