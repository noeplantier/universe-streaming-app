/**
 * app/(auth)/_layout.tsx — Groupe de routes authentification PIN
 *
 * Layout minimal : pas de NavBar, pas de SafeArea forcée (la page de login
 * gère son propre layout plein-écran avec GalaxyBackground).
 * L'animation slide_from_bottom donne un sentiment "modal" à l'écran de login.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
