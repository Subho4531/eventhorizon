import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/LenisProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StellarSub",
  description: "Minimalist Cosmic Operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-black">
        <SmoothScroll>
            {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
