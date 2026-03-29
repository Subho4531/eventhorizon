"use client";

import React from "react";

export default function LeaderboardPage() {
  return (
    <div className="max-w-7xl mx-auto py-8 lg:py-12 relative z-10 h-full">
      {/* Header Section */}
      <header className="mb-16 text-center lg:text-left flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <span className="font-sans uppercase tracking-[0.3em] text-[10px] text-blue-500 font-bold px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">GLOBAL STANDINGS</span>
          <h1 className="text-4xl md:text-6xl font-sans font-bold tracking-tighter text-white">THE HORIZON <br/><span className="text-blue-500">ELITE</span></h1>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex gap-12 items-center border border-white/5 bg-white/[0.03] backdrop-blur-md">
          <div className="text-center">
            <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 mb-1">LIVE NODES</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-2xl font-sans font-bold text-white">14,209</span>
            </div>
          </div>
          <div className="w-px h-10 bg-white/10"></div>
          <div className="text-center">
            <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 mb-1">TOTAL VOLUME</p>
            <span className="text-2xl font-sans font-bold text-orange-500">82.4M</span>
          </div>
        </div>
      </header>

      {/* Top 3 Pedestals */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-24 max-w-5xl mx-auto">
        {/* Rank 2 */}
        <div className="order-2 md:order-1 flex flex-col items-center group">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full border-2 border-white/20 p-1 group-hover:border-white transition-all duration-500">
              <img className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwPXUmtu3ZDHBdAKAlKECtWJZUVLjciKWfDqLmzDPJSzMzAf7X4W0ee_7kRDgdEYS8NmGZJVKjhe4sws-f7npNnmpFdFI_FvQlHpDUJmBOy8OCNi4B3P1_nFg9h9nK7Dg24w9BZK6xCZXLuFsXUkhM6No07u4K-Ejodmc_P9ETOrHt9BJv33LyemefrqZ0otqrFw1xM-ND7QvkIzg0icb0taTcChm-D0oKnWl1yowYe9MiwMeUBMfHo6P4eDRTP1S6FtakgkE6MF8"/>
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/10 text-xl font-sans font-bold text-white">2</div>
          </div>
          <div className="bg-white/5 shadow-[0_0_40px_rgba(37,99,235,0.15)] w-full h-48 rounded-t-3xl flex flex-col items-center justify-center p-6 border-b-0 border border-white/5 backdrop-blur-md">
            <h3 className="font-sans text-lg font-bold mb-1 text-white">VORTEX_KEEPER</h3>
            <p className="font-sans uppercase tracking-[0.2em] text-[10px] text-blue-500 mb-4">PLATINUM TIER</p>
            <div className="text-center">
              <p className="font-sans text-2xl font-bold tracking-tighter text-white">48,201</p>
              <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">POINTS</p>
            </div>
          </div>
        </div>

        {/* Rank 1 (Central) */}
        <div className="order-1 md:order-2 flex flex-col items-center group">
          <div className="relative mb-8 transform -translate-y-4">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-orange-500 animate-bounce">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            </div>
            <div className="w-32 h-32 rounded-full border-4 border-orange-500 p-1 shadow-[0_0_30px_rgba(249,115,22,0.3)]">
              <img className="w-full h-full rounded-full object-cover" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDQw1teS3aB5qL8LLWHRDC8ujsgVIYRBX3FFyyOyk6LakZHgCqra6G6haYZDrzStGl1mWkv2uSa8Ha83FC2KMNLjgOF3PyzCVpnpykeciTIuwySioR5c-hBl7puP9Os7H5sJo4g7vf8rzYtnAiycDjYH8MC9CEirlBMoBEQM5YEfkae7f-IEfH6cKU6aVWQSWVnLIRyHj8t4rPKNgJDvjZr_6n2Pa2lJaYUmeYYf8Tqw_3Vo9XuDHAOQQcjkhlqTRj22m-YO9jVe4I"/>
            </div>
            <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center border-4 border-black text-2xl font-sans font-bold text-black">1</div>
          </div>
          <div className="bg-white/5 shadow-[0_0_40px_rgba(249,115,22,0.1)] w-full h-64 rounded-t-3xl flex flex-col items-center justify-center p-6 border-orange-500/20 border backdrop-blur-md">
            <h3 className="font-sans text-2xl font-bold mb-1 text-white">NOVA_PRIME</h3>
            <p className="font-sans uppercase tracking-[0.3em] text-[10px] text-orange-500 font-bold mb-6">CELESTIAL GRANDMASTER</p>
            <div className="text-center">
              <p className="font-sans text-4xl font-extrabold tracking-tighter text-white">92,450</p>
              <p className="font-sans uppercase tracking-[0.2em] text-[10px] text-white/40">TOTAL EXP</p>
            </div>
          </div>
        </div>

        {/* Rank 3 */}
        <div className="order-3 md:order-3 flex flex-col items-center group">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-full border-2 border-white/20 p-1 group-hover:border-white transition-all duration-500">
              <img className="w-full h-full rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuABXcHowk-V4rTouix8rV8pTkTrz9ysw-mpAdGzN0JUNwM5Jeg_JSQEFxKVxEhe0zmQHTp35iZDK3XKs7RowrwQv24-p8xGMw0Yc_giHVDmQWNOwal_Ab2Lwl9ODsQKk0geJTIRrOVmqZ4htstKCiOzHByob3aW8YoNzpMTg4dKOo_dZiOUmaJoy7roPqXZSn9pSzUTMIEDgZHcKsCucNh6ZPgY8v1btqqve0yXESEt5bCX5MwP9sbvarqVekWwpjLNXJ2tXivnmy0"/>
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-black rounded-full flex items-center justify-center border border-white/10 text-xl font-sans font-bold text-white">3</div>
          </div>
          <div className="bg-white/5 shadow-[0_0_40px_rgba(37,99,235,0.15)] w-full h-36 rounded-t-3xl flex flex-col items-center justify-center p-6 border-b-0 border border-white/5 backdrop-blur-md">
            <h3 className="font-sans text-lg font-bold mb-1 text-white">ORBIT_VOID</h3>
            <p className="font-sans uppercase tracking-[0.2em] text-[10px] text-blue-500 mb-2">GOLD TIER</p>
            <div className="text-center">
              <p className="font-sans text-xl font-bold tracking-tighter text-white">32,118</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ranking Table */}
      <section className="bg-white/5 backdrop-blur-md rounded-3xl overflow-hidden mb-12 border border-white/5">
        <div className="px-8 py-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center bg-white/5 gap-4">
          <h2 className="font-sans font-bold tracking-widest text-sm uppercase text-white">Global Ranking</h2>
          <div className="flex gap-4">
            <button className="px-4 py-1.5 rounded-full bg-white/10 text-[10px] font-sans font-bold tracking-widest uppercase hover:bg-white/20 transition-all text-white">All Time</button>
            <button className="px-4 py-1.5 rounded-full border border-white/10 text-[10px] font-sans font-bold tracking-widest uppercase hover:bg-white/5 transition-all text-white/60">Season 04</button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr className="text-left border-b border-white/5 bg-black/40">
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">Rank</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">User Profile</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">Tier</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">Stability</th>
                <th className="px-8 py-4 font-sans uppercase tracking-[0.2em] text-[8px] text-white/40 text-right">Horizon Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {/* Row 4 */}
              <tr className="hover:bg-white/5 transition-all group">
                <td className="px-8 py-5 font-sans font-bold text-white/60">04</td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-white/10 p-0.5">
                      <img className="w-full h-full rounded-full object-cover" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXNLJajfhueuVjBdcSrdoecC7Wp21TqbrGhr5_YtHz6sC-99fUpbaoJQriPOeJXxyZasMzh_xE73iGVH1fiGOeybCSK_giEPH_OXeGT4X8U-5I77RnVAiX5QJjW82iGaIw_oMSpStznryGIO0aT5jdIQsbgw4hxDD6Jg_krw56aHM8QnRQCLD8zhFjfQbRtP41LEqFOW3VoJjpER-xK-XahK6Ho-J7G3Hp5QhJ9bYzrh-anxnbXJuMUsnDQTlcYLrkUb1lIFYyc2Y"/>
                    </div>
                    <div>
                      <p className="font-sans font-bold text-sm text-white">NEBULA_RUNNER</p>
                      <p className="font-sans text-[9px] text-white/30 uppercase tracking-widest">Active 2m ago</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 rounded-full border border-blue-500/30 text-[8px] font-sans font-bold tracking-widest uppercase text-blue-400">Gold</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="w-[94%] h-full bg-blue-500"></div>
                    </div>
                    <span className="font-sans text-[10px] text-white/60">94%</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-sans font-bold text-lg tabular-nums text-white">28,492</td>
              </tr>
              
              {/* Row 5 */}
              <tr className="hover:bg-white/5 transition-all group">
                <td className="px-8 py-5 font-sans font-bold text-white/60">05</td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-white/10 p-0.5">
                      <img className="w-full h-full rounded-full object-cover" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1KRN77tMjrHk0uHJZfMpxTiRiRonUX_KYicq8SMzCeoVjisPRvB2-Xwmr0gWeIaRyLVr5-UGFXAJLhLC7K2gQADUoWOun8ua850rdUjO8mP3QfEWel1HVDNsHhHgxdZhqEpp_CQseder_7q-wAgQ5TCc0Cj37jteuqC_13Jz3MCc5IXcI1dEGlUgfi4kI2FRwlrlFNoSAjkfTITO0GHJYSt8B0ZeiO_JSOw2N4Cc4mZsOrMaVyqdUqYK1yTjg5F8HOtD6rrvfXSI"/>
                    </div>
                    <div>
                      <p className="font-sans font-bold text-sm text-white">SILENT_ECHO</p>
                      <p className="font-sans text-[9px] text-white/30 uppercase tracking-widest">Active 12m ago</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 rounded-full border border-blue-500/30 text-[8px] font-sans font-bold tracking-widest uppercase text-blue-400">Gold</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="w-[88%] h-full bg-blue-500"></div>
                    </div>
                    <span className="font-sans text-[10px] text-white/60">88%</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-sans font-bold text-lg tabular-nums text-white">25,104</td>
              </tr>
              
              {/* Row 6 */}
              <tr className="hover:bg-white/5 transition-all group">
                <td className="px-8 py-5 font-sans font-bold text-white/60">06</td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-white/10 p-0.5">
                      <img className="w-full h-full rounded-full object-cover" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQp52mfZfoozFRC1RNo0ioy_Ddq8iyKug5i-wzqK7-ONw0rY4e14OVOe5Cu-vFlaBUpEBE9vjVfNwL9NSbSEZoLLGTp1VAH9T_SSQ6aQ347HYMjQVgZuGUvrxsjEwarBU_w5DLN8c3L45anKddARhbeNdBk_wcpYBSMcSZKg92DV1BcSIrTDLtyCBK3WDc6-skpY-RB4507gYJpmSxNCLTvqAJ_nCuwTVuIl95aqsr3SZh3w_hkL1-uOKDZqlYVvpxxNULbuBirz4"/>
                    </div>
                    <div>
                      <p className="font-sans font-bold text-sm text-white">QUANTUM_Z</p>
                      <p className="font-sans text-[9px] text-white/30 uppercase tracking-widest">Active 1h ago</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 rounded-full border border-white/20 text-[8px] font-sans font-bold tracking-widest uppercase text-white/40">Silver</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="w-[99%] h-full bg-blue-500"></div>
                    </div>
                    <span className="font-sans text-[10px] text-white/60">99%</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-sans font-bold text-lg tabular-nums text-white">22,810</td>
              </tr>
              
              {/* User Self Row (Pinned/Highlighted) */}
              <tr className="bg-blue-600/10 border-l-4 border-blue-500 transition-all">
                <td className="px-8 py-5 font-sans font-bold text-blue-400">142</td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-blue-500/50 p-0.5">
                      <img className="w-full h-full rounded-full object-cover" alt="Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDw-523AgGpAP-lstC4IUatPuwICAoja8Qw4ogGO10K37Hy2cBcUs5vLQoTEWBiPkEoU63ZswF6OmUzY7y9yAqmGua-Vxmje2uFkGWae5o1CjOGB_29Rru0RKEZ1rTPfaR5NtxanZWkYvCwVNjd1onMTy8uo7_bnDex2erME8B2tAeRy2zoXectRjPQ_7pP0vu7-S_mHK_k37S7QLDsLFhGdqbeHEzVUhINsMNhtP4tMR7hUN6I3XS5iXgPCaMDP4kPCYusix8Z2Qo"/>
                    </div>
                    <div>
                      <p className="font-sans font-bold text-sm text-white">COMMANDER_YOU</p>
                      <p className="font-sans text-[9px] text-blue-400 uppercase tracking-widest">Your Position</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 rounded-full border border-white/10 text-[8px] font-sans font-bold tracking-widest uppercase text-white/40">Bronze</span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="w-[62%] h-full bg-blue-500"></div>
                    </div>
                    <span className="font-sans text-[10px] text-white/60">62%</span>
                  </div>
                </td>
                <td className="px-8 py-5 text-right font-sans font-bold text-lg tabular-nums text-white">4,280</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-8 py-6 bg-white/5 flex justify-center border-t border-white/5">
          <button className="flex items-center gap-2 group">
            <span className="font-sans uppercase tracking-[0.3em] text-[10px] text-white/40 group-hover:text-white transition-all">View Full Directory</span>
            <span className="material-symbols-outlined text-white/40 group-hover:text-white transition-all text-sm group-hover:translate-x-1 duration-300">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Dynamic Metrics Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl flex flex-col justify-between h-32 border border-white/5">
          <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">Network Load</p>
          <div>
            <span className="text-3xl font-sans font-bold text-white">12.8%</span>
            <p className="text-[9px] text-blue-500 font-bold tracking-widest uppercase mt-1">Optimal</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl flex flex-col justify-between h-32 border border-white/5">
          <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">Average Uplink</p>
          <div>
            <span className="text-3xl font-sans font-bold text-white">482 MB/S</span>
            <p className="text-[9px] text-orange-500 font-bold tracking-widest uppercase mt-1">+14% Shift</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl flex flex-col justify-between h-32 border border-white/5">
          <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">Active Sectors</p>
          <div>
            <span className="text-3xl font-sans font-bold text-white">08/12</span>
            <p className="text-[9px] text-white/40 tracking-widest uppercase mt-1">Quadrant A-Z</p>
          </div>
        </div>
        <div className="bg-white/5 backdrop-blur-md p-6 rounded-2xl flex flex-col justify-between h-32 border border-white/5">
          <p className="font-sans uppercase tracking-[0.2em] text-[8px] text-white/40">System Uptime</p>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/20"></span>
            </div>
            <span className="text-3xl font-sans font-bold text-white">99.98%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
