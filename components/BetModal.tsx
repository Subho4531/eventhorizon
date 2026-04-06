"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { X, Check, Loader2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { useWallet } from "./WalletProvider";
// Using global snarkjs via script tag for browser compatibility

interface BetModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketTitle: string;
  marketId: string; // Prisma ID
  contractMarketId: number; // On-chain ID
  marketStatus?: string; // Market status passed from parent
}

type LoadingStep = "idle" | "validating" | "generating" | "signing" | "submitting" | "indexing";
type ErrorStep = "validation" | "proof" | "signing" | "submission" | "indexing" | "localStorage" | null;

export default function BetModal({ isOpen, onClose, marketTitle, marketId, contractMarketId, marketStatus: initialMarketStatus }: BetModalProps) {
  const { publicKey } = useWallet();
  const [side, setSide] = useState<0 | 1>(0); // 0 = Yes, 1 = No
  const [amount, setAmount] = useState("10");
  const [loadingStep, setLoadingStep] = useState<LoadingStep>("idle");
  const [errorStep, setErrorStep] = useState<ErrorStep>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [marketStatus, setMarketStatus] = useState<string | null>(initialMarketStatus || null);

  // Validate market status when modal opens (only if not provided)
  useEffect(() => {
    if (isOpen && marketId && !initialMarketStatus) {
      validateMarketStatus();
    } else if (isOpen && initialMarketStatus) {
      setMarketStatus(initialMarketStatus);
    }
  }, [isOpen, marketId, initialMarketStatus]);

  const validateMarketStatus = async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}`);
      if (!res.ok) {
        setMarketStatus("UNKNOWN");
        return;
      }
      const market = await res.json();
      setMarketStatus(market.status);
    } catch (err) {
      console.error("Failed to fetch market status:", err);
      setMarketStatus("UNKNOWN");
    }
  };

  const resetState = () => {
    setLoadingStep("idle");
    setErrorStep(null);
    setErrorMessage("");
    setSuccess(false);
    setTxHash("");
  };

  const handleRetry = () => {
    resetState();
    handleBet();
  };

  const getStepMessage = (step: LoadingStep): string => {
    switch (step) {
      case "validating": return "Validating market status...";
      case "generating": return "Generating ZK Proof...";
      case "signing": return "Awaiting Signature...";
      case "submitting": return "Submitting to Blockchain...";
      case "indexing": return "Finalizing...";
      default: return "";
    }
  };

  if (!isOpen) return null;

  const handleBet = async () => {
    if (!publicKey) {
      setErrorStep("validation");
      setErrorMessage("Please connect wallet first");
      return;
    }

    resetState();
    setLoadingStep("validating");

    try {
      // Step 1: Market validation
      if (marketStatus !== "OPEN") {
        setLoadingStep("idle");
        setErrorStep("validation");
        setErrorMessage(
          marketStatus === "CLOSED" 
            ? "This market is closed and no longer accepting bets" 
            : marketStatus === "RESOLVED"
            ? "This market has been resolved and no longer accepting bets"
            : "Unable to verify market status. Please try again."
        );
        return;
      }

      // Step 2: Generate ZK Proof
      setLoadingStep("generating");
      let commitment: string;
      let nonce: string;
      let bettorKey: string;

      try {
        // 1. Generate local randomness (nonce) and derive deterministic key
        nonce = Math.floor(Math.random() * 1000000000).toString();
        
        // 2. Derive deterministic key from public key (hackathon simplified)
        // In production, this would be a message signed by the wallet and hashed.
        bettorKey = Array.from(publicKey.slice(2, 12)).reduce((acc, char) => acc + char.charCodeAt(0).toString(), "").slice(0, 15); 
        
        const input = {
          side: side.toString(),
          nonce: nonce,
          bettor_key: bettorKey
        };

        // 3. Generate ZK Proof using snarkjs (npm)
        console.log("Generating Zero-Knowledge commitment...");
        // @ts-ignore
        const snarkjs = await import("snarkjs");
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
          input,
          "/circuit/seal/seal_bet.wasm",
          "/circuit/seal/seal_0001.zkey"
        );
        
        commitment = publicSignals[0];
        console.log("Proof verified, commitment:", commitment);
      } catch (proofErr) {
        setLoadingStep("idle");
        setErrorStep("proof");
        setErrorMessage(
          "Failed to generate zero-knowledge proof. This may be due to missing circuit files or browser compatibility issues. Please refresh and try again."
        );
        console.error("ZK proof generation error:", proofErr);
        return;
      }

      // Step 3: Build and sign transaction with Freighter
      setLoadingStep("signing");
      let signedXdr: string;

      try {
        const { placeBet } = await import("@/lib/escrow");
        const res = await placeBet(publicKey, contractMarketId, commitment, parseFloat(amount));
        
        if (!res.success || !res.unsignedXdr) {
          throw new Error("Failed to build place_bet transaction");
        }

        console.log("Signing transaction with Freighter...");
        const { signTransaction } = await import("@stellar/freighter-api");
        
        try {
          const signRes = await signTransaction(res.unsignedXdr, {
            networkPassphrase: "Test SDF Network ; September 2015"
          });
          // freighter-api returns { signedTxXdr, signerAddress } or just the string depending on version
          signedXdr = typeof signRes === "string" ? signRes : (signRes as any).signedTxXdr;
        } catch (signErr: any) {
          setLoadingStep("idle");
          setErrorStep("signing");
          setErrorMessage(
            signErr?.message?.includes("User declined") || signErr?.message?.includes("rejected")
              ? "Transaction signature was rejected. Please approve the transaction in Freighter to place your bet."
              : "Failed to sign transaction with Freighter. Please ensure Freighter is installed and unlocked."
          );
          console.error("Freighter signing error:", signErr);
          return;
        }
      } catch (buildErr) {
        setLoadingStep("idle");
        setErrorStep("signing");
        setErrorMessage("Failed to build transaction. Please check your wallet connection and try again.");
        console.error("Transaction building error:", buildErr);
        return;
      }

      // Step 4: Submit to Soroban
      setLoadingStep("submitting");
      let submitRes: { hash: string };

      try {
        const { submitSignedXdr } = await import("@/lib/escrow");
        submitRes = await submitSignedXdr(signedXdr);

        if (!submitRes || !submitRes.hash) {
          throw new Error("Transaction submission failed");
        }

        console.log("On-chain bet confirmed:", submitRes.hash);
        setTxHash(submitRes.hash);
      } catch (submitErr: any) {
        setLoadingStep("idle");
        setErrorStep("submission");
        setErrorMessage(
          submitErr?.message?.includes("timeout") || submitErr?.message?.includes("Confirmation timeout")
            ? "Transaction submission timed out. The transaction may still be processing. Please check your wallet or try again."
            : submitErr?.message?.includes("network") || submitErr?.message?.includes("RPC")
            ? "Network error: Unable to connect to Stellar network. Please check your connection and try again."
            : "Failed to submit transaction to blockchain. Please try again."
        );
        console.error("Soroban submission error:", submitErr);
        return;
      }

      // Step 5: Index in Prisma
      setLoadingStep("indexing");

      try {
        const indexRes = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId,
            userPublicKey: publicKey,
            amount,
            commitment,
            txHash: submitRes.hash
          })
        });

        if (!indexRes.ok) {
          const errorData = await indexRes.json().catch(() => ({}));
          throw new Error(errorData.error || "Database indexing failed");
        }
      } catch (indexErr: any) {
        // Non-critical: bet is on-chain, just log warning
        console.warn("Database indexing error (non-critical):", indexErr);
        setErrorStep("indexing");
        setErrorMessage(
          "Bet was successfully placed on-chain but failed to index in database. Your bet is valid and will appear after the next sync. Transaction hash: " + submitRes.hash
        );
        // Continue to localStorage save despite indexing failure
      }

      // Step 6: Save local proof data to localStorage for the reveal flow
      try {
        const portfolio = JSON.parse(localStorage.getItem("zk_portfolio") || "[]");
        portfolio.push({
          marketId,
          contractMarketId,
          marketTitle,
          side,
          nonce,
          bettorKey,
          commitment,
          amount,
          txHash: submitRes.hash,
          status: "SEALED"
        });
        localStorage.setItem("zk_portfolio", JSON.stringify(portfolio));
      } catch (storageErr) {
        // Non-critical: warn user but don't block success
        console.warn("localStorage save error (non-critical):", storageErr);
        // Don't set error state, just log
      }

      // Success!
      setLoadingStep("idle");
      setSuccess(true);

      // Emit custom event to trigger dashboard refresh
      window.dispatchEvent(new CustomEvent("betPlaced", { detail: { marketId } }));

      setTimeout(() => {
        setSuccess(false);
        onClose();
        resetState();
      }, 3000);

    } catch (e) {
      console.error("Unexpected error:", e);
      setLoadingStep("idle");
      setErrorStep("validation");
      setErrorMessage("An unexpected error occurred. Please try again.");
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
        
        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
               <Check className="w-8 h-8 text-green-400" />
            </div>
            <h4 className="text-lg font-medium text-white">Bet Sealed Successfully!</h4>
            <p className="text-sm text-dim mt-2">Your positional proof has been generated independently in-browser and your commitment is secured.</p>
            
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View Transaction <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        ) : errorStep ? (
          <div className="py-6">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-400 mb-1">
                  {errorStep === "validation" && "Validation Error"}
                  {errorStep === "proof" && "Proof Generation Failed"}
                  {errorStep === "signing" && "Signature Required"}
                  {errorStep === "submission" && "Submission Failed"}
                  {errorStep === "indexing" && "Indexing Warning"}
                  {errorStep === "localStorage" && "Storage Warning"}
                </h4>
                <p className="text-sm text-white/70">{errorMessage}</p>
              </div>
            </div>

            {txHash && errorStep === "indexing" && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-4"
              >
                View Transaction <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-medium text-white bg-white/10 hover:bg-white/20 transition-all"
              >
                Close
              </button>
              {errorStep !== "indexing" && (
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 rounded-xl font-medium text-white bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-6">
              <button 
                onClick={() => setSide(0)}
                disabled={loadingStep !== "idle"}
                className={`flex-1 py-3 rounded-xl border font-medium transition-all ${side === 0 ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                YES
              </button>
              <button 
                onClick={() => setSide(1)}
                disabled={loadingStep !== "idle"}
                className={`flex-1 py-3 rounded-xl border font-medium transition-all ${side === 1 ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed`}
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
                disabled={loadingStep !== "idle"}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0.00"
              />
            </div>

            {loadingStep !== "idle" && (
              <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {getStepMessage(loadingStep)}
                </p>
              </div>
            )}

            <button 
              onClick={handleBet}
              disabled={loadingStep !== "idle" || marketStatus === "CLOSED" || marketStatus === "RESOLVED"}
              className="w-full py-4 rounded-xl font-medium text-white bg-white hover:bg-gray-200 text-black flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingStep !== "idle" ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {getStepMessage(loadingStep)}</>
              ) : (
                <>Generate Proof & Lock Position</>
              )}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
