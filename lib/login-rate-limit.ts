import { createSupabaseAdminClient } from "@/lib/supabase";

// Seuils sur les échecs de connexion :
// - même email + même IP : 5 échecs / 15 min (force brute classique) ;
// - même IP, tous emails : 20 échecs / 15 min (essais sur plusieurs comptes) ;
// - même email, toutes IP : 30 échecs / heure (force brute distribuée).
// La clé email + IP évite qu'un inconnu bloque à lui seul le compte de quelqu'un d'autre
// avec quelques essais ; seul le palier « toutes IP », plus haut, peut gêner le vrai titulaire.
const LIMITS = {
  emailAndIp: { max: 5, windowMinutes: 15 },
  ip: { max: 20, windowMinutes: 15 },
  email: { max: 30, windowMinutes: 60 },
};

const since = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export async function isLoginRateLimited(email: string, ip: string) {
  const supabase = createSupabaseAdminClient();
  const count = (filters: { email?: string; ip?: string }, windowMinutes: number) => {
    let query = supabase
      .from("auth_login_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since(windowMinutes));
    if (filters.email) query = query.eq("email", filters.email);
    if (filters.ip) query = query.eq("request_ip", filters.ip);
    return query;
  };
  const [pair, byIp, byEmail] = await Promise.all([
    count({ email, ip }, LIMITS.emailAndIp.windowMinutes),
    count({ ip }, LIMITS.ip.windowMinutes),
    count({ email }, LIMITS.email.windowMinutes),
  ]);
  const error = pair.error || byIp.error || byEmail.error;
  if (error) throw error;
  return (
    (pair.count ?? 0) >= LIMITS.emailAndIp.max ||
    (byIp.count ?? 0) >= LIMITS.ip.max ||
    (byEmail.count ?? 0) >= LIMITS.email.max
  );
}

const RETENTION_HOURS = 24;

export async function recordFailedLogin(email: string, ip: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("auth_login_attempts")
    .insert({ email, request_ip: ip });
  if (error) throw error;

  // Purge des échecs de plus de 24 h : au-delà de la plus longue fenêtre (1 h), ils ne servent plus.
  // Un échec de purge ne doit pas faire échouer le login.
  const { error: purgeError } = await supabase
    .from("auth_login_attempts")
    .delete()
    .lt("created_at", new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString());
  if (purgeError) console.error("[auth/login] Purge des anciens échecs impossible :", purgeError.message);
}
