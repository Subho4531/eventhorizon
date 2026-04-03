"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, Wallet, ExternalLink, ArrowDownCircle,
  ArrowUpCircle, Edit3, Link as LinkIcon, Loader2,
  TrendingUp, MapPin, Star, AlertCircle,
} from "lucide-react";
import { useWallet, UserLink } from "@/components/WalletProvider";
import EditProfileModal from "@/components/EditProfileModal";
import {
  depositToEscrow,
  withdrawFromEscrow,
  submitSignedXdr,
  getMarket,
  claimWinnings,
} from "@/lib/escrow";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────────
type Transaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  amount: number;
  hash: string;
  createdAt: string;
};

type TxStatus = "idle" | "signing" | "submitting" | "confirming" | "done" | "error";

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_MSG: Record<TxStatus, string | null> = {
  idle: null,
  signing: "Waiting for Freighter signature...",
  submitting: "Submitting to Soroban network...",
  confirming: "Confirming on-chain...",
  done: "✓ Transaction confirmed!",
  error: "Transaction failed. Please try again.",
};

/**
 * Sign an XDR transaction with Freighter and return the signed XDR.
 * Falls back gracefully if Freighter is not installed.
 */
async function freighterSign(unsignedXdr: string): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  // freighter-api v4 uses networkPassphrase, not network
  // Force Testnet for the cosmic event horizon hackathon
  const networkPassphrase = "Test SDF Network ; September 2015";
  const result = await signTransaction(unsignedXdr, { networkPassphrase });
  // freighter-api v4 returns { signedTxXdr } or just the string
  if (typeof result === "string") return result;
  if (result && "signedTxXdr" in result) return (result as { signedTxXdr: string }).signedTxXdr;
  throw new Error("Freighter returned unexpected response");
}

/**
 * Record a completed transaction in the DB, which also atomically
 * increments/decrements the user's balance field.
 */
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
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-3xl scale-150" />
        <div className="relative w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Wallet className="w-10 h-10 text-blue-400" />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-3">Portfolio Locked</h2>
        <p className="text-white/40 max-w-sm mx-auto text-sm leading-relaxed">
          Connect your Freighter wallet to access your cosmic portfolio, balance, and transaction history.
        </p>
      </div>
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={connect} disabled={isConnecting}
        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-2xl flex items-center gap-2 shadow-[0_0_30px_rgba(37,99,235,0.4)] transition-all disabled:opacity-50"
      >
        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
        Connect Wallet
      </motion.button>
    </div>
  );
}

