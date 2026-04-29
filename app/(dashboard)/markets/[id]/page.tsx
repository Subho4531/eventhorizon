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
  Zap,
  XCircle,
  Activity,
  Layers,
} from "lucide-react";
import Image from "next/image";
import { useWallet } from "@/components/WalletProvider";
import MarketChart from "@/components/MarketChart";
import { Progress } from "@/components/ui/progress";
import RiskAlert from "@/components/RiskAlert";
import {
  placeBet as placeBetOnChain,
  submitSignedXdr,
  getOnchainEscrowBalance,
  getMarket,
} from "@/lib/escrow";

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
  imageUrl?: string | null;
}

interface MarketIntelligence {
  probability?: number;
  qualityScore?: number;
  manipulationScore?: number;
  riskFlags?: string[];
  confidence?: number;
  sources?: string[];
}

interface Activity {
  id: string;
  amount: number;
  createdAt: string;
  user?: { publicKey: string; name?: string | null };
}

const CATEGORY_COLORS: Record<string, { text: string; border: string; bg: string; glow: string }> = {
  Crypto: { text: "text-[#FF8C00]", border: "border-[#FF8C00]/30", bg: "bg-[#FF8C00]/5", glow: "rgba(255,140,0,0.15)" },
  Finance: { text: "text-[#00C853]", border: "border-[#00C853]/30", bg: "bg-[#00C853]/5", glow: "rgba(0,200,83,0.15)" },
  Technology: { text: "text-[#2979FF]", border: "border-[#2979FF]/30", bg: "bg-[#2979FF]/5", glow: "rgba(41,121,255,0.15)" },
  Politics: { text: "text-[#FFD700]", border: "border-[#FFD700]/30", bg: "bg-[#FFD700]/5", glow: "rgba(255,215,0,0.15)" },
  Sports: { text: "text-[#F50057]", border: "border-[#F50057]/30", bg: "bg-[#F50057]/5", glow: "rgba(245,0,87,0.15)" },
};

const DEFAULT_CAT = { text: "text-white/40", border: "border-white/10", bg: "bg-white/5", glow: "rgba(255,255,255,0.1)" };

