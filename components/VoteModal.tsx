"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Loader2, Scale, Users } from "lucide-react";
import { useWallet } from "./WalletProvider";

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  disputeId: string;
  marketTitle: string;
  currentOutcome: "YES" | "NO";
  proposedOutcome: "YES" | "NO";
  evidence: {
    description: string;
    urls: string[];
  };
}

export default function VoteModal({
  isOpen,
  onClose,
  disputeId,
  marketTitle,
  currentOutcome,
  proposedOutcome,
  evidence,
}: VoteModalProps) {
  const { publicKey } = useWallet();
  const [selectedOutcome, setSelectedOutcome] = useState<"ORIGINAL" | "CHALLENGE">("CHALLENGE");
  const [stake, setStake] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [reputation, setReputation] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && publicKey) {
      fetchReputation();
    }
  }, [isOpen, publicKey]);

  const fetchReputation = async () => {
    if (!publicKey) return;
    
    try {
      const res = await fetch(`/api/users/${publicKey}/reputation`);
      if (res.ok) {
        const data = await res.json();
        setReputation(data.score);
      }
    } catch (err) {
      console.error("Failed to fetch reputation:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (reputation === null || reputation <= 300) {
      setError("Reputation score above 300 required to vote");
      return;
    }

    const stakeAmount = parseFloat(stake);
    if (isNaN(stakeAmount) || stakeAmount < 10) {
      setError("Minimum stake is 10 XLM");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/disputes/${disputeId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voterAddress: publicKey,
          outcome: selectedOutcome === "ORIGINAL" ? currentOutcome : proposedOutcome,
          stake: stakeAmount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Vote submission failed");
      }

      alert("Vote submitted successfully!");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit vote");
    } finally {
      setSubmitting(false);
    }
  };

  const voteWeight = reputation ? (reputation / 1000).toFixed(3) : "0.000";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-black border border-white/10 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-black/95 backdrop-blur-xl border-b border-white/10 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Vote on Dispute
                </h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                  Min 10 XLM Stake Required
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                </div>
              ) : (
                <>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">{marketTitle}</h3>
                    <div className="grid grid-cols-2 gap-4 text-[10px]">
                      <div>
                        <span className="text-white/40 uppercase tracking-widest block mb-1">
                          Original Resolution
                        </span>
                        <span className="text-white font-bold">{currentOutcome}</span>
                      </div>
                      <div>
                        <span className="text-white/40 uppercase tracking-widest block mb-1">
                          Challenged To
                        </span>
                        <span className="text-blue-400 font-bold">{proposedOutcome}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                    <h4 className="text-[10px] text-white/60 uppercase font-black tracking-widest">
                      Challenge Evidence
                    </h4>
                    <p className="text-xs text-white/80 leading-relaxed">{evidence.description}</p>
                    {evidence.urls.length > 0 && (
                      <div className="space-y-2 pt-2">
                        {evidence.urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:text-blue-300 underline block truncate"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span className="text-[10px] text-blue-400 uppercase font-black tracking-widest">
                        Your Voting Power
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-white/40 block">Reputation</span>
                        <span className="text-white font-bold">{reputation}</span>
                      </div>
                      <div>
                        <span className="text-white/40 block">Vote Weight</span>
                        <span className="text-white font-bold">{voteWeight}×</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/60 uppercase font-black tracking-widest">
                      Your Vote
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedOutcome("ORIGINAL")}
                        className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                          selectedOutcome === "ORIGINAL"
                            ? "bg-white text-black border-white"
                            : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        Keep {currentOutcome}
                      </button>
                      <button
                        onClick={() => setSelectedOutcome("CHALLENGE")}
                        className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                          selectedOutcome === "CHALLENGE"
                            ? "bg-blue-600 text-white border-blue-400"
                            : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        Change to {proposedOutcome}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-white/60 uppercase font-black tracking-widest">
                      Stake Amount (XLM)
                    </label>
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      min="10"
                      step="1"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                    <p className="text-[9px] text-white/40">
                      Minimum 10 XLM required. Your stake will be returned after voting ends.
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 flex items-start gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="text-xs">{error}</span>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !reputation || reputation <= 300}
                    className="w-full bg-white text-black text-xs font-black uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting Vote...
                      </>
                    ) : (
                      `Submit Vote (${stake} XLM)`
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
