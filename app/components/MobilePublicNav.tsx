"use client";

import Link from "next/link";
import { useRef } from "react";

export default function MobilePublicNav() {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = () => {
    if (detailsRef.current) {
      detailsRef.current.removeAttribute("open");
    }
  };

  return (
    <details ref={detailsRef} className="md:hidden relative group">
      <summary className="list-none cursor-pointer p-2 outline-none text-2xl" aria-label="Ouvrir le menu">
        <span className="group-open:hidden">☰</span>
        <span className="hidden group-open:inline">✕</span>
      </summary>
      <nav className="absolute right-0 top-full mt-4 w-[280px] bg-[var(--color-bg-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl flex flex-col p-4 gap-4 z-50">
        <a href="#comment-ca-marche" className="vp-nav-link text-center" onClick={closeMenu}>
          Comment ça marche
        </a>
        <Link href="/login" className="vp-nav-link text-center" onClick={closeMenu}>
          Espace pro
        </Link>
        <Link href="/demande-invitation" className="button primary vp-cta-nav w-full justify-center" onClick={closeMenu}>
          Demander une invitation
        </Link>
      </nav>
    </details>
  );
}
