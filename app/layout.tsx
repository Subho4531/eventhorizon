import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/LenisProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

import { WalletProvider } from "@/components/WalletProvider";

export const metadata: Metadata = {
  title: {
    default: "GravityFlow | ZK Prediction Market",
    template: "%s | GravityFlow"
  },
  description: "Experience the next generation of prediction markets with Zero-Knowledge privacy on Stellar Testnet. Trade outcomes with deep liquidity and total anonymity.",
  keywords: ["stellar", "prediction market", "zero-knowledge", "zk-proofs", "soroban", "crypto", "betting"],
  openGraph: {
    title: "GravityFlow | ZK Prediction Market",
    description: "Privacy-first prediction markets on Stellar.",
    url: "https://gravityflow.stellar",
    siteName: "GravityFlow",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GravityFlow | ZK Prediction Market",
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
      className={`${spaceGrotesk.variable} ${inter.variable} antialiased`}
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
