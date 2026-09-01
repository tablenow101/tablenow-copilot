"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { Session } from "@/lib/types";
import { publicPilotSession } from "@/lib/public-pilot";
import { isPublicPilotRuntime } from "@/lib/public-pilot-host";

export function useSession(options: { requireOnboarding?: boolean } = {}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (isPublicPilotRuntime()) {
      setSession(publicPilotSession);
      if (options.requireOnboarding === true) router.replace("/today");
      setLoading(false);
      return publicPilotSession;
    }
    try {
      const next = await api<Session>("/v1/auth/session");
      setSession(next);
      if (options.requireOnboarding === true && next.tenant.onboardingComplete) router.replace("/today");
      if (options.requireOnboarding !== true && !next.tenant.onboardingComplete) router.replace("/onboarding");
      return next;
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) router.replace("/login");
      else setError(caught instanceof Error ? caught.message : "Impossible de vérifier la session.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [options.requireOnboarding, router]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { session, loading, error, refresh };
}
