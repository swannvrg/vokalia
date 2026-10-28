"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTransitionRouter } from "@/app/components/PageTransitionProvider";
import Link from "next/link";
import Logo from "@/app/components/Logo";
import Icon from "@/app/components/Icon";

export default function DashboardShell({
  children,
  businessId,
  isAdmin = false,
  onAddAppointment,
}: {
  children: React.ReactNode;
  businessId?: string | null;
  isAdmin?: boolean;
  onAddAppointment?: () => void;
}) {
  const router = useTransitionRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  // Close menu on Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  // Close menu on navigation change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isProfile = pathname?.includes("/profil");
  const isQrCode = pathname?.includes("/qr-code");
  const calendarHref = businessId ? `/${businessId}/calendrier` : (isAdmin ? "/admin" : "/calendrier");
  const profileHref = businessId ? `/${businessId}/profil` : "/profil";
  const qrCodeHref = businessId ? `/${businessId}/qr-code` : "/qr-code";
  const showNavLinks = !isAdmin || businessId;

  return (
    <main className="shell">
      <header className="topbar relative dashboard-topbar">
        <Link href={calendarHref} className="brand" style={{ textDecoration: "none" }} onClick={() => setMenuOpen(false)}>
          <Logo size={28} />
          <span className="brand-wordmark">vokalia</span>
        </Link>

        {/* Mobile top actions: "+" button & burger button */}
        <div className="dashboard-mobile-actions flex md:hidden items-center gap-2">
          {onAddAppointment && (
            <button
              type="button"
              className="button primary flex items-center justify-center min-w-[44px] min-h-[44px] !p-0 !w-11 !h-11 rounded-full shadow-md"
              onClick={onAddAppointment}
              aria-label="Ajouter un rendez-vous"
            >
              <Icon name="plus" size={20} />
            </button>
          )}
          <button
            type="button"
            className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-panel)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-dashboard-menu"
            aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={22} />
          </button>
        </div>

        {/* Desktop actions (>= 768px) */}
        <div className="actions hidden md:flex">
          {onAddAppointment && (
            <button className="button primary" onClick={onAddAppointment}>
              Ajouter un rendez-vous
            </button>
          )}
          {showNavLinks && (
            <>
              <Link
                href={calendarHref}
                className={`button ${!isProfile && !isQrCode ? "" : "ghost"}`}
                style={!isProfile && !isQrCode ? { borderColor: "var(--color-border)", background: "transparent", color: "var(--color-text)" } : {}}
                aria-current={!isProfile && !isQrCode ? "page" : undefined}
              >
                Calendrier
              </Link>
              <Link
                href={profileHref}
                className={`button ${isProfile ? "" : "ghost"}`}
                style={isProfile ? { borderColor: "var(--color-border)", background: "transparent", color: "var(--color-text)" } : {}}
                aria-current={isProfile ? "page" : undefined}
              >
                Profil
              </Link>
              <Link
                href={qrCodeHref}
                className={`button ${isQrCode ? "" : "ghost"}`}
                style={isQrCode ? { borderColor: "var(--color-border)", background: "transparent", color: "var(--color-text)" } : {}}
                aria-current={isQrCode ? "page" : undefined}
              >
                QR code
              </Link>
            </>
          )}
          {businessId && !isAdmin && (
            <a
              className="button ghost"
              href={`/${businessId}/profil-public`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
              title="Voir la fiche publique du salon"
            >
              Fiche publique ↗
            </a>
          )}
          <button className="button ghost" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </header>

      {/* Backdrop overlay for mobile menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 top-[65px] bg-black/50 z-40 md:hidden backdrop-blur-xs"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
          <div
          id="mobile-dashboard-menu"
          className="dashboard-mobile-menu md:hidden fixed bg-[var(--color-bg-panel)] border border-[var(--color-border)] shadow-2xl z-50 p-3 transition-all"
        >
          <nav className="flex flex-col gap-2">
            {showNavLinks ? (
              <>
                <Link
                  href={calendarHref}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium min-h-[44px] transition-colors ${
                    !isProfile
                      ? "bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]"
                      : "text-[var(--color-text-dim)] hover:bg-[var(--color-bg-subtle)]"
                  }`}
                  aria-current={!isProfile ? "page" : undefined}
                >
                  <Icon name="calendar" size={20} />
                  <span>Calendrier</span>
                </Link>
                <Link
                  href={profileHref}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium min-h-[44px] transition-colors ${
                    isProfile
                      ? "bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]"
                      : "text-[var(--color-text-dim)] hover:bg-[var(--color-bg-subtle)]"
                  }`}
                  aria-current={isProfile ? "page" : undefined}
                >
                  <Icon name="settings" size={20} />
                  <span>Profil</span>
                </Link>
                <Link
                  href={qrCodeHref}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium min-h-[44px] transition-colors ${
                    isQrCode
                      ? "bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]"
                      : "text-[var(--color-text-dim)] hover:bg-[var(--color-bg-subtle)]"
                  }`}
                  aria-current={isQrCode ? "page" : undefined}
                >
                  <Icon name="qr" size={20} />
                  <span>QR code</span>
                </Link>
                {businessId && (
                  <a
                    href={`/${businessId}/profil-public`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-lg text-base font-medium min-h-[44px] text-[var(--color-text-dim)] hover:bg-[var(--color-bg-subtle)] transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <Icon name="external" size={20} />
                      <span>Fiche publique</span>
                    </span>
                  </a>
                )}
              </>
            ) : (
              <div className="px-4 py-2 text-sm text-[var(--color-text-muted)]">Administration</div>
            )}
            <div className="my-1 border-t border-[var(--color-border)]" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium min-h-[44px] text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
            >
              <Icon name="logout" size={20} />
              <span>Se déconnecter</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <div className="content">{children}</div>
    </main>
  );
}
