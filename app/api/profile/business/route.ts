import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";

async function getBusiness(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string) {
  const businessId = await getBusinessIdForCurrentUser(supabase, userId);
  const { data, error } = await supabase.from("businesses").select("id, name, real_phone_number, address, timezone").eq("id", businessId).single();
  if (error) throw error;
  return data;
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    return Response.json(await getBusiness(supabase, user.id));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de charger les informations du salon." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const current = await getBusiness(supabase, user.id);
    const body = await request.json();
    const { data, error } = await supabase.from("businesses").update({
      name: String(body.name ?? current.name).trim(),
      real_phone_number: String(body.phoneNumber ?? "").trim() || null,
      address: String(body.address ?? "").trim() || null,
    }).eq("id", current.id).eq("app_user_id", user.id).select("id, name, real_phone_number, address, timezone").single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible d'enregistrer les informations du salon." }, { status: 500 });
  }
}
