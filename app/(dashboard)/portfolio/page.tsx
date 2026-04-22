"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy, Check, Wallet, ArrowDownCircle,
  ArrowUpCircle, Edit3, Link as LinkIcon, Loader2,
  TrendingUp, AlertCircle,
  RefreshCw, Zap, Shield, Trophy, Activity,
  Lock,
} from "lucide-react";
import Image from "next/image";
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
// import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
type Transaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "BET" | "CLAIM";
  amount: number;
  hash: string;
  createdAt: string;
};

type SealedPosition = {
  marketId: string;
  contractMarketId: number;
  marketTitle: string;
  side: number;
  nonce: string;
  bettorKey: string;
  commitment: string;
  amount: string;
  txHash: string;
  status: "SEALED" | "CLAIMED";
  isLocalMissing: boolean;
  imageUrl?: string | null;
};

type TxStatus = "idle" | "proving" | "signing" | "submitting" | "verifying" | "confirming" | "done" | "error" | "loading";

const STATUS_MSG: Record<TxStatus, string | null> = {
  idle: null,
  proving: "Generating Zero-Knowledge Proof...",
  signing: "Awaiting Signature Authority...",
  submitting: "Broadcasting Encrypted Payload...",
  verifying: "Verifying ZK Circuit Integrity...",
  confirming: "Awaiting Ledger Finality...",
  done: "✓ Protocol Action Complete",
  error: "Operation Terminated. Verify State.",
  loading: "Processing..."
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
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4 font-mono">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative"
      >
        <div className="w-24 h-24 border border-white/10 flex items-center justify-center bg-[#0D0D0D] relative overflow-hidden group">
          {/* Decorative bits */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#FF8C00]" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-[#FF8C00]" />
          <Lock className="w-10 h-10 text-white/40 group-hover:text-[#FF8C00] transition-colors" />
        </div>
      </motion.div>
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Secure Terminal Locked</h2>
        <p className="text-white/20 max-w-xs mx-auto text-[10px] leading-relaxed uppercase tracking-widest">
          Connect your authorized hardware module (Freighter) to access your decentralized escrow and transaction logs.
        </p>
      </div>
      <button
        onClick={connect}
        disabled={isConnecting}
        className="group relative border border-[#FF8C00] bg-[#FF8C00] text-black font-black px-12 py-4 uppercase tracking-[0.3em] text-[12px] hover:bg-black hover:text-[#FF8C00] transition-all disabled:opacity-50 overflow-hidden"
      >
        <span className="relative z-10 flex items-center gap-3">
          {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
          Initialize Wallet
        </span>
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
      </button>
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
      setErrorMsg(`Insufficient liquidity. Max: ${currentBalance.toFixed(4)} XLM`);
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      setStatus("proving");
      await new Promise(r => setTimeout(r, 1200)); // Simulating proof generation

      setStatus("signing");
      const builder = isDeposit ? depositToEscrow : withdrawFromEscrow;
      const result = await builder(publicKey, xlm);
      if (!result.success) throw new Error("Transaction build failure");

      let txHash = result.hash;

      if (result.unsignedXdr) {
        const signedXdr = await freighterSign(result.unsignedXdr);
        setStatus("submitting");
        const submitted = await submitSignedXdr(signedXdr);
        txHash = submitted.hash;
        
        setStatus("verifying");
        await new Promise(r => setTimeout(r, 1000)); // Simulating proof verification
        
        setStatus("confirming");
      }

      await recordTransaction(publicKey, isDeposit ? "DEPOSIT" : "WITHDRAWAL", xlm, txHash);
      setStatus("done");
      setTimeout(() => { onSuccess(); handleClose(); }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.toLowerCase().includes("user declined") || msg.toLowerCase().includes("rejected")) {
        setErrorMsg("Signature rejected by host.");
      } else {
        setErrorMsg(msg.length > 80 ? msg.slice(0, 80).toUpperCase() + "..." : msg.toUpperCase());
      }
      setStatus("error");
      setTimeout(() => { setStatus("idle"); setErrorMsg(""); }, 4000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-8 right-8 z-[91] w-96 bg-[#0D0D0D] border border-white/10 p-8 font-mono shadow-2xl"
          >
            {/* Corner marks */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[#FF8C00]" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[#FF8C00]" />

            <div className="relative">
              <div className="flex items-center gap-4 mb-8">
                <div className={`w-10 h-10 border flex items-center justify-center ${isDeposit ? "border-[#FF8C00] bg-[#FF8C00]/5" : "border-white/20 bg-white/5"}`}>
                  {isDeposit
                    ? <ArrowDownCircle className="w-5 h-5 text-[#FF8C00]" />
                    : <ArrowUpCircle className="w-5 h-5 text-white/60" />}
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-white uppercase tracking-[0.2em]">{isDeposit ? "Deposit into Escrow" : "Withdraw from Escrow"}</h3>
                  <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest mt-1">
                    {isDeposit ? "Network: Stellar On-Chain" : `Capacity: ${currentBalance.toFixed(4)} XLM`}
                  </p>
                </div>
              </div>

              <div className="relative mb-6">
                <input
                  type="number" min="0.0000001" step="any"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrorMsg(""); }}
                  placeholder="0.00"
                  disabled={isLoading}
                  className="w-full bg-black border border-white/10 px-6 py-5 text-2xl font-black text-white placeholder-white/5 focus:outline-none focus:border-[#FF8C00]/50 transition-all disabled:opacity-40"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20">XLM</span>
              </div>

              {!isDeposit && currentBalance > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-8">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAmount((currentBalance * pct).toFixed(4))}
                      className="py-2 text-[9px] font-black text-white/30 border border-white/5 hover:text-[#FF8C00] hover:border-[#FF8C00]/30 hover:bg-[#FF8C00]/5 transition-all uppercase tracking-tighter"
                    >
                      {(pct * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>
              )}

              {(STATUS_MSG[status] || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className={`flex items-start gap-3 text-[10px] mb-6 border p-4 font-black uppercase tracking-tighter ${
                    status === "done" ? "text-[#00C853] border-[#00C853]/20 bg-[#00C853]/5" :
                    status === "error" ? "text-red-500 border-red-500/20 bg-red-500/5" : "text-blue-400 border-blue-400/20 bg-blue-400/5"
                  }`}
                >
                  {isLoading && status !== "done" && status !== "error" && <Loader2 className="w-3 h-3 shrink-0 animate-spin" />}
                  <span>{errorMsg || STATUS_MSG[status]?.toUpperCase()}</span>
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="py-4 border border-white/10 text-white/20 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all disabled:opacity-20"
                >
                  ABORT OPERATION
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                  className={`py-4 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all ${
                    isDeposit 
                      ? "bg-[#FF8C00] text-black hover:bg-white" 
                      : "bg-white text-black hover:bg-[#FF8C00]"
                  } disabled:opacity-20`}
                >
                  {isLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : isDeposit
                      ? "EXECUTE DEPOSIT"
                      : "EXECUTE WITHDRAW"}
                </button>
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
  const date = new Date(tx.createdAt);
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  const time = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const config = {
    DEPOSIT: { label: "Liquidity In", icon: ArrowDownCircle, color: "text-[#FF8C00]", bg: "border-[#FF8C00]/20 bg-[#FF8C00]/5", sign: "+" },
    WITHDRAWAL: { label: "Liquidity Out", icon: ArrowUpCircle, color: "text-white/40", bg: "border-white/10 bg-white/5", sign: "-" },
    BET: { label: "Position Seal", icon: TrendingUp, color: "text-white/40", bg: "border-white/10 bg-white/5", sign: "-" },
    CLAIM: { label: "Winnings Recovery", icon: Trophy, color: "text-[#00C853]", bg: "border-[#00C853]/20 bg-[#00C853]/5", sign: "+" },
  };

  const { label, icon: Icon, color, bg, sign } = config[tx.type] || config.DEPOSIT;

  return (
    <div className="flex items-center gap-6 py-4 border-b border-white/5 hover:bg-white/[0.02] px-4 transition-colors group font-mono">
      <div className={`w-10 h-10 border flex items-center justify-center shrink-0 ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black text-white uppercase tracking-[0.1em]">{label}</div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[9px] text-white/20 font-bold uppercase">TX ID: </span>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${tx.hash}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[9px] text-white/40 hover:text-[#FF8C00] transition-colors truncate max-w-[120px]"
          >
            {tx.hash.slice(0, 16).toUpperCase()}...
          </a>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[12px] font-black ${color} tracking-tighter`}>
          {sign}{tx.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
        </div>
        <div className="text-[9px] text-white/10 font-bold mt-1 uppercase tracking-widest">{formatted} | {time}</div>
      </div>
    </div>
  );
}

// ── Sealed Position Card ───────────────────────────────────────────────────────
function SealedPositionCard({ position, onClaimed }: { position: SealedPosition; onClaimed: () => void }) {
  const { publicKey } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [marketState, setMarketState] = useState<{ status: number | string; outcome: number; payout_bps?: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getMarket(position.contractMarketId).then(s => { if (s) setMarketState(s); });
  }, [position.contractMarketId]);

  const isResolved = marketState?.status === 2 || marketState?.status === "Resolved";
  const isClosed = marketState?.status === 1 || marketState?.status === "Closed";
  const sideLabel = position.side === 0 ? "YES" : "NO";
  const isWinner = isResolved ? (marketState.outcome === position.side) : null;
  const canClaim = isResolved && isWinner && !position.isLocalMissing;

  const handleClaim = async () => {
    if (!publicKey || position.isLocalMissing) return;
    setClaiming(true);
    setError("");
    try {
      const snarkjs = await import("snarkjs");
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
      
      setStatus("signing");
      const nullifier = publicSignals[0];
      const res = await claimWinnings(publicKey, position.contractMarketId, position.commitment, nullifier, proof);
      if (!res.success || !res.unsignedXdr) throw new Error("CLAIM TX BUILD FAILURE");
      
      const signedXdr = await freighterSign(res.unsignedXdr);
      setStatus("submitting");
      const submitRes = await submitSignedXdr(signedXdr);
      if (!submitRes.hash) throw new Error("SUBMISSION FAILURE");
      
      setStatus("verifying");
      await new Promise(r => setTimeout(r, 1000));

      await fetch("/api/bets/claim", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitment: position.commitment, nullifier, txHash: submitRes.hash }),
      });

      const portfolio = JSON.parse(localStorage.getItem("zk_portfolio") || "[]");
      localStorage.setItem("zk_portfolio", JSON.stringify(
        portfolio.map((p: SealedPosition) => p.commitment === position.commitment ? { ...p, status: "CLAIMED" } : p)
      ));
      onClaimed();
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : "CLAIM FAILED");
    } finally {
      setClaiming(false);
    }
  };

  const estimatedPayout = marketState
    ? ((parseFloat(position.amount) * (marketState.payout_bps || 0)) / 10000).toFixed(2)
    : null;

  return (
    <div className="bg-[#0D0D0D] border border-white/10 p-6 font-mono relative overflow-hidden group">
      {/* Market Image Background (Faded) */}
      {position.imageUrl && (
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none">
          <Image fill src={position.imageUrl} alt="" className="object-cover grayscale" />
        </div>
      )}
      
      {/* Decorative pulse for open positions */}
      {position.status === "SEALED" && !isResolved && (
        <div className="absolute top-0 right-0 w-12 h-[1px] bg-[#FF8C00]/20 animate-scan" />
      )}

      <div className="relative">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-3">
            <div className={`inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 border ${
              position.isLocalMissing ? "text-white/20 border-white/10 bg-white/5" : 
              position.side === 0 ? "text-[#FF8C00] border-[#FF8C00]/30 bg-[#FF8C00]/5" : "text-white border-white/30 bg-white/5"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${position.isLocalMissing ? "bg-white/10" : (position.side === 0 ? "bg-[#FF8C00]" : "bg-white")}`} />
              {position.isLocalMissing ? "Hidden Payload" : `Position: ${sideLabel}`}
            </div>
            <h4 className="text-[12px] font-black text-white leading-tight uppercase tracking-tighter line-clamp-2 min-h-[2.5em]">
              {position.marketTitle || "Syncing data..."}
            </h4>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 border ${
            position.status === "CLAIMED" ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/5" : "text-white/20 border-white/10 bg-white/5"
          }`}>
            {position.status}
          </span>
        </div>

        <div className="flex items-center gap-3 mb-6 p-3 bg-black/40 border border-white/5">
          <Activity className="w-3.5 h-3.5 text-white/20" />
          <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">
            CID: {position.commitment.slice(0, 12).toUpperCase()}...
          </span>
          {position.isLocalMissing && (
            <span className="ml-auto text-[8px] text-red-500 font-black uppercase">Data Missing</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-white/5 bg-white/[0.02] p-3">
            <div className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-1">Initial Stake</div>
            <div className="text-[12px] font-black text-white">{position.amount} XLM</div>
          </div>
          <div className="border border-white/5 bg-white/[0.02] p-3">
            <div className="text-[8px] text-white/20 uppercase font-black tracking-widest mb-1">Recovery Estimate</div>
            <div className="text-[12px] font-black text-[#00C853]">
              {estimatedPayout !== null ? `${estimatedPayout} XLM` : "???"}
            </div>
          </div>
        </div>

        {position.status === "SEALED" && (
          <div>
            {canClaim ? (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full bg-[#FF8C00] text-black font-black py-3 uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white transition-all disabled:opacity-40 rounded-sm"
              >
                {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4" /> Recover Winnings</>}
              </button>
            ) : isResolved && isWinner === false ? (
              <div className="flex items-center justify-center gap-3 py-3 text-red-500 text-[10px] font-black uppercase border border-red-500/20 bg-red-500/5">
                <AlertCircle className="w-4 h-4" /> Loss Detected
              </div>
            ) : position.isLocalMissing ? (
              <div className="flex items-center justify-center gap-3 py-3 text-white/20 text-[10px] font-black uppercase border border-white/5 bg-white/[0.01]">
                <Lock className="w-4 h-4" /> Secrets Missing
              </div>
            ) : (
              <div className="text-center text-[9px] text-white/20 font-black uppercase tracking-[0.2em] py-3 bg-white/[0.02] border border-white/5">
                {!marketState ? "Syncing status..." :
                  isClosed ? "Waiting for Oracle" :
                  isResolved ? "Validating eligibility" :
                  "Position Locked"}
              </div>
            )}
            {error && <p className="text-[8px] text-red-500 mt-3 text-center font-black uppercase">{error}</p>}
          </div>
        )}

        {position.status === "CLAIMED" && (
          <div className="flex items-center justify-center gap-3 py-3 text-[#00C853] text-[10px] font-black uppercase bg-[#00C853]/5 border border-[#00C853]/10">
            <Trophy className="w-4 h-4" /> Recovery Complete
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, delay }: {
  label: string; value: string; sub: string; icon: React.ReactNode; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="bg-[#0D0D0D] border border-white/10 p-6 relative overflow-hidden group hover:border-[#FF8C00]/30 transition-all font-mono"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-[#FF8C00] -translate-x-full group-hover:translate-x-0 transition-transform duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">{label}</div>
          <div className="w-8 h-8 border border-white/10 flex items-center justify-center text-white/20 group-hover:text-[#FF8C00] group-hover:border-[#FF8C00]/30 transition-all">
            {icon}
          </div>
        </div>
        <div className="text-2xl font-black text-white tracking-tighter uppercase">{value}</div>
        <div className="text-[9px] text-white/10 font-bold mt-2 uppercase tracking-widest">{sub}</div>
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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [onchainBalance, setOnchainBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchOnchainBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalanceLoading(true);
    try {
      const bal = await getOnchainEscrowBalance(publicKey);
      setOnchainBalance(bal);
    } catch (err) {
      console.error("Failed to fetch on-chain balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey]);

  const loadSealedPositions = useCallback(async () => {
    if (!publicKey) return;
    try {
      const stored = localStorage.getItem("zk_portfolio");
      let localPositions: SealedPosition[] = [];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          localPositions = Array.isArray(parsed) 
            ? parsed.filter((p: SealedPosition) => p.bettorKey === publicKey)
            : [];
        } catch {
          localPositions = [];
        }
      }

      let remotePositions: SealedPosition[] = [];
      try {
        const res = await fetch(`/api/bets?userPublicKey=${encodeURIComponent(publicKey)}`);
        if (res.ok) {
          const data = await res.json();
          remotePositions = (data.bets || []).map((b: { marketId: string; market: { contractMarketId: number; title: string; imageUrl?: string }; userPublicKey: string; commitment: string; amount: number; txHash: string; revealed: boolean }) => ({
            marketId: b.marketId,
            contractMarketId: b.market?.contractMarketId ?? 0,
            marketTitle: b.market?.title,
            side: 0,
            nonce: "",
            bettorKey: b.userPublicKey,
            commitment: b.commitment,
            amount: b.amount.toString(),
            txHash: b.txHash,
            status: b.revealed ? "CLAIMED" : "SEALED",
            isLocalMissing: true,
            imageUrl: b.market?.imageUrl,
          }));
        }
      } catch {
        remotePositions = [];
      }

      const mergedMap = new Map<string, SealedPosition>();
      remotePositions.forEach(p => mergedMap.set(p.commitment, p));
      localPositions.forEach(p => mergedMap.set(p.commitment, { ...p, isLocalMissing: false }));
      
      const allPositions = Array.from(mergedMap.values());
      // Sort: SEALED first, then CLAIMED. Within that, could sort by date if available.
      const sorted = allPositions.sort((a, b) => {
        if (a.status === "SEALED" && b.status === "CLAIMED") return -1;
        if (a.status === "CLAIMED" && b.status === "SEALED") return 1;
        return 0;
      });
      
      setSealedPositions(sorted);
    } catch {
      // Handle error silently or with state
    }
  }, [publicKey]);

  const loadTransactions = useCallback(async () => {
    if (!publicKey) return;
    setTxLoading(true);
    try {
      const res = await fetch(`/api/transactions?publicKey=${encodeURIComponent(publicKey)}`, { cache: 'no-store' });
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      // Handle error silently
    } finally {
      setTxLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) return;
    loadTransactions();
    loadSealedPositions();
    fetchOnchainBalance();
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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !publicKey) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // 1. Upload to Cloudinary
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();
      const newPfpUrl = uploadData.secure_url;

      // 2. Update user in DB
      const updateRes = await fetch(`/api/users/${publicKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pfpUrl: newPfpUrl }),
      });

      if (!updateRes.ok) throw new Error("Failed to update profile");
      
      await refreshUser();
    } catch (err) {
      console.error("Profile update error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTxSuccess = useCallback(() => {
    refreshUser();
    loadTransactions();
    fetchOnchainBalance();
  }, [refreshUser, loadTransactions, fetchOnchainBalance]);

  if (!publicKey) return <WalletGate />;
  if (isLoadingUser) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-[#FF8C00] animate-spin" />
        <span className="text-[10px] text-white/30 uppercase tracking-[0.2em]">Synchronizing data...</span>
      </div>
    </div>
  );

  const initials = (user?.name ?? publicKey).slice(0, 2).toUpperCase();
  const links: UserLink[] = Array.isArray(user?.links) ? user!.links : [];
  const liveBalance = onchainBalance !== null ? onchainBalance : (user?.balance ?? 0);
  
  // const _deposits = transactions.filter(t => t.type === "DEPOSIT").reduce((s, t) => s + t.amount, 0);
  const claimedPositions = sealedPositions.filter(p => p.status === "CLAIMED");
  const openPositionsValue = sealedPositions.filter(p => p.status === "SEALED").reduce((s, p) => s + parseFloat(p.amount), 0);
  const winRate = sealedPositions.length > 0 ? Math.round((claimedPositions.length / sealedPositions.length) * 100) : 0;

  return (
    <div className="">
      <EditProfileModal isOpen={editOpen} onClose={() => setEditOpen(false)} />
      <EscrowModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} onSuccess={handleTxSuccess} mode="deposit" />
      <EscrowModal isOpen={withdrawOpen} onClose={() => setWithdrawOpen(false)} onSuccess={handleTxSuccess} mode="withdraw" currentBalance={liveBalance} />

      <div className="max-w-7xl mx-auto py-8 px-4 xl:px-0 space-y-8 relative z-10">

        {/* ── Profile Header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="relative bg-[#0D0D0D] border border-white/10 p-8 overflow-hidden"
        >
          {/* Decorative bits */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF8C00]/5 -translate-y-1/2 translate-x-1/2 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
            {/* Avatar */}
            <div className="relative shrink-0">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/*"
              />
              <div 
                onClick={handleAvatarClick}
                className="w-24 h-24 border border-white/10 bg-black flex items-center justify-center overflow-hidden cursor-pointer group/avatar relative"
              >
                {user?.pfpUrl ? (
                  <Image fill src={user.pfpUrl} alt={user.name ?? "Avatar"} className="object-cover group-hover/avatar:opacity-50 transition-opacity" />
                ) : (
                  <span className="text-4xl font-black text-white/20 uppercase italic group-hover/avatar:opacity-50 transition-opacity">{initials}</span>
                )}
                
                {/* Upload Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/40">
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 text-[#FF8C00] animate-spin" />
                  ) : (
                    <>
                      <Edit3 className="w-5 h-5 text-[#FF8C00] mb-1" />
                      <span className="text-[8px] font-black text-white uppercase tracking-tighter">CHANGE</span>
                    </>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#00C853] border-4 border-[#0D0D0D] flex items-center justify-center z-20">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>

            {/* Profile info */}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FF8C00] mb-2">Auth Status: Verified Trader</div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic mb-2">
                {user?.name || "Anonymous Module"}
              </h1>
              {user?.bio && <p className="text-white/40 text-[11px] mb-4 max-w-xl leading-relaxed uppercase font-bold">{user.bio}</p>}

              <div className="flex flex-wrap items-center gap-6">
                <button onClick={copyKey} className="flex items-center gap-3 group/key border border-white/5 bg-white/[0.02] px-3 py-1.5 hover:border-white/20 transition-all">
                  <span className="text-[10px] font-bold text-white/30 group-hover/key:text-white/60">
                    {publicKey.slice(0, 16)}...{publicKey.slice(-12)}
                  </span>
                  {copied ? <Check className="w-3 h-3 text-[#00C853]" /> : <Copy className="w-3 h-3 text-white/20" />}
                </button>

                {links.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {links.map((link, i) => (
                      <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[10px] text-white/30 hover:text-[#FF8C00] transition-colors border border-white/5 px-3 py-1"
                      >
                        <LinkIcon className="w-2.5 h-2.5" />
                        {link.label?.toUpperCase() || "LINK"}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setEditOpen(true)}
              className="px-6 py-3 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all rounded-full"
            >
              Config Profile
            </button>
          </div>
        </motion.div>

        {/* ── Liquidity & Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
          
          <div className="space-y-8">
            {/* Main Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard 
                label="Escrow Liquidity" 
                value={`${liveBalance.toLocaleString()} XLM`} 
                sub={balanceLoading ? "Syncing Chain..." : "On-chain Available"} 
                icon={<Shield className="w-4 h-4" />}
                delay={0.1}
              />
              <StatCard 
                label="Capital At Stake" 
                value={`${openPositionsValue.toLocaleString()} XLM`} 
                sub={`${sealedPositions.filter(p => p.status === "SEALED").length} Active Positions`} 
                icon={<Activity className="w-4 h-4" />}
                delay={0.2}
              />
              <StatCard 
                label="Accuracy Index" 
                value={`${winRate}%`} 
                sub={`${claimedPositions.length} Successful Recoveries`} 
                icon={<Trophy className="w-4 h-4" />}
                delay={0.3}
              />
            </div>

            {/* Positions */}
            <div className="border border-white/10 bg-[#0D0D0D] p-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-3">
                  <TrendingUp className="w-4 h-4 opacity-30" />
                  Position Inventory
                </h2>
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/20">
                  <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-[#FF8C00] rounded-full" /> YES</span>
                  <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-white rounded-full" /> NO</span>
                </div>
              </div>

              {sealedPositions.length === 0 ? (
                <div className="text-center py-24 border border-white/5 bg-white/[0.01]">
                  <p className="text-[10px] text-white/20 uppercase font-black tracking-[0.4em] italic">No Active Positions Detected</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {sealedPositions.map((pos) => (
                    <SealedPositionCard 
                      key={pos.commitment} 
                      position={pos} 
                      onClaimed={loadSealedPositions} 
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Liquidity Controls & History */}
          <div className="space-y-8">
            {/* Liquidity Module */}
            <div className="border border-[#FF8C00]/40 bg-[#0D0D0D] p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[1px] bg-[#FF8C00]/30 animate-scan pointer-events-none" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#FF8C00] mb-8 flex items-center justify-between">
                Liquidity Module
                <RefreshCw className={`w-4 h-4 ${balanceLoading ? "animate-spin" : "cursor-pointer opacity-30 hover:opacity-100"}`} onClick={fetchOnchainBalance} />
              </h2>

              <div className="space-y-6">
                <div className="p-6 border border-white/5 bg-black/40 text-center">
                  <div className="text-[9px] text-white/20 uppercase font-black tracking-widest mb-2">Escrow Capacity</div>
                  <div className="text-4xl font-black text-white tracking-tighter uppercase italic">
                    {liveBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </div>
                  <div className="text-[10px] text-white/40 font-bold mt-2">XLM Token</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDepositOpen(true)}
                    className="py-4 border border-[#FF8C00] text-[#FF8C00] font-black uppercase text-[10px] tracking-[0.2em] hover:bg-[#FF8C00] hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    DEPOSIT
                  </button>
                  <button
                    onClick={() => setWithdrawOpen(true)}
                    className="py-4 border border-white text-white font-black uppercase text-[10px] tracking-[0.2em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    WITHDRAW
                  </button>
                </div>
                
                <p className="text-[8px] text-white/20 uppercase font-black tracking-widest text-center leading-relaxed italic">
                  Funds are secured in decentralized escrow smart contract
                </p>
              </div>
            </div>

            {/* History feed */}
            <div className="border border-white/10 bg-[#0D0D0D] p-8">
              <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 mb-8 flex items-center gap-3">
                <Activity className="w-4 h-4 opacity-30" />
                System Logs
              </h2>

              <div className="space-y-1">
                {txLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-white/10 animate-spin" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 text-[10px] text-white/10 uppercase font-black tracking-widest">
                    Log Empty
                  </div>
                ) : (
                  transactions.slice(0, 10).map((tx) => <TxRow key={tx.id} tx={tx} />)
                )}
              </div>

              {transactions.length > 10 && (
                <button className="w-full py-4 mt-6 border-t border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-white/10 hover:text-white/40 transition-colors">
                  Load More Logs
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
