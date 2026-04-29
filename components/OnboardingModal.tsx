"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, ImageIcon, ArrowRight, Loader2, Sparkles, Plus } from "lucide-react";
import { useWallet, getDefaultPfp } from "./WalletProvider";
import Image from "next/image";

export default function OnboardingModal() {
  const { publicKey, needsOnboarding, refreshUser } = useWallet();
  const [name, setName] = useState("");
  const [pfpUrl, setPfpUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !publicKey) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, name: name.trim(), pfpUrl: pfpUrl.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create account");
      await refreshUser();
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPfpUrl(data.secure_url);
    } catch (err) {
      setError("Upload failed. Please try again.");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  const truncKey = publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-6)}` : "";

  return (
    <AnimatePresence>
      {needsOnboarding && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md bg-[#0a0a0f]/95 border border-white/10 rounded-3xl p-8 shadow-[0_0_80px_rgba(37,99,235,0.15)]">
              
              {/* Glow accent */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="relative text-center mb-8">
                <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-5">
                  <Sparkles className="w-3 h-3" />
                  New Wallet Detected
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
                  Create Your Account
                </h2>
                <p className="text-white/40 text-sm">
                  Your identity on the Event Horizon
                </p>
                <div className="mt-3 px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-[10px] font-mono text-white/30 break-all">
                  {truncKey}
                </div>
              </div>

              {/* Avatar Preview */}
              <div className="flex justify-center mb-6">
                <label className="relative w-24 h-24 rounded-full border border-indigo-500/30 overflow-hidden bg-gradient-to-br from-indigo-600/20 to-purple-600/20 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)] cursor-pointer group/avatar">
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    disabled={isUploading} 
                  />
                  {pfpUrl || (publicKey ? getDefaultPfp(publicKey) : "") ? (
                    <img 
                      src={pfpUrl || (publicKey ? getDefaultPfp(publicKey) : "")} 
                      alt="Preview" 
                      className="w-full h-full object-cover group-hover/avatar:opacity-40 transition-opacity" 
                      onError={() => setPfpUrl("")} 
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white/60 group-hover/avatar:opacity-40 transition-opacity">{initials}</span>
                  )}
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Plus className="w-6 h-6 text-white" />
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 w-5 h-5 bg-indigo-500 rounded-full border border-black flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                </label>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    Display Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Cosmic Trader"
                      required
                      maxLength={40}
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 transition-all"
                    />
                  </div>
                </div>

                {/* Profile photo */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                    Profile Photo URL <span className="text-white/20 normal-case font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="url"
                      value={pfpUrl}
                      onChange={(e) => setPfpUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-indigo-500/5 transition-all"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-red-400 text-xs text-center">{error}</p>
                )}

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl py-3 flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Launch Profile
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
