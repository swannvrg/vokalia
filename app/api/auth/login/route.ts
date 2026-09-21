import { authenticate, createSession } from "@/lib/supabase";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const user = await authenticate(String(email ?? ""), String(password ?? ""));
  if (!user) return Response.json({ error: "Identifiants incorrects." }, { status: 401 });
  await createSession(user.id);
  return Response.json({ ok: true, role: user.role });
}