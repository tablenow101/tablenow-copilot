"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./Brand";

export function LaunchScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace("/login"), 1100);
    return () => window.clearTimeout(timer);
  }, [router]);

  return <main className="tn-launch" aria-label="Ouverture de TableNow OS"><Brand className="tn-launch-brand" /></main>;
}
