const STORAGE_KEY = "chapee_notification_sounds_enabled";

/** Default: sound on. Stored in localStorage for per-browser preference. */
export function getNotificationSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return true;
  return raw === "true";
}

export function setNotificationSoundsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}
