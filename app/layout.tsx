import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import PageTransitionProvider from "@/app/components/PageTransitionProvider";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vokalia.fr"),
  title: {
    default: "Vokalia — Agent vocal IA et réservation en ligne pour commerçants",
    template: "%s — Vokalia",
  },
  description:
    "Vokalia est un agent vocal IA qui répond aux appels de votre salon, propose des créneaux libres et confirme les rendez-vous — plus une page de réservation en ligne pour vos clients.",
  openGraph: {
    siteName: "Vokalia",
    title: "Vokalia — Agent vocal IA et réservation en ligne pour commerçants",
    description:
      "Vokalia est un agent vocal IA qui répond aux appels de votre salon, propose des créneaux libres et confirme les rendez-vous — plus une page de réservation en ligne pour vos clients.",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${hankenGrotesk.variable}`}>
      <body>
        <PageTransitionProvider>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:p-4 focus:bg-[#15120F] focus:text-[#BD5B39]">Aller au contenu</a>
          {children}
        </PageTransitionProvider>
      </body>
    </html>
  );
}
