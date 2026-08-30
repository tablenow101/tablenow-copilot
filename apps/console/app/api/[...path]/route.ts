import { buildApp } from "@tablenow/core-api/app";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path?: string[] }> };
let appPromise: ReturnType<typeof buildApp> | undefined;

function getApp(): ReturnType<typeof buildApp> {
  appPromise ||= buildApp();
  return appPromise;
}

async function handler(request: Request, context: RouteContext): Promise<Response> {
  const app = await getApp();
  const { path = [] } = await context.params;
  const incomingUrl = new URL(request.url);
  const url = `/${path.map(encodeURIComponent).join("/")}${incomingUrl.search}`;
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  const method = request.method.toUpperCase() as "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
  const carriesBody = !["GET", "HEAD"].includes(method);
  const payload = carriesBody ? Buffer.from(await request.arrayBuffer()) : undefined;
  const injected = await app.inject({
    method,
    url,
    headers,
    ...(payload && payload.byteLength > 0 ? { payload } : {}),
  });
  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(injected.headers)) {
    if (Array.isArray(value)) value.forEach((entry) => responseHeaders.append(key, String(entry)));
    else if (value !== undefined) responseHeaders.set(key, String(value));
  }
  responseHeaders.set("cache-control", "no-store");
  return new Response(method === "HEAD" ? null : new Uint8Array(injected.rawPayload), {
    status: injected.statusCode,
    headers: responseHeaders,
  });
}

export { handler as DELETE, handler as GET, handler as HEAD, handler as OPTIONS, handler as PATCH, handler as POST, handler as PUT };
