import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function CalendrierPage() {
  let user;
  let supabase;
  try {
    ({ supabase, user } = await requireUser());
  } catch {
    redirect("/login");
  }

  if (user.role === "admin") {
    redirect("/admin");
  }

  try {
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    redirect(`/${businessId}/calendrier`);
  } catch {
    redirect("/login");
  }
}
