import { requireUser } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Calendar from "@/app/calendar";

const parisDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );

export default async function CalendrierPage() {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }
  return <Calendar initialDate={parisDate()} />;
}
