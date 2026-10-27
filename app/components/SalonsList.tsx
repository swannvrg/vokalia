import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export default async function SalonsList() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from("businesses")
    .select("id, name, address")
    .eq("listed", true)
    .order("name");

  if (!data?.length) return null;

  return (
    <section className="vp-section vp-salons" aria-labelledby="salons-titre">
      <div className="vp-wrap">
        <h2 id="salons-titre" className="vp-section-title">
          Salons sur Vokalia
        </h2>
        <ul className="vp-salons-list">
          {data.map((salon) => (
            <li key={salon.id}>
              <Link
                href={`/${salon.id}/profil-public`}
                className="vp-card vp-salon-card"
              >
                <h3>{salon.name || "Salon"}</h3>
                {salon.address && <p>{salon.address}</p>}
                <span className="vp-salon-card-cta">Voir la fiche →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}