"""
agent/agents/image_searcher.py

Image searcher agent pipeline:
  1. SerpAPI Google Images search (top 5-10 results)
  2. Filter by resolution + URL validity
  3. Fallback to Pexels if not enough good results
  4. Return best candidate URL
"""
from __future__ import annotations

from typing import Optional

from tools import serp_tool, pexels_tool
from schemas.market import ImageResult, ImageSearchResult

# Minimum acceptable candidates before triggering Pexels fallback
MIN_SERPAPI_CANDIDATES = 2


def find_market_image(
    market_title: str,
    category: str = "General",
    verify_urls: bool = False,
) -> ImageSearchResult:
    """
    Full image search pipeline for a market.

    Args:
        market_title: The market title to search images for.
        category: Market category — used to build a better search query.
        verify_urls: If True, HEAD-checks each URL (slower but more reliable).

    Returns:
        ImageSearchResult with the best image URL and metadata.
    """
    # Build a focused search query
    search_query = _build_query(market_title, category)
    print(f"[ImageSearcher] Searching images for: {search_query!r}")

    # ── Phase 1: SerpAPI ─────────────────────────────────────────────────────
    candidates: list[ImageResult] = serp_tool.search_images(search_query)

    if verify_urls and candidates:
        print(f"[ImageSearcher] Verifying {len(candidates)} image URLs...")
        candidates = [c for c in candidates if serp_tool.verify_image_url(c.url)]
        print(f"[ImageSearcher] {len(candidates)} URLs passed verification")

    # ── Phase 2: Pexels fallback ─────────────────────────────────────────────
    if len(candidates) < MIN_SERPAPI_CANDIDATES:
        print(
            f"[ImageSearcher] Only {len(candidates)} SerpAPI results — "
            "falling back to Pexels"
        )
        pexels_candidates = pexels_tool.search_images(search_query)
        candidates.extend(pexels_candidates)

    if not candidates:
        print("[ImageSearcher] ⚠️  No images found from any source")
        return ImageSearchResult(
            selected_url="",
            source="none",
            search_query=search_query,
            candidates_count=0,
        )

    # ── Phase 3: Select best ─────────────────────────────────────────────────
    best = _select_best(candidates)

    print(
        f"[ImageSearcher] ✅ Selected {best.source} image "
        f"{best.width}x{best.height}: {best.url[:80]}..."
    )

    return ImageSearchResult(
        selected_url=best.url,
        source=best.source,
        search_query=search_query,
        candidates_count=len(candidates),
    )


def _build_query(title: str, category: str) -> str:
    """Build an optimised image search query from the market title."""
    # Strip common prediction market boilerplate words
    noise = {
        "will", "the", "a", "an", "be", "to", "in", "by", "for",
        "before", "after", "at", "on", "is", "of", "its", "does",
        "happen", "occur", "reach", "hit", "announce", "release",
        "complete", "yes", "no", "end", "year", "2025", "2026", "2027",
    }
    words = [w for w in title.split() if w.lower() not in noise]
    query = " ".join(words[:8])  # Keep it concise

    # Add category context for better image relevance
    category_hints = {
        "Crypto": "cryptocurrency blockchain",
        "Finance": "stock market financial",
        "Technology": "technology innovation",
        "Politics": "politics government",
        "Sports": "sports competition",
        "Science": "science research",
        "Entertainment": "entertainment media",
    }
    hint = category_hints.get(category, "")
    if hint:
        query = f"{query} {hint}"

    return query.strip()


def _select_best(candidates: list[ImageResult]) -> ImageResult:
    """Pick the highest-scoring candidate by relevance + resolution."""
    def score(img: ImageResult) -> float:
        # Combine relevance score with resolution bonus
        resolution_bonus = 0.0
        if img.width and img.height:
            area = img.width * img.height
            resolution_bonus = min(area / 3_000_000, 0.3)  # Up to 0.3 bonus
        # Prefer SerpAPI slightly for editorial quality
        source_bonus = 0.05 if img.source == "serpapi" else 0.0
        return img.relevance_score + resolution_bonus + source_bonus

    return max(candidates, key=score)
