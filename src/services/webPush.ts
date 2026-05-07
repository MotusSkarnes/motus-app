import type { SupabaseClient } from "@supabase/supabase-js";

const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isWebPushConfigurable(): boolean {
  return (
    import.meta.env.PROD &&
    Boolean(vapidPublic && vapidPublic.length > 0) &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type WebPushRegisterResult = { ok: true } | { ok: false; message: string };

export async function registerWebPushWithSupabase(supabase: SupabaseClient): Promise<WebPushRegisterResult> {
  if (!isWebPushConfigurable() || !vapidPublic) {
    return { ok: false, message: "Varsler er ikke tilgjengelig på denne enheten akkurat nå." };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, message: "Varsling ble ikke tillatt i nettleseren." };
  }
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublic),
  });
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) {
    return { ok: false, message: "Ikke innlogget." };
  }
  const { error } = await supabase.functions.invoke("register-push-subscription", {
    body: { subscription: sub.toJSON() },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) {
    return { ok: false, message: error.message || "Kunne ikke lagre push-abonnement." };
  }
  return { ok: true };
}
