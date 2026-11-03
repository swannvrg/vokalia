import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const businessId = await resolveAuthorizedBusinessId(supabase, user, String(body.businessId ?? ""));
    const [{ data: business, error: businessError }, { data: hours, error: hoursError }, { count: resourceCount, error: resourcesError }, { count: serviceCount, error: servicesError }] = await Promise.all([
      supabase.from("businesses").select("name, address, real_phone_number").eq("id", businessId).single(),
      supabase.from("business_hours").select("id, open_time, close_time").eq("business_id", businessId),
      supabase.from("resources").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("resource_type", "practitioner").eq("active", true),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("active", true),
    ]);
    if (businessError || hoursError || resourcesError || servicesError) throw businessError || hoursError || resourcesError || servicesError;
    const missing: string[] = [];
    if (!business?.name?.trim() || !business.address?.trim() || !business.real_phone_number?.trim()) missing.push("les informations du salon");
    if (!(hours ?? []).some((hour) => hour.open_time && hour.close_time)) missing.push("au moins un jour ouvert");
    if (!resourceCount) missing.push("au moins un coiffeur");
    if (!serviceCount) missing.push("au moins une prestation");
    if (missing.length) return Response.json({ error: `Complétez ${missing.join(", ")}.` }, { status: 400 });
    const { error } = await supabase.from("app_users").update({ onboarding_pending: false, updated_at: new Date().toISOString() }).eq("id", user.id).eq("business_id", businessId);
    if (error) throw error;
    return Response.json({ ok: true, businessId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ error: "Accès refusé à ce salon." }, { status: 403 });
    if (error instanceof Error && (error.message === "SALON_NOT_FOUND" || error.message === "NO_BUSINESS")) return Response.json({ error: "Salon introuvable." }, { status: 404 });
    console.error("[onboarding/complete] Échec :", error instanceof Error ? error.message : "erreur inconnue");
    return Response.json({ error: "Impossible de terminer la configuration." }, { status: 500 });
  }
}
