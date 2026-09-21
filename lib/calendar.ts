import type { Appointment, CalendarData, Resource, Service } from "@/lib/types";

const PARIS_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isParisDate(value: string, date: string) {
  return PARIS_DATE.format(new Date(value)) === date;
}

export async function getCalendarData(
  supabase: ReturnType<typeof import("@/lib/supabase").createSupabaseAdminClient>,
  date: string,
  businessId: string,
): Promise<CalendarData> {
  const { data: resourceRows, error: resourcesError } = await supabase
    .from("resources")
    .select("id, business_id, name, capacity, active, color")
    .eq("business_id", businessId)
    .eq("resource_type", "practitioner")
    .eq("active", true)
    .order("name");
  if (resourcesError) throw resourcesError;

  const resources = (resourceRows ?? []) as (Resource & { business_id: string })[];
  const mondayBasedWeekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const [{ data: businessHours, error: hoursError }, { data: serviceRows, error: servicesError }, { data: appointmentRows, error: appointmentsError }] =
    await Promise.all([
      supabase.from("business_hours").select("day_of_week, open_time, close_time").eq("business_id", businessId),
      supabase.from("services").select("id, name, duration_minutes").eq("business_id", businessId).eq("active", true).order("name"),
      supabase
        .from("appointments")
        .select("id, resource_id, service_id, customer_id, start_time, end_time, status, booked_by, block_label, customer:customers(name), service:services(name), resource:resources(name, color)")
        .eq("business_id", businessId)
        .gte("start_time", `${date}T00:00:00Z`)
        .lt("start_time", `${date}T23:59:59Z`),
    ]);
  if (servicesError) throw servicesError;
  if (appointmentsError) throw appointmentsError;
  if (hoursError) throw hoursError;

  const normalizedHours = (businessHours ?? []).map((item) => ({
    ...item,
    day_of_week: Number(item.day_of_week),
  }));
  const usesZeroBasedWeekdays = normalizedHours.some((item) => item.day_of_week === 0);
  const hours = normalizedHours.find((item) => item.day_of_week === (usesZeroBasedWeekdays ? mondayBasedWeekday : mondayBasedWeekday + 1)) ?? null;

  const services = (serviceRows ?? []) as Service[];
  const appointments = (appointmentRows ?? []).map((item) => ({
    ...item,
    customer: Array.isArray(item.customer) ? item.customer[0] ?? null : item.customer,
    service: Array.isArray(item.service) ? item.service[0] ?? null : item.service,
    resource: Array.isArray(item.resource) ? item.resource[0] ?? null : item.resource,
  })) as Appointment[];
  const slotResults = await Promise.all(
    services.map(async (service) => {
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_business_id: businessId,
        p_service_id: service.id,
        p_resource_id: "",
        p_party_size: "1",
        p_search_from: `${date}T00:00:00Z`,
        p_search_days: 2,
        p_slot_increment_minutes: 15,
        p_max_results: 500,
      });
      if (error) throw error;
      return (data ?? []).filter((slot: { slot_start: string }) => isParisDate(slot.slot_start, date));
    }),
  );

  const slots = Array.from(
    new Map(
      slotResults.flat().map((slot) => [
        `${slot.resource_id}-${slot.slot_start}`,
        { resource_id: slot.resource_id, slot_start: slot.slot_start, slot_end: slot.slot_end },
      ]),
    ).values(),
  );

  return {
    date,
    opening: hours ?? null,
    resources: resources.map((resource) => ({ id: resource.id, name: resource.name, capacity: resource.capacity, active: resource.active, color: resource.color || "#D96D4B" })),
    services,
    appointments,
    slots,
  };
}