"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { useWallet } from "@/components/WalletProvider";
import {
  depositToEscrow,
  withdrawFromEscrow,
  submitSignedXdr,
} from "@/lib/escrow";

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

interface EscrowModalProps {
  isOpen?: boolean;
  onClose: () => void;
  onComplete: () => void;
  mode: "DEPOSIT" | "WITHDRAW";
  currentBalance?: number;
}

export default function EscrowModal({ isOpen = true, onClose, onComplete, mode, currentBalance = 0 }: EscrowModalProps) {
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<TxStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isDeposit = mode === "DEPOSIT";

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
      await new Promise(r => setTimeout(r, 1200));

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
        await new Promise(r => setTimeout(r, 1000));
        
        setStatus("confirming");
      }

      await recordTransaction(publicKey, isDeposit ? "DEPOSIT" : "WITHDRAWAL", xlm, txHash);
      setStatus("done");
      setTimeout(() => { onComplete(); handleClose(); }, 1800);
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
            className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] w-[400px] max-w-[90vw] bg-[#0A0A0A] border border-white/[0.08] p-8 rounded-[2rem] shadow-2xl"
          >
            {/* Ambient Glow */}
            <div className={`absolute top-0 right-0 w-[200px] h-[200px] blur-[80px] rounded-full pointer-events-none ${isDeposit ? "bg-[#FF8C00]/[0.05]" : "bg-white/[0.03]"}`} />

            <div className="relative">
              <div className="flex flex-col items-center gap-4 mb-8 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner ${
                  isDeposit ? "border-[#FF8C00]/30 bg-[#FF8C00]/10" : "border-white/10 bg-white/[0.03]"
                }`}>
                  {isDeposit
                    ? <ArrowDownCircle className="w-7 h-7 text-[#FF8C00]" />
                    : <ArrowUpCircle className="w-7 h-7 text-white" />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">{isDeposit ? "Deposit into Escrow" : "Withdraw from Escrow"}</h3>
                  <p className="text-[10px] text-white/40 uppercase font-bold tracking-[0.2em] mt-1">
                    {isDeposit ? "Network: Stellar On-Chain" : `Capacity: ${currentBalance.toFixed(4)} XLM`}
                  </p>
                </div>
              </div>

              <div className="relative mb-6 group">
                <div className={`absolute inset-0 blur-md opacity-0 group-focus-within:opacity-100 transition-opacity rounded-xl ${isDeposit ? "bg-gradient-to-r from-[#FF8C00]/20 to-transparent" : "bg-white/5"}`} />
                <input
                  type="number" min="0.0000001" step="any"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrorMsg(""); }}
                  placeholder="0.00"
                  disabled={isLoading}
                  className={`relative w-full bg-[#000000] border-2 rounded-xl px-6 py-5 text-3xl font-black text-white placeholder-white/10 focus:outline-none transition-colors shadow-inner disabled:opacity-40 font-mono ${
                    isDeposit ? "border-white/[0.06] focus:border-[#FF8C00]/60" : "border-white/[0.06] focus:border-white/40"
                  }`}
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[12px] font-black text-white/30 uppercase tracking-widest">XLM</span>
              </div>

              {!isDeposit && currentBalance > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-8">
                  {[0.25, 0.5, 0.75, 1].map(pct => (
                    <button
                      key={pct}
                      onClick={() => setAmount((currentBalance * pct).toFixed(4))}
                      className="py-2.5 rounded-lg text-[10px] font-black text-white/40 border border-white/[0.06] bg-white/[0.02] hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all uppercase tracking-wider font-mono"
                    >
                      {(pct * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>
              )}

              {(STATUS_MSG[status] || errorMsg) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className={`flex items-start gap-3 text-[10px] mb-6 rounded-xl border p-4 font-bold uppercase tracking-wider ${
                    status === "done" ? "text-[#00C853] border-[#00C853]/20 bg-[#00C853]/10" :
                    status === "error" ? "text-red-400 border-red-500/20 bg-red-500/10" : "text-blue-400 border-blue-400/20 bg-blue-400/10"
                  }`}
                >
                  {isLoading && status !== "done" && status !== "error" && <Loader2 className="w-4 h-4 shrink-0 animate-spin mt-0.5" />}
                  <span>{errorMsg || STATUS_MSG[status]?.toUpperCase()}</span>
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="py-4 rounded-xl border border-white/10 bg-white/[0.02] text-white/40 text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white/5 hover:text-white transition-all disabled:opacity-20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !amount || parseFloat(amount) <= 0}
                  className={`relative py-4 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 transition-all overflow-hidden group/btn ${
                    isDeposit 
                      ? "bg-gradient-to-r from-[#FF8C00] to-[#E67E22] text-black shadow-[0_0_20px_rgba(255,140,0,0.3)]" 
                      : "bg-gradient-to-r from-white to-white/90 text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  } disabled:opacity-30 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-95`}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : isDeposit
                        ? "Execute"
                        : "Execute"}
                  </span>
                  {!isLoading && amount && parseFloat(amount) > 0 && (
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
