import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";

const hexColor = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value) : "#D96D4B";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const { data, error } = await supabase.from("resources").select("id, name, capacity, active, color, resource_type").eq("business_id", businessId).eq("resource_type", "practitioner").order("active", { ascending: false }).order("name");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de charger les Coiffeurs." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const body = await request.json();
    const { data, error } = await supabase.from("resources").insert({ business_id: businessId, name: String(body.name ?? "").trim(), capacity: 1, color: hexColor(body.color), resource_type: "practitioner", active: true }).select("id, name, capacity, active, color, resource_type").single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible d'ajouter le Coiffeur." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const body = await request.json();
    const changes = { name: String(body.name ?? "").trim(), capacity: 1, color: hexColor(body.color), ...(typeof body.active === "boolean" ? { active: body.active } : {}) };
    const { data, error } = await supabase.from("resources").update(changes).eq("id", body.id).eq("business_id", businessId).eq("resource_type", "practitioner").select("id, name, capacity, active, color, resource_type").single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de modifier le Coiffeur." }, { status: 500 });
  }
}
