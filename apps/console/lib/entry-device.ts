export function shouldShowLaunchScreen(userAgent: string): boolean {
  const value = userAgent.toLowerCase();
  return /iphone|ipod|ipad|android/.test(value) || (value.includes("macintosh") && value.includes("mobile"));
}
