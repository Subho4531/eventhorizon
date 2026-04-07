"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { resolveMarket, submitSignedXdr } from "@/lib/escrow";
import { signTransaction } from "@stellar/freighter-api";
import { useRouter } from "next/navigation";
import IntelligenceDashboard from "@/components/IntelligenceDashboard";
import ReputationBadge from "@/components/ReputationBadge";
import BetManagementTable from "@/components/BetManagementTable";
import CreateMarketModal from "@/components/CreateMarketModal";
import {
  Plus,
  Shield,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  List,
  ArrowUpDown,
} from "lucide-react";

interface Market {
  id: string;
  title: string;
  description: string;
  contractMarketId: number;
  status: string;
  yesPool: number;
  noPool: number;
  totalVolume?: number;
  closeDate?: string;
  qualityScore?: number;
  manipulationScore?: number;
}

interface Bet {
  id: string;
  marketId: string;
  userPublicKey: string;
  amount: number;
  commitment: string;
  revealed: boolean;
  createdAt: string;
  market: {
    id: string;
    title: string;
    status: string;
  };
  user: {
    publicKey: string;
    name: string | null;
  };
}

interface BetStats {
  totalVolume: number;
  betCount: number;
  avgBetSize: number;
  sealedCount: number;
  revealedCount: number;
}

type MarketSortKey = "title" | "status" | "yesPool" | "noPool" | "closeDate" | "contractMarketId";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  RESOLVED: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  CLOSED: "bg-white/10 text-white/40 border border-white/10",
  DISPUTED: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
};

