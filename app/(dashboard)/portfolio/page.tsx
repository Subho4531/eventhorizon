"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, Wallet, ExternalLink, ArrowDownCircle,
  ArrowUpCircle, Edit3, Link as LinkIcon, Loader2,
  TrendingUp, TrendingDown, MapPin, Star, AlertCircle,
  RefreshCw, Zap, Shield, Trophy, Activity, ChevronRight,
  Lock,
} from "lucide-react";
import { useWallet, UserLink } from "@/components/WalletProvider";
import EditProfileModal from "@/components/EditProfileModal";
import {
  depositToEscrow,
  withdrawFromEscrow,
  submitSignedXdr,
  getMarket,
  claimWinnings,
  getOnchainEscrowBalance,
} from "@/lib/escrow";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
type Transaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "BET" | "CLAIM";
  amount: number;
  hash: string;
  createdAt: string;
};

type TxStatus = "idle" | "signing" | "submitting" | "confirming" | "done" | "error";

const STATUS_MSG: Record<TxStatus, string | null> = {
  idle: null,
  signing: "Waiting for Freighter signature...",
  submitting: "Submitting to Soroban network...",
  confirming: "Confirming on-chain...",
  done: "✓ Transaction confirmed!",
  error: "Transaction failed. Please try again.",
};

async function freighterSign(unsignedXdr: string): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const networkPassphrase = "Test SDF Network ; September 2015";
  const result = await signTransaction(unsignedXdr, { networkPassphrase });
  if (typeof result === "string") return result;
  if (result && "signedTxXdr" in result) return (result as { signedTxXdr: string }).signedTxXdr;
  throw new Error("Freighter returned unexpected response");
}

async function recordTransaction(
  publicKey: string,
  type: "DEPOSIT" | "WITHDRAWAL",
  amount: number,
  hash: string
) {
  const res = await fetch("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey, type, amount, hash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to record transaction");
  }
  return res.json();
}

// ── Wallet Gate ────────────────────────────────────────────────────────────────
function WalletGate() {
  const { connect, isConnecting } = useWallet();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl scale-150 animate-pulse" />
        <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-white/10 flex items-center justify-center shadow-[0_0_60px_rgba(37,99,235,0.3)]">
          <Lock className="w-12 h-12 text-blue-400" />
        </div>
      </motion.div>
      <div className="text-center space-y-3">
        <h2 className="text-4xl font-bold text-white tracking-tight">Portfolio Locked</h2>
        <p className="text-white/40 max-w-sm mx-auto text-sm leading-relaxed">
          Connect your Freighter wallet to access your cosmic portfolio, escrow balance, and trading history.
        </p>
      </div>
      <motion.button
        whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(37,99,235,0.5)" }}
        whileTap={{ scale: 0.95 }}
        onClick={connect}
        disabled={isConnecting}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-4 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all disabled:opacity-50 text-sm uppercase tracking-wider"
      >
        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
        Connect Freighter
      </motion.button>
    </div>
  );
}

// ── Escrow Action Modal ────────────────────────────────────────────────────────
interface EscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mode: "deposit" | "withdraw";
  currentBalance?: number;
}

