"""
agent/config.py — Centralised configuration loaded from environment.
"""
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

# ── LLM ─────────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
if GOOGLE_API_KEY:
    print(f"[Config] Loaded Google API Key: {GOOGLE_API_KEY[:8]}***")
else:
    print("[Config] ❌ No GOOGLE_API_KEY found in .env!")

LLM_MODEL = os.getenv("AGENT_LLM_MODEL", "gemini-2.0-flash")

# ── Image search ─────────────────────────────────────────────────────────────
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")

# Min image dimensions to accept from search
MIN_IMAGE_WIDTH = int(os.getenv("MIN_IMAGE_WIDTH", "800"))
MIN_IMAGE_HEIGHT = int(os.getenv("MIN_IMAGE_HEIGHT", "600"))
MAX_IMAGE_RESULTS = int(os.getenv("MAX_IMAGE_RESULTS", "10"))

# ── Next.js API ──────────────────────────────────────────────────────────────
NEXTJS_API_URL = os.getenv("AGENT_NEXTJS_API_URL", "http://localhost:3000")
AGENT_API_KEY = os.getenv("AGENT_API_KEY", "")

# ── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# ── Agent behaviour ──────────────────────────────────────────────────────────
# How many hours into the future should markets close by default
MARKET_DURATION_HOURS = int(os.getenv("MARKET_DURATION_HOURS", "168"))  # 7 days
CREATION_INTERVAL_HOURS = int(os.getenv("CREATION_INTERVAL_HOURS", "6"))

CATEGORIES = [
    "Crypto",
    "Finance",
    "Technology",
    "Politics",
    "Sports",
    "Science",
    "Entertainment",
]
