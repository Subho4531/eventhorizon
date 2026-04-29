"""
agent/main.py — GravityFlow Autonomous Agent

Entry point that runs:
  - market creation pipeline every N hours (default: 6h)
  - market resolution scan every hour

Run: python main.py
     python main.py --create-now         (trigger one creation immediately)
     python main.py --resolve-now        (trigger one resolution scan)
     python main.py --category Crypto    (force a category)
"""
from __future__ import annotations

import argparse
import sys
import time
import io
from datetime import datetime

# ── Force UTF-8 output on Windows (fixes cp1252 UnicodeEncodeError) ──────────
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import schedule
from rich.console import Console
from rich.table import Table

from config import CREATION_INTERVAL_HOURS
from agents.market_creator import run_creation_pipeline
from agents.market_resolver import resolve_pending_markets
from tools.nextjs_tool import get_agent_status

console = Console(force_terminal=True, highlight=False)


def print_banner():
    print("")
    print("╔══════════════════════════════════════╗")
    print("║   GravityFlow Autonomous Agent v1.0  ║")
    print("╚══════════════════════════════════════╝")
    print("")


def run_creation_job(category: str | None = None):
    console.print(f"\n[bold green]▶ Market Creation Job[/bold green] [{datetime.now():%H:%M:%S}]")
    result = run_creation_pipeline(category=category)
    if result:
        console.print(f"[green]✅ Created:[/green] {result.title}")
    else:
        console.print("[yellow]⚠️  Creation pipeline returned no result[/yellow]")


def run_resolution_job():
    console.print(f"\n[bold blue]▶ Market Resolution Scan[/bold blue] [{datetime.now():%H:%M:%S}]")
    results = resolve_pending_markets()
    if results:
        table = Table(title="Resolved Markets")
        table.add_column("Market ID", style="cyan")
        table.add_column("Title")
        table.add_column("Outcome", style="green")
        table.add_column("Confidence")
        for r in results:
            table.add_row(
                r["marketId"][:12] + "...",
                r["title"][:50],
                r["outcome"],
                f"{r['confidence']:.0%}",
            )
        console.print(table)
    else:
        console.print("[dim]No markets resolved this scan[/dim]")


def check_health():
    console.print("\n[bold]System Health Check[/bold]")
    try:
        status = get_agent_status()
        console.print(f"  Oracle: {'✅' if status['oracle']['healthy'] else '❌'}")
        console.print(f"  Redis queue: {'✅' if status['queue']['redisConfigured'] else '⚠️ not configured'}")
        console.print(f"  SerpAPI: {'✅' if status['agentConfig']['serpApiConfigured'] else '⚠️ not configured'}")
        console.print(f"  Markets: {status['markets']}")
    except Exception as e:
        console.print(f"  [red]Health check failed: {e}[/red]")


def main():
    parser = argparse.ArgumentParser(description="GravityFlow Autonomous Agent")
    parser.add_argument("--create-now", action="store_true", help="Run market creation immediately")
    parser.add_argument("--resolve-now", action="store_true", help="Run resolution scan immediately")
    parser.add_argument("--category", type=str, help="Force category for creation")
    parser.add_argument("--health", action="store_true", help="Check system health and exit")
    parser.add_argument("--daemon", action="store_true", help="Run as scheduled daemon")
    args = parser.parse_args()

    print_banner()

    if args.health:
        check_health()
        return

    if args.create_now:
        run_creation_job(category=args.category)
        return

    if args.resolve_now:
        run_resolution_job()
        return

    if args.daemon:
        console.print(
            f"[bold]Starting scheduler[/bold]\n"
            f"  • Market creation: every {CREATION_INTERVAL_HOURS}h\n"
            f"  • Resolution scan: every 1h\n"
        )

        # Run immediately on start
        run_creation_job()
        run_resolution_job()

        # Schedule recurring jobs
        schedule.every(CREATION_INTERVAL_HOURS).hours.do(run_creation_job)
        schedule.every(1).hour.do(run_resolution_job)

        console.print("[bold green]Scheduler running. Press Ctrl+C to stop.[/bold green]")
        try:
            while True:
                schedule.run_pending()
                time.sleep(60)
        except KeyboardInterrupt:
            console.print("\n[yellow]Agent stopped by user.[/yellow]")
        return

    # Default: show help
    parser.print_help()


if __name__ == "__main__":
    main()
