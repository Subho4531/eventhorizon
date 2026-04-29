"""
agent/tools/pexels_tool.py

Pexels image search — fallback when SerpAPI yields insufficient results.
Free tier: 200 requests/hour, 20,000/month.
"""
from __future__ import annotations

import httpx

from config import PEXELS_API_KEY
from schemas.market import ImageResult

PEXELS_BASE_URL = "https://api.pexels.com/v1"


def search_images(query: str, num: int = 5) -> list[ImageResult]:
    """
    Search Pexels for photos matching the query.
    Returns up to `num` high-resolution candidates.
    """
    if not PEXELS_API_KEY:
        print("[PexelsTool] PEXELS_API_KEY not configured — skipping fallback")
        return []

    try:
        headers = {"Authorization": PEXELS_API_KEY}
        params = {
            "query": query,
            "per_page": num,
            "orientation": "landscape",
            "size": "large",
        }

        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{PEXELS_BASE_URL}/search",
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
            data = resp.json()

        photos = data.get("photos", [])
        results: list[ImageResult] = []

        for photo in photos:
            src = photo.get("src", {})
            # Prefer "large2x" or "large" for best quality
            url = src.get("large2x") or src.get("large") or src.get("original")
            if not url:
                continue

            results.append(
                ImageResult(
                    url=url,
                    width=photo.get("width"),
                    height=photo.get("height"),
                    source="pexels",
                    relevance_score=0.75,  # Pexels images are high quality by default
                    thumbnail=src.get("tiny"),
                )
            )

        print(f"[PexelsTool] Found {len(results)} images for: {query!r}")
        return results

    except Exception as e:
        print(f"[PexelsTool] Search failed: {e}")
        return []
