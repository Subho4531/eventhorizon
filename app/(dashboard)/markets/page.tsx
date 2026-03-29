import MarketsGrid from "@/components/MarketsGrid";

export const metadata = {
  title: "Event Horizon | Prediction Markets",
  description: "Trade on the outcome of future events with Zero-Knowledge privacy.",
};

export default function MarketsPage() {
  return (
    <div className="w-full relative h-full">
      <div className="relative z-10 pt-10 px-0 max-w-7xl pb-24 pointer-events-none">
        <header className="mb-12 pointer-events-auto">
           <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 drop-shadow-xl font-sans text-white">
              Prediction Markets
           </h1>
           <p className="text-white/60 max-w-2xl text-lg tracking-wide leading-relaxed font-sans">
             Trade on the outcome of real-world events. Using Zero-Knowledge proofs, 
             your positions are <span className="text-blue-400">cryptographically sealed</span> until resolution, enabling true decentralized privacy.
           </p>
        </header>

        <div className="pointer-events-auto">
          <MarketsGrid />
        </div>
      </div>
    </div>
  );
}
