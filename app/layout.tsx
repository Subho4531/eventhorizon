import type { Metadata } from "next";
import { Space_Grotesk, Outfit } from "next/font/google";
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

import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: {
    default: "Event Horizon | ZK Prediction Market",
    template: "%s | Event Horizon"
  },
  description: "Experience the next generation of prediction markets with Zero-Knowledge privacy on Stellar Testnet. Trade outcomes with deep liquidity and total anonymity.",
  keywords: ["stellar", "prediction market", "zero-knowledge", "zk-proofs", "soroban", "crypto", "betting"],
  openGraph: {
    title: "Event Horizon | ZK Prediction Market",
    description: "Privacy-first prediction markets on Stellar.",
    url: "https://eventhorizon-pied.vercel.app/",
    siteName: "Event Horizon",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Event Horizon | ZK Prediction Market",
    description: "The cosmic event horizon of ZK-prediction markets on Stellar.",
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
      className={`${spaceGrotesk.variable} ${outfit.variable} antialiased`}
    >
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-black">
        <WalletProvider>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </WalletProvider>
      </body>
    </html>
  );
}
