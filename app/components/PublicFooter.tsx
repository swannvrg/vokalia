import Link from "next/link";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <span>
          Vokalia · service édité par{" "}
          <strong>BAST&Eacute; VERGEZ Swann Alo&iuml;s Alban</strong>,
          entrepreneur individuel · SIREN&nbsp;951&nbsp;433&nbsp;788 ·
          RCS&nbsp;Avignon · 35&nbsp;Rue&nbsp;Sureau, 84000&nbsp;Avignon ·{" "}
          <a href="mailto:contact@vokalia.fr">contact@vokalia.fr</a>
        </span>
        <Link href="/mentions-legales">Mentions légales</Link>
      </div>
    </footer>
  );
}
