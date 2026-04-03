"use client";

import { useState } from "react";
import { createMarket, submitSignedXdr, getOnchainMarketCount } from "@/lib/escrow";
import { signTransaction } from "@stellar/freighter-api";
import { useRouter } from "next/navigation";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPublicKey: string;
}

export default function CreateMarketModal({
  isOpen,
  onClose,
  userPublicKey,
}: CreateMarketModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [oracle, setOracle] = useState(userPublicKey); // Default to self
  const [closeDate, setCloseDate] = useState("");
  const [bond, setBond] = useState("10"); // Default 10 XLM
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "tx" | "indexing" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  async function handleCreate() {
    if (!title || !closeDate || !bond || !oracle) {
      setErrorMsg("Please fill all required fields.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setStep("tx");

    try {
      const closeTimeUnix = Math.floor(new Date(closeDate).getTime() / 1000);
      const bondNum = parseFloat(bond);

      // Step 0: Get Current Count to Predic ID
      const currentCount = await getOnchainMarketCount();
      const predictedId = currentCount + 1;

      // Step 1: Build Unsigned XDR
      const res = await createMarket(
        userPublicKey,
        title,
        closeTimeUnix,
        bondNum,
        oracle
      );

      if (!res.success || !res.unsignedXdr) {
        throw new Error("Failed to build transaction");
      }

      // Step 2: Sign with Freighter
      const signRes = await signTransaction(res.unsignedXdr, {
        networkPassphrase: "Test SDF Network ; September 2015",
      });

      if (!signRes || !signRes.signedTxXdr) {
        throw new Error("Transaction signing failed or cancelled.");
      }

      // Step 3: Submit to Soroban RPC
      await submitSignedXdr(signRes.signedTxXdr);

      // Step 4: Index in Database
      setStep("indexing");
      const dbRes = await fetch("/api/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractMarketId: predictedId,
          title,
          description,
          creatorId: userPublicKey,
          closeDate: new Date(closeDate).toISOString(),
          bondAmount: bondNum
        }),
      });

      if (!dbRes.ok) {
        console.warn("On-chain success, but indexing delayed.");
      }

      setStep("success");
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred");
      setStep("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="glass-panel w-full max-w-xl rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Glow Effect */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px]" />

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <span className="text-[10px] text-blue-400 font-black tracking-[0.3em] uppercase mb-2 block">
                Protocol Access
              </span>
              <h2 className="text-3xl font-bold text-white tracking-tight">Propose Horizon</h2>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors border border-white/10"
            >
              <span className="material-symbols-outlined text-white/40 text-lg">close</span>
            </button>
          </div>

          {step === "form" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] text-white/30 uppercase font-black tracking-widest pl-1">Market Title (Symbol)</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value.toUpperCase().replace(/\s/g, "_"))}
                  placeholder="E.G. MARS_LANDING_2026"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 transition-colors font-sans text-sm tracking-wider"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-white/30 uppercase font-black tracking-widest pl-1">Detailed Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Precisely define the resolution criteria..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 transition-colors font-sans text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] text-white/30 uppercase font-black tracking-widest pl-1">Oracle Address</label>
                  <input 
                    type="text" 
                    value={oracle}
                    onChange={(e) => setOracle(e.target.value)}
                    placeholder="G..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-white/10 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-white/30 uppercase font-black tracking-widest pl-1">Consensus Deadline</label>
                  <input 
                    type="datetime-local" 
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-sans text-sm h-[54px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center pl-1">
                  <label className="text-[10px] text-white/30 uppercase font-black tracking-widest">Creator Bond (XLM)</label>
                  <span className="text-[9px] text-blue-400 font-bold">Locked until resolution</span>
                </div>
                <input 
                  type="number" 
                  value={bond}
                  onChange={(e) => setBond(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:border-blue-500/50 transition-colors font-sans text-sm"
                />
              </div>

              {errorMsg && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  {errorMsg}
                </div>
              )}

              <button 
                onClick={handleCreate}
                disabled={loading}
                className="w-full bg-white text-black font-black uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 shadow-xl"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Initializing...
                  </>
                ) : (
                  "Propose Marketplace"
                )}
              </button>
            </div>
          )}

          {(step === "tx" || step === "indexing") && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-8">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-2 border-white/5 flex items-center justify-center">
                  <div className="w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin" />
                </div>
                <span className="material-symbols-outlined absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 text-3xl">
                  {step === "tx" ? "account_balance_wallet" : "database"}
                </span>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white tracking-wide">
                  {step === "tx" ? "Authorizing on Stellar" : "Publishing Metadata"}
                </h3>
                <p className="text-xs text-white/40 uppercase tracking-widest leading-relaxed">
                  {step === "tx" 
                    ? "Please sign the transaction in your Freighter wallet to lock the creator bond." 
                    : "Finalizing the cosmic consensus in our global ledger."}
                </p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-8">
              <div className="w-24 h-24 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-green-400 text-4xl animate-bounce">check_circle</span>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white tracking-wide">Horizon Proposed Successfully</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest">Initial consensus reached. Returning to dashboard.</p>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-8">
              <div className="w-24 h-24 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-4xl">error</span>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white tracking-wide">Flow Interrupted</h3>
                <p className="text-[10px] text-red-400/80 uppercase tracking-widest max-w-xs">{errorMsg}</p>
              </div>
              <button 
                onClick={() => setStep("form")}
                className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] text-white font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
              >
                Retry Configuration
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
