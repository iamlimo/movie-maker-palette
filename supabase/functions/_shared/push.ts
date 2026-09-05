/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared Firebase Cloud Messaging (HTTP v1) sender for edge functions.
// Uses Deno's WebCrypto to sign the service-account JWT — no firebase-admin.

function base64url(data: Uint8Array): string {
  let str = "";
  for (const b of data) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToBase64url(text: string): string {
  return base64url(new TextEncoder().encode(text));
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\\n/g, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(contents), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = textToBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = textToBase64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OAuth2 token error: ${JSON.stringify(data)}`);

  cachedToken = { token: data.access_token, expiresAt: Date.now() + 3500 * 1000 };
  return cachedToken.token;
}

export interface PushSendOptions {
  /** Restrict to a single user; omit to broadcast to every active device. */
  userId?: string | null;
  title: string;
  body: string;
  /** Arbitrary string-able payload merged into FCM `data`. */
  data?: Record<string, unknown>;
  /** Data-only message (no visible alert). */
  silent?: boolean;
  /** Row in push_notifications is written when true (default true). */
  log?: boolean;
  createdBy?: string | null;
}

export interface PushSendResult {
  sentCount: number;
  totalTokens: number;
  notificationId: string | null;
  skippedReason?: string;
}

/**
 * Sends a push to one user (or everyone) using the FIREBASE_SERVICE_ACCOUNT secret.
 * Never throws for delivery problems — payment flows must not fail because a
 * notification could not be delivered.
 */
export async function sendPush(
  supabase: any,
  options: PushSendOptions,
): Promise<PushSendResult> {
  const target = options.userId ? "user" : "all";
  const empty: PushSendResult = { sentCount: 0, totalTokens: 0, notificationId: null };

  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!serviceAccountJson) {
    console.warn("[push] FIREBASE_SERVICE_ACCOUNT is not configured — skipping send");
    return { ...empty, skippedReason: "missing_service_account" };
  }

  let tokenQuery = supabase
    .from("push_device_tokens")
    .select("token")
    .eq("is_active", true);
  if (options.userId) tokenQuery = tokenQuery.eq("user_id", options.userId);

  const { data: tokenRows, error: tokenError } = await tokenQuery;
  if (tokenError) {
    console.error("[push] failed to load device tokens:", tokenError.message);
    return { ...empty, skippedReason: "token_query_failed" };
  }

  const tokens: string[] = Array.from(
    new Set(
      (tokenRows ?? [])
        .map((r: { token?: unknown }) => (typeof r.token === "string" ? r.token : ""))
        .filter(Boolean),
    ),
  );

  const stringData = Object.fromEntries(
    Object.entries({
      ...(options.data ?? {}),
      title: options.title,
      body: options.body,
      silent: options.silent ? "true" : "false",
    })
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
  );

  let sentCount = 0;
  const invalidTokens: string[] = [];

  if (tokens.length > 0) {
    try {
      const sa = JSON.parse(serviceAccountJson) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      };
      if (!sa.client_email || !sa.private_key || !sa.project_id) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is missing client_email/private_key/project_id");
      }

      const accessToken = await getAccessToken(sa.client_email, sa.private_key);
      const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

      const batchSize = 50;
      for (let i = 0; i < tokens.length; i += batchSize) {
        const batch = tokens.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (token) => {
            const message: Record<string, unknown> = {
              message: {
                token,
                data: stringData,
                android: { priority: "high" },
                ...(options.silent
                  ? { apns: { payload: { aps: { "content-available": 1 } } } }
                  : {
                      notification: { title: options.title, body: options.body },
                      apns: { payload: { aps: { sound: "default", badge: 1 } } },
                    }),
              },
            };

            const res = await fetch(fcmUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(message),
            });
            const result = await res.json().catch(() => ({}));

            if (!res.ok) {
              const code = result?.error?.details?.[0]?.errorCode || result?.error?.status || "";
              if (code === "UNREGISTERED" || code === "INVALID_ARGUMENT") invalidTokens.push(token);
              throw new Error(`FCM ${res.status}: ${code || JSON.stringify(result).slice(0, 200)}`);
            }
            return result;
          }),
        );

        sentCount += results.filter((r) => r.status === "fulfilled").length;
        results
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .slice(0, 3)
          .forEach((r) => console.error("[push] send failed:", r.reason?.message ?? r.reason));
      }

      if (invalidTokens.length > 0) {
        await supabase
          .from("push_device_tokens")
          .update({ is_active: false })
          .in("token", Array.from(new Set(invalidTokens)));
      }
    } catch (error) {
      console.error("[push] FCM dispatch error:", error instanceof Error ? error.message : error);
    }
  }

  let notificationId: string | null = null;
  if (options.log !== false) {
    const { data: inserted, error: logError } = await supabase
      .from("push_notifications")
      .insert({
        title: options.title,
        body: options.body,
        data: options.data ?? {},
        target,
        target_user_id: options.userId ?? null,
        sent_count: sentCount,
        created_by: options.createdBy ?? null,
      })
      .select("id")
      .maybeSingle();

    if (logError) console.error("[push] failed to log notification:", logError.message);
    notificationId = inserted?.id ?? null;
  }

  return { sentCount, totalTokens: tokens.length, notificationId };
}

/** Human label + deep link for a rented piece of content. */
async function describeContent(
  supabase: any,
  contentId: string,
  contentType: string,
): Promise<{ label: string; targetScreen: string; entityId: string }> {
  const type = String(contentType || "").toLowerCase();

  try {
    if (type === "movie") {
      const { data } = await supabase
        .from("movies")
        .select("title")
        .eq("id", contentId)
        .maybeSingle();
      return {
        label: data?.title ? `"${data.title}"` : "Your movie",
        targetScreen: "movie",
        entityId: contentId,
      };
    }

    if (type === "season") {
      const { data } = await supabase
        .from("seasons")
        .select("season_number, tv_show_id, tv_shows(title)")
        .eq("id", contentId)
        .maybeSingle();
      const show = (data as any)?.tv_shows?.title;
      const label = show
        ? `${show} — Season ${data?.season_number ?? ""}`.trim()
        : `Season ${data?.season_number ?? ""}`.trim();
      return {
        label,
        targetScreen: "tvshow",
        entityId: (data as any)?.tv_show_id || contentId,
      };
    }

    if (type === "episode") {
      const { data } = await supabase
        .from("episodes")
        .select("title, episode_number, seasons(season_number, tv_show_id, tv_shows(title))")
        .eq("id", contentId)
        .maybeSingle();
      const season = (data as any)?.seasons;
      const show = season?.tv_shows?.title;
      const parts = [
        show,
        season?.season_number ? `S${season.season_number}` : null,
        data?.episode_number ? `E${data.episode_number}` : null,
        data?.title,
      ].filter(Boolean);
      return {
        label: parts.length ? parts.join(" ") : "Your episode",
        targetScreen: "tvshow",
        entityId: season?.tv_show_id || contentId,
      };
    }
  } catch (error) {
    console.error("[push] content lookup failed:", error instanceof Error ? error.message : error);
  }

  return { label: "Your rental", targetScreen: "home", entityId: "home" };
}

/**
 * Fires the "rental unlocked" push exactly once per rental intent.
 * The guard lives in rental_intents.metadata.unlock_push_sent_at, so a webhook
 * and a verification retry can both call this safely.
 */
export async function sendRentalUnlockedPush(
  supabase: any,
  params: {
    userId: string;
    rentalIntentId: string;
    contentId: string;
    contentType: string;
    expiresAt?: string | null;
    rentalAccessId?: string | null;
  },
): Promise<void> {
  try {
    const { data: intent, error: intentError } = await supabase
      .from("rental_intents")
      .select("id, metadata")
      .eq("id", params.rentalIntentId)
      .maybeSingle();

    if (intentError) {
      console.error("[push] unlock guard lookup failed:", intentError.message);
      return;
    }

    const metadata = (intent?.metadata ?? {}) as Record<string, unknown>;
    if (metadata.unlock_push_sent_at) return;

    // Claim the guard before sending so concurrent callers bail out.
    const { data: claimed, error: claimError } = await supabase
      .from("rental_intents")
      .update({
        metadata: { ...metadata, unlock_push_sent_at: new Date().toISOString() },
      })
      .eq("id", params.rentalIntentId)
      .is("metadata->>unlock_push_sent_at", null)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("[push] unlock guard claim failed:", claimError.message);
      return;
    }
    if (!claimed) return; // another invocation already claimed it

    const { label, targetScreen, entityId } = await describeContent(
      supabase,
      params.contentId,
      params.contentType,
    );

    const typeWord = String(params.contentType || "").toLowerCase();
    const noun = typeWord === "season" ? "Season" : typeWord === "episode" ? "Episode" : "Movie";

    await sendPush(supabase, {
      userId: params.userId,
      title: `${noun} unlocked 🎬`,
      body: `${label} is ready to watch. Enjoy!`,
      data: {
        origin: "rental-unlocked",
        target_screen: targetScreen,
        entity_id: entityId,
        content_id: params.contentId,
        content_type: typeWord,
        rental_intent_id: params.rentalIntentId,
        rental_access_id: params.rentalAccessId ?? "",
        expires_at: params.expiresAt ?? "",
      },
    });
  } catch (error) {
    console.error("[push] rental unlock push failed:", error instanceof Error ? error.message : error);
  }
}