export default function AdminPage() {
  const { publicKey } = useWallet();
  const router = useRouter();

  // ── Open markets (for resolution) ──────────────────────────────────────────
  const [openMarkets, setOpenMarkets] = useState<Market[]>([]);
  // ── All markets (for overview + bet form) ───────────────────────────────────
  const [allMarkets, setAllMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [payoutBps, setPayoutBps] = useState("20000");

  // UI toggles
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<"resolution" | "markets" | "bets">("resolution");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Oracle reputation
  const [oracleReputation, setOracleReputation] = useState<any>(null);

  // Markets table sort/filter
  const [marketSearch, setMarketSearch] = useState("");
  const [marketStatusFilter, setMarketStatusFilter] = useState<string>("ALL");
  const [marketSortKey, setMarketSortKey] = useState<MarketSortKey>("closeDate");
  const [marketSortDir, setMarketSortDir] = useState<"asc" | "desc">("desc");

  // Bet management
  const [bets, setBets] = useState<Bet[]>([]);
  const [betStats, setBetStats] = useState<BetStats | null>(null);
  const [selectedMarketFilter, setSelectedMarketFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"amount" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [betsLoading, setBetsLoading] = useState(false);

  // Manual bet creation
  const [showBetForm, setShowBetForm] = useState(false);
  const [betFormData, setBetFormData] = useState({
    marketId: "",
    userPublicKey: "",
    amount: "",
    commitment: "",
  });
  const [creatingBet, setCreatingBet] = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMarkets();
  }, []);

  useEffect(() => {
    if (publicKey) fetchOracleReputation();
  }, [publicKey]);

  useEffect(() => {
    fetchBets();
    fetchBetStats();
  }, [selectedMarketFilter, sortBy, sortOrder]);

  async function fetchMarkets() {
    setLoading(true);
    try {
      const res = await fetch("/api/markets");
      const data = await res.json();
      const all: Market[] = data.markets ?? [];
      setAllMarkets(all);
      setOpenMarkets(all.filter((m) => m.status === "OPEN"));
    } catch (err) {
      console.error("Fetch failed", err);
    } finally {
      setLoading(false);
    }
  }

  const fetchOracleReputation = async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/users/${publicKey}/reputation`);
      if (res.ok) setOracleReputation(await res.json());
    } catch {}
  };

  const fetchBets = async () => {
    setBetsLoading(true);
    try {
      const params = new URLSearchParams({ sortBy, sortOrder, limit: "50" });
      if (selectedMarketFilter !== "all") params.append("marketId", selectedMarketFilter);
      const res = await fetch(`/api/bets?${params.toString()}`);
      if (res.ok) setBets((await res.json()).bets ?? []);
    } catch {}
    finally { setBetsLoading(false); }
  };

  const fetchBetStats = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMarketFilter !== "all") params.append("marketId", selectedMarketFilter);
      const res = await fetch(`/api/bets/stats?${params.toString()}`);
      if (res.ok) setBetStats(await res.json());
    } catch {}
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreateBet = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingBet(true);
    try {
      const commitment =
        betFormData.commitment ||
        `0x${Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("")}`;

      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: betFormData.marketId,
          userPublicKey: betFormData.userPublicKey,
          amount: parseFloat(betFormData.amount),
          commitment,
          txHash: `manual_${Date.now()}`,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create bet");
      }

      alert("Bet created successfully!");
      setShowBetForm(false);
      setBetFormData({ marketId: "", userPublicKey: "", amount: "", commitment: "" });
      fetchBets();
      fetchBetStats();
    } catch (err: any) {
      alert(err.message || "Failed to create bet");
    } finally {
      setCreatingBet(false);
    }
  };

  async function handleResolve(market: Market) {
    if (!publicKey) return alert("Please connect wallet");
    setResolvingId(market.id);
    try {
      const res = await resolveMarket(publicKey, market.contractMarketId, outcome, parseInt(payoutBps));
      if (!res.success || !res.unsignedXdr) throw new Error("Failed to build XDR");

      const signRes = await signTransaction(res.unsignedXdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });
      if (!signRes.signedTxXdr) throw new Error("Signing failed");

      await submitSignedXdr(signRes.signedTxXdr);

      const dbRes = await fetch(`/api/markets/${market.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, payoutBps: parseInt(payoutBps), oraclePubKey: publicKey }),
      });
      if (!dbRes.ok) throw new Error("DB sync failed");

      alert("Market resolved successfully!");
      router.refresh();
      fetchMarkets();
    } catch (err: any) {
      const msg = err.message || "Resolution failed";
      if (msg.includes("not the registered oracle")) {
        alert("Resolution failed: Your wallet is not the registered oracle for this market.");
      } else if (msg.includes("already resolved")) {
        alert("This market has already been resolved.");
      } else {
        alert(msg.length > 200 ? msg.slice(0, 200) + "…" : msg);
      }
    } finally {
      setResolvingId(null);
    }
  }

  // ── Markets table helpers ────────────────────────────────────────────────────
  const toggleMarketSort = (key: MarketSortKey) => {
    if (marketSortKey === key) {
      setMarketSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setMarketSortKey(key);
      setMarketSortDir("asc");
    }
  };

  const filteredAllMarkets = allMarkets
    .filter((m) => {
      const matchesStatus = marketStatusFilter === "ALL" || m.status === marketStatusFilter;
      const matchesSearch =
        !marketSearch ||
        m.title.toLowerCase().includes(marketSearch.toLowerCase()) ||
        String(m.contractMarketId).includes(marketSearch);
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      let av: any = a[marketSortKey as keyof Market];
      let bv: any = b[marketSortKey as keyof Market];
      if (marketSortKey === "closeDate") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      }
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return marketSortDir === "asc" ? -1 : 1;
      if (av > bv) return marketSortDir === "asc" ? 1 : -1;
      return 0;
    });

  const SortIcon = ({ col }: { col: MarketSortKey }) =>
    marketSortKey === col ? (
      marketSortDir === "asc" ? (
        <ChevronUp className="w-3 h-3 text-blue-400" />
      ) : (
        <ChevronDown className="w-3 h-3 text-blue-400" />
      )
    ) : (
      <ArrowUpDown className="w-3 h-3 text-white/20" />
    );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto py-12 space-y-10">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <span className="text-[10px] text-blue-400 font-black tracking-[0.3em] uppercase mb-2 block flex items-center gap-2">
            <Shield className="w-3 h-3 inline" /> Oracle Authority
          </span>
          <h1 className="text-4xl font-bold text-white tracking-tight">Admin Panel</h1>
          <p className="text-white/40 text-[10px] mt-2 uppercase tracking-widest">
            Manage markets, resolve horizons, monitor bets
          </p>
          {oracleReputation && (
            <div className="mt-4">
              <ReputationBadge score={oracleReputation.score} tier={oracleReputation.tier} size="lg" />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
          >
            {showDashboard ? "Hide Intel" : "Show Intel"}
          </button>
          {publicKey && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white border border-blue-400/30 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Propose Horizon
            </button>
          )}
        </div>
      </header>

      {/* ── Intelligence Dashboard ─────────────────────────────────────────── */}
      {showDashboard && (
        <div className="mb-4">
          <IntelligenceDashboard />
        </div>
      )}

      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Markets", value: allMarkets.length, color: "text-white" },
          {
            label: "Open Markets",
            value: allMarkets.filter((m) => m.status === "OPEN").length,
            color: "text-emerald-400",
          },
          {
            label: "Pending Resolution",
            value: openMarkets.length,
            color: "text-amber-400",
          },
          {
            label: "Resolved",
            value: allMarkets.filter((m) => m.status === "RESOLVED").length,
            color: "text-blue-400",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-panel p-5 rounded-2xl border border-white/5 bg-gradient-to-br from-white/3 to-transparent"
          >
            <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest mb-2">{s.label}</div>
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-white/10 pb-0">
        {(
          [
            { id: "resolution", label: "Resolve Markets" },
            { id: "markets", label: "All Markets" },
            { id: "bets", label: "Bet Management" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-[11px] font-bold uppercase tracking-widest rounded-t-xl transition-all border-b-2 ${
              activeTab === tab.id
                ? "text-white border-blue-500 bg-white/5"
                : "text-white/30 border-transparent hover:text-white/60 hover:bg-white/3"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: RESOLVE MARKETS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "resolution" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Markets Pending Resolution</h2>
              <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
                {openMarkets.length} open market{openMarkets.length !== 1 ? "s" : ""} awaiting oracle verdict
              </p>
            </div>

            {/* Global outcome + payout controls */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setOutcome("YES")}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    outcome === "YES"
                      ? "bg-emerald-600 text-white border-emerald-400"
                      : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                  }`}
                >
                  YES
                </button>
                <button
                  onClick={() => setOutcome("NO")}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                    outcome === "NO"
                      ? "bg-red-600 text-white border-red-400"
                      : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                  }`}
                >
                  NO
                </button>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1">
                  Payout BPS
                </label>
                <input
                  type="number"
                  value={payoutBps}
                  onChange={(e) => setPayoutBps(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs w-28 focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="glass-panel p-20 text-center rounded-3xl border border-white/5 animate-pulse">
                <div className="text-white/20 text-sm">Loading markets…</div>
              </div>
            ) : openMarkets.length === 0 ? (
              <div className="glass-panel p-20 text-center rounded-4xl border border-dashed border-white/10">
                <span className="material-symbols-outlined text-white/10 text-5xl mb-6">verified_user</span>
                <p className="text-[10px] text-white/30 uppercase font-bold tracking-widest italic">
                  All horizons reached consensus. No pending resolutions.
                </p>
              </div>
            ) : (
              openMarkets.map((m) => (
                <div
                  key={m.id}
                  className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-white/2 to-transparent group hover:border-white/10 transition-all"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">
                          Contract #{m.contractMarketId}
                        </span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${STATUS_STYLES[m.status] ?? "bg-white/10 text-white/40"}`}>
                          {m.status}
                        </span>
                        {m.qualityScore !== undefined && (
                          <span
                            className={`text-[9px] font-bold ${
                              m.qualityScore >= 70
                                ? "text-green-400"
                                : m.qualityScore >= 40
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            Q: {m.qualityScore.toFixed(0)}
                          </span>
                        )}
                        {m.manipulationScore !== undefined && m.manipulationScore >= 70 && (
                          <span className="text-[9px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-0.5">
                            ⚠️ Risk {m.manipulationScore.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white">{m.title}</h3>
                      <p className="text-xs text-white/40 max-w-md">
                        {m.description || "No description provided."}
                      </p>
                      <div className="flex gap-4 mt-2 text-[10px] text-white/30 uppercase font-black tracking-widest">
                        <span>
                          YES Pool:{" "}
                          <span className="text-emerald-400 ml-1">{m.yesPool} XLM</span>
                        </span>
                        <span className="border-l border-white/10 pl-4">
                          NO Pool:{" "}
                          <span className="text-red-400 ml-1">{m.noPool} XLM</span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResolve(m)}
                      disabled={resolvingId === m.id}
                      className="shrink-0 bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-xl hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 disabled:opacity-30 shadow-lg"
                    >
                      {resolvingId === m.id ? "Resolving…" : "Resolve On-Chain"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: ALL MARKETS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "markets" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">All Markets</h2>
              <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
                {filteredAllMarkets.length} of {allMarkets.length} markets
              </p>
            </div>
            {publicKey && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white border border-blue-400/30 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
              >
                <Plus className="w-3.5 h-3.5" />
                New Market
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by title or contract ID…"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
            />
            <div className="flex gap-2">
              {["ALL", "OPEN", "RESOLVED", "CLOSED", "DISPUTED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setMarketStatusFilter(s)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    marketStatusFilter === s
                      ? "bg-blue-600 text-white border-blue-400"
                      : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/3">
                  {(
                    [
                      { key: "contractMarketId", label: "#" },
                      { key: "title", label: "Title" },
                      { key: "status", label: "Status" },
                      { key: "yesPool", label: "YES Pool" },
                      { key: "noPool", label: "NO Pool" },
                      { key: "closeDate", label: "Close Date" },
                    ] as { key: MarketSortKey; label: string }[]
                  ).map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => toggleMarketSort(key)}
                      className="px-5 py-3.5 text-left text-[9px] text-white/30 font-bold uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        {label}
                        <SortIcon col={key} />
                      </div>
                    </th>
                  ))}
                  <th className="px-5 py-3.5 text-right text-[9px] text-white/30 font-bold uppercase tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-white/20 text-sm">
                      Loading…
                    </td>
                  </tr>
                ) : filteredAllMarkets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-white/20 text-sm">
                      No markets match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredAllMarkets.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors group"
                    >
                      <td className="px-5 py-4 text-[11px] text-blue-400 font-mono font-bold">
                        {m.contractMarketId}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white text-sm leading-tight max-w-xs truncate">
                          {m.title}
                        </div>
                        {m.description && (
                          <div className="text-[10px] text-white/30 mt-0.5 max-w-xs truncate">
                            {m.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            STATUS_STYLES[m.status] ?? "bg-white/10 text-white/40"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-[12px] text-emerald-400 font-bold">
                        {m.yesPool} XLM
                      </td>
                      <td className="px-5 py-4 text-[12px] text-red-400 font-bold">
                        {m.noPool} XLM
                      </td>
                      <td className="px-5 py-4 text-[11px] text-white/40">
                        {m.closeDate ? new Date(m.closeDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {m.status === "OPEN" && (
                          <button
                            onClick={() => {
                              setActiveTab("resolution");
                              setOutcome("YES");
                            }}
                            className="text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: BET MANAGEMENT
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "bets" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="text-[10px] text-purple-400 font-black tracking-[0.3em] uppercase mb-2 block">
                Betting Activity
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight">Bet Management</h2>
              <p className="text-white/40 text-[10px] mt-1 uppercase tracking-widest">
                Monitor all sealed positions across markets
              </p>
            </div>
            <button
              onClick={() => setShowBetForm(!showBetForm)}
              className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white border border-purple-400 hover:bg-purple-700 transition-all"
            >
              {showBetForm ? "Cancel" : "+ Create Test Bet"}
            </button>
          </div>

          {/* Manual Bet Creation Form */}
          {showBetForm && (
            <div className="glass-panel p-8 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent">
              <h3 className="text-xl font-bold text-white mb-6">Create Test Bet</h3>
              <form onSubmit={handleCreateBet} className="space-y-4">
                <div>
                  <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                    Market
                  </label>
                  {/* Use allMarkets here so we can create bets on any market (not just OPEN) */}
                  <select
                    value={betFormData.marketId}
                    onChange={(e) => setBetFormData({ ...betFormData, marketId: e.target.value })}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">Select a market</option>
                    {allMarkets.map((m) => (
                      <option key={m.id} value={m.id}>
                        [{m.status}] {m.title} (Contract #{m.contractMarketId})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                    User Public Key
                  </label>
                  <input
                    type="text"
                    value={betFormData.userPublicKey}
                    onChange={(e) =>
                      setBetFormData({ ...betFormData, userPublicKey: e.target.value })
                    }
                    placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                  />
                  {publicKey && (
                    <button
                      type="button"
                      onClick={() => setBetFormData({ ...betFormData, userPublicKey: publicKey })}
                      className="mt-1 text-[9px] text-purple-400 hover:text-purple-300 transition-colors pl-1"
                    >
                      Use my wallet address
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                    Amount (XLM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={betFormData.amount}
                    onChange={(e) => setBetFormData({ ...betFormData, amount: e.target.value })}
                    placeholder="10.00"
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                    Commitment Hash (Optional)
                  </label>
                  <input
                    type="text"
                    value={betFormData.commitment}
                    onChange={(e) => setBetFormData({ ...betFormData, commitment: e.target.value })}
                    placeholder="0x... (auto-generated if empty)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50 font-mono"
                  />
                  <p className="text-[9px] text-white/40 mt-1 pl-1">
                    Leave empty to auto-generate a random commitment
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={creatingBet}
                    className="flex-1 bg-purple-600 text-white text-[10px] font-black uppercase tracking-[0.2em] py-3 rounded-xl hover:bg-purple-700 transition-all transform active:scale-95 disabled:opacity-30 shadow-lg"
                  >
                    {creatingBet ? "Creating…" : "Create Bet"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBetForm(false)}
                    className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Stats Cards */}
          {betStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-purple-500/10 to-transparent">
                <div className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-2">
                  Total Volume
                </div>
                <div className="text-3xl font-bold text-white">
                  {betStats.totalVolume.toFixed(2)} XLM
                </div>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-blue-500/10 to-transparent">
                <div className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-2">
                  Bet Count
                </div>
                <div className="text-3xl font-bold text-white">{betStats.betCount}</div>
                <div className="text-[9px] text-white/40 mt-1">
                  {betStats.sealedCount} sealed · {betStats.revealedCount} revealed
                </div>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-gradient-to-br from-green-500/10 to-transparent">
                <div className="text-[9px] text-green-400 font-bold uppercase tracking-widest mb-2">
                  Avg Bet Size
                </div>
                <div className="text-3xl font-bold text-white">
                  {betStats.avgBetSize.toFixed(2)} XLM
                </div>
              </div>
            </div>
          )}

          {/* Filters and Sort Controls */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                Filter by Market
              </label>
              <select
                value={selectedMarketFilter}
                onChange={(e) => setSelectedMarketFilter(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
              >
                <option value="all">All Markets</option>
                {allMarkets.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.status}] {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div>
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "amount" | "createdAt")}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="createdAt">Date</option>
                  <option value="amount">Amount</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] text-white/30 uppercase font-black tracking-widest pl-1 mb-2 block">
                  Order
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/50"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bet Table */}
          <BetManagementTable
            bets={bets}
            loading={betsLoading}
            onSort={(sb, so) => {
              setSortBy(sb);
              setSortOrder(so);
            }}
            onFilter={(marketId) => setSelectedMarketFilter(marketId)}
          />
        </div>
      )}

      {/* ── Create Market Modal ─────────────────────────────────────────────── */}
      {isCreateModalOpen && publicKey && (
        <CreateMarketModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            fetchMarkets(); // refresh after creation
          }}
          userPublicKey={publicKey}
        />
      )}
    </div>
  );
}
