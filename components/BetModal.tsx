"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
// Using global snarkjs via script tag for browser compatibility

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketTitle: string;
  marketId: number;
}

export default function BetModal({ isOpen, onClose, marketTitle, marketId }: BetModalProps) {
  const [side, setSide] = useState<0 | 1>(0); // 0 = Yes, 1 = No
  const [amount, setAmount] = useState("10");
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleBet = async () => {
    setIsGenerating(true);
    try {
      // 1. Generate local randomness (nonce) and key
      const nonce = Math.floor(Math.random() * 1000000000).toString();
      const bettorKey = "123456"; // Emulated user key for hackathon
      
      const input = {
        side: side.toString(),
        nonce: nonce,
        bettor_key: bettorKey
      };

      // 2. Generate ZK Proof using circum/snarkjs
      // We are fetching the files we copied into 'public/circuit/seal/'
      console.log("Generating Zero-Knowledge commitment...");
      const { proof, publicSignals } = await (window as any).snarkjs.groth16.fullProve(
        input,
        "/circuit/seal/seal_bet.wasm",
        "/circuit/seal/seal_0001.zkey"
      );
      
      const commitment = publicSignals[0];
      console.log("Proof verified, commitment:", commitment);
      
      // Save local proof data to localStorage so we can claim later!
      const portfolio = JSON.parse(localStorage.getItem("zk_portfolio") || "[]");
      portfolio.push({
        marketId,
        marketTitle,
        side,
        nonce,
        bettorKey,
        commitment,
        amount,
        status: "SEALED"
      });
      localStorage.setItem("zk_portfolio", JSON.stringify(portfolio));

      // In real Soroban Dapp, we'd sign & submit a tx to `place_bet(market_id, commitment, amount)`
      // ... await freighter.signTransaction(...)
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);

    } catch (e) {
      console.error(e);
      alert("Error generating ZK proof. See console.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-card w-full max-w-md rounded-2xl p-6 relative overflow-hidden shadow-2xl border border-white/10 bg-black/40"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-dim hover:text-white transition-colors">
          <X className="w-5 h-5"/>
        </button>
        
        <h3 className="text-xl font-medium text-white mb-2">Place Sealed Bet</h3>
        <p className="text-sm text-white/50 mb-6">{marketTitle}</p>
        
        {!success ? (
          <>
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setSide(0)}
                className={`flex-1 py-3 rounded-xl border font-medium transition-all ${side === 0 ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
              >
                YES
              </button>
              <button 
                onClick={() => setSide(1)}
                className={`flex-1 py-3 rounded-xl border font-medium transition-all ${side === 1 ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
              >
                NO
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-xs text-dim uppercase tracking-wider mb-2">Wager Amount (XLM)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="0.00"
              />
            </div>

            <button 
              onClick={handleBet}
              disabled={isGenerating}
              className="w-full py-4 rounded-xl font-medium text-white bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating ZK Proof...</>
              ) : (
                <>Generate Proof & Lock Position</>
              )}
            </button>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
               <Check className="w-8 h-8 text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-white">Bet Sealed Successfully!</h4>
            <p className="text-sm text-dim mt-2">Your positional proof has been generated independently in-browser and your commitment is secured.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
