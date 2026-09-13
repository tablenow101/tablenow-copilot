import { describe, expect, it, vi } from "vitest";
import { searchBusinesses } from "./business-search.js";

describe("public establishment lookup", () => {
  it("selects the matching establishment, minimizes fields and deduplicates", async () => {
    const site = {
      siret: "12345678900012",
      adresse: "12 rue du Port",
      libelle_commune: "BORDEAUX",
      nom_commercial: "Maison Rivage",
      etat_administratif: "A",
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          results: [
            {
              nom_complet: "Société Rivage",
              matching_etablissements: [site, site],
              dirigeants: [{ private: "must not leave adapter" }],
            },
          ],
        }),
      );
    const results = await searchBusinesses("Rivage Bordeaux", request);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      name: "Maison Rivage",
      cityCountry: "BORDEAUX, France",
    });
    expect(results[0]).not.toHaveProperty("dirigeants");
    const url = request.mock.calls[0]![0] as URL;
    expect(url.origin).toBe("https://recherche-entreprises.api.gouv.fr");
    expect(url.searchParams.get("include")).toBe(
      "siege,matching_etablissements",
    );
  });
  it("excludes closed, partially disclosed and invalid establishments", async () => {
    const site = {
      siret: "12345678900012",
      libelle_commune: "PARIS",
      nom_commercial: "Test",
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({
          results: [
            { siege: { ...site, etat_administratif: "F" } },
            { siege: { ...site, statut_diffusion_etablissement: "P" } },
            { siege: { ...site, siret: "../../bad" } },
          ],
        }),
      );
    expect(await searchBusinesses("Test", request)).toEqual([]);
  });
  it("does not turn provider failure into a fabricated search result", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    await expect(searchBusinesses("Test", request)).rejects.toThrow(
      "BUSINESS_SEARCH_UNAVAILABLE",
    );
  });
});
