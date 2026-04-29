"""
agent/tools/serp_tool.py

SerpAPI image + news search wrapper.
Searches for images relevant to a market title and returns filtered candidates.
"""
from __future__ import annotations

import httpx
from typing import Optional
from serpapi import GoogleSearch  # type: ignore

from config import SERPAPI_API_KEY, MAX_IMAGE_RESULTS, MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT
from schemas.market import ImageResult


def search_images(query: str, num: int = MAX_IMAGE_RESULTS) -> list[ImageResult]:
    """
    Search for images via SerpAPI Google Images.
    Returns top `num` results filtered by minimum dimensions.
    """
    if not SERPAPI_API_KEY:
        print("[SerpTool] SERPAPI_API_KEY not configured — skipping image search")
        return []

    try:
        params = {
            "engine": "google_images",
            "q": query,
            "num": num * 2,  # Fetch extra to allow filtering
            "safe": "active",
            "api_key": SERPAPI_API_KEY,
        }
        search = GoogleSearch(params)
        results = search.get_dict()
        images_data = results.get("images_results", [])

        candidates: list[ImageResult] = []
        for img in images_data:
            try:
                original = img.get("original", "")
                if not original or not original.startswith("http"):
                    continue

                width = img.get("original_width") or img.get("img_width") or 0
                height = img.get("original_height") or img.get("img_height") or 0

                # Skip unreliable hosts that block hotlinking or require sessions
                blacklist = ["facebook.com", "fbsbx.com", "instagram.com", "twitter.com", "lookaside"]
                if any(b in original.lower() for b in blacklist):
                    continue

                # Filter by minimum resolution
                if width and height:
                    if int(width) < MIN_IMAGE_WIDTH or int(height) < MIN_IMAGE_HEIGHT:
                        continue

                candidates.append(
                    ImageResult(
                        url=original,
                        width=int(width) if width else None,
                        height=int(height) if height else None,
                        source="serpapi",
                        relevance_score=_score_image(img, query),
                        thumbnail=img.get("thumbnail"),
                    )
                )

                if len(candidates) >= num:
                    break

            except Exception as e:
                print(f"[SerpTool] Skipping image due to parse error: {e}")
                continue

        print(f"[SerpTool] Found {len(candidates)} usable images for: {query!r}")
        return candidates

    except Exception as e:
        print(f"[SerpTool] Image search failed: {e}")
        return []


def search_news(query: str, num: int = 5) -> list[dict]:
    """
    Search for recent news articles to help with market resolution.
    Returns list of { title, link, snippet, date } dicts.
    """
    if not SERPAPI_API_KEY:
        return []

    try:
        params = {
            "engine": "google",
            "q": query,
            "num": num,
            "tbm": "nws",  # News tab
            "api_key": SERPAPI_API_KEY,
        }
        search = GoogleSearch(params)
        results = search.get_dict()
        news_results = results.get("news_results", [])

        return [
            {
                "title": r.get("title", ""),
                "link": r.get("link", ""),
                "snippet": r.get("snippet", ""),
                "date": r.get("date", ""),
                "source": r.get("source", ""),
            }
            for r in news_results
        ]
    except Exception as e:
        print(f"[SerpTool] News search failed: {e}")
        return []


def _score_image(img_data: dict, query: str) -> float:
    """Heuristic relevance score: higher resolution = better score."""
    width = img_data.get("original_width") or 0
    height = img_data.get("original_height") or 0
    try:
        area = int(width) * int(height)
        # Normalize: 1920x1080 = 2073600 → score ~0.9
        score = min(area / 2_500_000, 1.0)
    except Exception:
        score = 0.5
    return round(score, 3)


def verify_image_url(url: str, timeout: float = 5.0) -> bool:
    """
    Quick HEAD request to check if an image URL is accessible.
    Returns True if the URL returns a 200 with an image content-type.
    """
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.head(url)
            if resp.status_code != 200:
                return False
            content_type = resp.headers.get("content-type", "")
            return "image" in content_type
    except Exception:
        return False
