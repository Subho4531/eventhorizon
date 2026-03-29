"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useWallet } from "@/components/WalletProvider";
import { Loader2 } from "lucide-react";
import ConnectWalletButton from "./ui/connectWalletButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { publicKey, isConnecting, connect } = useWallet();
  
  const formatKey = (key: string) => `${key.slice(0, 5)}...${key.slice(-4)}`;

  return (
    <>
      
      {/* App Grid Layout */}
      <div className="min-h-screen w-full relative z-10 grid grid-cols-1 md:grid-cols-[240px_1fr] grid-rows-[80px_1fr] bg-black/20 shadow-2xl pointer-events-none">
        
        {/* Top Navbar */}
        <nav className="col-span-1 md:col-span-2 flex justify-between items-center px-6 md:px-10 border-b border-white/5 bg-black/20 backdrop-blur-md z-50 pointer-events-auto">
          <div className="flex flex-col">
            <div className="text-xl font-bold tracking-tight text-white font-sans drop-shadow-md">
              Event Horizon
            </div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
              Cosmic Market
            </div>
          </div>
          
          <div className="hidden lg:flex items-center space-x-2 bg-white/5 p-1 rounded-full border border-white/10">
             <Link href="/dashboard" className={`glass-pill px-6 py-1.5 rounded-full text-[11px] font-bold transition-all ${pathname === '/dashboard' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white'}`}>Dashboard</Link>
             <Link href="/markets" className={`glass-pill px-6 py-1.5 rounded-full text-[11px] font-bold transition-all ${pathname === '/markets' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white'}`}>Markets</Link>
             <Link href="/portfolio" className={`glass-pill px-6 py-1.5 rounded-full text-[11px] font-bold transition-all ${pathname === '/portfolio' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white'}`}>Portfolio</Link>
             <Link href="/leaderboard" className={`glass-pill px-6 py-1.5 rounded-full text-[11px] font-bold transition-all ${pathname === '/leaderboard' ? 'text-white bg-white/10' : 'text-white/40 hover:text-white'}`}>Leaderboard</Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center bg-white/5 rounded-full px-4 py-2 border border-white/10">
              <span className="material-symbols-outlined text-white/40 text-sm mr-2">search</span>
              <input 
                className="bg-transparent border-none outline-none focus:ring-0 text-xs w-28 md:w-32 text-white placeholder-white/20" 
                placeholder="Search markets..." 
                type="text"
              />
            </div>
            <ConnectWalletButton/>
          </div>
        </nav>
        
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col border-r border-white/5 bg-black/10 backdrop-blur-md py-8 pointer-events-auto h-full overflow-y-auto">
          <div className="px-8 mb-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">explore</span>
              </div>
              <div>
                <div className="text-[10px] text-white font-bold uppercase tracking-widest">Observatory</div>
                <div className="flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                  <div className="text-[8px] text-white/40 uppercase tracking-widest">Live Signals</div>
                </div>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 space-y-2">
            <Link className={`flex items-center px-8 py-3 transition-all ${pathname === '/dashboard' ? 'bg-white/5 text-white border-r-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`} href="/dashboard">
              <span className={`material-symbols-outlined mr-4 text-xl ${pathname === '/dashboard' ? 'opacity-80' : 'opacity-60'}`}>dashboard</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Home</span>
            </Link>
            <Link className={`flex items-center px-8 py-3 transition-all ${pathname === '/markets' ? 'bg-white/5 text-white border-r-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`} href="/markets">
              <span className={`material-symbols-outlined mr-4 text-xl ${pathname === '/markets' ? 'opacity-80' : 'opacity-60'}`}>show_chart</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Pulse</span>
            </Link>
            <Link className={`flex items-center px-8 py-3 transition-all ${pathname === '/portfolio' ? 'bg-white/5 text-white border-r-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`} href="/portfolio">
              <span className={`material-symbols-outlined mr-4 text-xl ${pathname === '/portfolio' ? 'opacity-80' : 'opacity-60'}`}>language</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Galaxy</span>
            </Link>
            <Link className={`flex items-center px-8 py-3 transition-all ${pathname === '/leaderboard' ? 'bg-white/5 text-white border-r-2 border-white' : 'text-white/40 hover:text-white hover:bg-white/5'}`} href="/leaderboard">
              <span className={`material-symbols-outlined mr-4 text-xl ${pathname === '/leaderboard' ? 'opacity-80' : 'opacity-60'}`}>auto_awesome</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Moonshots</span>
            </Link>
          </nav>
          
          <div className="p-6 space-y-4">
            <button className="w-full bg-white/5 border border-white/10 text-white py-3 rounded-xl font-bold text-[9px] uppercase tracking-widest hover:bg-white/10 transition-all">
                New Prediction
            </button>
            <div className="flex justify-between items-center px-2 opacity-30 text-[9px] uppercase tracking-widest font-bold">
                <a href="#">Support</a>
                <a href="#">Docs</a>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="overflow-y-auto p-4 md:p-10 custom-scrollbar col-span-1 md:col-span-1 pointer-events-auto h-full max-h-[calc(100vh-80px)]">
           {children}
        </main>
      </div>
    </>
  );
}
