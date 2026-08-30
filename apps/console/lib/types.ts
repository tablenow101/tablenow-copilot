export type Role = "platform_admin" | "owner" | "group_admin" | "manager" | "operator" | "viewer";

export interface Session {
  user: { id: string; email: string; displayName: string | null };
  tenant: { id: string; name: string; slug: string; onboardingComplete: boolean };
  membership: { role: Role };
  csrfToken: string | null;
}

export interface Workspace {
  summary: {
    occupancyPercent: number;
    openDecisions: number;
    availableTables: number;
    inventoryAlerts: number;
    revenueCapturedToday: number;
    timeSavedMinutes: number;
    coversToday: number;
  };
  restaurantSummaries: Array<{
    restaurantId: string;
    occupancyPercent: number;
    openDecisions: number;
    availableTables: number;
    inventoryAlerts: number;
    revenueCapturedToday: number;
    timeSavedMinutes: number;
    coversToday: number;
  }>;
  restaurants: Array<{ id: string; name: string; slug: string; address: string | null; phone: string | null; timezone: string; capacity: number; isDemo: boolean }>;
  reservations: Array<{ id: string; restaurantId: string; guestName: string; guestEmail: string | null; guestPhone: string | null; startsAt: string; partySize: number; status: string; source: string; notes: string | null }>;
  communications: Array<{ id: string; restaurantId: string; channel: string; direction: string; contactName: string | null; subject: string | null; summary: string; status: string; occurredAt: string }>;
  decisions: Array<{ id: string; restaurantId: string; kind: string; title: string; description: string; priority: string; status: string; suggestedAction: string | null; dueAt: string | null; resolutionNote: string | null; createdAt: string }>;
  tasks: Array<{ id: string; restaurantId: string; title: string; category: string; status: string; assigneeName: string | null; dueAt: string | null }>;
  shifts: Array<{ id: string; restaurantId: string; teamMemberName: string; roleTitle: string; startsAt: string; endsAt: string; status: string }>;
  inventory: Array<{ id: string; restaurantId: string; name: string; unit: string; quantity: number; reorderThreshold: number; status: string; updatedAt: string }>;
  metrics: Array<{ restaurantId: string; date: string; revenueCaptured: number; covers: number; callsHandled: number; conversionRate: number; timeSavedMinutes: number }>;
  actions: Array<{ id: string; restaurantId: string | null; conversationId: string; tool: string; title: string; rationale: string; risk: string; approvalRequired: boolean; status: string; createdAt: string }>;
}

export interface ComputerUseOverview {
  systems: Array<{ id: string; restaurantId: string; category: string; provider: string; displayName: string; accessMethod: string; status: string; capabilities: string[]; isSourceOfTruth: boolean; priority: number; updatedAt: string }>;
  routes: Array<{ id: string; restaurantId: string; capability: string; primarySystemId: string; primarySystemName: string; primaryAccessMethod: string; fallbackSystemId: string | null; fallbackSystemName: string | null; fallbackAccessMethod: string | null; executionMode: string; maximumRisk: string; active: boolean }>;
  connections: Array<{ id: string; restaurantId: string; provider: string; displayName: string; surface: string; baseUrl: string; allowedHosts: string[]; mode: string; status: string; capabilities: string[]; healthMessage: string | null; lastVerifiedAt: string | null; updatedAt: string }>;
  workflows: Array<{ id: string; connectionId: string; key: string; version: number; name: string; description: string; risk: string; approvalRequired: boolean; status: string; successCount: number; failureCount: number; lastSucceededAt: string | null; lastFailedAt: string | null }>;
  runs: Array<{ id: string; connectionId: string; workflowId: string; objective: string; risk: string; approvalRequired: boolean; status: string; summary: string | null; errorCode: string | null; attempts: number; maxAttempts: number; cancellationRequested: boolean; startedAt: string | null; completedAt: string | null; createdAt: string; workflowName: string; connectionName: string; requestedBy: string | null }>;
  events: Array<{ id: string; runId: string; sequence: number; kind: string; status: string; message: string; metadata: Record<string, unknown>; hasEvidence: boolean; occurredAt: string }>;
  nodes: Array<{ id: string; name: string; status: string; version: string | null; platform: string | null; capabilities: string[]; browserVersion: string | null; healthStatus: string; lastHeartbeatAt: string | null; lastSeenAt: string | null }>;
  generatedAt: string;
}
