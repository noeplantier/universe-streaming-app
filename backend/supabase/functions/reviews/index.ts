import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Connection: "keep-alive",
    },
  });
}

function getQuery(req: Request) {
  return new URL(req.url).searchParams;
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(b64 + pad);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Compat custom token:
 * - priorité: claim "memberId"
 * - fallback: auth.getUser(token).user.id
 * - fallback: claim "sub"
 */
async function resolveActorId(
  token: string,
  adminClient: ReturnType<typeof createClient>
): Promise<string | null> {
  const payload = decodeJwtPayload(token);

  const memberId = typeof payload?.memberId === "string" ? payload.memberId : null;
  if (memberId && isUuid(memberId)) return memberId;

  const { data: authData, error: authErr } = await adminClient.auth.getUser(token);
  if (!authErr && authData?.user?.id && isUuid(authData.user.id)) {
    return authData.user.id;
  }

  const sub = typeof payload?.sub === "string" ? payload.sub : null;
  if (sub && isUuid(sub)) return sub;

  return null;
}

function mergeCritiquesWithProfiles<T extends { user_id: string }>(
  critiques: T[],
  profiles: Profile[]
) {
  const byId = new Map<string, Profile>();
  for (const p of profiles) byId.set(p.id, p);

  return critiques.map((c) => ({
    ...c,
    profile: byId.get(c.user_id) ?? null,
  }));
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publishableKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
      return jsonResponse({ detail: "Missing Supabase env vars" }, 500);
    }

    // Admin client (bypass RLS) -> uniquement pour vérification token / opérations techniques
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // User-context client (applique RLS)
    const token = getBearerToken(req);
    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });

    const method = req.method.toUpperCase();
    const url = new URL(req.url);

    const parts = url.pathname.split("/").filter(Boolean);
    const fnName = "reviews";
    const fnIndex = parts.indexOf(fnName);
    const tail = fnIndex >= 0 ? parts.slice(fnIndex + 1) : [];

    // -----------------------------
    // POST /reviews/:id/like
    // -----------------------------
    if (method === "POST" && tail.length === 2 && tail[1] === "like") {
      const reviewId = tail[0];

      if (!reviewId) return jsonResponse({ detail: "Missing review id" }, 400);
      if (!isUuid(reviewId)) {
        return jsonResponse({ detail: "Invalid review id (uuid expected)" }, 400);
      }
      if (!token) return jsonResponse({ detail: "Unauthorized (missing token)" }, 401);

      const actorId = await resolveActorId(token, admin);
      if (!actorId) return jsonResponse({ detail: "Unauthorized (invalid token)" }, 401);

      // Evite double like (PK: critique_id + user_id)
      const { error: likeErr } = await admin
        .from("critique_likes")
        .insert({ critique_id: reviewId, user_id: actorId })
        .select("critique_id")
        .maybeSingle();

      // duplicate key -> déjà liké
      if (likeErr && !String(likeErr.message).toLowerCase().includes("duplicate key")) {
        return jsonResponse({ detail: likeErr.message }, 500);
      }

      // Recompter et synchroniser likes_count
      const { count, error: countErr } = await admin
        .from("critique_likes")
        .select("*", { head: true, count: "exact" })
        .eq("critique_id", reviewId);

      if (countErr) return jsonResponse({ detail: countErr.message }, 500);

      const newCount = count ?? 0;

      const { data: updated, error: updErr } = await admin
        .from("critiques")
        .update({ likes_count: newCount })
        .eq("id", reviewId)
        .select("*")
        .maybeSingle();

      if (updErr) return jsonResponse({ detail: updErr.message }, 500);
      if (!updated) return jsonResponse({ detail: "Review not found" }, 404);

      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .eq("id", updated.user_id)
        .maybeSingle();

      if (profileErr) return jsonResponse({ detail: profileErr.message }, 500);

      return jsonResponse({ ...updated, profile }, 200);
    }

    // -----------------------------
    // DELETE /reviews/:id
    // (applique RLS via userClient)
    // -----------------------------
    if (method === "DELETE" && tail.length === 1) {
      const reviewId = tail[0];

      if (!reviewId) return jsonResponse({ detail: "Missing review id" }, 400);
      if (!isUuid(reviewId)) {
        return jsonResponse({ detail: "Invalid review id (uuid expected)" }, 400);
      }
      if (!token) return jsonResponse({ detail: "Unauthorized (missing token)" }, 401);

      const { error: delErr } = await userClient.from("critiques").delete().eq("id", reviewId);
      if (delErr) {
        // RLS reject -> souvent 401/403 côté PostgREST
        return jsonResponse({ detail: delErr.message }, 403);
      }

      return jsonResponse({ success: true, id: reviewId }, 200);
    }

    // -----------------------------
    // GET /reviews/:id
    // -----------------------------
    if (method === "GET" && tail.length === 1) {
      const reviewId = tail[0];

      if (!reviewId) return jsonResponse({ detail: "Missing review id" }, 400);
      if (!isUuid(reviewId)) {
        return jsonResponse({ detail: "Invalid review id (uuid expected)" }, 400);
      }

      const { data: critique, error: critiqueErr } = await userClient
        .from("critiques")
        .select("*")
        .eq("id", reviewId)
        .maybeSingle();

      if (critiqueErr) return jsonResponse({ detail: critiqueErr.message }, 500);
      if (!critique) return jsonResponse({ detail: "Review not found" }, 404);

      const { data: profile, error: profileErr } = await userClient
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .eq("id", critique.user_id)
        .maybeSingle();

      if (profileErr) return jsonResponse({ detail: profileErr.message }, 500);

      return jsonResponse({ ...critique, profile }, 200);
    }

    // -----------------------------
    // GET /reviews?film_id=...&user_id=...
    // -----------------------------
    if (method === "GET" && tail.length === 0) {
      const q = getQuery(req);
      const filmId = q.get("film_id");
      const userId = q.get("user_id");

      if (filmId && !isUuid(filmId)) {
        return jsonResponse({ detail: "Invalid film_id (uuid attendu)" }, 400);
      }
      if (userId && !isUuid(userId)) {
        return jsonResponse({ detail: "Invalid user_id (uuid attendu)" }, 400);
      }

      let critiques: any[] = [];

      if (filmId) {
        const { data: film, error: filmErr } = await userClient
          .from("films")
          .select("id, title")
          .eq("id", filmId)
          .maybeSingle();

        if (filmErr) return jsonResponse({ detail: filmErr.message }, 500);
        if (!film?.title) return jsonResponse([], 200);

        const { data, error } = await userClient
          .from("critiques")
          .select("*")
          .eq("film_title", film.title)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ detail: error.message }, 500);
        critiques = data ?? [];
      } else if (userId) {
        const { data, error } = await userClient
          .from("critiques")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ detail: error.message }, 500);
        critiques = data ?? [];
      } else {
        return jsonResponse({ detail: "Provide film_id or user_id" }, 400);
      }

      const userIds = [...new Set(critiques.map((c) => c.user_id).filter(Boolean))];
      if (userIds.length === 0) return jsonResponse(critiques, 200);

      const { data: profiles, error: profErr } = await userClient
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .in("id", userIds);

      if (profErr) return jsonResponse({ detail: profErr.message }, 500);

      const merged = mergeCritiquesWithProfiles(critiques, (profiles ?? []) as Profile[]);
      return jsonResponse(merged, 200);
    }

    // -----------------------------
    // POST /reviews
    // (applique RLS via userClient, user_id = memberId/sub)
    // -----------------------------
    if (method === "POST" && tail.length === 0) {
      const body = (await req.json().catch(() => null)) as
        | {
            film_id?: string;
            title?: string;
            content?: string;
            rating?: number;
            tags?: string[] | null;
            reel_id?: string | null;
          }
        | null;

      if (!body) return jsonResponse({ detail: "Invalid JSON body" }, 400);
      if (!token) return jsonResponse({ detail: "Unauthorized (missing token)" }, 401);

      const actorId = await resolveActorId(token, admin);
      if (!actorId) return jsonResponse({ detail: "Unauthorized (invalid token)" }, 401);

      const { film_id, title, content, rating, tags, reel_id } = body;

      if (!film_id || !isUuid(film_id)) {
        return jsonResponse({ detail: "Missing/invalid film_id" }, 400);
      }
      if (typeof content !== "string" || content.trim().length === 0) {
        return jsonResponse({ detail: "Missing content" }, 400);
      }
      if (typeof rating !== "number") {
        return jsonResponse({ detail: "Missing rating" }, 400);
      }
      if (reel_id != null && !isUuid(reel_id)) {
        return jsonResponse({ detail: "Invalid reel_id" }, 400);
      }

      const { data: film, error: filmErr } = await userClient
        .from("films")
        .select("title")
        .eq("id", film_id)
        .maybeSingle();

      if (filmErr) return jsonResponse({ detail: filmErr.message }, 500);
      if (!film?.title) return jsonResponse({ detail: "Film not found" }, 404);

      const payload = {
        user_id: actorId, // must match JWT claim memberId/sub expected by RLS
        title: (title ?? film.title).trim(),
        film_title: film.title,
        content: content.trim(),
        rating,
        tags: Array.isArray(tags) && tags.length > 0 ? tags : null,
        reel_id: reel_id ?? null,
      } satisfies Json;

      const { data: inserted, error: insErr } = await userClient
        .from("critiques")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (insErr) return jsonResponse({ detail: insErr.message }, 403);
      if (!inserted) return jsonResponse({ detail: "Insert failed" }, 500);

      const { data: profile, error: profileErr } = await userClient
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .eq("id", inserted.user_id)
        .maybeSingle();

      if (profileErr) return jsonResponse({ detail: profileErr.message }, 500);

      return jsonResponse({ ...inserted, profile }, 201);
    }

    return jsonResponse({ detail: "Method not allowed" }, 405);
  } catch (e) {
    console.error(e);
    return jsonResponse({ detail: "Internal error" }, 500);
  }
});