import { tiemposText, tiemposHeadline } from "@/lib/fonts";
import Providers from "./providers"; // Adjust path

import "@/styles/globals.css";

export const metadata = {
  title: "Enterprise Resource Planning",
  description:
    "software system that includes all the tools and processes required to run a successful company, including HR, manufacturing, supply chain, finance, accounting, and more.",
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${tiemposText.variable} ${tiemposHeadline.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