// ── Shared Transaction Modal ────────────────────────────────────────────────────
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
  const maxAmount = isDeposit ? undefined : currentBalance;

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
      // ── Step 1: Build unsigned Soroban XDR ──────────────────────────────────
      setStatus("signing");
      const builder = isDeposit ? depositToEscrow : withdrawFromEscrow;
      const result = await builder(publicKey, xlm);

      if (!result.success) throw new Error("Failed to build transaction");

      let txHash = result.hash;

      // ── Step 2: If real mode, sign with Freighter + submit ──────────────────
      if (result.unsignedXdr) {
        // Sign with Freighter
        const signedXdr = await freighterSign(result.unsignedXdr);

        // Submit to Soroban RPC
        setStatus("submitting");
        const submitted = await submitSignedXdr(signedXdr);
        txHash = submitted.hash;
        setStatus("confirming");
      }

      // ── Step 3: Record in DB + update balance ────────────────────────────────
      await recordTransaction(
        publicKey,
        isDeposit ? "DEPOSIT" : "WITHDRAWAL",
        xlm,
        txHash
      );

      setStatus("done");
      setTimeout(() => { onSuccess(); handleClose(); }, 1800);

    } catch (err: unknown) {
      console.error(`[${mode}] error:`, err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      // User rejected in Freighter
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

  const accentClass = isDeposit ? "text-blue-400" : "text-orange-400";
  const btnClass = isDeposit
    ? "bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]"
    : "bg-orange-600 hover:bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.3)]";
  const glowClass = isDeposit
    ? "shadow-[0_0_60px_rgba(37,99,235,0.2)]"
    : "shadow-[0_0_60px_rgba(234,88,12,0.15)]";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", damping: 25 }}
            className={`fixed bottom-8 right-8 z-[91] w-80 bg-[#0a0a0f]/98 border border-white/10 rounded-3xl p-6 ${glowClass}`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              {isDeposit
                ? <ArrowDownCircle className={`w-4 h-4 ${accentClass}`} />
                : <ArrowUpCircle className={`w-4 h-4 ${accentClass}`} />}
              <h3 className="text-sm font-bold text-white">
                {isDeposit ? "Deposit to Escrow" : "Withdraw from Escrow"}
              </h3>
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">
              {isDeposit ? "Funds held by smart contract" : `Available: ${currentBalance.toFixed(4)} XLM`}
            </p>

            {/* Amount Input */}
            <div className="relative mb-2">
              <input
                type="number" min="0.0000001" step="any"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setErrorMsg(""); }}
                placeholder="0.00"
                disabled={isLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xl font-bold text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-all pr-16 disabled:opacity-60"
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold ${accentClass}`}>XLM</span>
            </div>

            {/* Quick amounts for withdraw */}
            {!isDeposit && currentBalance > 0 && (
              <div className="flex gap-1.5 mb-4">
                {[0.25, 0.5, 0.75, 1].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setAmount((currentBalance * pct).toFixed(4))}
                    className="flex-1 text-[9px] font-bold text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg py-1.5 transition-all"
                  >
                    {(pct * 100).toFixed(0)}%
                  </button>
                ))}
              </div>
            )}
            {isDeposit && <div className="mb-4" />}

            {/* Status / Error */}
            {(STATUS_MSG[status] || errorMsg) && (
              <div className={`flex items-start gap-2 text-[10px] mb-3 ${
                status === "done" ? "text-green-400" :
                status === "error" ? "text-red-400" : "text-blue-400"
              }`}>
                {status === "error" && <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />}
                {isLoading && status !== "done" && status !== "error" &&
                  <Loader2 className="w-3 h-3 mt-0.5 shrink-0 animate-spin" />}
                <span>{errorMsg || STATUS_MSG[status]}</span>
              </div>
            )}

            {/* Progress bar */}
            {isLoading && (
              <div className="w-full h-0.5 bg-white/5 rounded-full mb-3 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isDeposit ? "bg-blue-500" : "bg-orange-500"}`}
                  animate={{ width: status === "signing" ? "33%" : status === "submitting" ? "66%" : "90%" }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="py-2.5 rounded-xl border border-white/10 text-white/50 text-xs font-bold hover:bg-white/5 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={isLoading || !amount || parseFloat(amount) <= 0}
                className={`py-2.5 rounded-xl ${btnClass} disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1 transition-all`}
              >
                {isLoading
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : isDeposit
                    ? <><ArrowDownCircle className="w-3 h-3" /> Deposit</>
                    : <><ArrowUpCircle className="w-3 h-3" /> Withdraw</>}
              </motion.button>
            </div>

            {/* Network badge */}
            <div className="mt-3 text-[9px] text-white/20 text-center">
              {process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID
                ? `On-chain · ${process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID.slice(0, 8)}…`
                : "Mock mode · no contract set"}
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
  const date = new Date(tx.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 group">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
        isDeposit ? "bg-blue-600/10 border border-blue-600/20" : "bg-orange-500/10 border border-orange-500/20"
      }`}>
        {isDeposit
          ? <ArrowDownCircle className="w-4 h-4 text-blue-400" />
          : <ArrowUpCircle className="w-4 h-4 text-orange-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-white uppercase tracking-wider">
          {isDeposit ? "Deposit" : "Withdrawal"}
        </div>
        {tx.hash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[9px] text-white/30 font-mono hover:text-blue-400 transition-colors flex items-center gap-1 truncate max-w-[180px]"
          >
            {tx.hash.slice(0, 20)}… <ExternalLink className="w-2 h-2 shrink-0" />
          </a>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold ${isDeposit ? "text-blue-400" : "text-orange-400"}`}>
          {isDeposit ? "+" : "-"}{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
        </div>
        <div className="text-[9px] text-white/30">{formatted} · {time}</div>
      </div>
    </div>
  );
}

// ── Sealed Position Component & Claim Logic ────────────────────────────────────
interface SealedPosition {
  marketId: string;
  contractMarketId: number;
  marketTitle: string;
  side: 0 | 1; // 0=Yes, 1=No
  nonce: string;
  bettorKey: string;
  commitment: string;
  amount: string;
  txHash: string;
  status: "SEALED" | "CLAIMED" | "EXPIRED";
}

