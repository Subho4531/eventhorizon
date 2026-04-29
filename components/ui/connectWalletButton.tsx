"use client";
import { useWallet } from "../WalletProvider";
import { Loader2, LogOut, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function ConnectWalletButton() {
  const { publicKey, connect, isConnecting, disconnect } = useWallet();
  const [isHovered, setIsHovered] = useState(false);

  const formatKey = (key: string) => `${key.slice(0, 4)}…${key.slice(-4)}`;

  if (publicKey) {
    return (
      <motion.button
        onClick={disconnect}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileTap={{ scale: 0.97 }}
        className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-300 bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white group"
      >
        {/* Connected dot */}
        <div className="relative">
          <div className="w-2 h-2 rounded-full bg-[#00C853]" />
          <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#00C853] animate-pulse-ring" />
        </div>
        
        <AnimatePresence mode="wait">
          {isHovered ? (
            <motion.span
              key="disconnect"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 text-red-400"
            >
              <LogOut className="w-3 h-3" />
              Disconnect
            </motion.span>
          ) : (
            <motion.span
              key="address"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="tracking-wider font-mono"
            >
              {formatKey(publicKey)}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <motion.button
      onClick={connect}
      disabled={isConnecting}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="relative flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[11px] font-bold tracking-wide transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: "linear-gradient(135deg, #FF8C00, #FF6B00)",
        boxShadow: "0 0 20px rgba(255, 140, 0, 0.25), inset 0 1px 1px rgba(255,255,255,0.15)",
      }}
    >
      {/* Hover shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
      
      <span className="relative z-10 flex items-center gap-2 text-black">
        {isConnecting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Zap className="w-3.5 h-3.5" />
        )}
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </span>
    </motion.button>
  );
}