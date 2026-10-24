"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/app/components/Logo";
import Link from "next/link";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
};
type Resource = { id: string; name: string; color: string };
type Slot = {
  resource_id: string;
  resource_name: string;
  slot_start: string;
  slot_end: string;
};
type BusinessHours = {
  day_of_week: number;
  open_time: string;
  close_time: string;
}[];
type BookingData = {
  business: {
    name: string;
    address: string | null;
    real_phone_number: string | null;
  };
  services: Service[];
  resources: Resource[];
  businessHours: BusinessHours;
  slots: Slot[];
};
type Confirmation = {
  customerName: string;
  service: Service;
  slot: Slot;
  date: string;
  salonName: string;
  address: string | null;
  salonPhone: string | null;
};

const parisDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );

const formatTime = (value: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const formatLongDate = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${value}T12:00:00Z`));

const addDays = (value: string, amount: number) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const formatPrice = (price: number | null) =>
  price == null
    ? ""
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(price);

function dateChipParts(value: string, index: number) {
  const d = new Date(`${value}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(d)
    .replace(".", "");
  const day = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
  const top = index === 0 ? "Auj." : index === 1 ? "Dem." : weekday;
  return { top, day };
}

function isClosedDay(value: string, hours: BusinessHours | undefined) {
  if (!hours) return false;
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  const dbDay = day === 0 ? 7 : day;
  return !hours.some((item) => Number(item.day_of_week) === dbDay);
}

function firstOpenDate(hours: BusinessHours | undefined) {
  const today = parisDate();
  for (let i = 0; i < 14; i++) {
    const value = addDays(today, i);
    if (!isClosedDay(value, hours)) return value;
  }
  return today;
}

const icsEscape = (value: string) =>
  value.replace(/[\\,;\n]/g, (character) =>
    character === "\n" ? "\\n" : `\\${character}`,
  );

function downloadCalendarFile(confirmation: Confirmation) {
  const start = new Date(confirmation.slot.slot_start);
  const end = new Date(confirmation.slot.slot_end);
  const toIcsDate = (value: Date) =>
    value
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const title = `${confirmation.service.name} avec ${confirmation.slot.resource_name}`;
  const location = [confirmation.salonName, confirmation.address]
    .filter(Boolean)
    .join(", ");

  const isAndroid = /android/i.test(navigator.userAgent);

  // ANDROID : ouvre Google Agenda avec l'événement pré-rempli
  if (isAndroid) {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${toIcsDate(start)}/${toIcsDate(end)}`,
      location,
    });
    window.location.href = `https://calendar.google.com/calendar/render?${params}`;
    return;
  }

  // IPHONE (et le reste) : ouvre l'écran "Ajouter l'événement" du Calendrier
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vokalia//Booking//FR",
    "BEGIN:VEVENT",
    `UID:${confirmation.slot.slot_start}-${confirmation.slot.resource_id}@vokalia`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const DAY_NAMES = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
];

