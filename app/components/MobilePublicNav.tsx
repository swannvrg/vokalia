"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "@/app/components/Icon";

export default function MobilePublicNav() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => {
    setIsOpen(false);
    if (detailsRef.current) {
      detailsRef.current.removeAttribute("open");
    }
  };

  return (
    <details
      ref={detailsRef}
      className="md:hidden relative group"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary
        className="list-none cursor-pointer p-2 outline-none flex items-center justify-center min-w-[44px] min-h-[44px]"
        aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
      >
        {isOpen ? <Icon name="close" size={24} /> : <Icon name="menu" size={24} />}
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
