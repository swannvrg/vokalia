import { createSupabaseAdminClient } from "@/lib/supabase";
import { isWithinOpeningHours } from "@/lib/business-hours";
import { normalizeFrenchPhone } from "@/lib/format-phone";

const parisDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

function parisOffset(localDate: string, localTime: string): string {
  const approx = new Date(`${localDate}T${localTime}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  });
  const parts = formatter.formatToParts(approx);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  const match = tzPart?.value.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+01:00";
}

async function getBusiness(supabase: ReturnType<typeof createSupabaseAdminClient>, businessId: string) {
  const { data, error } = await supabase.from("businesses").select("id, name, real_phone_number, address, timezone").eq("id", businessId).eq("status", "active").single();
  if (error) throw error;
  return data;
}

export async function GET(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const params = new URL(request.url).searchParams;
    const businessId = params.get("businessId") || "";
    if (!businessId) return Response.json({ error: "Salon non spécifié." }, { status: 400 });
    const date = params.get("date") || parisDate();
    const serviceId = params.get("serviceId") || "";
    const resourceId = params.get("resourceId") || "";
    const business = await getBusiness(supabase, businessId);
    const [{ data: services, error: servicesError }, { data: resources, error: resourcesError }, { data: businessHours, error: hoursError }] = await Promise.all([
      supabase.from("services").select("id, name, duration_minutes, price").eq("business_id", business.id).eq("active", true).order("name"),
      supabase.from("resources").select("id, name, capacity, active, color").eq("business_id", business.id).eq("resource_type", "practitioner").eq("active", true).order("name"),
      supabase.from("business_hours").select("day_of_week, open_time, close_time").eq("business_id", business.id),
    ]);
    if (servicesError) throw servicesError;
    if (resourcesError) throw resourcesError;
    if (hoursError) throw hoursError;

    let slots: { resource_id: string; resource_name: string; slot_start: string; slot_end: string }[] = [];
    if (serviceId) {
      const resourceIds = resourceId ? [resourceId] : (resources ?? []).map((resource) => resource.id);
      const responses = await Promise.all(resourceIds.map((currentResourceId) =>
        supabase.rpc("get_available_slots", {
          p_business_id: business.id,
          p_service_id: serviceId,
          p_resource_id: currentResourceId,
          p_party_size: "1",
          p_search_from: `${date}T00:00:00${parisOffset(date, "00:00")}`,
          p_search_days: 1,
          p_slot_increment_minutes: 15,
          p_max_results: 300,
        }),
      ));
      const firstError = responses.find((response) => response.error)?.error;
      if (firstError) throw firstError;
      const data = responses.flatMap((response) => response.data ?? []);

      const service = (services ?? []).find((s) => s.id === serviceId);
      const duration = service?.duration_minutes ?? 30;

      slots = (data ?? []).map((slot: {
        resource_id: string;
        resource_name: string;
        slot_start?: string;
        slot_end?: string;
        slot_display?: string;
        slot_token?: string;
      }) => {
        let slotStart = slot.slot_start;
        if (!slotStart && slot.slot_token) {
          try {
            const decoded = Buffer.from(slot.slot_token, "base64").toString("utf-8");
            const parts = decoded.split("|");
            if (parts[1]) {
              const d = new Date(parts[1].trim());
              if (!Number.isNaN(d.getTime())) slotStart = d.toISOString();
            }
          } catch {
            // fallback
          }
        }
        if (!slotStart && slot.slot_display) {
          const [d, t] = slot.slot_display.split("T");
          if (d && t) {
            const dObj = new Date(`${d}T${t}:00${parisOffset(d, t)}`);
            if (!Number.isNaN(dObj.getTime())) slotStart = dObj.toISOString();
          }
          if (!slotStart) {
            const dObj = new Date(slot.slot_display);
            if (!Number.isNaN(dObj.getTime())) slotStart = dObj.toISOString();
          }
        }

        let slotEnd = slot.slot_end;
        if (!slotEnd && slotStart) {
          slotEnd = new Date(new Date(slotStart).getTime() + duration * 60_000).toISOString();
        }

        return {
          resource_id: slot.resource_id,
          resource_name: slot.resource_name,
          slot_start: slotStart ?? "",
          slot_end: slotEnd ?? "",
        };
      });
    }
    return Response.json({ business, services: services ?? [], resources: resources ?? [], businessHours: businessHours ?? [], slots });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Impossible de charger les disponibilités." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const body = await request.json();
    const businessId = String(body.businessId ?? "");
    if (!businessId) return Response.json({ error: "Salon non spécifié." }, { status: 400 });
    const name = String(body.customerName ?? "").trim();
    const phone = normalizeFrenchPhone(String(body.customerPhone ?? ""));
    const resourceId = String(body.resourceId ?? "");
    const serviceId = String(body.serviceId ?? "");
    const startTime = String(body.startTime ?? "");
    if (!name || !resourceId || !serviceId || !startTime) return Response.json({ error: "Veuillez remplir tous les champs obligatoires." }, { status: 400 });
    if (!phone) return Response.json({ error: "Numéro de téléphone invalide. Utilisez 06 12 34 56 78 ou +33 6 12 34 56 78." }, { status: 400 });
    if (Number.isNaN(new Date(startTime).getTime())) return Response.json({ error: "Date ou heure invalide." }, { status: 400 });

    const { data: resource, error: resourceError } = await supabase.from("resources").select("business_id").eq("id", resourceId).eq("business_id", businessId).eq("resource_type", "practitioner").eq("active", true).single();
    if (resourceError || !resource) return Response.json({ error: "Ce Coiffeur n'est plus disponible." }, { status: 400 });
    const { data: service, error: serviceError } = await supabase.from("services").select("duration_minutes").eq("id", serviceId).eq("business_id", resource.business_id).eq("active", true).single();
    if (serviceError || !service) return Response.json({ error: "Cette prestation n'est plus disponible." }, { status: 400 });
    if (!(await isWithinOpeningHours(supabase, resource.business_id, new Date(startTime), service.duration_minutes))) {
      return Response.json({ error: "Ce créneau est en dehors des heures d'ouverture du salon." }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("book_appointment", { p_business_id: resource.business_id, p_resource_id: resourceId, p_service_id: serviceId, p_customer_phone: phone, p_customer_name: name, p_start_time: startTime, p_party_size: 1, p_booked_by: "client" });
    if (error) {
      if (error.message.includes("SLOT_NO_LONGER_AVAILABLE")) return Response.json({ error: "Ce créneau vient d'être réservé. Choisissez-en un autre." }, { status: 409 });
      throw error;
    }
    return Response.json({ id: data }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Impossible de confirmer le rendez-vous." }, { status: 500 });
  }
}
