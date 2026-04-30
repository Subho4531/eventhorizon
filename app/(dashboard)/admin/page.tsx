"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { useWallet } from "@/components/WalletProvider";
import { resolveMarket, submitSignedXdr } from "@/lib/escrow";
import { signTransaction } from "@stellar/freighter-api";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import IntelligenceDashboard from "@/components/IntelligenceDashboard";
import ReputationBadge from "@/components/ReputationBadge";
import BetManagementTable from "@/components/BetManagementTable";
import CreateMarketModal from "@/components/CreateMarketModal";
import { Loader2 } from "lucide-react";
import {
  Plus,
  Shield,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import Image from "next/image";
import { useCallback } from "react";

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
  imageUrl?: string | null;
  payoutBps?: number | null;
  outcome?: string | null;
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

type MarketSortKey = "title" | "status" | "yesPool" | "noPool" | "closeDate" | "contractMarketId" | "outcome" | "payoutBps";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "text-[#FF8C00] border-[#FF8C00]/30 bg-[#FF8C00]/5",
  RESOLVED: "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5",
  CLOSED: "text-white/20 border-white/10 bg-white/5",
  DISPUTED: "text-red-500 border-red-500/30 bg-red-500/5",
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

  // UI toggles
  const [showDashboard, setShowDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<"resolution" | "markets" | "bets">("resolution");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Oracle reputation
  const [oracleReputation, setOracleReputation] = useState<{ score: number; tier: "Novice" | "Intermediate" | "Expert" | "Master" } | null>(null);

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
  const fetchMarkets = useCallback(async () => {
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
  }, []);

  const fetchOracleReputation = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/users/${publicKey}/reputation`);
      if (res.ok) setOracleReputation(await res.json());
    } catch {}
  }, [publicKey]);

  const fetchBets = useCallback(async () => {
    setBetsLoading(true);
    try {
      const params = new URLSearchParams({ sortBy, sortOrder, limit: "50" });
      if (selectedMarketFilter !== "all") params.append("marketId", selectedMarketFilter);
      const res = await fetch(`/api/bets?${params.toString()}`);
      if (res.ok) setBets((await res.json()).bets ?? []);
    } catch {}
    finally { setBetsLoading(false); }
  }, [selectedMarketFilter, sortBy, sortOrder]);

  const fetchBetStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedMarketFilter !== "all") params.append("marketId", selectedMarketFilter);
      const res = await fetch(`/api/bets/stats?${params.toString()}`);
      if (res.ok) setBetStats(await res.json());
    } catch {}
  }, [selectedMarketFilter]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    if (publicKey) fetchOracleReputation();
  }, [publicKey, fetchOracleReputation]);

  useEffect(() => {
    fetchBets();
    fetchBetStats();
  }, [fetchBets, fetchBetStats]);

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
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create bet");
    } finally {
      setCreatingBet(false);
    }
  };

  async function handleResolve(market: Market, selectedOutcome: "YES" | "NO") {
    if (!publicKey) return alert("Please connect wallet");
    setResolvingId(market.id);
    try {
      const X = selectedOutcome === "YES" ? market.noPool : market.yesPool;
      const Y = selectedOutcome === "YES" ? market.yesPool : market.noPool;
      const totalPool = Y + (0.9 * X);
      let payoutMultiplier = 1;
      if (Y > 0) {
        payoutMultiplier = totalPool / Y;
      }
      const computedPayoutBps = Math.max(10000, Math.floor(payoutMultiplier * 10000));

      const res = await resolveMarket(publicKey, market.contractMarketId, selectedOutcome, computedPayoutBps);
      if (!res.success || !res.unsignedXdr) throw new Error("Failed to build XDR");

      const signRes = await signTransaction(res.unsignedXdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });
      if (!signRes.signedTxXdr) throw new Error("Signing failed");

      await submitSignedXdr(signRes.signedTxXdr);

      const dbRes = await fetch(`/api/markets/${market.id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: selectedOutcome, payoutBps: computedPayoutBps, oraclePubKey: publicKey }),
      });
      if (!dbRes.ok) throw new Error("DB sync failed");

      alert("Market resolved successfully!");
      router.refresh();
      fetchMarkets();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resolution failed";
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
      let av: string | number = a[marketSortKey] ?? "";
      let bv: string | number = b[marketSortKey] ?? "";
      if (marketSortKey === "closeDate") {
        av = av ? new Date(av as string).getTime() : 0;
        bv = bv ? new Date(bv as string).getTime() : 0;
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
        <ChevronUp className="w-3 h-3 text-[#FF8C00]" />
      ) : (
        <ChevronDown className="w-3 h-3 text-[#FF8C00]" />
      )
    ) : (
      <ArrowUpDown className="w-3 h-3 text-white/10" />
    );

  // ── Render ────────────────────────────────────────────────────────────────────
  if (publicKey !== process.env.NEXT_PUBLIC_ADMIN_ID) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-mono gap-6">
        <Shield className="w-16 h-16 text-red-500/20" />
        <div className="text-center">
          <h2 className="text-xl font-black text-white uppercase tracking-[0.2em]">ACCESS_DENIED</h2>
          <p className="text-[10px] text-white/20 uppercase tracking-widest mt-2">UNAUTHORIZED_CREDENTIALS_DETECTED</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 space-y-12 font-mono">
      
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-8 flex-wrap">
        <div className="relative">
          <div className="absolute -left-6 top-0 bottom-0 w-1 bg-[#FF8C00]" />
          <span className="text-[10px] text-[#FF8C00] font-black tracking-[0.5em] uppercase mb-3 block flex items-center gap-3">
            <Shield className="w-4 h-4" /> SECURE ORACLE TERMINAL
          </span>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">ADMIN OVERRIDE</h1>
          <p className="text-white/20 text-[10px] mt-2 uppercase tracking-[0.2em] font-bold">
            MANAGE MARKETS // RESOLVE HORIZONS // MONITOR TX FLOW
          </p>
          {oracleReputation && (
            <div className="mt-6">
              <ReputationBadge score={oracleReputation.score} tier={oracleReputation.tier as "Novice" | "Intermediate" | "Expert" | "Master"} size="lg" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="px-6 py-3 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
          >
            {showDashboard ? "Hide Intelligence Module" : "Show Intelligence Module"}
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-3 px-8 py-3 bg-[#FF8C00] text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-[#FF8C00]/10"
          >
            <Plus className="w-4 h-4" />
            Initialize New Horizon
          </button>
        </div>
      </header>

      {showDashboard && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="border border-[#FF8C00]/20 bg-[#FF8C00]/5 p-1">
          <IntelligenceDashboard />
        </motion.div>
      )}

      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: "Total Markets", value: allMarkets.length, color: "text-white" },
          { label: "Open Slots", value: allMarkets.filter((m) => m.status === "OPEN").length, color: "text-[#FF8C00]" },
          { label: "Pending Verdict", value: openMarkets.length, color: "text-blue-400" },
          { label: "Archived Data", value: allMarkets.filter((m) => m.status === "RESOLVED").length, color: "text-[#00C853]" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0D0D0D] border border-white/10 p-6 group hover:border-white/20 transition-all">
            <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-3">{s.label}</div>
            <div className={`text-3xl font-black ${s.color} tracking-tighter`}>{s.value}</div>
            <div className="w-full h-1 bg-white/5 mt-4 overflow-hidden">
               <div className="w-1/3 h-full bg-white/10 animate-scan" />
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 border-b border-white/10 overflow-x-auto no-scrollbar">
        {[
          { id: "resolution", label: "Market Resolution" },
          { id: "markets", label: "Global Inventory" },
          { id: "bets", label: "Transaction Logs" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "resolution" | "markets" | "bets")}
            className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative shrink-0 ${
              activeTab === tab.id
                ? "text-[#FF8C00]"
                : "text-white/20 hover:text-white/60"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#FF8C00]" />
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB: RESOLVE MARKETS
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "resolution" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="py-20 text-center border border-white/5 bg-[#0D0D0D]">
                <Loader2 className="w-8 h-8 text-[#FF8C00] animate-spin mx-auto mb-4" />
                <span className="text-[10px] text-white/20 uppercase font-black">SCANNING HORIZONS...</span>
              </div>
            ) : openMarkets.length === 0 ? (
              <div className="py-24 text-center border border-dashed border-white/10 bg-[#0D0D0D]">
                <Shield className="w-12 h-12 text-white/5 mx-auto mb-6" />
                <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.4em] italic">
                  NO PENDING RESOLUTIONS DETECTED
                </p>
              </div>
            ) : (
              openMarkets.map((m) => (
                <div key={m.id} className="bg-[#0D0D0D] border border-white/10 p-8 group hover:border-[#FF8C00]/30 transition-all relative">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-[#FF8C00] font-black">#{m.contractMarketId}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border ${STATUS_STYLES[m.status]}`}>
                          {m.status}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white tracking-tighter uppercase italic">{m.title}</h3>
                      <p className="text-[11px] text-white/40 uppercase font-bold leading-relaxed max-w-2xl">{m.description}</p>
                      
                      <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest pt-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-white/20 text-[8px]">POOL YES</span>
                          <span className="text-[#00C853]">{m.yesPool} XLM</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-white/20 text-[8px]">POOL NO</span>
                          <span className="text-red-500">{m.noPool} XLM</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleResolve(m, "YES")}
                        disabled={resolvingId === m.id}
                        className="px-8 py-3 bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/30 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-[#00C853] hover:text-black transition-all disabled:opacity-20"
                      >
                        {resolvingId === m.id ? "EXECUTING..." : "RESOLVE YES"}
                      </button>
                      <button
                        onClick={() => handleResolve(m, "NO")}
                        disabled={resolvingId === m.id}
                        className="px-8 py-3 bg-red-500/10 text-red-500 border border-red-500/30 text-[11px] font-black uppercase tracking-[0.3em] hover:bg-red-500 hover:text-black transition-all disabled:opacity-20"
                      >
                        {resolvingId === m.id ? "EXECUTING..." : "RESOLVE NO"}
                      </button>
                    </div>
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
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="SEARCH BY TITLE OR ID..."
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              className="flex-1 bg-[#0D0D0D] border border-white/10 px-6 py-4 text-white text-sm font-black placeholder:text-white/5 focus:outline-none focus:border-[#FF8C00]/50"
            />
            <div className="flex bg-black border border-white/10 p-1">
              {["ALL", "OPEN", "RESOLVED", "CLOSED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setMarketStatusFilter(s)}
                  className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                    marketStatusFilter === s ? "bg-[#FF8C00] text-black" : "text-white/20 hover:text-white"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-white/10 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  {[
                    { key: "contractMarketId", label: "ID" },
                    { key: "imageUrl", label: "VISUAL" },
                    { key: "title", label: "MODULE TITLE" },
                    { key: "status", label: "STATE" },
                    { key: "yesPool", label: "POOL YES" },
                    { key: "noPool", label: "POOL NO" },
                    { key: "outcome", label: "OUTCOME" },
                    { key: "payoutBps", label: "BPS" },
                    { key: "closeDate", label: "TERMINATION" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => toggleMarketSort(key as MarketSortKey)}
                      className="px-6 py-4 text-[9px] text-white/20 font-black uppercase tracking-widest cursor-pointer hover:text-[#FF8C00] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {label}
                        <SortIcon col={key as MarketSortKey} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-[9px] text-white/20 font-black uppercase tracking-widest">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr><td colSpan={9} className="px-6 py-20 text-center text-white/10 text-[10px] font-black uppercase">SYNCING DATA STREAM...</td></tr>
                ) : filteredAllMarkets.length === 0 ? (
                  <tr><td colSpan={9} className="px-6 py-20 text-center text-white/10 text-[10px] font-black uppercase">NO RECORDS FOUND</td></tr>
                ) : (
                  filteredAllMarkets.map((m) => (
                    <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-6 text-[11px] text-[#FF8C00] font-black italic">{m.contractMarketId}</td>
                      <td className="px-6 py-6">
                        {m.imageUrl ? (
                          <div className="w-12 h-8 border border-white/10 overflow-hidden relative">
                            <Image src={m.imageUrl} alt="" fill className="object-cover grayscale opacity-50" />
                          </div>
                        ) : (
                          <div className="w-12 h-8 border border-dashed border-white/5 flex items-center justify-center text-[6px] text-white/10 uppercase font-black">NO_DATA</div>
                        )}
                      </td>
                      <td className="px-6 py-6">
                        <div className="text-[12px] font-black text-white uppercase italic tracking-tighter truncate max-w-[200px]">{m.title}</div>
                      </td>
                      <td className="px-6 py-6">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border ${STATUS_STYLES[m.status]}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-[11px] font-black text-white/60">{m.yesPool} XLM</td>
                      <td className="px-6 py-6 text-[11px] font-black text-white/60">{m.noPool} XLM</td>
                      <td className="px-6 py-6">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 border ${m.outcome === "YES" ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5" : m.outcome === "NO" ? "text-red-500 border-red-500/30 bg-red-500/5" : "text-white/20 border-white/10 bg-transparent"}`}>
                          {m.outcome || "---"}
                        </span>
                      </td>
                      <td className="px-6 py-6 text-[11px] font-black text-white/60">
                        {m.payoutBps ? m.payoutBps : "---"}
                      </td>
                      <td className="px-6 py-6 text-[10px] font-black text-white/20">
                        {m.closeDate ? new Date(m.closeDate).toLocaleDateString().toUpperCase() : "---"}
                      </td>
                      <td className="px-6 py-6 text-right">
                        {m.status === "OPEN" && (
                          <button
                            onClick={() => { setActiveTab("resolution"); }}
                            className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 border border-[#FF8C00]/30 text-[#FF8C00] hover:bg-[#FF8C00] hover:text-black transition-all"
                          >
                            RESOLVE
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
        <div className="space-y-8">
          <div className="flex items-center justify-between bg-[#0D0D0D] border border-white/10 p-8">
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-[0.1em]">System Transaction Stream</h2>
              <p className="text-[9px] text-white/20 uppercase tracking-[0.3em] mt-1 font-bold">Monitor realtime sealed commitments</p>
            </div>
            <button
              onClick={() => setShowBetForm(!showBetForm)}
              className="px-8 py-3 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
            >
              {showBetForm ? "Abort Manual Entry" : "Initialize Manual Bet"}
            </button>
          </div>

          {showBetForm && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#0D0D0D] border border-[#FF8C00]/30 p-10">
              <form onSubmit={handleCreateBet} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block">Select Target Horizon</label>
                    <select
                      value={betFormData.marketId}
                      onChange={(e) => setBetFormData({ ...betFormData, marketId: e.target.value })}
                      required
                      className="w-full bg-black border border-white/10 px-4 py-4 text-white text-[11px] font-black uppercase focus:outline-none focus:border-[#FF8C00]/50 appearance-none"
                    >
                      <option value="">-- SELECT MARKET --</option>
                      {allMarkets.map((m) => (
                        <option key={m.id} value={m.id}>[{m.status}] {m.title.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block">AUTH_PUBLIC_KEY</label>
                    <input
                      type="text"
                      value={betFormData.userPublicKey}
                      onChange={(e) => setBetFormData({ ...betFormData, userPublicKey: e.target.value })}
                      placeholder="G..."
                      required
                      className="w-full bg-black border border-white/10 px-4 py-4 text-white text-[11px] font-black focus:outline-none focus:border-[#FF8C00]/50"
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block">INJECTION_AMOUNT_XLM</label>
                    <input
                      type="number" step="0.01" min="0.01"
                      value={betFormData.amount}
                      onChange={(e) => setBetFormData({ ...betFormData, amount: e.target.value })}
                      placeholder="0.00"
                      required
                      className="w-full bg-black border border-white/10 px-4 py-4 text-white text-[11px] font-black focus:outline-none focus:border-[#FF8C00]/50"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block">COMMITMENT_HASH_OVERRIDE</label>
                    <input
                      type="text"
                      value={betFormData.commitment}
                      onChange={(e) => setBetFormData({ ...betFormData, commitment: e.target.value })}
                      placeholder="AUTO_GENERATE_IF_EMPTY"
                      className="w-full bg-black border border-white/10 px-4 py-4 text-white text-[11px] font-black focus:outline-none focus:border-[#FF8C00]/50"
                    />
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button type="submit" disabled={creatingBet} className="flex-1 bg-[#FF8C00] text-black text-[11px] font-black uppercase tracking-[0.2em] py-4 hover:bg-white transition-all disabled:opacity-20">
                      {creatingBet ? "Injecting..." : "Execute Injection"}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}

          {betStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0D0D0D] border border-white/10 p-8">
                <div className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-3">TOTAL_VOLUME</div>
                <div className="text-3xl font-black text-white tracking-tighter">{betStats.totalVolume.toFixed(2)} XLM</div>
              </div>
              <div className="bg-[#0D0D0D] border border-white/10 p-8">
                <div className="text-[9px] text-[#FF8C00] font-black uppercase tracking-widest mb-3">BET_COUNT</div>
                <div className="text-3xl font-black text-[#FF8C00] tracking-tighter">{betStats.betCount}</div>
                <div className="text-[9px] text-white/20 mt-2 font-bold uppercase tracking-widest">
                  {betStats.sealedCount} SEALED // {betStats.revealedCount} REVEALED
                </div>
              </div>
              <div className="bg-[#0D0D0D] border border-white/10 p-8">
                <div className="text-[9px] text-blue-400 font-black uppercase tracking-widest mb-3">AVG_SIZE</div>
                <div className="text-3xl font-black text-blue-400 tracking-tighter">{betStats.avgBetSize.toFixed(2)} XLM</div>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block pl-1">FILTER_BY_MARKET</label>
              <select
                value={selectedMarketFilter}
                onChange={(e) => setSelectedMarketFilter(e.target.value)}
                className="w-full bg-[#0D0D0D] border border-white/10 px-6 py-4 text-white text-[11px] font-black uppercase focus:outline-none focus:border-[#FF8C00]/50 appearance-none"
              >
                <option value="all">ALL_HORIZONS</option>
                {allMarkets.map((m) => (
                  <option key={m.id} value={m.id}>[{m.status}] {m.title.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <div>
                <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block pl-1">SORT_BY</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "amount" | "createdAt")}
                  className="bg-[#0D0D0D] border border-white/10 px-6 py-4 text-white text-[11px] font-black uppercase focus:outline-none focus:border-[#FF8C00]/50 appearance-none min-w-[140px]"
                >
                  <option value="createdAt">TIMESTAMP</option>
                  <option value="amount">VALUE</option>
                </select>
              </div>
              <div>
                <label className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-2 block pl-1">ORDER</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                  className="bg-[#0D0D0D] border border-white/10 px-6 py-4 text-white text-[11px] font-black uppercase focus:outline-none focus:border-[#FF8C00]/50 appearance-none min-w-[140px]"
                >
                  <option value="desc">DESCENDING</option>
                  <option value="asc">ASCENDING</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[#0D0D0D] border border-white/10">
            <BetManagementTable
              bets={bets}
              loading={betsLoading}
              onSort={(sb, so) => { setSortBy(sb); setSortOrder(so); }}
              onFilter={(marketId) => setSelectedMarketFilter(marketId)}
            />
          </div>
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
