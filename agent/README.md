## GravityFlow Autonomous Agent

Python-based agentic pipeline for market creation and resolution.

### Setup

```bash
cd agent
pip install -r requirements.txt
```

### Usage

```bash
# Check system health
python main.py --health

# Create one market now
python main.py --create-now

# Create one market in a specific category
python main.py --create-now --category Crypto

# Run resolution scan
python main.py --resolve-now

# Run as daemon (create every 6h, resolve every 1h)
python main.py --daemon
```

### Architecture

```
main.py
├── agents/
│   ├── topic_discovery.py   # LLM + SerpAPI news → MarketTemplate
│   ├── image_searcher.py    # SerpAPI images → Pexels fallback → best URL
│   ├── market_creator.py    # Orchestrates creation pipeline
│   └── market_resolver.py  # Scans + resolves expired markets
├── tools/
│   ├── serp_tool.py         # SerpAPI wrapper (images + news)
│   ├── pexels_tool.py       # Pexels fallback images
│   └── nextjs_tool.py       # HTTP client for Next.js Agent API
└── schemas/
    └── market.py            # Pydantic models
```

### Environment Variables

See `.env.example` for required variables.
