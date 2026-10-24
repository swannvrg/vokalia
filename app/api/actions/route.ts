import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";
import { isWithinOpeningHours } from "@/lib/business-hours";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const { supabase, user } = await requireUser();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      body.businessId,
    );
    if (body.action === "cancel") {
      const { data: appt } = await supabase
        .from("appointments")
        .select("id")
        .eq("id", body.appointmentId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!appt) return Response.json({ error: "Rendez-vous introuvable." }, { status: 404 });
      const { data, error } = await supabase.rpc("cancel_appointment", {
        p_appointment_id: body.appointmentId,
        p_business_id: businessId,
      });
      if (error) throw error;
      if (!data) return Response.json({ error: "Ce rendez-vous est déjà annulé ou introuvable." }, { status: 409 });
      return Response.json({ ok: true });
    }

    if (body.action === "block") {
      const { data: resource } = await supabase.from("resources").select("business_id").eq("id", body.resourceId).eq("business_id", businessId).single();
      if (!resource) return Response.json({ error: "Coiffeur introuvable." }, { status: 404 });
      const start = new Date(body.startTime);
      if (Number.isNaN(start.getTime())) return Response.json({ error: "Date ou heure invalide." }, { status: 400 });
      const end = new Date(start.getTime() + Number(body.durationMinutes) * 60_000);
      if (!Number.isFinite(Number(body.durationMinutes)) || Number(body.durationMinutes) <= 0) return Response.json({ error: "Durée invalide." }, { status: 400 });
      if (!(await isWithinOpeningHours(supabase, resource.business_id, start, Number(body.durationMinutes)))) {
        return Response.json({ error: "Ce blocage est en dehors des heures d'ouverture du salon." }, { status: 400 });
      }
      const { data: conflict } = await supabase
        .from("appointments")
        .select("id")
        .eq("business_id", businessId)
        .eq("resource_id", body.resourceId)
        .eq("status", "confirmed")
        .lt("start_time", end.toISOString())
        .gt("end_time", start.toISOString())
        .limit(1)
        .maybeSingle();
      if (conflict) return Response.json({ error: "Ce créneau est déjà occupé." }, { status: 409 });

      const { error } = await supabase.from("appointments").insert({
        business_id: businessId,
        resource_id: body.resourceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        booked_by: "block",
        block_label: body.label?.trim() || null,
        customer_id: null,
        service_id: null,
      });
      if (error) throw error;
      return Response.json({ ok: true });
    }

    if (body.action === "resource") {
      if (body.resourceId) {
        const { error } = await supabase.from("resources").update({ capacity: Number(body.capacity) }).eq("id", body.resourceId).eq("business_id", businessId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resources").insert({
          business_id: businessId,
          name: body.name?.trim(),
          resource_type: "practitioner",
          capacity: Number(body.capacity) || 1,
          active: true,
        });
        if (error) throw error;
      }
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return Response.json({ error: "Accès refusé à ce salon." }, { status: 403 });
    }
    if (
      error instanceof Error &&
      (error.message === "SALON_NOT_FOUND" || error.message === "NO_BUSINESS")
    ) {
      return Response.json({ error: "Salon introuvable." }, { status: 404 });
    }
    console.error(error);
    return Response.json({ error: "L'opération a échoué." }, { status: 500 });
  }
}