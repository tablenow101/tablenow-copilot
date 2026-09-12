import { z } from "zod";

const nullableText = z.string().nullish();
const siteSchema = z.object({
  siret: z.string(),
  adresse: nullableText,
  libelle_commune: nullableText,
  libelle_pays_etranger: nullableText,
  nom_commercial: nullableText,
  liste_enseignes: z.array(z.string()).nullish(),
  etat_administratif: nullableText,
  statut_diffusion_etablissement: nullableText,
});
const responseSchema = z.object({
  results: z.array(
    z.object({
      nom_complet: nullableText,
      statut_diffusion: nullableText,
      siege: siteSchema.nullish(),
      matching_etablissements: z.array(siteSchema).optional(),
    }),
  ),
});

export async function searchBusinesses(
  query: string,
  request: typeof fetch = fetch,
) {
  const url = new URL("https://recherche-entreprises.api.gouv.fr/search");
  url.search = new URLSearchParams({
    q: query,
    per_page: "5",
    minimal: "true",
    include: "siege,matching_etablissements",
  }).toString();
  const response = await request(url, {
    signal: AbortSignal.timeout(6000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error("BUSINESS_SEARCH_UNAVAILABLE");
  const payload = responseSchema.parse(await response.json());
  const seen = new Set<string>();
  return payload.results
    .flatMap((company) => {
      if (company.statut_diffusion === "P") return [];
      const sites = company.matching_etablissements?.length
        ? company.matching_etablissements
        : company.siege
          ? [company.siege]
          : [];
      return sites.flatMap((site) => {
        if (
          !/^\d{14}$/.test(site.siret) ||
          seen.has(site.siret) ||
          site.etat_administratif === "F" ||
          site.statut_diffusion_etablissement === "P"
        )
          return [];
        const name =
          site.nom_commercial ||
          site.liste_enseignes?.[0] ||
          company.nom_complet;
        if (!name || !site.libelle_commune) return [];
        seen.add(site.siret);
        return [
          {
            id: site.siret,
            name: name.slice(0, 120),
            address: (site.adresse || "").slice(0, 300),
            cityCountry:
              `${site.libelle_commune}, ${site.libelle_pays_etranger || "France"}`.slice(
                0,
                160,
              ),
            sourceUrl: `https://annuaire-entreprises.data.gouv.fr/etablissement/${site.siret}`,
          },
        ];
      });
    })
    .slice(0, 8);
}
