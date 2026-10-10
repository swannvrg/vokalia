import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase";
import Logo from "@/app/components/Logo";
import PublicFooter from "@/app/components/PublicFooter";
import { formatPhoneDisplay } from "@/app/components/CallbackPanel";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) return { title: "Salon introuvable | Vokalia" };

  const supabase = createSupabaseAdminClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();

  return {
    title: business ? `${business.name} | Vokalia` : "Salon introuvable | Vokalia",
    description: business
      ? `Consultez les prestations, tarifs et horaires de ${business.name} et prenez rendez-vous en ligne.`
      : undefined,
  };
}

export default async function PublicSalonProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    notFound();
  }

  const supabase = createSupabaseAdminClient();

  // Requête stricte : UNIQUEMENT les données non sensibles (équivalent get_salon_context)
  const [
    { data: business, error: bError },
    { data: services, error: sError },
    { data: resources, error: rError },
    { data: hours, error: hError },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, address, real_phone_number, timezone")
      .eq("id", id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, is_default, combo_service_id")
      .eq("business_id", id)
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("name"),
    supabase
      .from("resources")
      .select("id, name, color")
      .eq("business_id", id)
      .eq("resource_type", "practitioner")
      .eq("active", true)
      .order("name"),
    supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time")
      .eq("business_id", id)
      .order("day_of_week"),
  ]);

  if (bError || !business) {
    notFound();
  }

  const activeServices = services ?? [];
  const activeResources = resources ?? [];
  const openingHours = hours ?? [];

  // Indexer les horaires par day_of_week (0 = Lundi ... 6 = Dimanche)
  const zeroBased = openingHours.some((h) => Number(h.day_of_week) === 0);
  const hoursByDay = new Map<
    number,
    { open_time: string; close_time: string }
  >();
  for (const h of openingHours) {
    if (h.open_time && h.close_time) {
      const normalizedDay = zeroBased ? Number(h.day_of_week) : Number(h.day_of_week) - 1;
      hoursByDay.set(normalizedDay, {
        open_time: h.open_time.slice(0, 5),
        close_time: h.close_time.slice(0, 5),
      });
    }
  }

  return (
    <div className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Barre de navigation publique */}
      <header className="topbar">
        <div className="brand">
          <Logo size={28} />
          <span className="brand-wordmark">vokalia</span>
        </div>
        <div className="actions">
          <Link
            href={`/prendre-rdv?businessId=${business.id}`}
            className="button primary"
            style={{ textDecoration: "none" }}
          >
            Prendre RDV
          </Link>
        </div>
      </header>

      {/* Contenu principal de la fiche vitrine */}
      <main className="content" style={{ flex: 1, maxWidth: "1000px" }}>
        {/* En-tête du salon (Hero) */}
        <section
          className="panel"
          style={{
            padding: "clamp(1.5rem, 3vw, 2.5rem)",
            marginBottom: "2rem",
            background:
              "radial-gradient(120% 120% at 90% 10%, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, var(--color-bg-panel) 60%)",
          }}
        >
          <p className="kicker">Fiche Salon</p>
          <h1
            style={{
              margin: "0.2rem 0 1rem",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: "var(--color-text)",
            }}
          >
            {business.name}
          </h1>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1.2rem",
              fontSize: "0.95rem",
              color: "var(--color-text-dim)",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            {business.address && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                <span>📍</span>
                <span>{business.address}</span>
              </span>
            )}
            {business.real_phone_number && (
              <a
                href={`tel:${business.real_phone_number}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  color: "var(--color-accent-soft)",
                  textDecoration: "none",
                }}
              >
                <span>📞</span>
                <span>{formatPhoneDisplay(business.real_phone_number)}</span>
              </a>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              href={`/prendre-rdv?businessId=${business.id}`}
              className="button primary"
              style={{
                textDecoration: "none",
                fontSize: "1rem",
                padding: "0.75rem 1.6rem",
              }}
            >
              Prendre rendez-vous en ligne
            </Link>
            {business.real_phone_number && (
              <a
                href={`tel:${business.real_phone_number}`}
                className="button ghost"
                style={{ textDecoration: "none", fontSize: "0.95rem" }}
              >
                Appeler le salon
              </a>
            )}
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          {/* Section Prestations & Tarifs */}
          <section className="panel" style={{ margin: 0 }}>
            <h2
              style={{
                margin: "0 0 1.2rem",
                fontFamily: "var(--font-display)",
                fontSize: "1.3rem",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>Prestations & Tarifs</span>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontFamily: "var(--font-body)",
                  color: "var(--color-text-muted)",
                  fontWeight: 400,
                }}
              >
                {activeServices.length} prestation{activeServices.length > 1 ? "s" : ""}
              </span>
            </h2>

            {activeServices.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                Aucune prestation enregistrée pour ce salon.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "10px",
                      border: service.is_default
                        ? "1px solid var(--color-accent)"
                        : "1px solid var(--color-border)",
                      backgroundColor: service.is_default
                        ? "color-mix(in srgb, var(--color-accent) 7%, var(--color-bg-panel))"
                        : "var(--color-bg-panel-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                          {service.name}
                        </span>
                        {service.is_default && (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              color: "var(--color-accent)",
                              backgroundColor:
                                "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "4px",
                            }}
                          >
                            ★ Populaire
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {service.duration_minutes} min
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "1.05rem",
                          fontWeight: 600,
                          color: "var(--color-text)",
                        }}
                      >
                        {service.price !== null ? `${service.price} €` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Colonne latérale : Équipe & Horaires */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Section Équipe / Praticiens */}
            {activeResources.length > 0 && (
              <section className="panel" style={{ margin: 0 }}>
                <h2
                  style={{
                    margin: "0 0 1rem",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.2rem",
                    fontWeight: 500,
                  }}
                >
                  L&apos;équipe du salon
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                  {activeResources.map((res) => (
                    <span
                      key={res.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.4rem 0.8rem",
                        borderRadius: "20px",
                        backgroundColor: "var(--color-bg-panel-2)",
                        border: "1px solid var(--color-border)",
                        fontSize: "0.88rem",
                        color: "var(--color-text)",
                      }}
                    >
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: res.color || "var(--color-accent)",
                        }}
                      />
                      <span>{res.name}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Section Horaires d'ouverture */}
            <section className="panel" style={{ margin: 0, flex: 1 }}>
              <h2
                style={{
                  margin: "0 0 1rem",
                  fontFamily: "var(--font-display)",
                  fontSize: "1.2rem",
                  fontWeight: 500,
                }}
              >
                Horaires d&apos;ouverture
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {DAYS.map((dayName, index) => {
                  const dayHours = hoursByDay.get(index);
                  const isOpen = Boolean(dayHours);

                  return (
                    <div
                      key={dayName}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.88rem",
                        padding: "0.35rem 0",
                        borderBottom:
                          index < DAYS.length - 1
                            ? "1px solid color-mix(in srgb, var(--color-border) 40%, transparent)"
                            : "none",
                      }}
                    >
                      <span
                        style={{
                          color: isOpen ? "var(--color-text)" : "var(--color-text-muted)",
                          fontWeight: isOpen ? 500 : 400,
                        }}
                      >
                        {dayName}
                      </span>
                      <span
                        style={{
                          color: isOpen ? "var(--color-text)" : "var(--color-text-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {isOpen
                          ? `${dayHours!.open_time} - ${dayHours!.close_time}`
                          : "Fermé"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
