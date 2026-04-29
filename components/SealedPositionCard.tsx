"use client";

import { useState, useEffect } from "react";
import { Loader2, Zap, AlertCircle, Lock, Activity, Trophy } from "lucide-react";
import Image from "next/image";
import { useWallet } from "@/components/WalletProvider";
import {
  getMarket,
  claimWinnings,
  submitSignedXdr,
  MarketState,
  SealedPosition
} from "@/lib/escrow";

async function freighterSign(unsignedXdr: string): Promise<string> {
  const { signTransaction } = await import("@stellar/freighter-api");
  const networkPassphrase = "Test SDF Network ; September 2015";
  const result = await signTransaction(unsignedXdr, { networkPassphrase });
  if (typeof result === "string") return result;
  if (result && "signedTxXdr" in result) return (result as { signedTxXdr: string }).signedTxXdr;
  throw new Error("Freighter returned unexpected response");
}

interface SealedPositionCardProps {
  position: SealedPosition;
  onClaimed: () => void;
}

export default function SealedPositionCard({ position, onClaimed }: SealedPositionCardProps) {
  const { publicKey } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [marketState, setMarketState] = useState<MarketState | null>(null);
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
          winning_side: marketState?.outcome?.toString() || "0",
          commitment: position.commitment
        },
        "/circuit/reveal/reveal_bet.wasm",
        "/circuit/reveal/reveal_0001.zkey"
      );
      
      const nullifier = publicSignals[0];
      const res = await claimWinnings(publicKey, position.contractMarketId, position.commitment, nullifier, proof);
      if (!res.success || !res.unsignedXdr) throw new Error("CLAIM TX BUILD FAILURE");
      
      const signedXdr = await freighterSign(res.unsignedXdr);
      const submitRes = await submitSignedXdr(signedXdr);
      if (!submitRes.hash) throw new Error("SUBMISSION FAILURE");
      
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
    <div className="bg-[#0A0A0A] border border-white/[0.08] rounded-3xl p-6 font-mono relative overflow-hidden group hover:border-white/[0.15] transition-all shadow-lg hover:shadow-2xl">
      {/* Market Image Background (Faded) */}
      {position.imageUrl && (
        <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
          <Image fill src={position.imageUrl} alt="" className="object-cover grayscale mix-blend-screen" />
        </div>
      )}
      
      {/* Decorative pulse for open positions */}
      {position.status === "SEALED" && !isResolved && (
        <div className="absolute top-0 right-0 w-32 h-[1px] bg-gradient-to-l from-[#FF8C00]/40 to-transparent animate-pulse" />
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-3">
            <div className={`inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${
              position.isLocalMissing ? "text-white/30 border-white/10 bg-white/[0.03]" : 
              position.side === 0 ? "text-[#FF8C00] border-[#FF8C00]/30 bg-[#FF8C00]/5" : "text-white border-white/20 bg-white/[0.03]"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${position.isLocalMissing ? "bg-white/20" : (position.side === 0 ? "bg-[#FF8C00]" : "bg-white")}`} />
              {position.isLocalMissing ? "Hidden Payload" : `Position: ${sideLabel}`}
            </div>
            <h4 className="text-[13px] font-black text-white leading-snug uppercase tracking-tight line-clamp-2 min-h-[2.5em] group-hover:text-white/90 transition-colors">
              {position.marketTitle || "Syncing data..."}
            </h4>
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
            position.status === "CLAIMED" ? "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/10" : "text-white/30 border-white/10 bg-white/[0.03]"
          }`}>
            {position.status}
          </span>
        </div>

        <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-black/60 border border-white/[0.05] shadow-inner">
          <Activity className="w-4 h-4 text-white/30" />
          <span className="text-[10px] text-white/50 font-medium uppercase tracking-widest">
            CID: {position.commitment.slice(0, 16).toUpperCase()}...
          </span>
          {position.isLocalMissing && (
            <span className="ml-auto text-[9px] text-red-400 font-bold uppercase tracking-widest px-2 py-0.5 bg-red-400/10 rounded-md">Missing</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-white/[0.05] bg-white/[0.02] rounded-2xl p-4">
            <div className="text-[9px] text-white/30 uppercase font-black tracking-[0.2em] mb-2">Initial Stake</div>
            <div className="text-base font-black text-white">{position.amount} <span className="text-[10px] text-white/40">XLM</span></div>
          </div>
          <div className="border border-white/[0.05] bg-white/[0.02] rounded-2xl p-4 relative overflow-hidden">
             {canClaim && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00C853]/5 to-transparent animate-scan" />}
            <div className="relative">
              <div className="text-[9px] text-white/30 uppercase font-black tracking-[0.2em] mb-2">Est. Recovery</div>
              <div className="text-base font-black text-[#00C853]">
                {estimatedPayout !== null ? `${estimatedPayout}` : "???"} <span className="text-[10px] text-[#00C853]/50">XLM</span>
              </div>
            </div>
          </div>
        </div>

        {position.status === "SEALED" && (
          <div>
            {canClaim ? (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full relative overflow-hidden group/btn bg-gradient-to-r from-[#00C853] to-[#00E676] text-black font-black py-4 rounded-xl uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(0,200,83,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                <span className="relative z-10 flex items-center gap-3">
                  {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 fill-black/20" /> Recover Winnings</>}
                </span>
                {!claiming && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 pointer-events-none" />
                )}
              </button>
            ) : isResolved && isWinner === false ? (
              <div className="flex items-center justify-center gap-3 py-3.5 rounded-xl text-red-400 text-[10px] font-black uppercase tracking-widest border border-red-500/20 bg-red-500/10 shadow-inner">
                <AlertCircle className="w-4 h-4" /> Loss Detected
              </div>
            ) : position.isLocalMissing ? (
              <div className="flex items-center justify-center gap-3 py-3.5 rounded-xl text-white/30 text-[10px] font-black uppercase tracking-widest border border-white/[0.05] bg-white/[0.02]">
                <Lock className="w-4 h-4" /> Secrets Missing
              </div>
            ) : (
              <div className="text-center text-[10px] text-white/30 font-black uppercase tracking-[0.2em] py-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                {!marketState ? "Syncing status..." :
                  isClosed ? "Waiting for Oracle" :
                  isResolved ? "Validating eligibility" :
                  "Position Locked"}
              </div>
            )}
            {error && <p className="text-[9px] text-red-400 mt-4 text-center font-bold uppercase tracking-widest">{error}</p>}
          </div>
        )}

        {position.status === "CLAIMED" && (
          <div className="flex items-center justify-center gap-3 py-3.5 rounded-xl text-[#00C853] text-[10px] font-black uppercase tracking-widest bg-[#00C853]/10 border border-[#00C853]/20 shadow-inner">
            <Trophy className="w-4 h-4" /> Recovery Complete
          </div>
        )}
      </div>
    </div>
  );
}
