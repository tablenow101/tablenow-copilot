import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLegalDocumentKey, LegalDocument, legalDocumentTitle } from "@/components/LegalDocument";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ document: string }> }): Promise<Metadata> {
  const { document } = await params;
  return { title: isLegalDocumentKey(document) ? `${legalDocumentTitle(document)} · TableNow` : "Document introuvable · TableNow" };
}
export default async function LegalPage({ params }: { params: Promise<{ document: string }> }) {
  const { document } = await params;
  if (!isLegalDocumentKey(document)) notFound();
  return <LegalDocument documentKey={document} />;
}
