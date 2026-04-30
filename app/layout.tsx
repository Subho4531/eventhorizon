import type { Metadata } from "next";
import { Space_Grotesk, Outfit, JetBrains_Mono, Michroma } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/LenisProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const michroma = Michroma({
  variable: "--font-michroma",
  weight: "400",
  subsets: ["latin"],
});

import { WalletProvider } from "@/components/WalletProvider";

import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: {
    default: "Horizon Markets | Autonomous Prediction Engine",
    template: "%s | Horizon Markets"
  },
  description: "Experience the next generation of autonomous prediction markets. Trade outcomes with high-confidence AI resolution and decentralized escrow.",
  keywords: ["stellar", "prediction market", "autonomous", "ai", "crypto", "trading"],
  openGraph: {
    title: "Horizon Markets | Autonomous Prediction Engine",
    description: "AI-driven autonomous prediction markets.",
    url: "https://horizonmarkets.vercel.app/",
    siteName: "Horizon Markets",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Horizon Markets | Autonomous Prediction Engine",
    description: "The autonomous event horizon of prediction markets.",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${outfit.variable} ${jetbrainsMono.variable} ${michroma.variable} antialiased`}
    >
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-black">
        <WalletProvider>
          <TooltipProvider>
            <SmoothScroll>
              {children}
            </SmoothScroll>
          </TooltipProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