function EscrowModal({ isOpen, onClose, onSuccess, mode, currentBalance = 0 }: EscrowModalProps) {
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isDeposit = mode === "deposit";

  const reset = () => {
    setAmount("");
    setStatus("idle");
    setErrorMsg("");
    setIsLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    const xlm = parseFloat(amount);
    if (!xlm || xlm <= 0 || !publicKey) return;
    if (!isDeposit && xlm > currentBalance) {
      setErrorMsg(`Insufficient balance. Max: ${currentBalance.toFixed(4)} XLM`);
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      setStatus("signing");
      const builder = isDeposit ? depositToEscrow : withdrawFromEscrow;
      const result = await builder(publicKey, xlm);
      if (!result.success) throw new Error("Failed to build transaction");

      let txHash = result.hash;

      if (result.unsignedXdr) {
        const signedXdr = await freighterSign(result.unsignedXdr);
        setStatus("submitting");
        const submitted = await submitSignedXdr(signedXdr);
        txHash = submitted.hash;
        setStatus("confirming");
      }

      await recordTransaction(publicKey, isDeposit ? "DEPOSIT" : "WITHDRAWAL", xlm, txHash);
      setStatus("done");
      setTimeout(() => { onSuccess(); handleClose(); }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.toLowerCase().includes("user declined") || msg.toLowerCase().includes("rejected")) {
        setErrorMsg("Signature rejected in Freighter.");
      } else {
        setErrorMsg(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
      }
      setStatus("error");
      setTimeout(() => { setStatus("idle"); setErrorMsg(""); }, 4000);
    } finally {
      setIsLoading(false);
    }
  };

  const accentColor = isDeposit ? "blue" : "orange";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className={`fixed bottom-8 right-8 z-[91] w-84 bg-[#080810]/98 border rounded-3xl p-6 shadow-2xl ${isDeposit ? "border-blue-500/20 shadow-blue-500/10" : "border-orange-500/20 shadow-orange-500/10"}`}
          >
            <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${isDeposit ? "from-blue-600/5" : "from-orange-500/5"} to-transparent pointer-events-none`} />

            <div className="relative">
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDeposit ? "bg-blue-500/15" : "bg-orange-500/15"}`}>
                  {isDeposit
                    ? <ArrowDownCircle className="w-4 h-4 text-blue-400" />
                    : <ArrowUpCircle className="w-4 h-4 text-orange-400" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {isDeposit ? "Deposit to Escrow" : "Withdraw from Escrow"}
                  </h3>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest">
                    {isDeposit ? "Funds secured by smart contract" : `Available: ${currentBalance.toFixed(4)} XLM`}
                  </p>
                </div>
              </div>

              <div className="relative my-4">
                <input
                  type="number" min="0.0000001" step="any"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrorMsg(""); }}
                  placeholder="0.00"
                  disabled={isLoading}
                  className={`w-full bg-white/5 border rounded-2xl px-5 py-4 text-2xl font-bold text-white placeholder-white/15 focus:outline-none transition-all pr-16 disabled:opacity-60 ${isDeposit ? "border-white/10 focus:border-blue-500/50" : "border-white/10 focus:border-orange-500/50"}`}
                />
                <span className={`absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold ${isDeposit ? "text-blue-400" : "text-orange-400"}`}>XLM</span>
              </div>

              {!isDeposit && currentBalance > 0 && (
                <div className="flex gap-1.5 mb-4">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAmount((currentBalance * pct).toFixed(4))}
                      className="flex-1 text-[9px] font-bold text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-1.5 transition-all uppercase tracking-wider"
                    >
                      {(pct * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>
              )}

              {(STATUS_MSG[status] || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className={`flex items-start gap-2 text-[10px] mb-3 rounded-xl px-3 py-2 ${
                    status === "done" ? "text-green-400 bg-green-500/10" :
                    status === "error" ? "text-red-400 bg-red-500/10" : `text-${accentColor}-400 bg-${accentColor}-500/10`
                  }`}
                >
                  {status === "error" && <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
                  {isLoading && status !== "done" && status !== "error" && <Loader2 className="w-3 h-3 mt-0.5 shrink-0 animate-spin" />}
                  <span>{errorMsg || STATUS_MSG[status]}</span>
                </motion.div>
              )}

              {isLoading && (
                <div className="w-full h-0.5 bg-white/5 rounded-full mb-4 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${isDeposit ? "bg-blue-500" : "bg-orange-500"}`}
                    animate={{ width: status === "signing" ? "30%" : status === "submitting" ? "65%" : "90%" }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="py-3 rounded-xl border border-white/10 text-white/50 text-xs font-bold hover:bg-white/5 transition-all disabled:opacity-40"
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                  className={`py-3 rounded-xl disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isDeposit ? "bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-orange-600 hover:bg-orange-500 shadow-[0_0_20px_rgba(234,88,12,0.4)]"}`}
                >
                  {isLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : isDeposit
                      ? <><ArrowDownCircle className="w-3.5 h-3.5" /> Deposit</>
                      : <><ArrowUpCircle className="w-3.5 h-3.5" /> Withdraw</>}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Transaction Row ────────────────────────────────────────────────────────────
function TxRow({ tx }: { tx: Transaction }) {
  const isDeposit = tx.type === "DEPOSIT";
  const isWithdraw = tx.type === "WITHDRAWAL";
  const isBet = tx.type === "BET";
  const isClaim = tx.type === "CLAIM";

  const date = new Date(tx.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Visual mapping
  const config = {
    DEPOSIT: { label: "Deposit", icon: ArrowDownCircle, color: "text-blue-400", bg: "bg-blue-600/10 border-blue-600/20", sign: "+" },
    WITHDRAWAL: { label: "Withdrawal", icon: ArrowUpCircle, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", sign: "−" },
    BET: { label: "Bet Placed", icon: TrendingDown, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", sign: "−" },
    CLAIM: { label: "Winnings", icon: Trophy, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", sign: "+" },
  };

  const { label, icon: Icon, color, bg, sign } = config[tx.type] || config.DEPOSIT;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 py-3.5 border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.02] -mx-4 px-4 rounded-xl transition-colors"
    >
      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</div>
        {tx.hash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[9px] text-white/25 font-mono hover:text-blue-400 transition-colors flex items-center gap-1 mt-0.5"
          >
            {tx.hash.slice(0, 12)}…{tx.hash.slice(-6)} <ExternalLink className="w-2 h-2 shrink-0" />
          </a>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold ${color}`}>
          {sign}{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} <span className="text-[10px] opacity-40">XLM</span>
        </div>
        <div className="text-[9px] text-white/25 mt-0.5">{formatted} · {time}</div>
      </div>
    </motion.div>
  );
}
// ── Sealed Position Types & Card ───────────────────────────────────────────────
interface SealedPosition {
  marketId: string;
  contractMarketId: number;
  marketTitle?: string;
  side: number;
  nonce: string;
  bettorKey: string;
  commitment: string;
  amount: string;
  txHash?: string;
  status: "SEALED" | "CLAIMED" | "EXPIRED";
  isLocalMissing?: boolean; // New: indicates if secret nonce is missing from this browser
}

function SealedPositionCard({ position, onClaimed }: { position: SealedPosition; onClaimed: () => void }) {
  const { publicKey } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [marketState, setMarketState] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMarket(position.contractMarketId).then(s => { if (s) setMarketState(s); });
  }, [position.contractMarketId]);

  // Robust checks for MarketStatus (can be 0/1/2 or "Open"/"Closed"/"Resolved")
  const isResolved = marketState?.status === 2 || marketState?.status === "Resolved";
  const isClosed = marketState?.status === 1 || marketState?.status === "Closed";
  const sideLabel = position.side === 0 ? "YES" : "NO";
  const isWinner = isResolved ? (marketState.outcome === position.side) : null;

  // We only allow claim if market is resolved AND user is the winner
  const canClaim = isResolved && isWinner && !position.isLocalMissing;

  const handleClaim = async () => {
    if (!publicKey || position.isLocalMissing) return;
    setClaiming(true);
    setError("");
    try {
      // @ts-ignore
      const snarkjs = await import("snarkjs");
      // Derive a numeric bettor_key from the publicKey (consistent with sealant logic in handleBet)
      const bettorKeyNum = parseInt(publicKey.slice(1, 9), 36).toString();

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        { 
          side: position.side.toString(), 
          nonce: position.nonce, 
          bettor_key: bettorKeyNum, 
          winning_side: marketState.outcome.toString(),
          commitment: position.commitment
        },
        "/circuit/reveal/reveal_bet.wasm",
        "/circuit/reveal/reveal_0001.zkey"
      );
      const nullifier = publicSignals[0];
      const res = await claimWinnings(publicKey, position.contractMarketId, position.commitment, nullifier, proof);
      if (!res.success || !res.unsignedXdr) throw new Error("Claim tx failed");
      const signedXdr = await freighterSign(res.unsignedXdr);
      const submitRes = await submitSignedXdr(signedXdr);
      if (!submitRes.hash) throw new Error("Submission failed");

      // 4. Sync Database
      const dbRes = await fetch("/api/bets/claim", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitment: position.commitment, nullifier, txHash: submitRes.hash }),
      });

      if (!dbRes.ok) {
        const errorData = await dbRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to sync claim with database");
      }

      // 5. Update local storage
      const portfolio = JSON.parse(localStorage.getItem("zk_portfolio") || "[]");
      localStorage.setItem("zk_portfolio", JSON.stringify(
        portfolio.map((p: any) => p.commitment === position.commitment ? { ...p, status: "CLAIMED" } : p)
      ));
      onClaimed();
    } catch (err: any) {
      setError(err.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const estimatedPayout = marketState
    ? ((parseFloat(position.amount) * (marketState.payout_bps || 0)) / 10000).toFixed(2)
    : null;

  const statusColors = {
    SEALED: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    CLAIMED: "text-green-400 border-green-500/30 bg-green-500/5",
    EXPIRED: "text-red-400 border-red-500/30 bg-red-500/5",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-all duration-300 group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/3 to-violet-600/3 pointer-events-none" />
      <div className="relative">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className={`inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border mb-2 ${position.isLocalMissing ? "text-white/30 border-white/10 bg-white/5" : (position.side === 0 ? "text-blue-400 border-blue-500/30 bg-blue-500/10" : "text-red-400 border-red-500/30 bg-red-500/10")}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${position.isLocalMissing ? "bg-white/20" : (position.side === 0 ? "bg-blue-400" : "bg-red-400")}`} />
              {position.isLocalMissing ? "Secret Sealed" : sideLabel} Position
            </div>
            <h4 className="text-sm font-bold text-white leading-snug max-w-[160px] line-clamp-2">
              {position.marketTitle || "Syncing…"}
            </h4>
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${statusColors[position.status]}`}>
            {position.status}
          </span>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 group-hover:bg-blue-500/10 group-hover:border-blue-500/30 transition-all">
            <Activity className="w-3 h-3 text-white/40 group-hover:text-blue-400" />
            <span className="text-[10px] text-white/40 font-mono group-hover:text-blue-300">
              {position.commitment.slice(0, 8)}…
            </span>
          </div>
          {position.isLocalMissing && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest">
                Secret Missing
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-[8px] text-white/30 uppercase tracking-widest mb-1">Stake</div>
            <div className="text-sm font-bold text-white">{position.amount} <span className="text-white/30 text-[10px]">XLM</span></div>
          </div>
          <div className="bg-white/5 rounded-xl p-3">
            <div className="text-[8px] text-white/30 uppercase tracking-widest mb-1">Est. Payout</div>
            <div className="text-sm font-bold text-green-400">
              {estimatedPayout !== null ? `${estimatedPayout} XLM` : "—"}
            </div>
          </div>
        </div>

        {position.status === "SEALED" && (
          <div>
            {canClaim ? (
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleClaim}
                disabled={claiming}
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50"
              >
                {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Zap className="w-3.5 h-3.5" /> Reveal & Claim</>}
              </motion.button>
            ) : isResolved && isWinner === false ? (
              <div className="flex items-center justify-center gap-2 py-2.5 text-red-400 text-[10px] font-bold uppercase tracking-widest bg-red-500/5 rounded-xl border border-red-500/10">
                <AlertCircle className="w-3.5 h-3.5" /> Position Lost
              </div>
            ) : position.isLocalMissing ? (
              <div className="flex items-center justify-center gap-2 py-2.5 text-amber-400 text-[10px] font-bold uppercase tracking-widest bg-amber-500/5 rounded-xl border border-amber-500/10">
                <AlertCircle className="w-3.5 h-3.5" /> Data missing locally
              </div>
            ) : (
              <div className="text-center text-[9px] text-white/25 uppercase tracking-widest py-2.5 bg-white/5 rounded-xl border border-white/5">
                {!marketState ? "Syncing on-chain status…" :
                  isClosed ? "⏳ Awaiting oracle resolution" :
                  isResolved ? "🔓 Checking eligibility..." :
                  "🔒 Market still open"}
              </div>
            )}
            {error && <p className="text-[10px] text-red-400 mt-2 text-center">{error}</p>}
          </div>
        )}

        {position.status === "CLAIMED" && (
          <div className="flex items-center justify-center gap-2 py-2.5 text-green-400 text-[10px] font-bold uppercase tracking-widest">
            <Trophy className="w-3.5 h-3.5" /> Winnings Claimed
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent, delay }: {
  label: string; value: string; sub: string; icon: React.ReactNode; accent: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl p-5 relative overflow-hidden group hover:border-white/10 transition-all`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/35">{label}</div>
          <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">{icon}</div>
        </div>
        <div className="text-xl font-bold text-white tracking-tight">{value}</div>
        <div className="text-[10px] text-white/30 mt-1">{sub}</div>
      </div>
    </motion.div>
  );
}

// ── Main Portfolio Page ────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { publicKey, user, isLoadingUser, refreshUser } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sealedPositions, setSealedPositions] = useState<SealedPosition[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // On-chain balance (from Soroban contract)
  const [onchainBalance, setOnchainBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchOnchainBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalanceLoading(true);
    try {
      const bal = await getOnchainEscrowBalance(publicKey);
      setOnchainBalance(bal);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to fetch on-chain balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey]);

  const loadSealedPositions = useCallback(async () => {
    if (!publicKey) return;
    
    try {
      // 1. Load from localStorage
      const stored = localStorage.getItem("zk_portfolio");
      let localPositions: SealedPosition[] = [];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localPositions = Array.isArray(parsed) 
            ? parsed.filter((p: any) => p.bettorKey === publicKey)
            : [];
        } catch (e) {
          console.error("Failed to parse zk_portfolio", e);
        }
      }

      // 2. Load from API (fallback/sync)
      let remotePositions: SealedPosition[] = [];
      try {
        const res = await fetch(`/api/bets?userPublicKey=${encodeURIComponent(publicKey)}`);
        if (res.ok) {
          const data = await res.json();
          remotePositions = (data.bets || []).map((b: any) => ({
            marketId: b.marketId,
            contractMarketId: b.market?.contractMarketId ?? 0,
            marketTitle: b.market?.title,
            side: 0, // We don't know the side without local secret
            nonce: "",
            bettorKey: b.userPublicKey,
            commitment: b.commitment,
            amount: b.amount.toString(),
            txHash: b.txHash,
            status: b.revealed ? "CLAIMED" : "SEALED",
            isLocalMissing: true,
          }));
        }
      } catch (e) {
        console.error("Failed to fetch remote bets", e);
      }

      // 3. Merge: Prioritize local storage (has nonces)
      const mergedMap = new Map<string, SealedPosition>();
      
      // Add remote ones first as placeholders
      remotePositions.forEach(p => mergedMap.set(p.commitment, p));
      
      // Overwrite/Add local ones (these are the "real" ones with secrets)
      localPositions.forEach(p => {
        mergedMap.set(p.commitment, { ...p, isLocalMissing: false });
      });

      const finalPositions = Array.from(mergedMap.values());
      console.log(`[portfolio] Loaded ${finalPositions.length} positions (${localPositions.length} local, ${remotePositions.length} remote)`);
      setSealedPositions(finalPositions);
    } catch (err) {
      console.error("Critical error in loadSealedPositions:", err);
    }
  }, [publicKey]);

  const loadTransactions = useCallback(async () => {
    if (!publicKey) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/transactions?publicKey=${encodeURIComponent(publicKey)}`, { cache: 'no-store' });
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;
    loadTransactions();
    loadSealedPositions();
    fetchOnchainBalance();
    // Refresh on-chain balance every 30s
    const interval = setInterval(fetchOnchainBalance, 30_000);
    return () => clearInterval(interval);
  }, [loadTransactions, loadSealedPositions, fetchOnchainBalance, publicKey]);

  const copyKey = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTxSuccess = useCallback(() => {
    refreshUser();
    loadTransactions();
    fetchOnchainBalance(); // Refresh on-chain balance after tx
  }, [refreshUser, loadTransactions, fetchOnchainBalance]);

  if (!publicKey) return <WalletGate />;
  if (isLoadingUser) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
        </div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest">Loading portfolio…</p>
      </div>
    </div>
  );

  const initials = (user?.name ?? publicKey).slice(0, 2).toUpperCase();
  const links: UserLink[] = Array.isArray(user?.links) ? user!.links : [];
  
  // Use live on-chain balance as source of truth; fall back to DB balance if still loading
  const liveBalance = onchainBalance !== null ? onchainBalance : (user?.balance ?? 0);
  
  const deposits = transactions.filter(t => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
  const withdrawals = transactions.filter(t => t.type === "WITHDRAWAL").reduce((s, t) => s + t.amount, 0);
  const totalBets = transactions.filter(t => t.type === "BET").reduce((s, t) => s + t.amount, 0);
  const totalWinnings = transactions.filter(t => t.type === "CLAIM").reduce((s, t) => s + t.amount, 0);
  
  // Net Flow represents the delta of funds in the escrow: (In - Out)
  const netFlow = (deposits + totalWinnings) - (withdrawals + totalBets);
  
  const claimedPositions = sealedPositions.filter(p => p.status === "CLAIMED");
  
  // Open positions value (currently at stake)
  const openPositionsValue = sealedPositions
    .filter(p => p.status === "SEALED")
    .reduce((s, p) => s + parseFloat(p.amount), 0);
    
  const winRate = sealedPositions.length > 0
    ? Math.round((claimedPositions.length / sealedPositions.length) * 100)
    : 0;

  const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID;

  return (
    <>
      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} />
      <EscrowModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} onSuccess={handleTxSuccess} mode="deposit" />
      <EscrowModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} onSuccess={handleTxSuccess} mode="withdraw" currentBalance={liveBalance} />

      <div className="max-w-7xl mx-auto py-8 lg:py-12 px-4 xl:px-0 space-y-6 relative z-10">

        {/* ── Profile Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8 overflow-hidden"
        >
          {/* ambient glows */}
          <div className="absolute -top-20 -right-20 w-80 h-80 bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600/30 to-violet-600/30 border border-white/10 flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.25)]">
                {user?.pfpUrl
                  ? <img src={user.pfpUrl} alt={user.name} className="w-full h-full object-cover" />
                  : <span className="text-3xl font-bold text-white/50">{initials}</span>}
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-green-500 rounded-full border-2 border-[#080810] flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>

            {/* Profile info */}
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-blue-400/80 mb-1">Cosmic Trader</div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-1">
                {user?.name || "Anonymous"}
              </h1>
              {user?.bio && <p className="text-white/40 text-sm mb-2 max-w-md leading-relaxed">{user.bio}</p>}

              <button onClick={copyKey} className="flex items-center gap-2 group/key mt-1">
                <span className="text-[10px] font-mono text-white/25 group-hover/key:text-white/50 transition-colors">
                  {publicKey.slice(0, 12)}…{publicKey.slice(-8)}
                </span>
                {copied
                  ? <Check className="w-3 h-3 text-green-400" />
                  : <Copy className="w-3 h-3 text-white/20 group-hover/key:text-white/40 transition-colors" />}
              </button>

              {links.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {links.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-white/40 hover:text-blue-400 transition-colors bg-white/5 border border-white/5 rounded-full px-3 py-1"
                    >
                      <LinkIcon className="w-2.5 h-2.5" />
                      {link.label || link.url}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Live Escrow Balance Card ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="relative bg-gradient-to-br from-blue-600/10 to-violet-600/5 backdrop-blur-2xl border border-blue-500/20 rounded-[2rem] p-6 lg:p-8 overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.12),transparent_60%)] pointer-events-none" />
          <div className="absolute -top-10 -right-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.35em] text-blue-400/80">
                  <Activity className="w-3 h-3" /> Live Escrow Balance
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[8px] text-green-400/70 uppercase tracking-widest">On-chain</span>
                </div>
              </div>

              <div className="flex items-end gap-3">
                {balanceLoading && onchainBalance === null ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                    <span className="text-white/30 text-lg">Fetching from Soroban…</span>
                  </div>
                ) : (
                  <div className="text-5xl lg:text-6xl font-bold text-white tracking-tighter tabular-nums">
                    {liveBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    <span className="text-white/30 ml-3 text-2xl font-medium">XLM</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mt-2">
                {lastRefreshed && (
                  <span className="text-[9px] text-white/25 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" />
                    Updated {lastRefreshed.toLocaleTimeString()}
                  </span>
                )}
                {CONTRACT_ID && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-white/25 hover:text-blue-400 flex items-center gap-1 transition-colors font-mono"
                  >
                    {CONTRACT_ID.slice(0, 8)}…{CONTRACT_ID.slice(-6)}
                    <ExternalLink className="w-2 h-2" />
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full lg:w-auto">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(37,99,235,0.5)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDepositOpen(true)}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all"
              >
                <ArrowDownCircle className="w-4 h-4" />
                Deposit XLM
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setWithdrawOpen(true)}
                disabled={liveBalance <= 0}
                className="flex items-center justify-center gap-2 bg-white/5 border border-white/15 hover:bg-orange-500/10 hover:border-orange-500/30 text-white/60 hover:text-orange-400 font-bold text-xs uppercase tracking-wider px-8 py-3.5 rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Withdraw
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={fetchOnchainBalance}
                disabled={balanceLoading}
                className="flex items-center justify-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors py-1"
              >
                <RefreshCw className={`w-3 h-3 ${balanceLoading ? "animate-spin" : ""}`} />
                Refresh balance
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Stats Grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Winnings"
            value={`${totalWinnings.toFixed(2)} XLM`}
            sub={`${transactions.filter(t => t.type === "CLAIM").length} claims`}
            icon={<Trophy className="w-4 h-4 text-emerald-400" />}
            accent="from-emerald-600/5 to-transparent"
            delay={0.15}
          />
          <StatCard
            label="Total Invested"
            value={`${totalBets.toFixed(2)} XLM`}
            sub={`${transactions.filter(t => t.type === "BET").length} positions`}
            icon={<TrendingDown className="w-4 h-4 text-blue-400" />}
            accent="from-blue-600/5 to-transparent"
            delay={0.2}
          />
          <StatCard
            label="Open Exposure"
            value={`${openPositionsValue.toFixed(2)} XLM`}
            sub={`${sealedPositions.filter(p => p.status === "SEALED").length} active bets`}
            icon={<Lock className="w-4 h-4 text-violet-400" />}
            accent="from-violet-600/5 to-transparent"
            delay={0.25}
          />
          <StatCard
            label="Net Strategy Delta"
            value={`${(totalWinnings - totalBets).toFixed(2)} XLM`}
            sub="Profit/Loss from trades"
            icon={totalWinnings >= totalBets ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            accent={totalWinnings >= totalBets ? "from-green-600/5 to-transparent" : "from-red-600/5 to-transparent"}
            delay={0.3}
          />
        </div>

        {/* ── Funding Stats ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ArrowDownCircle className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-[8px] text-white/30 uppercase tracking-widest font-bold">Deposits</div>
                <div className="text-white font-bold">{deposits.toFixed(2)} <span className="text-[10px] opacity-40">XLM</span></div>
              </div>
            </div>
          </div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ArrowUpCircle className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <div className="text-[8px] text-white/30 uppercase tracking-widest font-bold">Withdrawals</div>
                <div className="text-white font-bold">{withdrawals.toFixed(2)} <span className="text-[10px] opacity-40">XLM</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ── ZK Sealed Positions ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-violet-400/80 mb-1">ZK Sealed Vaults</div>
              <div className="text-white font-bold text-lg">Active Positions</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">
                {sealedPositions.filter(p => p.status === "SEALED").length} open
              </span>
              <div className="w-px h-4 bg-white/10" />
              <span className="text-[10px] text-green-400/70 uppercase tracking-widest">
                {claimedPositions.length} claimed
              </span>
            </div>
          </div>

          {sealedPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <MapPin className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-[11px] text-white/30 uppercase tracking-widest font-bold">No active positions</p>
              <p className="text-xs text-white/20 mt-2 max-w-xs">Place a bet on any open market to see your ZK-sealed positions here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sealedPositions.map((pos, i) => (
                <SealedPositionCard
                  key={`${pos.commitment}-${i}`}
                  position={pos}
                  onClaimed={() => { loadSealedPositions(); refreshUser(); fetchOnchainBalance(); loadTransactions(); }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Transaction History ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-white/30 mb-1">System Log</div>
              <div className="text-white font-bold text-lg">Transaction History</div>
            </div>
            <div className="flex items-center gap-3">
              {netFlow > 0 ? (
                <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
                  <TrendingUp className="w-3 h-3" /> +{netFlow.toFixed(2)} XLM net
                </span>
              ) : netFlow < 0 ? (
                <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1">
                  <TrendingDown className="w-3 h-3" /> {netFlow.toFixed(2)} XLM net
                </span>
              ) : null}
              <span className="text-[10px] text-white/30 uppercase tracking-widest">{transactions.length} records</span>
            </div>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Activity className="w-7 h-7 text-white/20" />
              </div>
              <p className="text-[11px] text-white/30 uppercase tracking-widest font-bold">No transactions yet</p>
              <p className="text-xs text-white/20 mt-2">Deposit XLM to start trading</p>
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setDepositOpen(true)}
                className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" /> Make First Deposit
              </motion.button>
            </div>
          ) : (
            <div>
              {transactions.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>
          )}
        </motion.div>

      </div>
    </>
  );
}
