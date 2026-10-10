import type { Metadata } from "next";
import Link from "next/link";
import PublicFooter from "@/app/components/PublicFooter";

export const metadata: Metadata = {
  title: "Vokalia — Agent vocal IA et réservation en ligne pour commerçants",
  description:
    "Vokalia est un agent vocal IA qui répond aux appels de votre salon, propose des créneaux libres et confirme les rendez-vous — plus une page de réservation en ligne pour vos clients.",
  openGraph: {
    title: "Vokalia — Agent vocal IA et réservation en ligne pour commerçants",
    description:
      "Vokalia est un agent vocal IA qui répond aux appels de votre salon, propose des créneaux libres et confirme les rendez-vous — plus une page de réservation en ligne pour vos clients.",
    url: "https://vokalia.fr",
  },
  robots: { index: true, follow: true },
};

import Logo from "@/app/components/Logo";

export default function HomePage() {
  return (
    <>
      {/* ============ HEADER NAV ============ */}
      <header className="vp-nav">
        <a href="/" className="vp-brand" aria-label="Vokalia — accueil">
          <Logo size={32} />
          <span className="vp-wordmark">vokalia</span>
        </a>
        <nav aria-label="Navigation principale">
          <a href="#comment-ca-marche" className="vp-nav-link">
            Comment ça marche
          </a>
          <Link href="/login" className="vp-nav-link">
            Espace pro
          </Link>
          <Link href="/demande-invitation" className="button primary vp-cta-nav">
            Demander une invitation
          </Link>
        </nav>
      </header>

      <main id="main-content">
        {/* ============ HERO ============ */}
        <section className="vp-hero">
          <div className="vp-hero-inner">
            <Logo size={64} />
            <h1 className="vp-hero-title">
              Votre salon ne rate plus un appel.
            </h1>
            <p className="vp-hero-sub">
              Vokalia est un agent vocal IA qui répond au téléphone à la place
              de votre salon, propose des créneaux disponibles en temps réel et
              confirme les rendez-vous — plus une page de réservation en ligne
              pour les clients qui préfèrent écrire.
            </p>
            <div className="vp-hero-actions">
              <Link href="/demande-invitation" className="button primary vp-btn-lg">
                Demander une invitation
              </Link>
              <a href="#comment-ca-marche" className="button vp-btn-lg">
                Comment ça marche
              </a>
            </div>
          </div>
        </section>

        {/* ============ DEUX FAÇONS DE RÉSERVER ============ */}
        <section className="vp-section vp-two-ways" aria-labelledby="deux-fa-ons">
          <div className="vp-wrap">
            <h2 id="deux-fa-ons" className="vp-section-title">
              Deux façons de prendre rendez-vous
            </h2>
            <div className="vp-cards-2">
              <article className="vp-card">
                <div className="vp-card-icon" aria-hidden="true">
                  {/* Onde active = appel en cours */}
                  <svg width="36" height="20" viewBox="0 0 48 24" fill="none">
                    <rect x="2"  y="8"  width="4" height="8"  rx="2" fill="#BD5B39" />
                    <rect x="10" y="4"  width="4" height="16" rx="2" fill="#BD5B39" />
                    <rect x="18" y="10" width="4" height="4"  rx="2" fill="#BD5B39" />
                    <rect x="26" y="2"  width="4" height="20" rx="2" fill="#BD5B39" />
                    <rect x="34" y="6"  width="4" height="12" rx="2" fill="#BD5B39" />
                    <rect x="42" y="9"  width="4" height="6"  rx="2" fill="#BD5B39" />
                  </svg>
                </div>
                <h3>L&rsquo;agent vocal IA</h3>
                <p>
                  Lorsqu&rsquo;un client appelle votre salon, l&rsquo;agent vocal
                  répond automatiquement, consulte vos disponibilités réelles et
                  confirme un rendez-vous par téléphone — sans décrocher vous-même.
                </p>
              </article>
              <article className="vp-card">
                <div className="vp-card-icon" aria-hidden="true">
                  {/* Onde succès = réservation confirmée */}
                  <svg width="36" height="20" viewBox="0 0 48 24" fill="none">
                    <rect x="6"  y="9"  width="4" height="6"  rx="2" fill="#9FB98A" />
                    <rect x="16" y="4"  width="4" height="16" rx="2" fill="#9FB98A" />
                    <rect x="26" y="9"  width="4" height="6"  rx="2" fill="#9FB98A" />
                  </svg>
                </div>
                <h3>La page de réservation en ligne</h3>
                <p>
                  Chaque salon dispose d&rsquo;une page de réservation accessible
                  depuis n&rsquo;importe quel appareil. Les clients qui préfèrent
                  écrire plutôt qu&rsquo;appeler réservent directement, 24&nbsp;h/24.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ============ COMMENT ÇA MARCHE ============ */}
        <section
          id="comment-ca-marche"
          className="vp-section vp-steps"
          aria-labelledby="comment-marche"
        >
          <div className="vp-wrap">
            <h2 id="comment-marche" className="vp-section-title">
              Comment ça marche
            </h2>
            <ol className="vp-steps-list">
              <li className="vp-step">
                <span className="vp-step-num">1</span>
                <div>
                  <h3>Le client appelle le salon</h3>
                  <p>
                    L&rsquo;agent vocal Vokalia décroche à votre place. Il
                    identifie la prestation souhaitée et consulte en temps réel
                    l&rsquo;agenda de votre salon.
                  </p>
                </div>
              </li>
              <li className="vp-step">
                <span className="vp-step-num">2</span>
                <div>
                  <h3>L&rsquo;agent propose un créneau disponible</h3>
                  <p>
                    En fonction des horaires du salon et des rendez-vous déjà
                    pris, l&rsquo;agent suggère un ou plusieurs créneaux libres
                    et confirme le choix du client.
                  </p>
                </div>
              </li>
              <li className="vp-step">
                <span className="vp-step-num">3</span>
                <div>
                  <h3>Le rendez-vous apparaît dans votre tableau de bord</h3>
                  <p>
                    Une fois confirmé, le rendez-vous est immédiatement visible
                    dans votre planning Vokalia — avec le nom du client, la
                    prestation et l&rsquo;heure.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        {/* ============ QUI SOMMES-NOUS ============ */}
        <section className="vp-section vp-about" aria-labelledby="qui-nous-sommes">
          <div className="vp-wrap">
            <h2 id="qui-nous-sommes" className="vp-section-title">
              Qui sommes-nous
            </h2>
            <p className="vp-about-text">
              Vokalia est un service développé et exploité à Avignon par{" "}
              <strong>BAST&Eacute; VERGEZ Swann Alo&iuml;s Alban</strong>,
              entrepreneur individuel (SIREN&nbsp;951&nbsp;433&nbsp;788). Le
              service est actuellement en phase de lancement — l&rsquo;accès se
              fait sur invitation.
            </p>
            <p className="vp-about-text">
              Pour toute question :{" "}
              <a href="mailto:contact@vokalia.fr">contact@vokalia.fr</a>
            </p>
            <Link href="/demande-invitation" className="button primary vp-btn-lg vp-about-cta">
              Demander à rejoindre Vokalia
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
