/**
 * FeedItem — MODIFICATIONS REQUISES
 * ══════════════════════════════════
 * Ce fichier documente les 3 changements à apporter à FeedItem.tsx
 * pour connecter la barre de progression, le bouton Infos et la palette d'icônes.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. NOUVELLES PROPS
 * ──────────────────────────────────────────────────────────────────────────────
 */

// Dans l'interface FeedItemProps, ajouter :
interface FeedItemPropsAdditions {
    onInfoPress: (film: FeedFilm)                          => void;
    onProgress:  (p: { positionMs: number; durationMs: number }) => void;
  }
  
  /**
   * ──────────────────────────────────────────────────────────────────────────────
   * 2. BARRE DE PROGRESSION — brancher onPlaybackStatusUpdate sur expo-av
   * ──────────────────────────────────────────────────────────────────────────────
   *
   * Dans le composant Video (expo-av), ajouter :
   */
  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      onProgress({
        positionMs: status.positionMillis ?? 0,
        durationMs: status.durationMillis ?? 0,
      });
    },
    [onProgress],
  );
  
  // Sur le composant <Video> :
  // <Video
  //   ...
  //   onPlaybackStatusUpdate={onPlaybackStatusUpdate}
  // />
  
  /**
   * ──────────────────────────────────────────────────────────────────────────────
   * 3. BOUTON INFOS — ajouter dans la sidebar actions
   * ──────────────────────────────────────────────────────────────────────────────
   *
   * Dans le rendu de la colonne d'actions (icônes droite) :
   */
  const handleInfoPress = useCallback(() => onInfoPress(film), [film, onInfoPress]);
  
  // JSX à ajouter dans la colonne d'actions :
  /*
  <TouchableOpacity
    style={actionBtn.wrap}
    onPress={handleInfoPress}
    hitSlop={HIT_SLOP}
    activeOpacity={0.75}
  >
    <Ionicons name="information-circle-outline" size={28} color="rgba(255,255,255,0.90)" />
    <Text style={actionBtn.label}>Infos</Text>
  </TouchableOpacity>
  */
  
  /**
   * ──────────────────────────────────────────────────────────────────────────────
   * 4. PALETTE ICÔNES — 0 couleur au press SAUF like
   * ──────────────────────────────────────────────────────────────────────────────
   *
   * Règle : toutes les icônes restent blanc/gris au press
   *         seul le like devient rouge (#FF3B5C) quand is_liked === true
   *
   * Exemple pour le bouton Like :
   */
  const LIKE_ACTIVE_COLOR   = '#FF3B5C';
  const ICON_DEFAULT_COLOR  = 'rgba(255,255,255,0.90)';
  const ICON_PRESSED_COLOR  = 'rgba(255,255,255,0.90)'; // pas de changement au press
  
  // Couleur du cœur :
  const likeColor = film.is_liked ? LIKE_ACTIVE_COLOR : ICON_DEFAULT_COLOR;
  
  // Icône like :
  /*
  <Ionicons
    name={film.is_liked ? 'heart' : 'heart-outline'}
    size={28}
    color={likeColor}
  />
  */
  
  // Toutes les autres icônes (save, share, comment, info…) :
  /*
  <Ionicons
    name="bookmark-outline"   // ne jamais changer en 'bookmark' au press
    size={28}
    color={ICON_DEFAULT_COLOR} // toujours blanc, jamais de couleur d'état
  />
  */
  
  export {};