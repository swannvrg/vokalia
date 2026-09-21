import { createSupabaseAdminClient } from "@/lib/supabase";
import { isWithinOpeningHours } from "@/lib/business-hours";

const parisDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());

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
    const [{ data: services, error: servicesError }, { data: resources, error: resourcesError }] = await Promise.all([
      supabase.from("services").select("id, name, duration_minutes").eq("business_id", business.id).eq("active", true).order("name"),
      supabase.from("resources").select("id, name, capacity, active, color").eq("business_id", business.id).eq("resource_type", "practitioner").eq("active", true).order("name"),
    ]);
    if (servicesError) throw servicesError;
    if (resourcesError) throw resourcesError;

    let slots: { resource_id: string; resource_name: string; slot_start: string; slot_end: string }[] = [];
    if (serviceId) {
      const { data, error } = await supabase.rpc("get_available_slots", {
        p_business_id: business.id,
        p_service_id: serviceId,
        p_resource_id: resourceId,
        p_party_size: "1",
        p_search_from: `${date}T00:00:00+02:00`,
        p_search_days: 1,
        p_slot_increment_minutes: 15,
        p_max_results: 300,
      });
      if (error) throw error;
      slots = data ?? [];
    }
    return Response.json({ business, services: services ?? [], resources: resources ?? [], slots });
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
    const phone = String(body.customerPhone ?? "").trim();
    const resourceId = String(body.resourceId ?? "");
    const serviceId = String(body.serviceId ?? "");
    const startTime = String(body.startTime ?? "");
    if (!name || !resourceId || !serviceId || !startTime) return Response.json({ error: "Veuillez remplir tous les champs obligatoires." }, { status: 400 });
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
