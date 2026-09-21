import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";

const serviceFields = "id, business_id, name, duration_minutes, price, active";

function serviceInput(body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const durationMinutes = Number(body.duration_minutes ?? body.durationMinutes);
  const price = body.price === null || body.price === "" || body.price === undefined
    ? null
    : Number(body.price);
  if (
    !name ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    (price !== null && (!Number.isFinite(price) || price < 0))
  ) {
    throw new Error("INVALID_SERVICE");
  }
  return { name, duration_minutes: durationMinutes, price };
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const { data, error } = await supabase
      .from("services")
      .select(serviceFields)
      .eq("business_id", businessId)
      .order("active", { ascending: false })
      .order("name");
    if (error) throw error;
    return Response.json(data ?? []);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED")
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json(
      { error: "Impossible de charger les prestations." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const input = serviceInput(await request.json());
    const { data, error } = await supabase
      .from("services")
      .insert({ business_id: businessId, ...input, active: true })
      .select(serviceFields)
      .single();
    if (error) throw error;
    return Response.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED")
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (error instanceof Error && error.message === "INVALID_SERVICE")
      return Response.json(
        { error: "Indiquez un nom, une durée valide en minutes et un prix valide." },
        { status: 400 },
      );
    console.error(error);
    return Response.json(
      { error: "Impossible d'ajouter la prestation." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const body = await request.json();
    const input = serviceInput(body);
    const changes = {
      ...input,
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
    };
    const { data, error } = await supabase
      .from("services")
      .update(changes)
      .eq("id", body.id)
      .eq("business_id", businessId)
      .select(serviceFields)
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED")
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (error instanceof Error && error.message === "INVALID_SERVICE")
      return Response.json(
        { error: "Indiquez un nom, une durée valide en minutes et un prix valide." },
        { status: 400 },
      );
    console.error(error);
    return Response.json(
      { error: "Impossible de modifier la prestation." },
      { status: 500 },
    );
  }
}