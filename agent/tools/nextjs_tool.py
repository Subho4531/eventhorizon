"""
agent/tools/nextjs_tool.py

HTTP client for calling the Next.js Agent API endpoints.
The Python agent uses these to trigger on-chain operations without
needing a direct Stellar SDK dependency.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

import httpx

from config import NEXTJS_API_URL, AGENT_API_KEY
from schemas.market import CreatedMarket


def _auth_headers() -> dict:
    return {
        "Authorization": f"Bearer {AGENT_API_KEY}",
        "Content-Type": "application/json",
    }


def create_market(
    title: str,
    description: str,
    category: str,
    close_date: datetime,
    image_url: str = "",
    image_source: Optional[str] = None,
    image_search_query: Optional[str] = None,
    timeout: float = 120.0,
) -> CreatedMarket:
    """
    POST /api/agent/create-market
    Triggers on-chain market creation + DB indexing + job scheduling.
    """
    payload = {
        "title": title,
        "description": description,
        "category": category,
        "closeDate": close_date.isoformat(),
        "imageUrl": image_url,
        "imageSource": image_source,
        "imageSearchQuery": image_search_query,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(
            f"{NEXTJS_API_URL}/api/agent/create-market",
            json=payload,
            headers=_auth_headers(),
        )

    if not resp.is_success:
        raise RuntimeError(
            f"create_market API failed {resp.status_code}: {resp.text[:500]}"
        )

    data = resp.json()
    market_data = data["market"]
    chain_data = data.get("chain", {})

    return CreatedMarket(
        id=market_data["id"],
        title=market_data["title"],
        contract_market_id=market_data.get("contractMarketId"),
        close_date=datetime.fromisoformat(market_data["closeDate"].replace("Z", "+00:00")),
        status=market_data["status"],
        tx_hash=chain_data.get("hash"),
    )


def resolve_market(
    market_id: str,
    outcome: str,
    payout_bps: int = 20000,
    evidence: str = "",
    timeout: float = 120.0,
) -> dict:
    """
    POST /api/agent/resolve-market
    Triggers on-chain resolve + DB update.
    """
    payload = {
        "marketId": market_id,
        "outcome": outcome,
        "payoutBps": payout_bps,
        "evidence": evidence,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(
            f"{NEXTJS_API_URL}/api/agent/resolve-market",
            json=payload,
            headers=_auth_headers(),
        )

    if not resp.is_success:
        raise RuntimeError(
            f"resolve_market API failed {resp.status_code}: {resp.text[:500]}"
        )

    return resp.json()


def get_agent_status(timeout: float = 10.0) -> dict:
    """GET /api/agent/status"""
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(
            f"{NEXTJS_API_URL}/api/agent/status",
            headers=_auth_headers(),
        )
    resp.raise_for_status()
    return resp.json()


def get_open_markets(timeout: float = 10.0) -> list[dict]:
    """Fetch all OPEN markets from the Next.js API for resolution scanning."""
    with httpx.Client(timeout=timeout) as client:
        resp = client.get(
            f"{NEXTJS_API_URL}/api/markets",
            headers=_auth_headers(),
        )
    resp.raise_for_status()
    data = resp.json()
    return data.get("markets", [])
