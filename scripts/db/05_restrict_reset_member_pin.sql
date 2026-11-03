-- Le RPC de reset est réservé aux opérations administratives côté serveur.
-- Les clients anon/authenticated ne doivent pas pouvoir remplacer le PIN d’un membre.
REVOKE EXECUTE ON FUNCTION public.reset_member_pin(text, text, text) FROM PUBLIC, anon, authenticated;
