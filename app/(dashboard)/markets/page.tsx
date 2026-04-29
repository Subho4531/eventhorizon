"use client";

import { useState, Suspense } from "react";
import { useWallet } from "@/components/WalletProvider";
import MarketsGrid from "@/components/MarketsGrid";
import CreateMarketModal from "@/components/CreateMarketModal";
import { motion } from "framer-motion";
import { TrendingUp, Zap, Shield } from "lucide-react";

export default function MarketsPage() {
  const { publicKey } = useWallet();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="w-full relative h-full">
      <div className="relative z-10 pt-4 px-0 max-w-7xl pb-24">
        <motion.header 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-start justify-between gap-6 mb-5">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#FF8C00]/[0.06] border border-[#FF8C00]/15">
                  <Zap className="w-3 h-3 text-[#FF8C00]" />
                  <span className="text-[9px] font-bold text-[#FF8C00]/80 uppercase tracking-[0.15em]">Live Markets</span>
                </div>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Prediction Markets
              </h1>
            </div>
          </div>
          <p className="text-white/30 max-w-2xl text-sm leading-relaxed font-medium flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 mt-0.5 text-[#FF8C00]/30 shrink-0" />
            <span>
              Trade on the outcome of real-world events. Your positions are{" "}
              <span className="text-[#FF8C00]/60 font-semibold">cryptographically sealed</span>{" "}
              with Zero-Knowledge proofs until resolution.
            </span>
          </p>
        </motion.header>

        <div className="pointer-events-auto">
          <Suspense fallback={
            <div className="flex items-center gap-3 text-white/15 text-xs font-medium py-20 justify-center">
              <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <TrendingUp className="w-4 h-4 animate-pulse opacity-40" />
              </div>
              <span className="uppercase tracking-[0.15em]">Loading markets...</span>
            </div>
          }>
            <MarketsGrid />
          </Suspense>
        </div>

        {isCreateModalOpen && publicKey && (
          <CreateMarketModal 
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            userPublicKey={publicKey}
          />
        )}
      </div>
    </div>
  );
}
