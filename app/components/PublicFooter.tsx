import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/app/components/Logo";
import Icon from "@/app/components/Icon";

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="public-footer-nav-link">
      <span>{children}</span>
      <span className="public-footer-arrow" aria-hidden="true">↗</span>
    </Link>
  );
}

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-main">
          <div className="public-footer-brand">
            <Link href="/" className="public-footer-logo" aria-label="Vokalia — accueil">
              <Logo size={40} />
              <span>vokalia</span>
            </Link>
            <p>
              L&apos;agent vocal qui aide les salons à ne plus rater un appel
              et à remplir leur agenda.
            </p>
          </div>

          <nav className="public-footer-column" aria-label="Navigation du pied de page">
            <h2>Navigation</h2>
            <div className="public-footer-links">
              <FooterLink href="/">Accueil</FooterLink>
              <FooterLink href="/#comment-ca-marche">Comment ça marche</FooterLink>
              <FooterLink href="/demande-invitation">Demander une invitation</FooterLink>
              <FooterLink href="/login">Espace pro</FooterLink>
            </div>
          </nav>

          <div className="public-footer-column">
            <h2>Contact</h2>
            <address className="public-footer-contact">
              <span><Icon name="pin" size={18} />Avignon, France</span>
              <a href="mailto:contact@vokalia.fr">
                <span className="public-footer-mail-icon" aria-hidden="true">✉</span>
                contact@vokalia.fr
              </a>
              <button type="button" className="public-footer-linkedin" aria-label="LinkedIn, lien bientôt disponible">
                <span className="public-footer-linkedin-icon" aria-hidden="true">in</span>
                LinkedIn
              </button>
            </address>
          </div>

          <div className="public-footer-mark">
            <Logo size={86} />
            <span>vokalia</span>
          </div>
        </div>

        <div className="public-footer-bottom">
          <span>
            © 2026 Vokalia — service édité par{" "}
            <strong>BASTÉ VERGEZ Swann Aloïs Alban</strong>
          </span>
          <div>
            <Link href="/mentions-legales">Mentions légales</Link>
            <a href="mailto:contact@vokalia.fr">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
