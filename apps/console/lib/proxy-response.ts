export function bodyForProxyResponse<Payload extends BodyInit>(method: string, status: number, payload: Payload): Payload | null {
  if (method === "HEAD" || status === 204 || status === 205 || status === 304) return null;
  return payload;
}
