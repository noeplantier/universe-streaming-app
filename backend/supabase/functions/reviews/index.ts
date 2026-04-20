// supabase/functions/reviews/index.ts
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

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

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
};

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const method = req.method.toUpperCase();
    const url = new URL(req.url);

    // Ex: ["reviews","123","like"] (selon mount)
    const parts = url.pathname.split("/").filter(Boolean);
    const fnName = "reviews";
    const fnIndex = parts.indexOf(fnName);
    
    // ce qu’il y a après /functions/v1/reviews/<...>
    const tail = fnIndex >= 0 ? parts.slice(fnIndex + 1) : [];

    // -----------------------------
    // POST /reviews/:id/like
    // -----------------------------
    if (method === "POST" && tail.length === 3 && tail[2] === "like") {
        const reviewId = tail[1];
        if (!reviewId) return jsonResponse({ detail: "Missing review id" }, 400);
        if (!isUuid(reviewId)) return jsonResponse({ detail: "Invalid review id (uuid expected)" }, 400);

      // 1) Lire likes_count
      const { data: row, error: rowErr } = await supabase
        .from("critiques")
        .select("likes_count")
        .eq("id", reviewId)
        .maybeSingle();

      if (rowErr) return jsonResponse({ detail: rowErr.message }, 500);
      if (!row) return jsonResponse({ detail: "Review not found" }, 404);

      const current = typeof row.likes_count === "number" ? row.likes_count : 0;

      // 2) Incrémenter
      const { data: updated, error: updErr } = await supabase
        .from("critiques")
        .update({ likes_count: current + 1 })
        .eq("id", reviewId)
        .select("*")
        .single();

      if (updErr) return jsonResponse({ detail: updErr.message }, 500);
      if (!updated) return jsonResponse({ detail: "Review not found" }, 404);

      // 3) Charger profile (pas de join direct fiable)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .eq("id", updated.user_id)
        .maybeSingle();

      if (profileErr) return jsonResponse({ detail: profileErr.message }, 500);

      return jsonResponse({ ...updated, profile }, 200);
    }

// -----------------------------
// GET /reviews/:id
// -----------------------------
if (method === "GET" && tail.length === 1) {
    const reviewId = tail[0];
  
    if (!reviewId) return jsonResponse({ detail: "Missing review id" }, 400);
    if (!isUuid(reviewId)) return jsonResponse({ detail: "Invalid review id (uuid expected)" }, 400);
  
    const { data: critique, error: critiqueErr } = await supabase
      .from("critiques")
      .select("*")
      .eq("id", reviewId)
      .maybeSingle();
  
    if (critiqueErr) return jsonResponse({ detail: critiqueErr.message }, 500);
    if (!critique) return jsonResponse({ detail: "Review not found" }, 404);
  
    const { data: profile, error: profileErr } = await supabase
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
    if (method === "GET") {
      const q = getQuery(req);
      const filmId = q.get("film_id");
      const userId = q.get("user_id");
      
      if (filmId && !isUuid(filmId)) return jsonResponse({ detail: "Invalid film_id (uuid attendu)" }, 400);
      if (userId && !isUuid(userId)) return jsonResponse({ detail: "Invalid user_id (uuid attendu)" }, 400);

      let critiques: any[] = [];

      if (filmId) {
        const { data: film, error: filmErr } = await supabase
          .from("films")
          .select("id, title")
          .eq("id", filmId)
          .maybeSingle();

        if (filmErr) return jsonResponse({ detail: filmErr.message }, 500);
        if (!film?.title) return jsonResponse([], 200);

        const { data, error } = await supabase
          .from("critiques")
          .select("*")
          .eq("film_title", film.title)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ detail: error.message }, 500);
        critiques = data ?? [];
      } else {
        // user_id
        const { data, error } = await supabase
          .from("critiques")
          .select("*")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ detail: error.message }, 500);
        critiques = data ?? [];
      }

      // Batch profiles
      const userIds = [...new Set((critiques ?? []).map((c) => c.user_id).filter(Boolean))];

      if (userIds.length === 0) return jsonResponse(critiques, 200);

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, display_name")
        .in("id", userIds);

      if (profErr) return jsonResponse({ detail: profErr.message }, 500);

      const merged = mergeCritiquesWithProfiles(critiques, (profiles ?? []) as Profile[]);
      return jsonResponse(merged, 200);
    }


    // DELETE /reviews/:id
if (method === "DELETE" && tail.length === 2) {
    const reviewId = tail[0]; // ⚠️ à adapter selon ton vrai mount path
    // Si ton endpoint est /functions/v1/reviews/<id>, tail devrait être ['<id>']
  }

    // -----------------------------
    // POST /reviews
    // -----------------------------
    if (method === "POST") {
      const body = (await req.json().catch(() => null)) as
        | { film_id?: string; content?: string; rating?: number }
        | null;

      if (!body) return jsonResponse({ detail: "Invalid JSON body" }, 400);

      const { film_id, content, rating } = body;

      if (!film_id || typeof content !== "string" || typeof rating !== "number") {
        return jsonResponse({ detail: "Missing film_id/content/rating" }, 400);
      }

      // mapper film_id -> film_title
      const { data: film, error: filmErr } = await supabase
        .from("films")
        .select("title")
        .eq("id", film_id)
        .maybeSingle();

      if (filmErr) return jsonResponse({ detail: filmErr.message }, 500);
      if (!film?.title) return jsonResponse({ detail: "Film not found" }, 404);

      // user_id: depuis le JWT Authorization
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

      let userId: string | null = null;
      if (token) {
        const { data: authData, error: authErr } = await supabase.auth.getUser(token);
        if (!authErr && authData?.user?.id) userId = authData.user.id;
      }

      if (!userId) {
        return jsonResponse({ detail: "Unauthorized (missing/invalid token)" }, 401);
      }

      // Insert + retourne critique
      const { data: inserted, error: insErr } = await supabase
        .from("critiques")
        .insert({
          user_id: userId,
          film_title: film.title,
          content,
          rating,
        } satisfies Json)
        .select("*")
        .single();

      if (insErr) return jsonResponse({ detail: insErr.message }, 500);
      if (!inserted) return jsonResponse({ detail: "Insert failed" }, 500);

      // Profile du créateur
      const { data: profile, error: profileErr } = await supabase
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

