// supabase/functions/reviews/index.ts
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Connection": "keep-alive",
    },
  });
}

function getQuery(req: Request) {
  return new URL(req.url).searchParams;
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

    // Route simple (Edge Function = un seul endpoint).
    // On lit req.url.pathname pour gérer /:id/like.
    // Selon comment tu l’appelles, pathname peut être "/reviews" ou "/reviews/.."
    const pathname = url.pathname.split("/").filter(Boolean); // ex: ["reviews","123","like"].

    // NOTE: la fonction est montée sur /functions/v1/reviews
    // Donc pathname peut ressembler à ["<something>","reviews", ...]
    // On se base sur la fin:
    const tail = pathname.slice(-3); // max 3 segments utiles

    // -----------------------------
    // POST /reviews/:id/like
    // -----------------------------
    if (method === "POST" && tail.length === 3 && tail[2] === "like") {
        const reviewId = tail[1];
        if (!reviewId) return jsonResponse({ detail: "Missing review id" }, 400);
      
        // 1) Récupère likes_count
        const { data: row, error: rowErr } = await supabase
          .from("critiques")
          .select("likes_count")
          .eq("id", reviewId)
          .maybeSingle();
      
        if (rowErr) return jsonResponse({ detail: rowErr.message }, 500);
        if (!row) return jsonResponse({ detail: "Review not found" }, 404);
      
        const current = typeof row.likes_count === "number" ? row.likes_count : 0;
      
        // 2) Incrémente
        const { data: updated, error: updErr } = await supabase
          .from("critiques")
          .update({ likes_count: current + 1 })
          .select(`
            *,
            user:user_id ( id, username, avatar_url )
          `)
          .eq("id", reviewId)
          .single();
      
        if (updErr) return jsonResponse({ detail: updErr.message }, 500);
        return jsonResponse(updated);
      }

    // -----------------------------
    // GET /reviews
    // -----------------------------
    if (method === "GET") {
      const q = getQuery(req);
      const filmId = q.get("film_id");
      const userId = q.get("user_id");

      if (!filmId && !userId) {
        return jsonResponse({ detail: "Provide film_id or user_id" }, 400);
      }

      // On récupère les critiques en join user
      // + mapping film_id -> film_title si film_id est fourni
      if (filmId) {
        // films: id, title
        const { data: film, error: filmErr } = await supabase
          .from("films")
          .select("title")
          .eq("id", filmId)
          .maybeSingle();

        if (filmErr) return jsonResponse({ detail: filmErr.message }, 500);
        if (!film?.title) return jsonResponse([], 200);

        const { data, error } = await supabase
          .from("critiques")
          .select(
            `
              *,
              user:user_id ( id, username, avatar_url )
            `
          )
          .eq("film_title", film.title)
          .order("created_at", { ascending: false });

        if (error) return jsonResponse({ detail: error.message }, 500);
        return jsonResponse(data ?? []);
      }

      // user_id
      const { data, error } = await supabase
        .from("critiques")
        .select(
          `
            *,
            user:user_id ( id, username, avatar_url )
          `
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });

      if (error) return jsonResponse({ detail: error.message }, 500);
      return jsonResponse(data ?? []);
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

      // user_id: on récupère l’utilisateur depuis le JWT (si tu passes Authorization)
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

      const { data: inserted, error: insErr } = await supabase
        .from("critiques")
        .insert({
          user_id: userId,
          film_title: film.title,
          content,
          rating,
          // likes_count si tu as une colonne et une valeur par défaut ailleurs
        } satisfies Json)
        .select(
          `
            *,
            user:user_id ( id, username, avatar_url )
          `
        )
        .single();

      if (insErr) return jsonResponse({ detail: insErr.message }, 500);
      return jsonResponse(inserted, 201);
    }

    return jsonResponse({ detail: "Method not allowed" }, 405);
  } catch (e) {
    console.error(e);
    return jsonResponse({ detail: "Internal error" }, 500);
  }
});