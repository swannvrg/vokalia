import type { Metadata } from "next";
import Link from "next/link";
import PublicFooter from "@/app/components/PublicFooter";
import Logo from "@/app/components/Logo";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales du service Vokalia, édité par BASTÉ VERGEZ Swann Aloïs Alban, entrepreneur individuel, SIREN 951 433 788.",
  robots: { index: true, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <>
      <header className="vp-nav">
        <a href="/" className="vp-brand" aria-label="Vokalia — accueil">
          <Logo size={28} />
          <span className="vp-wordmark">vokalia</span>
        </a>
        <nav aria-label="Navigation principale">
          <Link href="/" className="vp-nav-link">
            Accueil
          </Link>
        </nav>
      </header>

      <main id="main-content" className="vp-legal-page">
        <div className="vp-wrap">
          <h1 className="vp-legal-title">Mentions légales</h1>

          {/* -------- ÉDITEUR -------- */}
          <section className="vp-legal-section" aria-labelledby="editeur">
            <h2 id="editeur">Éditeur du site</h2>
            <p>
              Vokalia est un service édité et exploité par&nbsp;:
            </p>
            <dl className="vp-legal-dl">
              <dt>Nom légal</dt>
              <dd>BAST&Eacute; VERGEZ Swann Alo&iuml;s Alban</dd>

              <dt>Statut</dt>
              <dd>Entrepreneur individuel (micro-entrepreneur)</dd>

              <dt>SIREN</dt>
              <dd>951&nbsp;433&nbsp;788</dd>

              <dt>SIRET</dt>
              <dd>951&nbsp;433&nbsp;788&nbsp;00019</dd>

              <dt>Immatriculation</dt>
              <dd>RCS Avignon 951&nbsp;433&nbsp;788</dd>

              <dt>Code APE</dt>
              <dd>46.90Z</dd>

              <dt>Adresse</dt>
              <dd>35 Rue Sureau, 84000 Avignon, France</dd>

              <dt>Email</dt>
              <dd>
                <a href="mailto:contact@vokalia.fr">contact@vokalia.fr</a>
              </dd>
            </dl>
          </section>

          {/* -------- DIRECTEUR DE LA PUBLICATION -------- */}
          <section className="vp-legal-section" aria-labelledby="directeur-pub">
            <h2 id="directeur-pub">Directeur de la publication</h2>
            <p>Swann Bast&eacute; Vergez</p>
          </section>

          {/* -------- HÉBERGEUR -------- */}
          <section className="vp-legal-section" aria-labelledby="hebergeur">
            <h2 id="hebergeur">Hébergeur</h2>
            <dl className="vp-legal-dl">
              <dt>Société</dt>
              <dd>Vercel Inc.</dd>

              <dt>Adresse</dt>
              <dd>440 N Barranca Ave #4133, Covina, CA 91723, États-Unis</dd>

              <dt>Site</dt>
              <dd>
                <a
                  href="https://vercel.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  vercel.com
                </a>
              </dd>
            </dl>
          </section>

          {/* -------- PROPRIÉTÉ INTELLECTUELLE -------- */}
          <section className="vp-legal-section" aria-labelledby="propriete">
            <h2 id="propriete">Propriété intellectuelle</h2>
            <p>
              L&rsquo;ensemble des contenus présents sur ce site (textes,
              graphismes, logotype, code) est la propriété exclusive de
              BAST&Eacute; VERGEZ Swann Alo&iuml;s Alban, sauf mention
              contraire explicite. Toute reproduction, représentation ou
              diffusion, même partielle, est interdite sans autorisation
              préalable écrite de l&rsquo;éditeur.
            </p>
          </section>

          {/* -------- DONNÉES PERSONNELLES -------- */}
          {/* TODO relecture juridique */}
          <section className="vp-legal-section" aria-labelledby="donnees">
            <h2 id="donnees">Données personnelles</h2>
            <p>
              Les informations de rendez-vous (nom, numéro de téléphone,
              horaire) et les appels traités par le service Vokalia sont
              collectées et traitées dans le seul but de gérer les réservations
              pour le compte des commerçants utilisant le service.
            </p>
            <p>
              Conformément au Règlement général sur la protection des données
              (RGPD) et à la loi Informatique et Libertés, vous disposez d&rsquo;un
              droit d&rsquo;accès, de rectification et de suppression de vos
              données. Pour exercer ces droits, adressez votre demande par
              email à{" "}
              <a href="mailto:contact@vokalia.fr">contact@vokalia.fr</a>.
            </p>
          </section>

          <p className="vp-legal-back">
            <Link href="/">← Retour à l&rsquo;accueil</Link>
          </p>
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
