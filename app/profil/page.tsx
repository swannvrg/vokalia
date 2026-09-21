import { requireUser } from "@/lib/supabase";
import Profile from "@/app/profil/profile";

export default async function ProfilPage() {
  await requireUser();
  return <Profile />;
}
