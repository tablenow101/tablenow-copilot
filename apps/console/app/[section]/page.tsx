import { notFound } from "next/navigation";
import { OwnerShell } from "@/components/OwnerShell";

const sections = ["today", "decisions", "communications", "service", "reservations", "operations", "team", "performance", "locations", "systems", "profile", "copilot"] as const;

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  return <OwnerShell section={section} />;
}
