import SolarSystem from "@/components/SolarSystem";
import Navbar from "@/components/Navbar";
import HeroUI from "@/components/HeroUI";

export default function Home() {
  return (
    <main className="w-full relative min-h-screen">
      <Navbar />
      <SolarSystem />
      <HeroUI />
    </main>
  );
}
