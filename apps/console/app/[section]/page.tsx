import { notFound } from "next/navigation";
import { ProductShell } from "@/components/ProductShell";

const sections = ["today", "communications", "reservations", "operations", "team", "inventory", "performance", "locations", "systems", "copilot"] as const;

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  return <ProductShell section={section as (typeof sections)[number]} />;
}
