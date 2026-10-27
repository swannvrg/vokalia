"use client";

import { useEffect, useState } from "react";
import DashboardShell from "@/app/components/DashboardShell";
import Icon from "@/app/components/Icon";
import Logo from "@/app/components/Logo";
import QRCode from "qrcode";

interface QRCodeViewProps {
  businessId: string;
  businessName: string;
  siteUrl: string;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "salon"
  );
}

export default function QRCodeView({
  businessId,
  businessName,
  siteUrl,
}: QRCodeViewProps) {
  const [svgMarkup, setSvgMarkup] = useState<string>("");
  const [pngDataUrl, setPngDataUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Validation stricte de l'URL du site
  const hasValidSiteUrl = Boolean(siteUrl && siteUrl.trim().length > 0);
  const cleanSiteUrl = hasValidSiteUrl
    ? siteUrl.trim().replace(/\/+$/, "")
    : "";
  const publicUrl = hasValidSiteUrl
    ? `${cleanSiteUrl}/${businessId}/profil-public?src=qr`
    : "";
  const displayUrl = hasValidSiteUrl
    ? `${cleanSiteUrl}/${businessId}/profil-public`
    : "";

  useEffect(() => {
    if (!hasValidSiteUrl) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    async function generateQRCodes() {
      try {
        // 1. Génération du PNG haute définition (1024 x 1024 px minimum)
        const png = await QRCode.toDataURL(publicUrl, {
          errorCorrectionLevel: "H",
          margin: 4,
          width: 1024,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        // 2. Génération du SVG vectoriel
        const svg = await QRCode.toString(publicUrl, {
          type: "svg",
          errorCorrectionLevel: "H",
          margin: 4,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });

        if (isMounted) {
          setPngDataUrl(png);
          setSvgMarkup(svg);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Erreur lors de la génération du QR code:", err);
          setError("Impossible de générer le QR code. Veuillez réessayer.");
          setLoading(false);
        }
      }
    }

    generateQRCodes();

    return () => {
      isMounted = false;
    };
  }, [hasValidSiteUrl, publicUrl]);

  // Copier le lien
  const handleCopyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Échec de la copie du lien:", err);
    }
  };

  // Télécharger PNG
  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = `qr-code-${slugify(businessName)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Télécharger SVG
  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-code-${slugify(businessName)}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Imprimer l'affiche A4
  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardShell businessId={businessId}>
      {/* 1. Header Toolbar (écran seulement) */}
      <div className="toolbar no-print">
        <div>

          <h2>QR code &amp; Affiche</h2>
          <p>
            Permettez à vos clients de réserver en ligne en scannant votre QR
            code depuis leur smartphone.
          </p>
        </div>
      </div>

      {/* 2. Erreur si NEXT_PUBLIC_SITE_URL est absente */}
      {!hasValidSiteUrl && (
        <div className="panel border-amber-500/40 bg-amber-500/10 p-6 rounded-xl flex flex-col sm:flex-row items-start gap-4 mb-6">
          <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
            <Icon name="warning" size={26} />
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg text-amber-200 m-0">
              Variable d&apos;environnement manquante : NEXT_PUBLIC_SITE_URL
            </h3>
            <p className="text-sm text-[var(--color-text-dim)] leading-relaxed m-0">
              Pour éviter d&apos;imprimer un QR code erroné, la variable
              d&apos;environnement <code>NEXT_PUBLIC_SITE_URL</code> doit être
              définie (par exemple <code>https://vokalia.fr</code>, sans slash
              final).
            </p>
            <p className="text-xs text-[var(--color-text-muted)] m-0">
              Ajoutez <code>NEXT_PUBLIC_SITE_URL=https://vokalia.fr</code> dans
              votre fichier <code>.env.local</code> et dans les variables de
              projet sur votre plateforme de déploiement (Vercel).
            </p>
          </div>
        </div>
      )}

      {/* 3. Erreur de génération */}
      {hasValidSiteUrl && error && (
        <div className="panel border-red-500/40 bg-red-500/10 p-5 rounded-xl flex items-center gap-3 text-red-200 mb-6">
          <Icon name="warning" size={22} />
          <span>{error}</span>
        </div>
      )}

      {/* 4. État de chargement */}
      {hasValidSiteUrl && loading && (
        <div className="panel p-12 text-center text-[var(--color-text-dim)]">
          <div className="inline-block animate-spin mb-3">
            <Icon name="clock" size={32} />
          </div>
          <p className="m-0 text-base">Génération de votre QR code haute définition...</p>
        </div>
      )}

      {/* 5. Contenu principal (écran) */}
      {hasValidSiteUrl && !loading && !error && (
        <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Colonne Gauche : QR code et téléchargements */}
          <section className="lg:col-span-5 flex flex-col gap-5">
            <div className="panel m-0 p-6 flex flex-col items-center">
              <h3 className="text-base font-semibold w-full text-left mb-4">
                Votre QR code de réservation
              </h3>

              {/* Rendu QR code : contraste fort modules sombres sur fond blanc */}
              <div
                className="bg-white p-5 rounded-2xl shadow-lg border border-[var(--color-border)] flex items-center justify-center w-full max-w-[260px] aspect-square"
                role="img"
                aria-label={`QR code de réservation pour ${businessName}`}
              >
                {svgMarkup ? (
                  <div
                    className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={pngDataUrl}
                    alt={`QR code pour ${businessName}`}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* URL en clair sous le QR */}
              <div className="w-full mt-4">
                <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold block mb-1">
                  URL encodée
                </label>
                <div className="p-2.5 rounded-lg bg-[var(--color-bg-panel-2)] border border-[var(--color-border)] text-xs text-[var(--color-text-dim)] font-mono break-all select-all">
                  {publicUrl}
                </div>
              </div>

              {/* Boutons d'actions rapides (Copier le lien + Ouvrir la fiche) */}
              <div className="w-full grid grid-cols-2 gap-2 mt-3">
                <button
                  type="button"
                  className={`button flex items-center justify-center gap-2 text-sm transition-all ${copied
                    ? "!border-emerald-500 !bg-emerald-500/10 !text-emerald-300"
                    : ""
                    }`}
                  onClick={handleCopyLink}
                  title="Copier l'adresse de votre fiche publique"
                >
                  <Icon name={copied ? "check" : "copy"} size={16} />
                  <span>{copied ? "Lien copié !" : "Copier le lien"}</span>
                </button>

                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button ghost flex items-center justify-center gap-2 text-sm !border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                  title="Ouvrir votre fiche publique dans un nouvel onglet"
                  style={{ textDecoration: "none" }}
                >
                  <Icon name="external" size={16} />
                  <span>Ouvrir la fiche</span>
                </a>
              </div>

              {/* Téléchargements du fichier QR (PNG haute résolution + SVG vectoriel) */}
              <div className="w-full border-t border-[var(--color-border)] mt-5 pt-5 flex flex-col gap-2">
                <p className="text-xs text-[var(--color-text-muted)] m-0 mb-1">
                  Export direct du fichier QR code :
                </p>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="button flex items-center justify-center gap-2 text-sm w-full"
                >
                  <Icon name="download" size={16} />
                  <span>Télécharger en PNG (1024 px)</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="button ghost flex items-center justify-center gap-2 text-sm w-full !border border-[var(--color-border)]"
                >
                  <Icon name="download" size={16} />
                  <span>Télécharger en SVG (vectoriel)</span>
                </button>
              </div>
            </div>
          </section>

          {/* Colonne Droite : Affiche A4 vitrine prête à l'emploi */}
          <section className="lg:col-span-7 flex flex-col gap-5">
            <div className="panel m-0 p-6 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-semibold m-0">
                    Affiche A4
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-0">
                    Format A4 portrait prêt à imprimer ou à exporter en PDF.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="button flex items-center justify-center gap-2 text-sm shrink-0 border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                    title="Télécharger le QR code en haute résolution (PNG 1024px)"
                  >
                    <Icon name="download" size={16} />
                    <span>Télécharger le QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="button primary flex items-center justify-center gap-2 shrink-0 shadow-md"
                  >
                    <Icon name="printer" size={18} />
                    <span>Imprimer l&apos;affiche A4</span>
                  </button>
                </div>
              </div>



              {/* Aperçu fidèle de l'affiche A4 à l'écran */}
              <div className="flex justify-center bg-[var(--color-bg-panel-2)] p-4 sm:p-8 rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div
                  className="w-full max-w-[420px] bg-white text-[#15120F] rounded-lg shadow-2xl p-6 sm:p-8 flex flex-col justify-between items-center text-center transition-all select-none"
                  style={{
                    aspectRatio: "1 / 1.4142",
                    border: "1px solid #E6E0D6",
                  }}
                >
                  {/* Haut de l'affiche : Logo Vokalia */}
                  <div className="flex items-center gap-2 pt-1 opacity-90">
                    <Logo size={24} />
                    <span
                      className="font-bold tracking-tight text-base"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "#15120F",
                      }}
                    >
                      vokalia
                    </span>
                  </div>

                  {/* Milieu haut : Nom du salon + Titre accroche */}
                  <div className="my-auto py-2 flex flex-col items-center">
                    <h4
                      className="text-xl sm:text-2xl font-bold tracking-tight m-0 text-[#15120F]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {businessName}
                    </h4>

                    <div
                      className="text-base sm:text-lg font-medium mt-2 m-0 text-[#BD5B39]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Réservez en ligne en 30 secondes
                    </div>

                    {/* QR Code grand et centré */}
                    <div className="my-4 p-3 bg-white border border-[#E6E0D6] rounded-xl shadow-sm flex items-center justify-center w-[160px] sm:w-[190px] aspect-square">
                      {svgMarkup ? (
                        <div
                          className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: svgMarkup }}
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pngDataUrl}
                          alt="QR code"
                          className="w-full h-full object-contain"
                        />
                      )}
                    </div>

                    {/* Instructions scan & URL en clair */}
                    <p
                      className="text-xs sm:text-sm font-semibold text-[#15120F] m-0"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      Scannez avec l&apos;appareil photo de votre téléphone
                    </p>


                  </div>

                  {/* Bas de l'affiche : Mention de service */}
                  <div className="w-full pt-3 border-t border-[#E6E0D6] flex items-center justify-between text-[9px] sm:text-[10px] text-[#8C8172]">
                    <span>Prise de rendez-vous 24h/24 &amp; 7j/7</span>
                    <span>vokalia.fr</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 6. AFFICHE A4 RÉELLE POUR L'IMPRESSION (Strictement masquée à l'écran, visible uniquement via @media print) */}
      {hasValidSiteUrl && !loading && !error && (
        <div className="a4-print-sheet" aria-hidden="true">
          {/* En-tête A4 */}
          <div className="a4-print-header">
            <div className="flex items-center gap-3">
              <Logo size={36} />
              <span className="a4-print-brand">vokalia</span>
            </div>
          </div>

          {/* Cœur de l'affiche A4 */}
          <div className="a4-print-body">
            <div className="a4-print-salon-name">{businessName}</div>

            <div className="a4-print-catchphrase">
              Réservez en ligne en 30 secondes
            </div>

            {/* QR Code grand et parfaitement centré */}
            <div className="a4-print-qr-frame">
              {svgMarkup ? (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={pngDataUrl}
                  alt={`QR code ${businessName}`}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="a4-print-scan-instruction">
              Scannez avec l&apos;appareil photo de votre téléphone
            </div>


          </div>

          {/* Pied de page A4 */}
          <div className="a4-print-footer">
            <span>Prise de rendez-vous simple et instantanée 24h/24 &amp; 7j/7</span>
            <span>vokalia.fr</span>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