function Icon({ name, size = 16 }: { name: "back" | "next" | "phone" | "pin"; size?: number }) {
  const shapes = {
    back: <path d="M15 5l-7 7 7 7" />,
        next: <path d="M9 5l7 7-7 7" />,
    phone: (
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
    ),
    pin: (
      <>
        <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}

export default function BookingForm({ businessId }: { businessId: string }) {
  const [date, setDate] = useState(parisDate);
  const [serviceId, setServiceId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [data, setData] = useState<BookingData | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const initialised = useRef(false);
    const datesRef = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState({ prev: false, next: true });

  function updateArrows() {
    const el = datesRef.current;
    if (!el) return;
    setArrows({
      prev: el.scrollLeft > 4,
      next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }
  function scrollDates(direction: 1 | -1) {
    const el = datesRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }
  useEffect(() => {
    const frame = requestAnimationFrame(updateArrows);
    window.addEventListener("resize", updateArrows);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateArrows);
    };
  }, [data]);

  useEffect(() => {
    startTransition(() => setLoading(true));
    const query = new URLSearchParams({ date, businessId });
    if (serviceId) query.set("serviceId", serviceId);
    if (resourceId) query.set("resourceId", resourceId);
    fetch(`/api/public/booking?${query}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          setError(result.error ?? "Impossible de charger les disponibilités.");
        } else {
          setData(result);
          setSelectedSlot(null);
          setError("");
          if (!initialised.current) {
            initialised.current = true;
            const first = firstOpenDate(result.businessHours);
            if (first !== date) setDate(first);
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger les disponibilités.");
        setLoading(false);
      });
  }, [businessId, date, serviceId, resourceId, refreshNonce]);

  useEffect(() => {
    if (!confirmation) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    confirmationRef.current?.focus();
  }, [confirmation]);

  const dateOptions = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDays(parisDate(), index)),
    [],
  );

  const timeGroups = useMemo(() => {
    const map = new Map<string, Slot[]>();
    const today = date === parisDate();
    for (const slot of data?.slots ?? []) {
      if (!slot.slot_start) continue;
      if (today && new Date(slot.slot_start).getTime() < Date.now()) continue;
      const label = formatTime(slot.slot_start);
      const list = map.get(label) ?? [];
      if (!list.some((item) => item.resource_id === slot.resource_id))
        list.push(slot);
      map.set(label, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, slots]) => ({ label, slots }));
  }, [data, date]);

  const periods = useMemo(() => {
    const hourOf = (label: string) => parseInt(label.slice(0, 2), 10);
    return [
      { title: "Matin", items: timeGroups.filter((g) => hourOf(g.label) < 12) },
      {
        title: "Après-midi",
        items: timeGroups.filter(
          (g) => hourOf(g.label) >= 12 && hourOf(g.label) < 18,
        ),
      },
      { title: "Soir", items: timeGroups.filter((g) => hourOf(g.label) >= 18) },
    ].filter((period) => period.items.length > 0);
  }, [timeGroups]);

  const multi = !resourceId && (data?.resources.length ?? 0) > 1;
  const isSelected = (slot: Slot) =>
    selectedSlot?.slot_start === slot.slot_start &&
    selectedSlot.resource_id === slot.resource_id;

  const selectedService = data?.services.find(
    (service) => service.id === serviceId,
  );
  const serviceLine = selectedService
    ? [
        selectedService.name,
        `${selectedService.duration_minutes} min`,
        formatPrice(selectedService.price),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const whenLine = selectedSlot
    ? `${formatLongDate(date)} à ${formatTime(selectedSlot.slot_start)} avec ${selectedSlot.resource_name}`
    : "";

  const phoneValid = phone.replace(/\D/g, "").length >= 9;
  const missingMessage = !serviceId
    ? "Choisissez une prestation"
    : !selectedSlot
      ? "Choisissez un créneau"
      : !name.trim()
        ? "Renseignez votre prénom"
        : !phoneValid
          ? "Renseignez un numéro de téléphone valide"
          : "";
  const canSubmit = !missingMessage && !booking;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !selectedSlot || !selectedService) return;
    setBooking(true);
    setError("");
    try {
      const response = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          resourceId: selectedSlot.resource_id,
          serviceId,
          startTime: selectedSlot.slot_start,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          setSelectedSlot(null);
          setError(
            "Ce créneau vient d’être pris. Les disponibilités ont été rechargées.",
          );
          setRefreshNonce((value) => value + 1);
        } else {
          setError(result.error ?? "Impossible de confirmer le rendez-vous.");
        }
      } else {
        setConfirmation({
          customerName: name.trim(),
          service: selectedService,
          slot: selectedSlot,
          date,
          salonName: data?.business.name || "Salon",
          address: data?.business.address || null,
          salonPhone: data?.business.real_phone_number || null,
        });
        setName("");
        setPhone("");
        setSelectedSlot(null);
      }
    } catch {
      setError("Connexion impossible. Réessayez dans un instant.");
    }
    setBooking(false);
  }

  const salonPhone = data?.business.real_phone_number;

  const salonHref = businessId ? `/${businessId}/profil-public` : "/";
    const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  const todayIndex = (new Date(`${parisDate()}T12:00:00Z`).getUTCDay() + 6) % 7;
  const hoursRows = DAY_NAMES.map((label, index) => {
    const hours = data?.businessHours?.find(
      (item) => Number(item.day_of_week) === index + 1,
    );
    return {
      label,
      text: hours
        ? `${hours.open_time.slice(0, 5)} – ${hours.close_time.slice(0, 5)}`
        : "Fermé",
    };
  });

  return (
        <>
    <nav className="bk-nav" aria-label="Navigation">
      <div className="bk-nav-inner">
        <Link href={salonHref} className="bk-back">
          <Icon name="back" size={18} />
          <span>Fiche du salon</span>
        </Link>
        {salonPhone && (
          <a className="bk-nav-call" href={`tel:${salonPhone.replace(/\s/g, "")}`}>
            <Icon name="phone" size={16} />
            <span>Appeler</span>
          </a>
        )}
      </div>
    </nav>
    <main className="bk-page">
      <div className="bk-layout">
      <aside className="bk-aside" aria-label="Informations du salon">
        <div className="bk-aside-card">
          <div className="bk-aside-brand">
            <Logo size={36} />
            <div>
              <p className="kicker">Réservation en ligne</p>
              <h2>{data?.business.name || "Vokalia"}</h2>
            </div>
          </div>
          {data?.business.address && (
            <p className="bk-aside-line">
              <Icon name="pin" />
              {data.business.address}
            </p>
          )}
          {salonPhone && (
            <p className="bk-aside-line">
              <Icon name="phone" />
              <a href={`tel:${salonPhone.replace(/\s/g, "")}`}>{salonPhone}</a>
            </p>
          )}
        </div>
        <div className="bk-aside-card">
          <h3>Horaires</h3>
          <ul className="bk-hours">
            {hoursRows.map((row, index) => (
              <li key={row.label} className={index === todayIndex ? "today" : ""}>
                <span>{row.label}</span>
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
        {(data?.resources.length ?? 0) > 0 && (
          <div className="bk-aside-card">
            <h3>L’équipe</h3>
            <div className="bk-team">
              {data?.resources.map((resource) => (
                <span className="bk-team-chip" key={resource.id}>
                  <i style={{ backgroundColor: resource.color }} />
                  {resource.name}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="bk-aside-card">
          <h3>Votre sélection</h3>
          {selectedService ? (
            <>
              <p className="bk-aside-strong">{serviceLine}</p>
              {selectedSlot ? (
                <p className="bk-muted">{whenLine}</p>
              ) : (
                <p className="bk-muted">Choisissez un créneau.</p>
              )}
            </>
          ) : (
            <p className="bk-muted">Rien de sélectionné pour l’instant.</p>
          )}
        </div>
        <Link href={salonHref} className="button">
          Voir la fiche du salon
        </Link>
      </aside>
      <div className="bk-card">
        <header className="bk-brand">
          <Logo size={32} />
          <div>
            <p className="kicker">Réservation en ligne</p>
            <h1>{data?.business.name || "Vokalia"}</h1>
          </div>
        </header>

        {data?.business.address && (
          <p className="bk-meta">
            {data.business.address}
            {salonPhone && (
              <>
                {" · "}
                <a href={`tel:${salonPhone.replace(/\s/g, "")}`}>
                  {salonPhone}
                </a>
              </>
            )}
          </p>
        )}

        {confirmation ? (
          <div
            className="bk-confirm"
            ref={confirmationRef}
            tabIndex={-1}
            aria-live="polite"
          >
            <div className="bk-confirm-check">
              <CheckIcon size={28} />
            </div>
            <p className="kicker">Rendez-vous confirmé</p>
            <h2>À bientôt, {confirmation.customerName} !</h2>
            <p>
              {[
                confirmation.service.name,
                `${confirmation.service.duration_minutes} min`,
                formatPrice(confirmation.service.price),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p>
              {formatLongDate(confirmation.date)} à{" "}
              {formatTime(confirmation.slot.slot_start)} avec{" "}
              {confirmation.slot.resource_name}
            </p>
            <p>
              {confirmation.salonName}
              {confirmation.address ? `, ${confirmation.address}` : ""}
            </p>
            {confirmation.salonPhone && (
              <p>
                Téléphone du salon :{" "}
                <a href={`tel:${confirmation.salonPhone.replace(/\s/g, "")}`}>
                  {confirmation.salonPhone}
                </a>
              </p>
            )}
            <div className="bk-confirm-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => downloadCalendarFile(confirmation)}
              >
                Ajouter à mon calendrier
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setConfirmation(null);
                  setError("");
                  setRefreshNonce((value) => value + 1);
                }}
              >
                Prendre un autre rendez-vous
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
                        <section className="bk-section">
              <span className="bk-label" id="bk-date-label">
                Date · {monthLabel}
              </span>
              <div className="bk-dates-wrap">
                <button
                  type="button"
                  className="bk-arrow"
                  aria-label="Dates précédentes"
                  disabled={!arrows.prev}
                  onClick={() => scrollDates(-1)}
                >
                  <Icon name="back" size={18} />
                </button>
                <div
                  className="bk-dates"
                  ref={datesRef}
                  onScroll={updateArrows}
                  role="group"
                  aria-labelledby="bk-date-label"
                >
                  {dateOptions.map((option, index) => {
                    const closed = isClosedDay(option, data?.businessHours);
                    const { top, day } = dateChipParts(option, index);
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`bk-date ${date === option ? "selected" : ""}`}
                        aria-pressed={date === option}
                        aria-label={formatLongDate(option)}
                        disabled={closed}
                        onClick={() => {
                          setDate(option);
                          setSelectedSlot(null);
                        }}
                      >
                        <small>{top}</small>
                        <strong>{day}</strong>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="bk-arrow"
                  aria-label="Dates suivantes"
                  disabled={!arrows.next}
                  onClick={() => scrollDates(1)}
                >
                  <Icon name="next" size={18} />
                </button>
              </div>
            </section>

            <section className="bk-section bk-fields">
              <div className="field">
                <label htmlFor="booking-service">Prestation</label>
                <select
                  className="select"
                  id="booking-service"
                  value={serviceId}
                  onChange={(event) => {
                    setServiceId(event.target.value);
                    setResourceId("");
                    setSelectedSlot(null);
                  }}
                >
                  <option value="">Choisir une prestation</option>
                  {data?.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} · {service.duration_minutes} min
                      {service.price != null
                        ? ` · ${formatPrice(service.price)}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>
              {(data?.resources.length ?? 0) > 1 && (
                <div className="field">
                  <label htmlFor="booking-resource">Coiffeur</label>
                  <select
                    className="select"
                    id="booking-resource"
                    value={resourceId}
                    onChange={(event) => {
                      setResourceId(event.target.value);
                      setSelectedSlot(null);
                    }}
                    disabled={!serviceId}
                  >
                    <option value="">Tous les coiffeurs</option>
                    {data?.resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            <section className="bk-section" aria-live="polite">
              <h2 className="bk-title">Créneaux disponibles</h2>
              {loading ? (
                <p className="bk-muted">Recherche en cours…</p>
              ) : !serviceId ? (
                <p className="bk-muted">Choisissez d’abord une prestation.</p>
              ) : periods.length === 0 ? (
                <p className="bk-muted">
                  Aucun créneau disponible ce jour-là. Essayez une autre date.
                </p>
              ) : (
                periods.map((period) => (
                  <div key={period.title}>
                    <h3 className="bk-period">{period.title}</h3>
                    <div className={`bk-times ${multi ? "multi" : ""}`}>
                      {period.items.map(({ label, slots }) =>
                        multi ? (
                          <div className="bk-slotcard" key={label}>
                            <span className="bk-slotcard-time">{label}</span>
                            <div className="bk-slotcard-choices">
                              {slots.map((slot) => {
                                const resource = data?.resources.find(
                                  (item) => item.id === slot.resource_id,
                                );
                                return (
                                  <button
                                    key={slot.resource_id}
                                    type="button"
                                    className={`bk-who ${isSelected(slot) ? "selected" : ""}`}
                                    style={
                                      {
                                        "--slot-color":
                                          resource?.color ||
                                          "var(--color-accent)",
                                      } as React.CSSProperties
                                    }
                                    aria-pressed={isSelected(slot)}
                                    aria-label={`${label} avec ${slot.resource_name}`}
                                    onClick={() => setSelectedSlot(slot)}
                                  >
                                    {isSelected(slot) && (
                                      <CheckIcon size={12} />
                                    )}
                                    {slot.resource_name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <button
                            key={label}
                            type="button"
                            className={`bk-time ${isSelected(slots[0]) ? "selected" : ""}`}
                            aria-pressed={isSelected(slots[0])}
                            onClick={() => setSelectedSlot(slots[0])}
                          >
                            {isSelected(slots[0]) && <CheckIcon size={13} />}
                            {label}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="bk-section bk-fields">
              <div className="field">
                <label htmlFor="booking-name">Votre prénom</label>
                <input
                  className="input"
                  id="booking-name"
                  autoComplete="given-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="booking-phone">Téléphone</label>
                <input
                  className="input"
                  id="booking-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="06 12 34 56 78"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
            </section>

            <div className="bk-footer">
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              {selectedSlot ? (
                <div className="bk-recap">
                  <strong>{serviceLine}</strong>
                  <span>{whenLine}</span>
                </div>
              ) : null}
              {!canSubmit && !booking && (
                <p className="bk-hint">{missingMessage}</p>
              )}
              <button
                className="button bk-submit"
                type="submit"
                disabled={!canSubmit}
              >
                {booking ? "Confirmation…" : "Confirmer le rendez-vous"}
              </button>
            </div>
          </form>
                )}
      </div>
      </div>
    </main>
    </>
  );
}
