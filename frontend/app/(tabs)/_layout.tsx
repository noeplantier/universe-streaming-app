/**
 * app/(tabs)/_layout.tsx — UNIVERSE · GROUPE (tabs)
 *
 * Layout de groupe minimal pour index/search/social/profile/create/edit.
 * La navbar custom, l'anti-screenshot, le splash et l'auth guard sont des
 * préoccupations globales gérées une seule fois par le vrai root
 * (app/_layout.tsx) — ce fichier ne doit pas les redéfinir.
 *
 * Historique : ce fichier contenait jusqu'ici une copie quasi complète du
 * root layout (Stack avec des écrans comme film/[id], settings, etc. qui ne
 * sont pourtant pas des enfants de ce groupe) — voir doc/decisions. Seul
 * "edit" est un vrai enfant ici ; le reste était mort.
 */
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false,
        contentStyle: { backgroundColor: '#070C17' },
        animation:    Platform.OS === 'ios' ? 'default' : 'fade',
      }}
    >
      <Stack.Screen
        name="edit"
        options={{ animation: 'slide_from_bottom', gestureDirection: 'vertical' }}
      />
    </Stack>
  );
}
