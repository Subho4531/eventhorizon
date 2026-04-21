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

const CATEGORY_COLORS: Record<string, string> = {
  Crypto: "text-[#FF8C00] border-[#FF8C00]/30 bg-[#FF8C00]/5",
  Finance: "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5",
  Technology: "text-[#2979FF] border-[#2979FF]/30 bg-[#2979FF]/5",
  Politics: "text-[#FFD700] border-[#FFD700]/30 bg-[#FFD700]/5",
  Sports: "text-[#F50057] border-[#F50057]/30 bg-[#F50057]/5",
};

function truncKey(key: string) {
  return `${key.slice(0, 8)}...${key.slice(-6)}`;
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
      const { proof: sealProof, publicSignals: sealSignals } = await snarkjs.groth16.fullProve(
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
    } catch (e: any) {
      const msg = e.message || "Failed to place bet.";
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
          <Loader2 className="w-8 h-8 text-[#FF8C00] animate-spin" />
          <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Loading_Market_Data...</span>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 font-mono">
        <div className="w-12 h-12 border border-red-500/30 flex items-center justify-center bg-red-500/5">
          <AlertCircle className="w-6 h-6 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-white font-black tracking-tighter text-sm uppercase mb-2">ERR_404: MARKET_NOT_FOUND</p>
          <p className="text-white/20 text-[10px] max-w-xs mx-auto uppercase">The requested data module is unavailable or archived.</p>
        </div>
        <button
          onClick={() => router.push("/markets")}
          className="mt-4 px-6 py-2 border border-white/10 text-[10px] text-white/40 font-bold uppercase hover:bg-white/5 transition-all"
        >
          ← Return_To_Terminal
        </button>
      </div>
    );
  }

  const odds = calcOdds(market.yesPool, market.noPool);
  const catColor = CATEGORY_COLORS[market.category] ?? "text-white/40 border-white/10 bg-white/5";

  return (
    <div className="w-full max-w-7xl mx-auto px-0 pt-4 pb-24 font-mono">
      {/* Back nav */}
      <button
        onClick={() => router.push("/markets")}
        className="flex items-center gap-3 text-white/20 hover:text-[#FF8C00] text-[10px] uppercase font-black mb-8 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back::Markets_Index
      </button>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-8">
          {/* Market header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border border-white/10 bg-[#0D0D0D] p-8 relative overflow-hidden"
          >
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] bg-[length:16px_16px]" />
            
            {/* Market Image Hero */}
            {market.imageUrl && (
              <div className="relative w-full h-[300px] mb-8 border border-white/5 overflow-hidden">
                <img 
                  src={market.imageUrl} 
                  alt={market.title}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-[#0D0D0D]/20 to-transparent" />
                
                {/* Meta data overlay */}
                <div className="absolute bottom-4 left-6 flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10">
                    <div className="w-1.5 h-1.5 bg-[#FF8C00] rounded-full animate-pulse" />
                    <span className="text-[8px] text-[#FF8C00] font-black tracking-[0.2em] uppercase">DATA FEED ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md border border-white/10 text-white/40 text-[8px] font-black tracking-[0.2em] uppercase">
                    VISUAL_RELAY_v2.0
                  </div>
                </div>

                {/* Scanning effect */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-[#FF8C00]/30 animate-scan pointer-events-none" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 relative z-10">
              <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 border ${catColor}`}>
                {market.category}
              </span>
              <span
                className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest px-3 py-1 border ${
                  market.status === "OPEN"
                    ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5"
                    : "text-white/20 bg-white/5 border-white/10"
                }`}
              >
                {market.status === "OPEN" && (
                  <span className="w-1.5 h-1.5 bg-[#00C853] animate-pulse rounded-full" />
                )}
                STATUS::{market.status}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mt-6 mb-4 uppercase tracking-tighter">
              {market.title}
            </h1>

            {market.description && (
              <p className="text-xs text-white/40 leading-relaxed max-w-3xl border-l border-white/10 pl-6 my-6 italic">
                {market.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-8 pt-6 border-t border-white/5 mt-8">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">Expiration_Date</span>
                <div className="flex items-center gap-2 text-[11px] text-white/60 font-bold uppercase">
                  <Clock className="w-3.5 h-3.5 opacity-30" />
                  {new Date(market.closeDate).toLocaleDateString("en-US", { dateStyle: "medium" }).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">Total_Volume</span>
                <div className="flex items-center gap-2 text-[11px] text-[#FF8C00] font-bold uppercase">
                  <TrendingUp className="w-3.5 h-3.5 opacity-50" />
                  {(market.totalVolume || 0).toLocaleString()} XLM
                </div>
              </div>
              {market.contractMarketId && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-white/20 uppercase font-black tracking-widest">Onchain_Module</span>
                  <div className="flex items-center gap-2 text-[11px] text-white/40 font-bold uppercase">
                    <Shield className="w-3.5 h-3.5 opacity-30" />
                    CID::{market.contractMarketId}
                  </div>
                </div>
              )}
            </div>

            {/* Decorative scanline */}
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-[#FF8C00]/20" />
          </motion.div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="border border-white/10 bg-[#0D0D0D] p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                Data Stream Probability Index
              </h2>
              <div className="flex items-center gap-6 text-[10px] font-black tracking-widest">
                <span className="flex items-center gap-2 text-[#FF8C00]">
                  <div className="w-3 h-1 bg-[#FF8C00]" />
                  YES_{odds.yes}%
                </span>
                <span className="flex items-center gap-2 text-white/40">
                  <div className="w-3 h-1 bg-white/10" />
                  NO_{odds.no}%
                </span>
              </div>
            </div>
            <div className="h-[300px] border border-white/5 bg-black/20">
              <MarketChart marketId={market.id} yesPool={market.yesPool} noPool={market.noPool} />
            </div>
          </motion.div>

          {/* Intelligence Modules */}
          {(intelligence.manipulationScore || intelligence.probability !== undefined) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6"
            >
              {intelligence.probability !== undefined && intelligence.probability > 0 && (() => {
                const prob = intelligence.probability!;
                const confidence = (intelligence as any).confidence ?? 0;
                const sources: string[] = (intelligence as any).sources ?? [];
                const isPoolOnly = !sources.includes("historical") && !sources.includes("external");
                const pct = (prob * 100).toFixed(1);
                
                return (
                  <div className="border border-blue-500/20 bg-blue-500/5 p-6 relative overflow-hidden">
                    <div className="flex items-start gap-5 relative z-10">
                      <div className="w-12 h-12 border border-blue-500/30 flex items-center justify-center bg-blue-500/10">
                        <Brain className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-400/60 mb-2">
                          {isPoolOnly ? "Module Pool Signal" : "Module AI Inference"}
                        </p>
                        <p className="text-3xl font-black text-white mb-1">
                          {pct}%
                        </p>
                        <p className="text-[9px] text-white/30 uppercase tracking-tighter">
                          {isPoolOnly
                            ? "Data Source: On-chain Liquidity"
                            : `Model Conf: ${Math.round(confidence * 100)}% · Source: Multi_Inference`}
                        </p>
                      </div>
                    </div>
                    {/* Decorative bits */}
                    <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-blue-500/20" />
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="border border-white/10 bg-[#0D0D0D] p-8"
          >
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-3 mb-6">
              <Users className="w-4 h-4 opacity-30" />
              Recent Transaction Log
            </h2>
            {activity.length === 0 ? (
              <div className="flex items-center justify-center py-12 border border-white/5 bg-white/[0.02]">
                <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] animate-pulse">
                  Waiting For Data Transmission...
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-[11px] py-3 px-4 border border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white/20 text-[9px] uppercase font-black tracking-tighter">Trader Id</span>
                      <span className="text-white/60 font-bold">
                        {truncKey(a.user?.publicKey ?? "UNKNOWN_MODULE")}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-white/20 text-[9px] uppercase font-black tracking-tighter">Stake Val</span>
                      <span className="text-[#FF8C00] font-black">
                        {a.amount.toLocaleString()} XLM
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 min-w-[80px]">
                      <span className="text-white/20 text-[9px] uppercase font-black tracking-tighter">Timestamp</span>
                      <span className="text-white/30 font-bold uppercase">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── RIGHT COLUMN: Trade Terminal ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Probability Module */}
          <div className="border border-white/10 bg-[#0D0D0D] p-6 space-y-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              Module Market Sentiment
            </h2>
            <div className="space-y-4">
              <Progress
                value={odds.yes}
                label="YES INDEX"
                textClass="text-[#FF8C00]"
                indicatorClass="bg-[#FF8C00]/20"
              />
              <Progress
                value={odds.no}
                label="NO INDEX"
                textClass="text-white/40"
                indicatorClass="bg-white/5"
              />
            </div>
          </div>

          {/* Trade Terminal */}
          <div className="border border-[#FF8C00]/40 bg-[#0D0D0D] p-6 space-y-8 sticky top-24 relative overflow-hidden">
            {/* Header scanning effect */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-[#FF8C00]/30 animate-scan pointer-events-none" />
            
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF8C00] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Terminal Trade Execution
              </div>
              <div className="w-2 h-2 bg-[#FF8C00] animate-pulse rounded-full" />
            </h2>

            {hasBet && market.status === "OPEN" && (
              <div className="border border-white/10 bg-white/5 p-4 text-[10px] text-white/40 uppercase font-black leading-relaxed">
                STATUS LOG: POSITION ALREADY OPEN. MULTIPLE BETS DISABLED.
              </div>
            )}

            {market.status !== "OPEN" ? (
              <div className="text-center py-12 border border-white/5 bg-white/[0.02] space-y-3">
                <XCircle className="w-10 h-10 text-white/10 mx-auto" />
                <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.3em]">
                  Terminal Locked
                </p>
              </div>
            ) : (
              <>
                {/* Side selector */}
                <div className="grid grid-cols-2 gap-2">
                  {(["YES", "NO"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSide(opt)}
                      className={`relative py-4 border transition-all font-black uppercase text-[11px] tracking-[0.2em] ${
                        side === opt
                          ? opt === "YES"
                            ? "bg-[#FF8C00]/10 border-[#FF8C00] text-[#FF8C00]"
                            : "bg-white/10 border-white text-white"
                          : "border-white/10 text-white/20 hover:bg-white/5 hover:text-white/40"
                      }`}
                    >
                      {opt}
                      {side === opt && (
                        <motion.div layoutId="side-indicator" className="absolute -bottom-[1px] left-0 w-full h-[2px] bg-current" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Amount input */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-[9px] text-white/40 uppercase font-black tracking-widest">
                      Input::Stake_Amount (XLM)
                    </label>
                    <span className="text-[9px] text-white/20 uppercase font-bold">Limit::5000_XLM</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setBetError(""); setBetSuccess(false); }}
                      className="w-full bg-black border border-white/10 rounded-sm px-5 py-4 text-white text-sm font-black focus:outline-none focus:border-[#FF8C00]/50 transition-colors"
                      placeholder="0.00"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <div className="w-px h-4 bg-white/10" />
                      <span className="text-[10px] text-white/40 font-black uppercase">XLM</span>
                    </div>
                  </div>

                  {/* Quick amounts */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {["10", "50", "100", "500"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setAmount(q)}
                        className="py-2 text-[9px] font-black uppercase border border-white/5 text-white/30 hover:text-white hover:border-[#FF8C00]/30 hover:bg-[#FF8C00]/5 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payout data */}
                <div className="border border-white/5 bg-black/40 p-4 space-y-3">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/30 uppercase font-black">Est_Profit</span>
                    <span className="text-[#00C853] font-black">+{potentialPayout()} XLM</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-white/30 uppercase font-black">Probability</span>
                    <span className="text-white/60 font-black">
                      {side === "YES" ? odds.yes : odds.no}%
                    </span>
                  </div>
                </div>

                {/* Status messages */}
                <AnimatePresence mode="wait">
                  {betError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] font-black uppercase leading-tight"
                    >
                      ERR::{betError}
                    </motion.div>
                  )}
                  {betSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 border border-[#00C853]/30 bg-[#00C853]/5 text-[#00C853] text-[10px] font-black uppercase leading-tight"
                    >
                      SUCCESS::POSITION_SEALED_ON_CHAIN
                    </motion.div>
                  )}
                  {betStatus && !betError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="p-4 border border-blue-500/30 bg-blue-500/5 text-blue-400 text-[10px] font-black uppercase flex items-center gap-3"
                    >
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {betStatus}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Execute Button */}
                <button
                  onClick={handleBet}
                  disabled={submitting || !publicKey || hasBet}
                  className={`group relative w-full py-5 font-black uppercase text-[12px] tracking-[0.3em] transition-all overflow-hidden border ${
                    hasBet
                      ? "border-white/5 text-white/20 cursor-not-allowed bg-white/[0.02]"
                      : side === "YES"
                      ? "border-[#FF8C00] bg-[#FF8C00] text-black hover:bg-black hover:text-[#FF8C00]"
                      : "border-white bg-white text-black hover:bg-black hover:text-white"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        PROCESSING...
                      </>
                    ) : hasBet ? (
                      "TERMINAL_LOCKED"
                    ) : !publicKey ? (
                      "CONNECT_WALLET"
                    ) : (
                      `EXECUTE_BUY_${side}`
                    )}
                  </span>
                  
                  {/* Hover scanline */}
                  {!submitting && !hasBet && publicKey && (
                    <motion.div 
                      className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" 
                    />
                  )}
                </button>
              </>
            )}
          </div>

          {/* Module Specs */}
          <div className="border border-white/10 bg-[#0D0D0D] p-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20">
              Module::Contract_Specifications
            </h3>
            <div className="space-y-2 text-[10px] font-bold uppercase tracking-tighter">
              {market.contractMarketId && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/30">Module_ID</span>
                  <span className="text-white/60">0x00{market.contractMarketId}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-white/30">Bond_Stake</span>
                <span className="text-white/60">{market.bondAmount ?? 100} XLM</span>
              </div>
              {market.oracleAddress && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-white/30">Oracle_Relay</span>
                  <span className="text-white/60 truncate max-w-[120px]">{truncKey(market.oracleAddress)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/30">Network_Bus</span>
                <span className="text-[#00C853]">STELLAR_TESTNET_v4</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
