"""
agent/schemas/market.py — Pydantic models for the agent pipeline.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class MarketTemplate(BaseModel):
    """Output of the topic discovery agent."""
    title: str = Field(..., description="Clear binary prediction market title (max 80 chars)")
    description: str = Field(..., description="2-3 sentence description with resolution criteria")
    category: str = Field(..., description="One of: Crypto, Finance, Technology, Politics, Sports, Science, Entertainment")
    close_date: datetime = Field(..., description="When betting closes")
    resolution_criteria: str = Field(..., description="Exact conditions that would resolve YES or NO")
    confidence_score: float = Field(..., ge=0, le=1, description="How suitable this is as a prediction market")


class ImageResult(BaseModel):
    """A single image candidate from search."""
    url: str
    width: Optional[int] = None
    height: Optional[int] = None
    source: str  # "serpapi" | "pexels"
    relevance_score: float = Field(default=0.5, ge=0, le=1)
    thumbnail: Optional[str] = None


class ImageSearchResult(BaseModel):
    """Output of the image searcher agent."""
    selected_url: str
    source: str  # "serpapi" | "pexels"
    search_query: str
    cloudinary_url: Optional[str] = None
    candidates_count: int = 0


class CreatedMarket(BaseModel):
    """Response from the Next.js create-market API."""
    id: str
    title: str
    contract_market_id: Optional[int] = None
    close_date: datetime
    status: str
    tx_hash: Optional[str] = None


class ResolutionDecision(BaseModel):
    """Output of the resolver agent's analysis."""
    market_id: str
    outcome: str  # "YES" | "NO"
    confidence: float = Field(..., ge=0, le=1)
    evidence: str
    sources: list[str] = []
    payout_bps: int = Field(default=20000, description="20000 = 2x for winners")
