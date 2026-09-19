import { dayKey } from "./operating";
import { formatRestaurantTime } from "./timezone";
import type { Workspace } from "./types";

type Reservation = Pick<Workspace["reservations"][number], "startsAt" | "partySize" | "status">;
type Task = Pick<Workspace["tasks"][number], "status" | "category">;

export function summarizeToday(reservations: Reservation[], tasks: Task[], timeZone: string, now = new Date()) {
  const today = dayKey(now, timeZone);
  const recorded = reservations.filter(item => dayKey(item.startsAt, timeZone) === today && !["cancelled", "no_show"].includes(item.status));
  const upcoming = recorded.filter(item => ["pending", "confirmed"].includes(item.status) && new Date(item.startsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const byTime = new Map<string, number>();
  for (const item of [...recorded].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const label = formatRestaurantTime(item.startsAt, timeZone);
    byTime.set(label, (byTime.get(label) || 0) + item.partySize);
  }
  const preparation = tasks.filter(item => item.category !== "supplier" && item.status !== "cancelled");
  return {
    covers: recorded.reduce((sum, item) => sum + item.partySize, 0),
    completedCovers: recorded.filter(item => item.status === "completed").reduce((sum, item) => sum + item.partySize, 0),
    reservations: recorded.length,
    nextArrival: upcoming[0]?.startsAt || null,
    arrivals: [...byTime].map(([label, covers]) => ({ label, covers })),
    preparation: preparation.length ? { done: preparation.filter(item => item.status === "done").length, total: preparation.length } : null,
  };
}

export function ownerGreeting(displayName: string | null, timeZone: string, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  const firstName = displayName?.trim().split(/\s+/)[0];
  return `${hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour"}${firstName ? ` ${firstName}` : ""}`;
}