function SealedPositionCard({ position, onClaimed }: { position: SealedPosition, onClaimed: () => void }) {
  const { publicKey } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [marketState, setMarketState] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkMarket() {
      const state = await getMarket(position.contractMarketId);
      if (state) setMarketState(state);
    }
    checkMarket();
  }, [position.contractMarketId]);

  const canClaim = marketState && marketState.status === 2; // Resolved

  const handleClaim = async () => {
    if (!publicKey) return;
    setClaiming(true);
    setError("");
    try {
      console.log("Generating Reveal Proof...");
      // 1. Generate Reveal Proof
      const input = {
        side: position.side.toString(),
        nonce: position.nonce,
        bettor_key: position.bettorKey,
        winning_side: marketState.outcome.toString() // Assuming outcome is 0 or 1
      };

      // @ts-ignore
      const snarkjs = await import("snarkjs");
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/circuit/reveal/reveal_bet.wasm",
        "/circuit/reveal/reveal_0001.zkey"
      );

      const nullifier = publicSignals[0];
      console.log("Reveal proof generated. Nullifier:", nullifier);

      // 2. Submit to Soroban
      const res = await claimWinnings(
        publicKey,
        position.contractMarketId,
        position.commitment,
        nullifier,
        proof
      );

      if (!res.success || !res.unsignedXdr) throw new Error("Claim tx failed");

      const signedXdr = await freighterSign(res.unsignedXdr);
      const submitRes = await submitSignedXdr(signedXdr);

      if (!submitRes.hash) throw new Error("Submission failed");

      // 3. Update local state
      const portfolio = JSON.parse(localStorage.getItem("zk_portfolio") || "[]");
      const updated = portfolio.map((p: any) => 
        p.commitment === position.commitment ? { ...p, status: "CLAIMED" } : p
      );
      localStorage.setItem("zk_portfolio", JSON.stringify(updated));
      
      onClaimed();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  const calculatePayout = () => {
    if (!marketState) return "Syncing...";
    // Winner receives: bet_amount * payout_bps / 10,000
    const payout = (parseFloat(position.amount) * (marketState.payout_bps || 0)) / 10000;
    return `${payout.toFixed(2)} XLM`;
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white-[0.07] transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">
            {position.side === 0 ? "YES" : "NO"} Position
          </div>
          <h4 className="text-sm font-bold text-white leading-tight">
            {position.marketTitle || (marketState?.title ? (typeof marketState.title === 'string' ? marketState.title : "Cosmic Horizon") : "Syncing Title...")}
          </h4>
        </div>
        <Badge variant="outline" className={position.status === 'CLAIMED' ? 'text-green-400 border-green-500/30' : 'text-blue-400 border-blue-500/30'}>
          {position.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-[9px] text-white/30 uppercase tracking-widest">Stake</div>
          <div className="text-sm font-bold text-white">{position.amount} XLM</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-white/30 uppercase tracking-widest">Est. Payout</div>
          <div className="text-sm font-bold text-green-400">{calculatePayout()}</div>
        </div>
      </div>

      {position.status === "SEALED" && (
        <div className="pt-4 border-t border-white/5">
          {canClaim ? (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : "Reveal & Claim Winnings"}
            </button>
          ) : (
            <div className="text-center text-[10px] text-white/20 uppercase tracking-widest py-2 bg-white/5 rounded-lg border border-white/5">
              {marketState ? `Market ${marketState.status === 1 ? 'Closed (Resolving)' : 'Open'}` : "Syncing On-chain Status..."}
            </div>
          )}
          {error && <p className="text-[10px] text-red-400 mt-2 text-center">{error}</p>}
        </div>
      )}
    </div>
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

  const loadSealedPositions = useCallback(() => {
    if (!publicKey) return;
    const stored = localStorage.getItem("zk_portfolio");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter by current user
      setSealedPositions(parsed.filter((p: any) => p.bettorKey === publicKey));
    }
  }, [publicKey]);

  const loadTransactions = useCallback(async () => {
    if (!publicKey) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/transactions?publicKey=${encodeURIComponent(publicKey)}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setTxLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { 
    loadTransactions(); 
    loadSealedPositions();
  }, [loadTransactions, loadSealedPositions]);

  const copyKey = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Called after a successful deposit or withdrawal
  const handleTxSuccess = useCallback(() => {
    refreshUser();       // re-fetch user.balance from DB
    loadTransactions();  // refresh tx history
  }, [refreshUser, loadTransactions]);

  if (!publicKey) return <WalletGate />;
  if (isLoadingUser) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  );

  const initials = (user?.name ?? publicKey).slice(0, 2).toUpperCase();
  const links: UserLink[] = Array.isArray(user?.links) ? user!.links : [];
  const currentBalance = user?.balance ?? 0;
  const deposits = transactions.filter(t => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
  const withdrawals = transactions.filter(t => t.type === "WITHDRAWAL").reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} />

      {/* Deposit Modal */}
      <EscrowModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        onSuccess={handleTxSuccess}
        mode="deposit"
      />

      {/* Withdraw Modal */}
      <EscrowModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onSuccess={handleTxSuccess}
        mode="withdraw"
        currentBalance={currentBalance}
      />

      <div className="max-w-7xl mx-auto py-8 lg:py-12 px-4 xl:px-0 space-y-8 relative z-10">

        {/* ── Profile Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8 relative overflow-hidden"
        >
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row gap-6 items-start md:items-center">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 lg:w-24 lg:h-24 rounded-2xl overflow-hidden bg-linear-to-br from-blue-600/30 to-violet-600/30 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                {user?.pfpUrl
                  ? <img src={user.pfpUrl} alt={user.name} className="w-full h-full object-cover" />
                  : <span className="text-3xl font-bold text-white/40">{initials}</span>}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-black flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="font-sans uppercase tracking-[0.4em] text-[9px] text-blue-400 mb-1">Portfolio Overview</div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-1">
                {user?.name || "Anonymous Trader"}
              </h1>
              {user?.bio && <p className="text-white/50 text-sm mb-2 max-w-md">{user.bio}</p>}

              <button onClick={copyKey} className="flex items-center gap-2 group/key">
                <span className="text-[10px] font-mono text-white/30 group-hover/key:text-white/50 transition-colors">
                  {publicKey.slice(0, 12)}...{publicKey.slice(-8)}
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

            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => setEditOpen(true)}
              className="shrink-0 flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 font-bold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </motion.button>
          </div>
        </motion.div>

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Total Balance",
              value: `${currentBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`,
              sub: "Held in escrow",
              icon: <Wallet className="w-5 h-5 text-blue-400" />,
            },
            {
              label: "Total Deposited",
              value: `${deposits.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`,
              sub: `${transactions.filter(t => t.type === "DEPOSIT").length} transactions`,
              icon: <ArrowDownCircle className="w-5 h-5 text-green-400" />,
            },
            {
              label: "Total Withdrawn",
              value: `${withdrawals.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`,
              sub: `${transactions.filter(t => t.type === "WITHDRAWAL").length} transactions`,
              icon: <ArrowUpCircle className="w-5 h-5 text-orange-400" />,
            },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/40">{stat.label}</div>
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">{stat.icon}</div>
              </div>
              <div className="text-xl font-bold text-white tracking-tight">{stat.value}</div>
              <div className="text-[10px] text-white/30 mt-1">{stat.sub}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Balance Card + Deposit/Withdraw ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-linear-to-br from-blue-600/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="font-sans uppercase tracking-[0.4em] text-[9px] text-blue-400 mb-2 flex items-center gap-2">
                <TrendingUp className="w-3 h-3" /> Escrow Balance
              </div>
              <div className="text-4xl lg:text-5xl font-bold text-white tracking-tighter">
                {currentBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                <span className="text-white/30 ml-3 text-2xl">XLM</span>
              </div>
              <div className="text-[10px] text-white/30 mt-2 font-mono">
                {process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID
                  ? `Contract: ${process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID.slice(0, 10)}…${process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID.slice(-6)}`
                  : "Mock mode (contract not deployed)"}
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setDepositOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest px-5 py-3 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all"
              >
                <ArrowDownCircle className="w-4 h-4" />
                Deposit
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => setWithdrawOpen(true)}
                disabled={currentBalance <= 0}
                className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-orange-500/10 hover:border-orange-500/20 text-white/60 hover:text-orange-400 font-bold text-xs uppercase tracking-widest px-5 py-3 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUpCircle className="w-4 h-4" />
                Withdraw
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── ZK Sealed Positions ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-sans uppercase tracking-[0.4em] text-[9px] text-blue-400 mb-1">Active Positions</div>
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase tracking-widest">
                <Star className="w-3 h-3" /> ZK-Sealed Vaults
              </div>
            </div>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">
              {sealedPositions.length} active
            </span>
          </div>

          {sealedPositions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="w-6 h-6 text-white/20 mb-3" />
              <p className="text-[10px] text-white/30 uppercase tracking-widest">No open positions</p>
              <p className="text-xs text-white/20 mt-1">Place a bet on the Markets page to see sealed positions here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sealedPositions.map((pos, i) => (
                <SealedPositionCard 
                  key={i} 
                  position={pos} 
                  onClaimed={() => {
                    loadSealedPositions();
                    refreshUser();
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Transaction History ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white/[0.03] backdrop-blur-2xl border border-white/5 rounded-[2rem] p-6 lg:p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-sans uppercase tracking-[0.4em] text-[9px] text-blue-400 mb-1">System Log</div>
              <div className="text-white font-bold tracking-tight">Transaction History</div>
            </div>
            <span className="text-[10px] text-white/30 uppercase tracking-widest">
              {transactions.length} records
            </span>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ArrowDownCircle className="w-6 h-6 text-white/20 mb-3" />
              <p className="text-[10px] text-white/30 uppercase tracking-widest">No transactions yet</p>
              <p className="text-xs text-white/20 mt-1">Deposit XLM to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map(tx => <TxRow key={tx.id} tx={tx} />)}
            </div>
          )}
        </motion.div>

      </div>
    </>
  );
}
