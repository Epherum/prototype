import { Geist, Geist_Mono } from "next/font/google";
import Providers from "./providers"; // Adjust path

import "@/styles/globals.css";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Enterprise Resource Planning",
  description:
    "software system that includes all the tools and processes required to run a successful company, including HR, manufacturing, supply chain, finance, accounting, and more.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
