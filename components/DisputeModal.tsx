"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { useWallet } from "./WalletProvider";

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketId: string;
  marketTitle: string;
  currentOutcome: "YES" | "NO";
}

export default function DisputeModal({
  isOpen,
  onClose,
  marketId,
  marketTitle,
  currentOutcome,
}: DisputeModalProps) {
  const { publicKey } = useWallet();
  const [proposedOutcome, setProposedOutcome] = useState<"YES" | "NO">(
    currentOutcome === "YES" ? "NO" : "YES"
  );
  const [description, setDescription] = useState("");
  const [urls, setUrls] = useState(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!publicKey) {
      setError("Please connect your wallet");
      return;
    }

    if (description.length > 1000) {
      setError("Description must be 1000 characters or less");
      return;
    }

    const validUrls = urls.filter((url) => url.trim() !== "");

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/disputes/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId,
          challengerAddress: publicKey,
          evidence: {
            description,
            urls: validUrls,
          },
          proposedOutcome,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Challenge submission failed");
      }

      alert("Challenge submitted successfully! Voting period has begun.");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to submit challenge");
    } finally {
      setSubmitting(false);
    }
  };

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
                <h2 className="text-xl font-bold text-white">Challenge Resolution</h2>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                  100 XLM Bond Required
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
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-sm font-bold text-white mb-2">{marketTitle}</h3>
                <div className="flex items-center gap-4 text-[10px] text-white/60 uppercase tracking-widest">
                  <span>Current: <span className="text-white">{currentOutcome}</span></span>
                  <span className="text-white/20">→</span>
                  <span>Proposed: <span className="text-blue-400">{proposedOutcome}</span></span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-white/60 uppercase font-black tracking-widest">
                  Proposed Outcome
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProposedOutcome("YES")}
                    className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                      proposedOutcome === "YES"
                        ? "bg-blue-600 text-white border-blue-400"
                        : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    YES
                  </button>
                  <button
                    onClick={() => setProposedOutcome("NO")}
                    className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                      proposedOutcome === "NO"
                        ? "bg-red-600 text-white border-red-400"
                        : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    NO
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-white/60 uppercase font-black tracking-widest">
                  Evidence Description (Max 1000 chars)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain why the current resolution is incorrect..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm min-h-[120px] focus:outline-none focus:border-blue-500/50 resize-none"
                  maxLength={1000}
                />
                <div className="text-[9px] text-white/40 text-right">
                  {description.length}/1000
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-white/60 uppercase font-black tracking-widest flex items-center gap-2">
                  <LinkIcon className="w-3 h-3" />
                  Evidence URLs (Max 3)
                </label>
                {urls.map((url, i) => (
                  <input
                    key={i}
                    type="url"
                    value={url}
                    onChange={(e) => {
                      const newUrls = [...urls];
                      newUrls[i] = e.target.value;
                      setUrls(newUrls);
                    }}
                    placeholder={`Evidence URL ${i + 1} (optional)`}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-blue-500/50"
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 flex items-start gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="text-xs">{error}</span>
                </div>
              )}

              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 text-yellow-400">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="text-[10px] space-y-1">
                    <p className="font-bold uppercase tracking-widest">Important</p>
                    <p className="opacity-80">
                      Submitting a challenge requires a 100 XLM bond. If your challenge is accepted,
                      you'll receive your bond back plus a 50 XLM reward. If rejected, your bond
                      will be distributed to voters.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                className="w-full bg-white text-black text-xs font-black uppercase tracking-[0.2em] py-4 rounded-xl hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Challenge...
                  </>
                ) : (
                  "Submit Challenge (100 XLM)"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
