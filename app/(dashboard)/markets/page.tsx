"use client";

import { useState, Suspense } from "react";
import { useWallet } from "@/components/WalletProvider";
import MarketsGrid from "@/components/MarketsGrid";
import CreateMarketModal from "@/components/CreateMarketModal";
import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

export default function MarketsPage() {
  const { publicKey } = useWallet();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#000000] text-white pt-24 pb-20 selection:bg-[#FF8C00]/30 selection:text-white relative">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#FF8C00]/[0.02] rounded-full blur-[120px]" />
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-white/[0.01] rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A0A0A] border border-white/[0.08] rounded-[2rem] p-8 md:p-12 relative overflow-hidden shadow-2xl"
        >
          {/* Header Line */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#FF8C00]/40 to-transparent pointer-events-none" />

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
        </motion.div>

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
