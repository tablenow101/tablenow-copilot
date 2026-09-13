// Adapted from tablenow101/tablenowbackend src/routes/prefill.route.ts.
// Copilot owns its routes and credentials; no request goes to the legacy backend.
import { z } from "zod";
const text = z.object({ text: z.string().optional() });
const prediction = z.object({ placePrediction: z.object({ placeId: z.string(), text }).optional() });
export async function googlePlaces(kind: "search" | "details", value: string, session: string, locale: string, request: typeof fetch = fetch) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_NOT_CONFIGURED");
  const headers = { "Content-Type": "application/json", "X-Goog-Api-Key": key,
    "X-Goog-FieldMask": kind === "search" ? "suggestions.placePrediction.placeId,suggestions.placePrediction.text" : "id,displayName,formattedAddress,addressComponents,internationalPhoneNumber,websiteUri,location,regularOpeningHours,primaryTypeDisplayName,googleMapsUri" };
  const url = kind === "search" ? "https://places.googleapis.com/v1/places:autocomplete" : `https://places.googleapis.com/v1/places/${encodeURIComponent(value)}?${new URLSearchParams({ sessionToken: session, languageCode: locale })}`;
  const response = await request(url, { method: kind === "search" ? "POST" : "GET", headers, signal: AbortSignal.timeout(8000),
    ...(kind === "search" ? { body: JSON.stringify({ input: value, sessionToken: session, languageCode: locale }) } : {}) });
  if (!response.ok) throw new Error("GOOGLE_PLACES_UNAVAILABLE");
  const data = await response.json();
  if (kind === "search") return { results: z.object({ suggestions: z.array(prediction).default([]) }).parse(data).suggestions.flatMap(({placePrediction: p}) => p ? [{ id: p.placeId, name: p.text.text || "", address: "", cityCountry: "", sourceUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.text.text || value)}&query_place_id=${encodeURIComponent(p.placeId)}` }] : []) };
  const d = z.object({ id: z.string(), displayName: text, formattedAddress: z.string().optional(), internationalPhoneNumber: z.string().optional(), websiteUri: z.string().optional(), googleMapsUri: z.string().optional(), primaryTypeDisplayName: text.optional(), regularOpeningHours: z.object({ weekdayDescriptions: z.array(z.string()).optional() }).optional(), location: z.object({ latitude: z.number(), longitude: z.number() }).optional(), addressComponents: z.array(z.object({ longText: z.string(), types: z.array(z.string()) })).optional() }).parse(data);
  const component = (type: string) => d.addressComponents?.find(c => c.types.includes(type))?.longText;
  return { id: d.id, name: d.displayName.text || "", address: d.formattedAddress || "", cityCountry: [component("locality") || component("postal_town"), component("country")].filter(Boolean).join(", "), phone: d.internationalPhoneNumber || "", website: d.websiteUri || "", category: d.primaryTypeDisplayName?.text || "", openingHours: d.regularOpeningHours?.weekdayDescriptions || [], location: d.location, sourceUrl: d.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.displayName.text || value)}&query_place_id=${encodeURIComponent(d.id)}` };
}
