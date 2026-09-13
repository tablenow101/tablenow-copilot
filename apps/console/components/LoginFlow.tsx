"use client";
import { AccountFlow } from "./account/AccountFlow";
export function LoginFlow({ initialPublicPilot: _unused }: { initialPublicPilot?: boolean }) {
  return <AccountFlow mode="login" />;
}
