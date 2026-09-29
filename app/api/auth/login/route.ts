import {
  authenticate,
  createSession,
  createSupabaseAdminClient,
  getBusinessIdForCurrentUser,
} from "@/lib/supabase";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const user = await authenticate(String(email ?? ""), String(password ?? ""));
  if (!user)
    return Response.json({ error: "Identifiants incorrects." }, { status: 401 });
  await createSession(user.id);

  let businessId: string | null = null;
  if (user.role !== "admin") {
    try {
      businessId = await getBusinessIdForCurrentUser(
        createSupabaseAdminClient(),
        user.id,
      );
    } catch {
      businessId = null;
    }
  }

  return Response.json({ ok: true, role: user.role, businessId });
}