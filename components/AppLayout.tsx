"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useWallet } from "@/components/WalletProvider";
import { Loader2, TrendingUp } from "lucide-react";
import ConnectWalletButton from "./ui/connectWalletButton";
import Navbar from "./Navbar";
import OnboardingModal from "./OnboardingModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { publicKey, isConnecting, connect } = useWallet();
  
  const formatKey = (key: string) => `${key.slice(0, 5)}...${key.slice(-4)}`;


  return (
    <>
      <OnboardingModal />
      
      {/* Global Fixed Navbar */}
      <Navbar />

      {/* Main Content Layout */}
      <div className={`min-h-screen w-full relative z-10 flex bg-[#030303]/40 shadow-2xl pt-[80px]`}>
        
        {/* Sidebar (only on Desktop, only for specific routes if needed, otherwise hidden for clean Look) */}
        {pathname === '/markets' && (
          <aside className="hidden md:flex flex-col w-[240px] border-r border-white/5 bg-black/20 backdrop-blur-3xl py-8 sticky top-[80px] h-[calc(100vh-80px)] overflow-y-auto">
            <div className="px-8 mb-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-[10px] text-white font-bold uppercase tracking-widest">Markets</div>
                  <div className="flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                    <div className="text-[8px] text-white/40 uppercase tracking-widest">Live Pulse</div>
                  </div>
                </div>
              </div>
            </div>
            
            <nav className="flex-1 space-y-1">
              {[
                { href: "/dashboard", icon: "dashboard", label: "Home" },
                { href: "/markets", icon: "show_chart", label: "Markets" },
                { href: "/portfolio", icon: "account_balance_wallet", label: "Galaxy" },
                { href: "/leaderboard", icon: "auto_awesome", label: "Rank" },
                { href: "/admin", icon: "gavel", label: "Admin" },
              ].map((item) => (
                <Link 
                  key={item.href}
                  className={`flex items-center px-8 py-3.5 transition-all ${pathname === item.href ? 'bg-blue-600/10 text-white border-r-2 border-blue-500' : 'text-white/40 hover:text-white hover:bg-white/5'}`} 
                  href={item.href}
                >
                  <span className="material-symbols-outlined mr-4 text-xl opacity-70">{item.icon}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold">{item.label}</span>
                </Link>
              ))}
            </nav>
            
            <div className="p-6">
              <div className="bg-linear-to-br from-blue-600/20 to-violet-600/20 rounded-2xl p-4 border border-white/10">
                <div className="text-[9px] text-white/60 uppercase tracking-widest font-bold mb-2">Beta Access</div>
                <p className="text-[10px] text-white/40 leading-relaxed mb-3">ZK Prediction markets are now live on Testnet.</p>
                <div className="text-[10px] text-blue-400 font-bold cursor-pointer hover:underline">View Docs →</div>
              </div>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 custom-scrollbar overflow-x-hidden ${pathname === '/markets' ? '' : 'max-w-7xl mx-auto'}`}>
           <div className="p-4 md:p-8 lg:p-10">
             {children}
           </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[90%] max-w-sm"
      >
        <div className="bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 px-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center justify-between">
          {[
            { href: "/dashboard", icon: "dashboard", label: "Home" },
            { href: "/markets", icon: "show_chart", label: "Pulse" },
            { href: "/portfolio", icon: "account_balance_wallet", label: "Vault" },
            { href: "/leaderboard", icon: "auto_awesome", label: "Rank" },
            { href: "/admin", icon: "gavel", label: "Admin" },
          ].map((item) => (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center p-2 rounded-2xl transition-all ${pathname === item.href ? 'text-blue-400 bg-white/5' : 'text-white/40'}`}
            >
              <span className="material-symbols-outlined text-xl mb-1">{item.icon}</span>
              <span className="text-[8px] uppercase font-bold tracking-widest">{item.label}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    </>
  );
}
