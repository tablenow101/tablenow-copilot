import type { ComputerWorkflowDefinition } from "@tablenow/contracts";
import type { JSONValue } from "postgres";
import type { Transaction } from "@tablenow/provider-adapters";

export async function ensureComputerUseDemo(
  transaction: Transaction,
  tenantId: string,
  restaurantId: string,
  simulatorUrl: string,
  createdBy: string,
): Promise<void> {
  const baseUrl = simulatorUrl.replace(/\/$/, "");
  const reservationCapabilities = ["reservation.read", "reservation.create", "reservation.update", "reservation.cancel"];
  const [nativeSystem] = await transaction<{ id: string }[]>`
    insert into restaurant_systems (tenant_id, restaurant_id, category, provider, display_name, access_method,
      status, capabilities, is_source_of_truth, priority)
    values (${tenantId}, ${restaurantId}, 'reservations', 'tablenow', 'TableNow natif', 'native', 'ready',
      ${transaction.json(reservationCapabilities)}, false, 10)
    on conflict (tenant_id, restaurant_id, category, provider, display_name) do update set status = 'ready',
      capabilities = excluded.capabilities
    returning id
  `;
  const [manualSystem] = await transaction<{ id: string }[]>`
    insert into restaurant_systems (tenant_id, restaurant_id, category, provider, display_name, access_method,
      status, capabilities, is_source_of_truth, priority)
    values (${tenantId}, ${restaurantId}, 'manual', 'paper', 'Registre papier ou saisie humaine', 'manual', 'ready',
      ${transaction.json(reservationCapabilities)}, false, 90)
    on conflict (tenant_id, restaurant_id, category, provider, display_name) do update set status = 'ready',
      capabilities = excluded.capabilities
    returning id
  `;
  const [simulatorSystem] = await transaction<{ id: string }[]>`
    insert into restaurant_systems (tenant_id, restaurant_id, category, provider, display_name, access_method,
      status, capabilities, is_source_of_truth, priority, configuration)
    values (${tenantId}, ${restaurantId}, 'reservations', 'tablenow-simulator', 'Logiciel de réservation · validation',
      'browser', 'setup', ${transaction.json(reservationCapabilities)}, true, 20,
      ${transaction.json({ baseUrl } as JSONValue)})
    on conflict (tenant_id, restaurant_id, category, provider, display_name) do update set configuration = excluded.configuration,
      capabilities = excluded.capabilities
    returning id
  `;
  if (!nativeSystem || !manualSystem || !simulatorSystem) throw new Error("Failed to seed restaurant systems");
  const [connection] = await transaction<{ id: string }[]>`
    insert into computer_connections (tenant_id, restaurant_id, system_id, provider, display_name, surface, base_url,
      allowed_hosts, mode, status, capabilities, credential_ref, created_by)
    values (${tenantId}, ${restaurantId}, ${simulatorSystem.id}, 'tablenow-simulator', 'Interface universelle · validation', 'browser',
      ${baseUrl}, ${[new URL(baseUrl).hostname]}, 'assist', 'setup',
      '["connection.health","reservation.read","reservation.create","reservation.cancel"]'::jsonb,
      'browser-simulator', ${createdBy})
    on conflict (tenant_id, restaurant_id, display_name) do update set base_url = excluded.base_url,
      allowed_hosts = excluded.allowed_hosts, capabilities = excluded.capabilities
    returning id
  `;
  if (!connection) throw new Error("Failed to seed computer use connection");

  for (const capability of reservationCapabilities) {
    const executionMode = capability === "reservation.read" ? "automatic" : "approval";
    await transaction`
      insert into action_routes (tenant_id, restaurant_id, capability, primary_system_id, fallback_system_id,
        execution_mode, maximum_risk)
      values (${tenantId}, ${restaurantId}, ${capability}, ${simulatorSystem.id}, ${nativeSystem.id},
        ${executionMode}, ${capability === "reservation.cancel" ? "high" : "medium"})
      on conflict (tenant_id, restaurant_id, capability) do update set primary_system_id = excluded.primary_system_id,
        fallback_system_id = excluded.fallback_system_id, execution_mode = excluded.execution_mode, updated_at = now()
    `;
  }

  const workflows: Array<{
    key: string;
    name: string;
    description: string;
    risk: "low" | "medium" | "high";
    approvalRequired: boolean;
    definition: ComputerWorkflowDefinition;
  }> = [
    {
      key: "connection.health_check",
      name: "Vérifier la connexion",
      description: "Ouvre l’interface, vérifie qu’elle répond et conserve une preuve locale.",
      risk: "low",
      approvalRequired: false,
      definition: {
        engine: "playwright",
        startUrl: `${baseUrl}/reservations`,
        steps: [
          { id: "open", action: "goto", url: `${baseUrl}/reservations` },
          { id: "verify-heading", action: "verify", locator: { kind: "role", role: "heading", name: "Réservations" } },
          { id: "proof", action: "screenshot", label: "Connexion vérifiée" },
        ],
        expectedOutcome: "La liste des réservations est visible.",
        maxSteps: 8,
        readOnly: true,
      },
    },
    {
      key: "reservation.read",
      name: "Lire les réservations",
      description: "Contrôle la liste visible sans modifier le logiciel externe.",
      risk: "low",
      approvalRequired: false,
      definition: {
        engine: "playwright",
        startUrl: `${baseUrl}/reservations`,
        steps: [
          { id: "open", action: "goto", url: `${baseUrl}/reservations` },
          { id: "verify-list", action: "verify", locator: { kind: "testId", value: "reservation-list" } },
          { id: "proof", action: "screenshot", label: "Réservations lues" },
        ],
        expectedOutcome: "La liste des réservations est accessible et inchangée.",
        maxSteps: 8,
        readOnly: true,
      },
    },
    {
      key: "reservation.create",
      name: "Créer une réservation",
      description: "Saisit une nouvelle réservation puis vérifie sa présence dans la liste.",
      risk: "medium",
      approvalRequired: true,
      definition: {
        engine: "playwright",
        startUrl: `${baseUrl}/reservations`,
        steps: [
          { id: "open", action: "goto", url: `${baseUrl}/reservations` },
          { id: "new", action: "click", locator: { kind: "role", role: "button", name: "Nouvelle réservation" } },
          { id: "guest", action: "fill", locator: { kind: "label", value: "Nom du client" }, value: "{{guestName}}", sensitive: false },
          { id: "phone", action: "fill", locator: { kind: "label", value: "Téléphone" }, value: "{{guestPhone}}", sensitive: true },
          { id: "party", action: "fill", locator: { kind: "label", value: "Couverts" }, value: "{{partySize}}", sensitive: false },
          { id: "time", action: "fill", locator: { kind: "label", value: "Heure" }, value: "{{time}}", sensitive: false },
          { id: "save", action: "click", locator: { kind: "role", role: "button", name: "Enregistrer la réservation" } },
          { id: "verify", action: "verify", locator: { kind: "text", value: "{{guestName}}", exact: true } },
          { id: "proof", action: "screenshot", label: "Réservation créée et vérifiée" },
        ],
        expectedOutcome: "La réservation apparaît une seule fois dans la liste.",
        maxSteps: 20,
        readOnly: false,
      },
    },
    {
      key: "reservation.cancel",
      name: "Annuler une réservation",
      description: "Prépare l’annulation d’une réservation précise avec validation de la direction.",
      risk: "high",
      approvalRequired: true,
      definition: {
        engine: "openai-computer",
        startUrl: `${baseUrl}/reservations`,
        steps: [],
        expectedOutcome: "La réservation ciblée est marquée annulée et le changement est vérifié.",
        maxSteps: 24,
        readOnly: false,
      },
    },
  ];

  for (const workflow of workflows) {
    await transaction`
      insert into computer_workflows (tenant_id, connection_id, workflow_key, version, name, description,
        risk, approval_required, status, definition, created_by)
      values (${tenantId}, ${connection.id}, ${workflow.key}, 1, ${workflow.name}, ${workflow.description},
        ${workflow.risk}, ${workflow.approvalRequired}, 'active',
        ${transaction.json(workflow.definition as unknown as JSONValue)}, ${createdBy})
      on conflict (connection_id, workflow_key, version) do update set name = excluded.name,
        description = excluded.description, risk = excluded.risk, approval_required = excluded.approval_required,
        status = excluded.status, definition = excluded.definition
    `;
  }
}
