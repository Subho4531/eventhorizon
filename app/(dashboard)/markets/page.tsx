"use client";

import { useState, Suspense } from "react";
import { useWallet } from "@/components/WalletProvider";
import MarketsGrid from "@/components/MarketsGrid";
import CreateMarketModal from "@/components/CreateMarketModal";

export default function MarketsPage() {
  const { publicKey } = useWallet();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="w-full relative h-full">
      <div className="relative z-10 pt-10 px-0 max-w-7xl pb-24 pointer-events-none">
        <header className="mb-12 pointer-events-auto">
           <div className="flex items-start justify-between gap-6 mb-4">
             <div>
               <h1 className="text-4xl md:text-5xl font-medium tracking-tight drop-shadow-xl text-white">
                  Prediction Markets
               </h1>
             </div>
             {/* {publicKey && (
               <button 
                 onClick={() => setIsCreateModalOpen(true)}
                 className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white text-sm uppercase tracking-widest font-bold border border-blue-400/30 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap"
               >
                 <span className="material-symbols-outlined text-base">add</span>
                 Propose Horizon
               </button>
             )} */}
           </div>
           <p className="text-white/60 max-w-2xl text-lg tracking-wide leading-relaxed ">
             Trade on the outcome of real-world events. Using Zero-Knowledge proofs, 
             your positions are <span className="text-blue-400">cryptographically sealed</span> until resolution, enabling true decentralized privacy.
           </p>
        </header>

        <div className="pointer-events-auto">
          <Suspense fallback={<div className="text-white/20 text-xs uppercase tracking-widest animate-pulse">Scanning Horizons...</div>}>
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
