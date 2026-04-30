import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ConnectWalletButton from "./ui/connectWalletButton";
import { useWallet } from "./WalletProvider";
import { Activity, BarChart2, Trophy, Search, X, Briefcase, ChevronDown, Rocket, Zap, Globe, Cpu, Coins, LayoutGrid } from "lucide-react";
import { useState, useEffect } from "react";
import { setActiveMarketCategory } from "./MarketsGrid";

const NAV_ITEMS = [
  { href: "/", label: "Terminal", Icon: Activity },
  { href: "/markets", label: "Markets", Icon: BarChart2 },
  { href: "/portfolio", label: "Portfolio", Icon: Briefcase },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

const CATEGORIES = [
  { name: "All", icon: LayoutGrid, color: "text-white/40" },
  { name: "Crypto", icon: Coins, color: "text-orange-500" },
  { name: "Finance", icon: Zap, color: "text-green-500" },
  { name: "Technology", icon: Cpu, color: "text-blue-500" },
  { name: "Politics", icon: Globe, color: "text-yellow-500" },
  { name: "Sports", icon: Rocket, color: "text-pink-500" },
  { name: "Science", icon: Zap, color: "text-purple-500" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  useWallet();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    setSearchQuery(prev => (prev === q ? prev : q));
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchQuery) params.set("q", searchQuery);
    else params.delete("q");
    router.push(`/markets?${params.toString()}`);
  };

  const clearSearch = () => {
    setSearchQuery("");
    const params = new URLSearchParams(searchParams);
    params.delete("q");
    router.push(`/markets?${params.toString()}`);
    setSearchExpanded(false);
  };

  const isMarketsPage = pathname === "/markets" || pathname.startsWith("/markets/");

  const handleCategorySelect = (cat: string) => {
    if (!isMarketsPage) {
      router.push(`/markets?cat=${cat}`);
    } else {
      setActiveMarketCategory(cat);
    }
    setHoveredItem(null);
  };

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <motion.nav
        layout
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ 
          type: "spring", 
          stiffness: 400, 
          damping: 30,
          layout: { duration: 0.3, ease: "easeOut" } 
        }}
        className="flex items-center gap-6 rounded-full border border-white/10 bg-black/40 px-6 py-3 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/5 pointer-events-auto relative shadow-2xl"
      >
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <Image 
                src="/logo.png" 
                alt="Horizon Ring" 
                width={24} 
                height={24} 
                className="object-contain brightness-0 invert animate-[spin_2s_linear_infinite]"
              />
            </div>
            <span className="text-sm font-bold tracking-[0.2em] text-white uppercase group-hover:text-indigo-400 transition-colors whitespace-nowrap">Horizon</span>
          </Link>
          
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const isActive = href === "/" 
                ? pathname === "/" 
                : (pathname === href || pathname.startsWith(href + "/"));
              const isMarkets = label === "Markets";
              
              return (
                <div
                  key={href}
                  className="relative"
                  onMouseEnter={() => isMarkets && setHoveredItem("Markets")}
                  onMouseLeave={() => isMarkets && setHoveredItem(null)}
                >
                  <Link
                    href={href}
                    className={`relative flex items-center gap-2 px-4 py-2 transition-all duration-300 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      isActive
                        ? "text-white bg-white/10"
                        : "text-neutral-500 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                    {isMarkets && <ChevronDown className={`w-3 h-3 ml-1 transition-transform duration-300 ${hoveredItem === "Markets" ? "rotate-180" : ""}`} />}
                  </Link>

                  <AnimatePresence>
                    {isMarkets && hoveredItem === "Markets" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 mt-2 p-2 bg-[#0A0A0A]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-3xl min-w-[200px] z-50"
                      >
                        <div className="grid grid-cols-1 gap-0.5 ">
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat.name}
                              onClick={() => handleCategorySelect(cat.name)}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 group/cat transition-colors text-left w-full"
                            >
                              <cat.icon className={`w-4 h-4 ${cat.color}`} />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 group-hover/cat:text-white transition-colors">{cat.name}</span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto">
          {isMarketsPage && (
            <div className="flex items-center">
              <AnimatePresence mode="popLayout">
                {searchExpanded && (
                  <motion.form 
                    key="search-form"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 200, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    onSubmit={handleSearch}
                    className="flex items-center overflow-hidden"
                  >
                    <input 
                      autoFocus
                      type="text"
                      placeholder="Search Markets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 px-4 text-xs font-medium text-white placeholder:text-neutral-600 focus:!outline-none focus:!ring-0 focus-visible:!outline-none focus-visible:!ring-0 focus:border-white/10 transition-colors"
                    />
                    {searchQuery && (
                      <button 
                        type="button"
                        onClick={clearSearch}
                        className="ml-[-30px] mr-2 text-neutral-500 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </motion.form>
                )}
              </AnimatePresence>
              
              <button
                onClick={() => setSearchExpanded(!searchExpanded)}
                className={`p-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 ${searchExpanded ? "bg-white/10 text-white ml-2" : "text-neutral-500 hover:text-white hover:bg-white/5"}`}
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          )}
          
          <div className="shrink-0 pl-2 border-l border-white/5">
            <ConnectWalletButton />
          </div>
        </div>
      </motion.nav>
    </div>
  );
}
