import { OnboardingFlow } from "@/components/OnboardingFlow";
import type { SectionKey } from "@/lib/onboarding";

const editableSections = new Set<SectionKey>(["establishment", "priorities", "interaction", "reservations", "operations", "authority", "final_note", "review"]);

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ restaurantId?: string; section?: string }> }) {
  const query = await searchParams;
  const initialSection = query.section && editableSections.has(query.section as SectionKey) ? query.section as SectionKey : undefined;
  return <OnboardingFlow {...(query.restaurantId ? { initialRestaurantId: query.restaurantId } : {})} {...(initialSection ? { initialSection } : {})} />;
}
