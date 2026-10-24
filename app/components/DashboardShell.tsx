"use client";

import { useRouter, usePathname } from "next/navigation";
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
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const isProfile = pathname?.includes("/profil");
  const calendarHref = businessId ? `/${businessId}/calendrier` : (isAdmin ? "/admin" : "/calendrier");
  const profileHref = businessId ? `/${businessId}/profil` : "/profil";
  const showNavLinks = !isAdmin || businessId;

  return (
    <main className="shell pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <header className="topbar">
        <Link href={calendarHref} className="brand" style={{ textDecoration: "none" }}>
          <Logo size={28} />
          <span className="brand-wordmark">vokalia</span>
        </Link>
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
                className={`button ${!isProfile ? "" : "ghost"}`}
                style={!isProfile ? { borderColor: "var(--color-border)", background: "transparent", color: "var(--color-text)" } : {}}
                aria-current={!isProfile ? "page" : undefined}
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

      {/* Main Content */}
      <div className="content">{children}</div>

      {/* Mobile Navigation (Bottom Bar) */}
      <nav 
        className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 border-t border-[var(--color-border)] bg-[var(--color-bg-panel)] flex justify-around items-center px-2 pt-3 z-50"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {showNavLinks ? (
          <>
            <Link
              href={calendarHref}
              className={`flex flex-col items-center gap-1 ${!isProfile ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]"}`}
              style={{ textDecoration: "none" }}
              aria-current={!isProfile ? "page" : undefined}
            >
              <Icon name="calendar" size={20} />
              <span className="text-xs font-semibold">Calendrier</span>
            </Link>
            {onAddAppointment && (
              <button
                className="bg-[var(--color-accent)] text-[var(--color-bg)] rounded-full w-12 h-12 flex items-center justify-center font-bold text-2xl -mt-6 shadow-lg shadow-black/50"
                onClick={onAddAppointment}
                aria-label="Ajouter un rendez-vous"
              >
                +
              </button>
            )}
            <Link
              href={profileHref}
              className={`flex flex-col items-center gap-1 ${isProfile ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]"}`}
              style={{ textDecoration: "none" }}
              aria-current={isProfile ? "page" : undefined}
            >
              <Icon name="settings" size={20} />
              <span className="text-xs font-semibold">Profil</span>
            </Link>
          </>
        ) : (
          <div className="flex justify-around w-full">
            <span className="text-[var(--color-text-muted)] text-sm">Administration</span>
            <button className="text-[var(--color-text-dim)] text-sm font-semibold" onClick={handleLogout}>Déconnexion</button>
          </div>
        )}
      </nav>
    </main>
  );
}
