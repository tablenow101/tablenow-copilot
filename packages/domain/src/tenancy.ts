export function assertTenantMatch(expectedTenantId: string, resourceTenantId: string): void {
  if (!expectedTenantId || expectedTenantId !== resourceTenantId) {
    throw new Error("TENANT_BOUNDARY_VIOLATION");
  }
}

export function tenantSlug(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
  return slug || "restaurant";
}
