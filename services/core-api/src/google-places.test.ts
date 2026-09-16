import { afterEach, describe, expect, it, vi } from "vitest";
import { googlePlaces, googlePlacesConfiguration } from "./google-places.js";
afterEach(() => vi.unstubAllEnvs());
describe("Google Places Copilot adapter", () => {
 it("limits a deployed key to the two canonical environments", () => {
  const base = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "tablenow-copilot-v2.vercel.app", GOOGLE_PLACES_API_KEY: "test-only" };
  expect(googlePlacesConfiguration({ ...base, VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "product/onboarding-owner", PUBLIC_ORIGIN: "https://preview.tablenow.io" })).toBe("test-only");
  expect(googlePlacesConfiguration({ ...base, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main", PUBLIC_ORIGIN: "https://os.tablenow.io" })).toBe("test-only");
  expect(googlePlacesConfiguration({ ...base, VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "product/stitch-functional-owner", PUBLIC_ORIGIN: "https://copilot.tablenow.io" })).toBeNull();
 });
 it("fails before any network call when unconfigured", async () => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", ""); const fetcher = vi.fn<typeof fetch>();
  await expect(googlePlaces("search", "Paris", "s", "fr", fetcher)).rejects.toThrow("NOT_CONFIGURED");
  expect(fetcher).not.toHaveBeenCalled();
 });
 it("does not mask a Google failure as no results", async () => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-only");
  await expect(googlePlaces("search", "Paris", "s", "fr", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, {status:403})))).rejects.toThrow("UNAVAILABLE");
 });
 it("passes session and locale and excludes non-place suggestions", async () => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-only");
  const f = vi.fn<typeof fetch>().mockResolvedValue(Response.json({suggestions:[{placePrediction:{placeId:"abc",text:{text:"Restaurant Paris"}}},{queryPrediction:{}}]}));
  const result = await googlePlaces("search", "Paris", "session", "fr", f);
  expect(result).toMatchObject({results:[{id:"abc",name:"Restaurant Paris"}]});
  expect(JSON.parse(f.mock.calls[0]![1]!.body as string)).toMatchObject({sessionToken:"session",languageCode:"fr"});
 });
 it("terminates session using query parameter and normalizes actual details", async () => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-only");
  const f = vi.fn<typeof fetch>().mockResolvedValue(Response.json({id:"abc",displayName:{text:"Maison Test"},addressComponents:[{longText:"Paris",types:["locality"]},{longText:"France",types:["country"]}],internationalPhoneNumber:"+33 1 00 00 00 00",regularOpeningHours:{weekdayDescriptions:["Monday: Closed"]},primaryTypeDisplayName:{text:"Restaurant"}}));
  const result = await googlePlaces("details", "abc", "session", "en", f);
  expect(new URL(f.mock.calls[0]![0] as string).searchParams.get("sessionToken")).toBe("session");
  expect(result).toMatchObject({cityCountry:"Paris, France",category:"Restaurant",website:"",openingHours:["Monday: Closed"]});
  expect(JSON.stringify(result)).not.toContain("test-only");
 });
});
