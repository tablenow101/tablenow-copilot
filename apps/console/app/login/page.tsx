import { headers } from "next/headers";
import { LoginFlow } from "@/components/LoginFlow";
import { isPublicPilotHostname } from "@/lib/public-pilot-host";

export default async function LoginPage() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const hostname = (forwardedHost || requestHeaders.get("host") || "").split(":", 1)[0] || "";
  return <LoginFlow initialPublicPilot={isPublicPilotHostname(hostname)} />;
}
