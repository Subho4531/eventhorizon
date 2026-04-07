"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  Brain,
  Shield,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import MarketChart from "@/components/MarketChart";
import { Progress } from "@/components/ui/progress";
import QualityIndicator from "@/components/QualityIndicator";
import RiskAlert from "@/components/RiskAlert";

interface Market {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  status: string;
  yesPool: number;
  noPool: number;
  totalVolume: number;
  closeDate: string;
  contractMarketId?: number | null;
  bondAmount?: number;
  oracleAddress?: string;
}

interface MarketIntelligence {
  probability?: number;
  qualityScore?: number;
  manipulationScore?: number;
  riskFlags?: string[];
}

interface Activity {
  id: string;
  amount: number;
  createdAt: string;
  user?: { publicKey: string; name?: string | null };
}

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  Finance: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  Technology: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  Politics: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  Sports: "text-rose-400 bg-rose-500/10 border-rose-500/30",
};

function truncKey(key: string) {
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { publicKey } = useWallet();

  const [market, setMarket] = useState<Market | null>(null);
  const [intelligence, setIntelligence] = useState<MarketIntelligence>({});
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Bet form state
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("50");
  const [submitting, setSubmitting] = useState(false);
  const [betError, setBetError] = useState("");
  const [betSuccess, setBetSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/markets/${id}`);
        if (!res.ok) throw new Error("Not found");
        const m: Market = await res.json();
        setMarket(m);

        // Parallel intelligence + activity fetches
        const [probRes, qualityRes, riskRes, betsRes] = await Promise.allSettled([
          fetch(`/api/markets/${id}/probability`),
          fetch(`/api/markets/${id}/quality`),
          fetch(`/api/markets/${id}/risk`),
          fetch(`/api/bets?marketId=${id}&limit=10&sortBy=createdAt&sortOrder=desc`),
        ]);

        const intel: MarketIntelligence = {};
        if (probRes.status === "fulfilled" && probRes.value.ok)
          intel.probability = (await probRes.value.json()).probability;
        if (qualityRes.status === "fulfilled" && qualityRes.value.ok)
          intel.qualityScore = (await qualityRes.value.json()).score;
        if (riskRes.status === "fulfilled" && riskRes.value.ok) {
          const r = await riskRes.value.json();
          intel.manipulationScore = r.score;
          intel.riskFlags = r.flags?.map((f: { type: string }) => f.type) ?? [];
        }
        setIntelligence(intel);

        if (betsRes.status === "fulfilled" && betsRes.value.ok)
          setActivity((await betsRes.value.json()).bets ?? []);
      } catch {
        // market stays null → error state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const calcOdds = (yes: number, no: number) => {
    const t = yes + no;
    if (t === 0) return { yes: 50, no: 50 };
    return { yes: Math.round((yes / t) * 100), no: Math.round((no / t) * 100) };
  };

  const potentialPayout = () => {
    if (!market) return "0";
    const stake = parseFloat(amount) || 0;
    const { yes, no } = calcOdds(market.yesPool, market.noPool);
    const prob = side === "YES" ? yes / 100 : no / 100;
    if (prob === 0) return "∞";
    return ((stake / prob) - stake).toFixed(2);
  };

  const handleBet = async () => {
    if (!publicKey) { setBetError("Connect your wallet first."); return; }
    if (!market) return;
    const stake = parseFloat(amount);
    if (isNaN(stake) || stake < 1) { setBetError("Minimum bet is 1 XLM."); return; }

    setSubmitting(true);
    setBetError("");
    setBetSuccess(false);

    try {
      // commitment = deterministic hash of side+amount+key (simplified for demo)
      const commitment = `${side}:${stake}:${publicKey}:${Date.now()}`;

      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          userPublicKey: publicKey,
          amount: stake,
          side,
          commitment,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Bet failed");
      }

      setBetSuccess(true);
      setAmount("50");
      // Optimistically update pool
      setMarket((prev) =>
        prev
          ? {
              ...prev,
              yesPool: side === "YES" ? prev.yesPool + stake : prev.yesPool,
              noPool: side === "NO" ? prev.noPool + stake : prev.noPool,
              totalVolume: prev.totalVolume + stake,
            }
          : prev
      );
      setTimeout(() => setBetSuccess(false), 4000);
    } catch (e: any) {
      setBetError(e.message || "Failed to place bet.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-10 h-10 text-white/20" />
        <p className="text-white/40 uppercase tracking-widest text-sm">Market not found</p>
        <button
          onClick={() => router.push("/markets")}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          ← Back to markets
        </button>
      </div>
    );
  }

  const odds = calcOdds(market.yesPool, market.noPool);
  const catColor = CATEGORY_COLORS[market.category] ?? "text-white/60 bg-white/5 border-white/10";

  return (
    <div className="w-full max-w-7xl mx-auto px-0 pt-8 pb-24">
      {/* Back nav */}
      <button
        onClick={() => router.push("/markets")}
        className="flex items-center gap-2 text-white/40 hover:text-white text-xs uppercase tracking-widest font-semibold mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Markets
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">
          {/* Market header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/3 border border-white/8 rounded-2xl p-6 space-y-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${catColor}`}>
                {market.category}
              </span>
              <span
                className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                  market.status === "OPEN"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                    : "text-white/30 bg-white/5 border-white/10"
                }`}
              >
                {market.status === "OPEN" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {market.status}
              </span>
              {intelligence.qualityScore !== undefined && (
                <QualityIndicator score={intelligence.qualityScore} size="sm" />
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-semibold text-white leading-snug">
              {market.title}
            </h1>

            {market.description && (
              <p className="text-sm text-white/50 leading-relaxed">{market.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-white/5">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Clock className="w-3.5 h-3.5" />
                Closes {new Date(market.closeDate).toLocaleDateString("en-US", { dateStyle: "long" })}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <TrendingUp className="w-3.5 h-3.5" />
                {(market.totalVolume || 0).toLocaleString()} XLM volume
              </div>
              {market.contractMarketId && (
                <div className="flex items-center gap-1.5 text-xs text-white/40">
                  <Shield className="w-3.5 h-3.5" />
                  On-chain #{market.contractMarketId}
                </div>
              )}
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 }}
            className="bg-white/3 border border-white/8 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-white/60">
                Probability History
              </h2>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1.5 text-blue-400 font-bold">
                  <span className="w-3 h-0.5 bg-blue-400 rounded" />
                  YES {odds.yes}%
                </span>
                <span className="flex items-center gap-1.5 text-rose-400 font-bold">
                  <span className="w-3 h-0.5 bg-rose-400 rounded" />
                  NO {odds.no}%
                </span>
              </div>
            </div>
            <MarketChart marketId={market.id} yesPool={market.yesPool} noPool={market.noPool} />
          </motion.div>

          {/* Risk / Intelligence alerts */}
          {(intelligence.manipulationScore || intelligence.probability !== undefined) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {intelligence.probability !== undefined && (
                <div className="bg-purple-500/8 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-4">
                  <Brain className="w-8 h-8 text-purple-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">
                      AI Probability
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {(intelligence.probability * 100).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-white/40">YES likelihood</p>
                  </div>
                </div>
              )}
              {intelligence.manipulationScore !== undefined && intelligence.manipulationScore >= 50 && (
                <RiskAlert
                  score={intelligence.manipulationScore}
                  flags={intelligence.riskFlags}
                />
              )}
            </motion.div>
          )}

          {/* Activity feed */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white/3 border border-white/8 rounded-2xl p-6 space-y-4"
          >
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Recent Activity
            </h2>
            {activity.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-8">
                No trades yet — be the first.
              </p>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-xs text-white/60 py-2 border-b border-white/5 last:border-0"
                  >
                    <span className="font-mono text-white/40">
                      {truncKey(a.user?.publicKey ?? "Unknown")}
                    </span>
                    <span className="text-white/80 font-semibold">
                      {a.amount.toLocaleString()} XLM
                    </span>
                    <span className="text-white/30">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN: Bet Panel ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          {/* Odds summary */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/60">
              Current Odds
            </h2>
            <Progress
              value={odds.yes}
              label="YES"
              textClass="text-blue-400"
              indicatorClass="bg-blue-500/20"
            />
            <Progress
              value={odds.no}
              label="NO"
              textClass="text-rose-400"
              indicatorClass="bg-rose-500/20"
            />
          </div>

          {/* Bet form */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-5 space-y-5 sticky top-6">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-white/60 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Place Trade
            </h2>

            {market.status !== "OPEN" ? (
              <div className="text-center py-8 space-y-2">
                <XCircle className="w-8 h-8 text-white/20 mx-auto" />
                <p className="text-xs text-white/30 uppercase tracking-widest">
                  Market Closed
                </p>
              </div>
            ) : (
              <>
                {/* Side selector */}
                <div className="flex gap-2">
                  {(["YES", "NO"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSide(opt)}
                      className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-widest border transition-all ${
                        side === opt
                          ? opt === "YES"
                            ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/20"
                            : "bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/20"
                          : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/70"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {/* Amount input */}
                <div className="space-y-2">
                  <label className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
                    Amount (XLM)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setBetError(""); setBetSuccess(false); }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                      placeholder="50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white/30 font-semibold">
                      XLM
                    </span>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex gap-2">
                    {["10", "50", "100", "500"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(q)}
                        className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/30 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payout estimate */}
                <div className="bg-white/3 border border-white/6 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-white/40">
                    <span>Potential Profit</span>
                    <span className="text-emerald-400 font-bold">+{potentialPayout()} XLM</span>
                  </div>
                  <div className="flex justify-between text-white/40">
                    <span>Win Probability</span>
                    <span className="font-bold text-white/60">
                      {side === "YES" ? odds.yes : odds.no}%
                    </span>
                  </div>
                </div>

                {/* Error / success */}
                <AnimatePresence>
                  {betError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl p-3"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="text-xs">{betError}</span>
                    </motion.div>
                  )}
                  {betSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-semibold">
                        Bet placed — position sealed on-chain ✓
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  onClick={handleBet}
                  disabled={submitting || !publicKey}
                  className={`w-full py-4 rounded-xl text-sm font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 ${
                    side === "YES"
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                      : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
                  } disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]`}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sealing Bet…
                    </>
                  ) : !publicKey ? (
                    "Connect Wallet to Trade"
                  ) : (
                    `Buy ${side} · ${amount} XLM`
                  )}
                </button>

                {!publicKey && (
                  <p className="text-center text-[10px] text-white/30 uppercase tracking-widest">
                    Wallet connection required
                  </p>
                )}
              </>
            )}
          </div>

          {/* Contract info */}
          <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Contract Info
            </h3>
            <div className="space-y-2 text-[10px] text-white/40">
              {market.contractMarketId && (
                <div className="flex justify-between">
                  <span>Market ID</span>
                  <span className="font-mono text-white/60">#{market.contractMarketId}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Bond</span>
                <span className="font-mono text-white/60">{market.bondAmount ?? 100} XLM</span>
              </div>
              {market.oracleAddress && (
                <div className="flex justify-between">
                  <span>Oracle</span>
                  <span className="font-mono text-white/60">{truncKey(market.oracleAddress)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Network</span>
                <span className="font-mono text-white/60">Stellar Testnet</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