function truncKey(key: string) {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
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
  const [betStatus, setBetStatus] = useState("");
  const [hasBet, setHasBet] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/markets/${id}`);
        if (!res.ok) throw new Error("Not found");
        const m: Market = await res.json();
        setMarket(m);

        const [probRes, qualityRes, riskRes, betsRes] = await Promise.allSettled([
          fetch(`/api/markets/${id}/probability`),
          fetch(`/api/markets/${id}/quality`),
          fetch(`/api/markets/${id}/risk`),
          fetch(`/api/bets?marketId=${id}&limit=10&sortBy=createdAt&sortOrder=desc`),
        ]);

        const intel: MarketIntelligence = {};
        if (probRes.status === "fulfilled" && probRes.value.ok) {
          const p = await probRes.value.json();
          intel.probability = p.probability;
          intel.confidence = p.confidence;
          intel.sources = p.sources;
        }
        if (qualityRes.status === "fulfilled" && qualityRes.value.ok)
          intel.qualityScore = (await qualityRes.value.json()).score;
        if (riskRes.status === "fulfilled" && riskRes.value.ok) {
          const r = await riskRes.value.json();
          intel.manipulationScore = r.score;
          intel.riskFlags = r.flags?.map((f: { type: string }) => f.type) ?? [];
        }
        setIntelligence(intel);

        if (betsRes.status === "fulfilled" && betsRes.value.ok) {
          const betsData = await betsRes.value.json();
          const bets = betsData.bets ?? [];
          setActivity(bets);
          if (publicKey) {
            setHasBet(bets.some((b: { userPublicKey: string }) => b.userPublicKey === publicKey));
          }
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, publicKey]);

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
    if (hasBet) { setBetError("You already have an open position on this market."); return; }
    if (!market.contractMarketId) { setBetError("Market has no on-chain ID. Cannot place bet."); return; }
    const stake = parseFloat(amount);
    if (isNaN(stake) || stake < 1) { setBetError("Minimum bet is 1 XLM."); return; }

    setSubmitting(true);
    setBetError("");
    setBetSuccess(false);
    setBetStatus("Checking escrow balance...");

    try {
      const escrowBal = await getOnchainEscrowBalance(publicKey);
      if (escrowBal < stake) {
        throw new Error(`Insufficient escrow balance. You have ${escrowBal.toFixed(4)} XLM. Deposit more from your Portfolio.`);
      }

      const onchainMarket = await getMarket(market.contractMarketId);
      if (!onchainMarket) {
        throw new Error(`Market not found on the smart contract (ID: ${market.contractMarketId}).`);
      }
      
      const isStatusOpen = onchainMarket.status === 0 || onchainMarket.status === "Open";
      if (!isStatusOpen) {
        throw new Error(`Market is no longer open for betting (Status: ${onchainMarket.status}).`);
      }

      setBetStatus("Generating ZK commitment...");
      const sideNum = side === "YES" ? 0 : 1;
      const nonce = Math.floor(Math.random() * 2 ** 32).toString();
      const bettorKeyNum = parseInt(publicKey.slice(1, 9), 36).toString();

      const snarkjs = await import("snarkjs");
      const { publicSignals: sealSignals } = await snarkjs.groth16.fullProve(
        { side: sideNum.toString(), nonce, bettor_key: bettorKeyNum },
        "/circuit/seal/seal_bet.wasm",
        "/circuit/seal/seal_0001.zkey"
      );

      const commitmentHash = sealSignals[0];

      setBetStatus("Building on-chain transaction...");
      const res = await placeBetOnChain(publicKey, market.contractMarketId, commitmentHash, stake);
      if (!res.success || !res.unsignedXdr) throw new Error("Failed to build place_bet transaction");

      setBetStatus("Waiting for Freighter signature...");
      const { signTransaction } = await import("@stellar/freighter-api");
      const networkPassphrase = "Test SDF Network ; September 2015";
      const signResult = await signTransaction(res.unsignedXdr, { networkPassphrase });
      let signedXdr = "";
      if (typeof signResult === "string") signedXdr = signResult;
      else if (signResult && "signedTxXdr" in signResult) signedXdr = (signResult as { signedTxXdr: string }).signedTxXdr;
      if (!signedXdr) throw new Error("Freighter returned unexpected response");

      setBetStatus("Submitting to Soroban...");
      const submitRes = await submitSignedXdr(signedXdr);
      if (!submitRes.hash) throw new Error("Transaction submission failed");

      setBetStatus("Recording bet...");
      const dbRes = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          userPublicKey: publicKey,
          amount: stake,
          side,
          commitment: commitmentHash,
          txHash: submitRes.hash,
        }),
      });

      if (!dbRes.ok) {
        const d = await dbRes.json();
        if (dbRes.status === 409) {
          setHasBet(true);
        } else {
          console.error("DB indexing warning:", d.error);
        }
      } else {
        setHasBet(true);
      }

      const portfolioEntry = {
        marketId: market.id,
        contractMarketId: market.contractMarketId,
        marketTitle: market.title,
        side: sideNum,
        nonce,
        bettorKey: publicKey,
        commitment: commitmentHash,
        amount: stake.toString(),
        txHash: submitRes.hash,
        status: "SEALED",
      };
      const existing = JSON.parse(localStorage.getItem("zk_portfolio") || "[]");
      existing.push(portfolioEntry);
      localStorage.setItem("zk_portfolio", JSON.stringify(existing));

      setBetSuccess(true);
      setBetStatus("");
      setAmount("50");
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to place bet.";
      if (msg.toLowerCase().includes("user declined") || msg.toLowerCase().includes("rejected")) {
        setBetError("Signature rejected in Freighter.");
      } else {
        setBetError(msg.length > 120 ? msg.slice(0, 120) + "..." : msg);
      }
      setBetStatus("");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl border border-[#FF8C00]/20 bg-[#FF8C00]/[0.03] flex items-center justify-center relative">
            <Loader2 className="w-8 h-8 text-[#FF8C00]/60 animate-spin" />
            <div className="absolute inset-0 bg-[#FF8C00]/10 blur-xl animate-pulse rounded-full" />
          </div>
          <span className="text-[10px] text-[#FF8C00]/50 uppercase tracking-[0.2em] font-semibold">Initializing Market Data...</span>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 font-mono">
        <div className="w-16 h-16 rounded-2xl border border-red-500/30 flex items-center justify-center bg-red-500/10 relative">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="absolute inset-0 bg-red-500/20 blur-xl animate-pulse rounded-full" />
        </div>
        <div className="text-center">
          <p className="text-white font-black tracking-tighter text-xl uppercase mb-2">ERR_404: MARKET_NOT_FOUND</p>
          <p className="text-white/40 text-xs max-w-xs mx-auto uppercase">The requested data module is unavailable or archived.</p>
        </div>
        <button
          onClick={() => router.push("/markets")}
          className="mt-4 px-6 py-3 border border-white/10 rounded-xl text-[10px] text-white/60 font-bold uppercase hover:bg-white/5 hover:text-white transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Return_To_Terminal
        </button>
      </div>
    );
  }

  const odds = calcOdds(market.yesPool, market.noPool);
  const catColors = CATEGORY_COLORS[market.category] ?? DEFAULT_CAT;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24">
      {/* Back nav */}
      <button
        onClick={() => router.push("/markets")}
        className="flex items-center gap-2.5 text-white/40 hover:text-[#FF8C00] text-[11px] font-bold mb-8 transition-colors group tracking-wide uppercase"
      >
        <div className="w-6 h-6 rounded-lg bg-white/[0.03] flex items-center justify-center group-hover:bg-[#FF8C00]/10 transition-colors">
          <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
        </div>
        Back to Markets
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px] gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-8 min-w-0">
          {/* Market header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-white/[0.06] bg-[#0A0A0A] relative overflow-hidden rounded-3xl"
          >
            {/* Ambient category glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none opacity-20 transition-opacity duration-1000" style={{ backgroundColor: catColors.text.replace('text-[', '').replace(']', '') }} />
            
            {/* Market Image Hero */}
            {market.imageUrl && (
              <div className="relative w-full h-[280px] sm:h-[360px] overflow-hidden group">
                <Image 
                  src={market.imageUrl} 
                  alt={market.title}
                  fill
                  className="object-cover object-top group-hover:scale-105 transition-transform duration-[1200ms] ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
              </div>
            )}

            <div className={`p-6 sm:p-10 relative z-10 ${!market.imageUrl ? "pt-10" : "-mt-20"}`}>
              <div className="flex flex-wrap items-center gap-3 mb-6">
                <span className={`text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg ${catColors.text} ${catColors.border} ${catColors.bg}`}>
                  {market.category}
                </span>
                <span
                  className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg ${
                    market.status === "OPEN"
                      ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/10"
                      : "text-white/30 bg-white/5 border-white/10"
                  }`}
                >
                  {market.status === "OPEN" && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00C853] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00C853]" />
                    </span>
                  )}
                  {market.status}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.1] mb-6 tracking-tight drop-shadow-md">
                {market.title}
              </h1>

              {market.description && (
                <p className="text-[15px] text-white/50 leading-relaxed max-w-3xl border-l-[3px] border-[#FF8C00]/40 pl-5 mb-8 font-medium">
                  {market.description}
                </p>
              )}

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-white/[0.06]">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-[9px] text-white/30 uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3 h-3" /> Closes
                  </span>
                  <div className="text-[13px] text-white font-semibold">
                    {new Date(market.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-[#FF8C00]/[0.02] border border-[#FF8C00]/10">
                  <span className="text-[9px] text-[#FF8C00]/60 uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3 h-3" /> Volume
                  </span>
                  <div className="text-[13px] text-[#FF8C00] font-bold font-mono">
                    {(market.totalVolume || 0).toLocaleString()} <span className="text-[10px] opacity-60">XLM</span>
                  </div>
                </div>
                {market.contractMarketId && (
                  <div className="p-4 rounded-2xl bg-[#00F2FF]/[0.02] border border-[#00F2FF]/10 sm:col-span-2">
                    <span className="text-[9px] text-[#00F2FF]/60 uppercase font-bold tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3 h-3" /> Smart Contract
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="text-[13px] text-white font-mono bg-white/[0.05] px-2 py-0.5 rounded-md">ID: {market.contractMarketId}</div>
                      <div className="text-[11px] text-[#00F2FF] font-semibold flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Verified Escrow
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Probability Chart Module */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="border border-white/[0.06] bg-[#0A0A0A] p-6 sm:p-8 rounded-3xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <Activity className="w-5 h-5 text-white/50" />
                </div>
                <div>
                  <h2 className="text-[13px] font-bold tracking-wide text-white">Probability Chart</h2>
                  <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">Historical Odds</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-white/[0.02] p-2 px-4 rounded-xl border border-white/[0.04]">
                <span className="flex items-center gap-2 text-[11px] font-black tracking-wider text-[#FF8C00] font-mono">
                  <div className="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse" />
                  YES {odds.yes}%
                </span>
                <div className="w-px h-4 bg-white/10" />
                <span className="flex items-center gap-2 text-[11px] font-black tracking-wider text-white/50 font-mono">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  NO {odds.no}%
                </span>
              </div>
            </div>
            
            <div className="h-[320px] rounded-2xl overflow-hidden border border-white/[0.04] bg-[#050505] p-4">
              <MarketChart marketId={market.id} yesPool={market.yesPool} noPool={market.noPool} />
            </div>
          </motion.div>

          {/* Intelligence Modules */}
          {(intelligence.manipulationScore || intelligence.probability !== undefined) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {intelligence.probability !== undefined && intelligence.probability > 0 && (() => {
                const prob = intelligence.probability!;
                const confidence = intelligence.confidence ?? 0;
                const sources: string[] = intelligence.sources ?? [];
                const isPoolOnly = !sources.includes("historical") && !sources.includes("external");
                const pct = (prob * 100).toFixed(1);
                
                return (
                  <div className="border border-blue-500/20 bg-blue-500/[0.03] p-8 relative overflow-hidden rounded-3xl hover:bg-blue-500/[0.05] transition-colors group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.05] blur-3xl rounded-full group-hover:bg-blue-500/[0.1] transition-all" />
                    
                    <div className="flex items-start gap-5 relative z-10">
                      <div className="w-14 h-14 border border-blue-500/30 flex items-center justify-center bg-blue-500/10 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                        <Brain className="w-7 h-7 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400/80">
                            {isPoolOnly ? "Pool Signal" : "AI Inference"}
                          </p>
                          {!isPoolOnly && <div className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[8px] font-bold uppercase tracking-wider">Active</div>}
                        </div>
                        <p className="text-4xl font-black text-white mb-2 tracking-tight">
                          {pct}%
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium tracking-wide">
                          <Layers className="w-3 h-3" />
                          {isPoolOnly
                            ? "Source: On-chain Liquidity"
                            : `Confidence: ${Math.round(confidence * 100)}% · Multi-source`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              {intelligence.manipulationScore !== undefined && intelligence.manipulationScore >= 50 && (
                <div className="h-full">
                  <RiskAlert
                    score={intelligence.manipulationScore}
                    flags={intelligence.riskFlags}
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="border border-white/[0.06] bg-[#0A0A0A] p-6 sm:p-8 rounded-3xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Users className="w-5 h-5 text-white/50" />
              </div>
              <div>
                <h2 className="text-[13px] font-bold tracking-wide text-white">Recent Activity</h2>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">Live On-chain Transactions</p>
              </div>
            </div>
            
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border border-white/[0.04] bg-white/[0.01] rounded-2xl border-dashed">
                <Activity className="w-6 h-6 text-white/10 mb-3" />
                <p className="text-[11px] text-white/20 font-bold tracking-[0.1em] uppercase">
                  No activity detected
                </p>
                <p className="text-[9px] text-white/15 mt-1">Be the first to trade on this market.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activity.map((a, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    key={a.id}
                    className="flex items-center justify-between py-4 px-5 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.06] transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center border border-white/[0.05]">
                        <Users className="w-3.5 h-3.5 text-white/40" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Trader</span>
                        <span className="text-white/80 font-bold text-xs font-mono group-hover:text-white transition-colors">
                          {truncKey(a.user?.publicKey ?? "UNKNOWN")}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Amount</span>
                        <span className="text-[#FF8C00] font-black text-sm flex items-center gap-1 font-mono">
                          {a.amount.toLocaleString()} <span className="text-[9px] text-[#FF8C00]/60">XLM</span>
                        </span>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-0.5 min-w-[80px]">
                        <span className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Time</span>
                        <span className="text-white/40 font-semibold text-[11px]">
                          {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN: Trade Terminal ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6 lg:sticky lg:top-[100px] self-start"
        >
          {/* Probability Module */}
          <div className="border border-white/[0.06] bg-[#0A0A0A] p-6 rounded-3xl space-y-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Market Odds
            </h2>
            <div className="space-y-4">
              <Progress
                value={odds.yes}
                label="YES"
                textClass="text-[#FF8C00]"
                indicatorClass="bg-gradient-to-r from-[#FF8C00]/40 to-[#FF8C00]/80 shadow-[0_0_15px_rgba(255,140,0,0.3)]"
                className="h-9 bg-white/[0.02]"
              />
              <Progress
                value={odds.no}
                label="NO"
                textClass="text-white/50"
                indicatorClass="bg-white/10"
                className="h-9 bg-white/[0.02]"
              />
            </div>
          </div>

          {/* Trade Terminal */}
          <div className="border border-[#FF8C00]/30 bg-[#0A0A0A] rounded-3xl p-1 relative overflow-hidden shadow-[0_0_40px_rgba(255,140,0,0.05)]">
            {/* Header scanning effect */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#FF8C00]/80 to-transparent animate-scan pointer-events-none opacity-50" />
            
            <div className="bg-[#050505] rounded-[22px] p-6 space-y-8 relative z-10 border border-[#FF8C00]/10">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#FF8C00] flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FF8C00]" fill="currentColor" fillOpacity={0.2} />
                  Execution Terminal
                </h2>
                <div className="flex items-center gap-1.5 px-2 py-1 bg-[#00C853]/10 border border-[#00C853]/20 rounded-md">
                  <div className="w-1.5 h-1.5 bg-[#00C853] animate-pulse rounded-full" />
                  <span className="text-[8px] text-[#00C853] font-bold uppercase tracking-wider">Live</span>
                </div>
              </div>

              {hasBet && market.status === "OPEN" && (
                <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-[10px] text-white/50 uppercase font-bold leading-relaxed tracking-wider">
                  <AlertCircle className="w-4 h-4 mb-2 opacity-50" />
                  Status Log: Position already open. Multiple positions on the same market are disabled for security.
                </div>
              )}

              {market.status !== "OPEN" ? (
                <div className="text-center py-12 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4">
                  <div className="w-14 h-14 rounded-full bg-white/[0.05] flex items-center justify-center mx-auto">
                    <XCircle className="w-7 h-7 text-white/20" />
                  </div>
                  <div>
                    <p className="text-[12px] text-white/40 font-black uppercase tracking-[0.2em]">
                      Terminal Locked
                    </p>
                    <p className="text-[10px] text-white/20 mt-1 uppercase tracking-wider">Market has resolved</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Side selector */}
                  <div className="grid grid-cols-2 gap-3 bg-white/[0.02] p-1.5 rounded-2xl border border-white/[0.04]">
                    {(["YES", "NO"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSide(opt)}
                        className={`relative py-3.5 rounded-xl transition-all font-black uppercase text-[12px] tracking-[0.2em] overflow-hidden ${
                          side === opt
                            ? opt === "YES"
                              ? "bg-gradient-to-b from-[#FF8C00] to-[#E67E22] text-black shadow-[0_4px_20px_rgba(255,140,0,0.25)] border border-transparent"
                              : "bg-white text-black shadow-[0_4px_20px_rgba(255,255,255,0.2)] border border-transparent"
                            : "bg-transparent border border-white/[0.08] text-white/30 hover:bg-white/[0.05] hover:text-white/60"
                        }`}
                      >
                        <span className="relative z-10">{opt}</span>
                      </button>
                    ))}
                  </div>

                  {/* Amount input */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] text-white/40 uppercase font-bold tracking-[0.15em]">
                        Stake Amount
                      </label>
                      <span className="text-[9px] text-[#FF8C00]/60 uppercase font-bold tracking-wider">Max Limit: 5,000</span>
                    </div>
                    
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#FF8C00]/20 to-transparent blur-md opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl" />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={amount}
                        onChange={(e) => { setAmount(e.target.value); setBetError(""); setBetSuccess(false); }}
                        className="relative w-full bg-[#000000] border-2 border-white/[0.08] rounded-xl px-5 py-4 text-white text-xl font-black font-mono focus:outline-none focus:border-[#FF8C00]/60 transition-colors shadow-inner"
                        placeholder="0"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                        <div className="w-px h-6 bg-white/10" />
                        <span className="text-[11px] text-white/50 font-black uppercase tracking-widest">XLM</span>
                      </div>
                    </div>

                    {/* Quick amounts */}
                    <div className="grid grid-cols-4 gap-2">
                      {["10", "50", "100", "MAX"].map((q) => (
                        <button
                          key={q}
                          onClick={() => setAmount(q === "MAX" ? "5000" : q)}
                          className="py-2.5 rounded-lg text-[10px] font-black uppercase border border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white hover:border-[#FF8C00]/40 hover:bg-[#FF8C00]/10 transition-all font-mono"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payout data */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-white/40 uppercase font-bold tracking-wider">Est. Return</span>
                      <span className="text-[#00C853] font-black text-sm font-mono bg-[#00C853]/10 px-2 py-0.5 rounded border border-[#00C853]/20">
                        +{potentialPayout()} XLM
                      </span>
                    </div>
                    <div className="h-px w-full bg-white/[0.06]" />
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-white/40 uppercase font-bold tracking-wider">Fill Probability</span>
                      <span className="text-white font-black font-mono">
                        {side === "YES" ? odds.yes : odds.no}%
                      </span>
                    </div>
                  </div>

                  {/* Status messages */}
                  <AnimatePresence mode="wait">
                    {betError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-[10px] font-bold uppercase leading-relaxed flex gap-3"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{betError}</span>
                      </motion.div>
                    )}
                    {betSuccess && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl border border-[#00C853]/30 bg-[#00C853]/10 text-[#00C853] text-[10px] font-bold uppercase leading-relaxed flex gap-3"
                      >
                        <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Position cryptographically sealed on-chain.</span>
                      </motion.div>
                    )}
                    {betStatus && !betError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase flex items-center gap-3"
                      >
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {betStatus}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Execute Button */}
                  <button
                    onClick={handleBet}
                    disabled={submitting || !publicKey || hasBet}
                    className={`group relative w-full py-5 rounded-xl font-black uppercase text-[12px] tracking-[0.25em] transition-all overflow-hidden border ${
                      hasBet
                        ? "border-white/10 text-white/30 cursor-not-allowed bg-white/[0.04]"
                        : side === "YES"
                        ? "border-transparent bg-gradient-to-r from-[#FF8C00] to-[#E67E22] text-black shadow-[0_0_30px_rgba(255,140,0,0.3)] hover:brightness-110"
                        : "border-transparent bg-gradient-to-r from-white to-white/90 text-black shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:brightness-110"
                    } disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95`}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing Transaction...
                        </>
                      ) : hasBet ? (
                        "Position Sealed"
                      ) : !publicKey ? (
                        "Connect Wallet to Trade"
                      ) : (
                        <>
                          Execute Buy {side}
                          <ArrowLeft className="w-4 h-4 rotate-135" />
                        </>
                      )}
                    </span>
                    
                    {/* Hover shimmer */}
                    {!submitting && !hasBet && publicKey && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Module Specs */}
          <div className="border border-white/[0.06] bg-[#0A0A0A] p-6 rounded-3xl space-y-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 flex items-center gap-2">
              <Shield className="w-3 h-3" /> Contract Specifications
            </h3>
            <div className="space-y-3 text-[11px] font-medium tracking-wide">
              {market.contractMarketId && (
                <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                  <span className="text-white/40 uppercase text-[9px] tracking-wider">Module ID</span>
                  <span className="text-white font-mono bg-white/[0.03] px-2 py-0.5 rounded">0x00{market.contractMarketId}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                <span className="text-white/40 uppercase text-[9px] tracking-wider">Bond Stake</span>
                <span className="text-white font-mono bg-white/[0.03] px-2 py-0.5 rounded">{market.bondAmount ?? 100} XLM</span>
              </div>
              {market.oracleAddress && (
                <div className="flex justify-between items-center border-b border-white/[0.04] pb-3">
                  <span className="text-white/40 uppercase text-[9px] tracking-wider">Oracle Relay</span>
                  <span className="text-white font-mono bg-white/[0.03] px-2 py-0.5 rounded truncate max-w-[120px]">{truncKey(market.oracleAddress)}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase text-[9px] tracking-wider">Network</span>
                <span className="text-[#00C853] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00C853]" />
                  Stellar Testnet
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
