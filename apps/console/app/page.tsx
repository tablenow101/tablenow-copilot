import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LaunchScreen } from "@/components/LaunchScreen";
import { shouldShowLaunchScreen } from "@/lib/entry-device";

export default async function Home() {
  const userAgent = (await headers()).get("user-agent") || "";
  if (!shouldShowLaunchScreen(userAgent)) redirect("/login");
  return <LaunchScreen />;
}
