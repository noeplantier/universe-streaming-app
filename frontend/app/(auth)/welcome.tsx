/**
 * app/welcome.tsx  (ou app/index.tsx selon votre routing)
 *
 * ── Écran d'authentification Universe ────────────────────────────────────────
 *
 *  FONCTIONNALITÉS
 *  ✦ Vérification session 48h au montage → skip si valide
 *  ✦ Auto-connect (demo) — contourne l'auth réelle pour le dev
 *  ✦ Google / Apple / Email (skeletons OAuth prêts pour prod)
 *  ✦ Lien éphémère super-user (OTP Supabase Magic Link)
 *  ✦ Session persistante 48h via AsyncStorage
 *  ✦ Design : GalaxyBackground + C.navyMid + neonL (cohérent avec l'app)
 *
 *  POUR ACTIVER L'AUTH RÉELLE :
 *  1. Remplacer handleAutoConnect par les vraies fonctions OAuth
 *  2. Configurer les providers dans Supabase Dashboard → Auth → Providers
 *  3. Ajouter les Google/Apple client IDs dans app.config.js
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import AsyncStorage          from '@react-native-async-storage/async-storage';

import GalaxyBackground      from '@/components/social/GalaxyBackground';
import { supabase }          from '@/lib/supabase';

const { width: SW, height: SH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// SESSION — 48h persistance
// ─────────────────────────────────────────────────────────────────────────────
const SESSION_KEY = '@universe_session_v1';
const SESSION_TTL = 48 * 60 * 60 * 1000; // 48h en ms

interface StoredSession {
  userId:    string;
  email:     string;
  role:      'user' | 'superuser';
  expiresAt: number;
}

async function saveSession(userId: string, email: string, role: 'user' | 'superuser' = 'user') {
  const session: StoredSession = {
    userId, email, role,
    expiresAt: Date.now() + SESSION_TTL,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (Date.now() > session.expiresAt) {
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS (cohérents avec le reste de l'app)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  navyMid:  'rgba(13,34,64,0.55)',
  navyLow:  'rgba(13,34,64,0.32)',
  navyHigh: 'rgba(13,34,64,0.82)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.18)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.85)',
  muted:    'rgba(255,255,255,0.38)',
  neon:     '#7C5EFC',
  neonL:    '#A78BFA',
  gold:     '#F5C842',
  error:    '#EF4444',
  success:  '#22C55E',
  google:   '#4285F4',
  apple:    '#FFFFFF',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ÉTOILES DÉCORATIVES
// ─────────────────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  top:  Math.random() * SH * 0.55,
  left: Math.random() * SW,
  size: 1 + Math.random() * 2,
  op:   0.2 + Math.random() * 0.5,
}));

const StarField = memo(function StarField() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {STARS.map(s => (
        <View
          key={s.id}
          style={{
            position:'absolute', top:s.top, left:s.left,
            width:s.size, height:s.size, borderRadius:s.size/2,
            backgroundColor:C.white, opacity:s.op,
          }}
        />
      ))}
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOUTON AUTH SOCIAL
// ─────────────────────────────────────────────────────────────────────────────
const SocialBtn = memo(function SocialBtn({
  icon, label, onPress, loading, color,
}: {
  icon: string; label: string; onPress: () => void;
  loading?: boolean; color?: string;
}) {
  return (
    <TouchableOpacity style={sb.btn} onPress={onPress} activeOpacity={0.82} disabled={loading}>
      <BlurView intensity={Platform.OS === 'ios' ? 20 : 14} tint="dark" style={sb.blur}>
        <View style={sb.inner}>
          {loading
            ? <ActivityIndicator size="small" color={C.neonL} />
            : <Ionicons name={icon as any} size={19} color={color ?? C.white} />
          }
          <Text style={sb.label}>{label}</Text>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
});

const sb = StyleSheet.create({
  btn:   { width:'100%', borderRadius:16, overflow:'hidden', marginBottom:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBr },
  blur:  { width:'100%' },
  inner: { flexDirection:'row', alignItems:'center', gap:12, paddingVertical:15, paddingHorizontal:20 },
  label: { color:C.white, fontSize:15, fontWeight:'700', flex:1, textAlign:'center', marginRight:19 },
});

// ─────────────────────────────────────────────────────────────────────────────
// PANNEAU EMAIL
// ─────────────────────────────────────────────────────────────────────────────
const EmailPanel = memo(function EmailPanel({
  onLogin, loading, error,
}: {
  onLogin: (email: string, pw: string) => void;
  loading: boolean;
  error:   string | null;
}) {
  const [email, setEmail] = useState('');
  const [pw,    setPw]    = useState('');
  const [showPw, setShowPw] = useState(false);

  const canSubmit = email.trim().includes('@') && pw.length >= 6 && !loading;

  return (
    <View style={ep.wrap}>
      <View style={ep.field}>
        <Ionicons name="mail-outline" size={16} color={C.muted} />
        <TextInput
          style={ep.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={C.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={C.neonL}
        />
      </View>

      <View style={ep.field}>
        <Ionicons name="lock-closed-outline" size={16} color={C.muted} />
        <TextInput
          style={ep.input}
          value={pw}
          onChangeText={setPw}
          placeholder="Mot de passe"
          placeholderTextColor={C.muted}
          secureTextEntry={!showPw}
          selectionColor={C.neonL}
        />
        <TouchableOpacity onPress={() => setShowPw(v => !v)} hitSlop={8}>
          <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={15} color={C.muted} />
        </TouchableOpacity>
      </View>

      {!!error && (
        <View style={ep.errorRow}>
          <Ionicons name="warning-outline" size={13} color={C.error} />
          <Text style={ep.errorTxt}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[ep.submitBtn, !canSubmit && ep.submitOff]}
        onPress={() => onLogin(email.trim(), pw)}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={C.white} size="small" />
          : <Text style={ep.submitTxt}>Se connecter</Text>
        }
      </TouchableOpacity>
    </View>
  );
});

const ep = StyleSheet.create({
  wrap:      { width:'100%', gap:10 },
  field:     { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.navyMid, borderRadius:14, paddingHorizontal:14, height:50, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  input:     { flex:1, color:C.white, fontSize:14 },
  errorRow:  { flexDirection:'row', alignItems:'center', gap:6 },
  errorTxt:  { color:C.error, fontSize:12 },
  submitBtn: { backgroundColor:C.neon, borderRadius:14, paddingVertical:15, alignItems:'center' },
  submitOff: { opacity:0.45 },
  submitTxt: { color:C.white, fontSize:15, fontWeight:'800' },
});

// ─────────────────────────────────────────────────────────────────────────────
// PANNEAU MAGIC LINK (super-users)
// ─────────────────────────────────────────────────────────────────────────────
const MagicLinkPanel = memo(function MagicLinkPanel({
  onSend, loading,
}: {
  onSend: (email: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [sent,  setSent]  = useState(false);

  const handleSend = useCallback(() => {
    if (!email.trim().includes('@')) return;
    onSend(email.trim());
    setSent(true);
  }, [email, onSend]);

  if (sent) {
    return (
      <View style={ml.sentBox}>
        <Ionicons name="checkmark-circle" size={28} color={C.success} />
        <Text style={ml.sentTitle}>Lien envoyé !</Text>
        <Text style={ml.sentSub}>Vérifie ta boîte mail Universe Team pour le lien d'accès.</Text>
      </View>
    );
  }

  return (
    <View style={ml.wrap}>
      <Text style={ml.hint}>
        Réservé à l'équipe Universe.{'\n'}Un lien éphémère (15 min) vous sera envoyé.
      </Text>
      <View style={ep.field}>
        <Ionicons name="shield-outline" size={16} color={C.neonL} />
        <TextInput
          style={ep.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email @universe-team.com"
          placeholderTextColor={C.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          selectionColor={C.neonL}
        />
      </View>
      <TouchableOpacity
        style={[ml.btn, (!email.trim().includes('@') || loading) && ep.submitOff]}
        onPress={handleSend}
        disabled={!email.trim().includes('@') || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={C.white} size="small" />
          : <>
              <Ionicons name="flash" size={15} color={C.white} />
              <Text style={ml.btnTxt}>Envoyer le lien éphémère</Text>
            </>
        }
      </TouchableOpacity>
    </View>
  );
});

const ml = StyleSheet.create({
  wrap:     { width:'100%', gap:10 },
  hint:     { color:C.muted, fontSize:12, textAlign:'center', lineHeight:17 },
  btn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'rgba(124,94,252,0.22)', borderRadius:14, paddingVertical:14, borderWidth:1, borderColor:C.neon },
  btnTxt:   { color:C.neonL, fontSize:14, fontWeight:'800' },
  sentBox:  { alignItems:'center', gap:8, paddingVertical:12 },
  sentTitle:{ color:C.success, fontSize:16, fontWeight:'800' },
  sentSub:  { color:C.muted, fontSize:12, textAlign:'center', lineHeight:17 },
});

// ─────────────────────────────────────────────────────────────────────────────
// WELCOME SCREEN
// ─────────────────────────────────────────────────────────────────────────────
type AuthMode = 'main' | 'email' | 'magic';

export default function WelcomeScreen() {
  const router = useRouter();

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(60)).current;
  const cardFade  = useRef(new Animated.Value(0)).current;

  const [mode,         setMode]         = useState<AuthMode>('main');
  const [loading,      setLoading]      = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [mlLoading,    setMlLoading]    = useState(false);
  const [emailError,   setEmailError]   = useState<string | null>(null);
  const [checking,     setChecking]     = useState(true); // vérifie session au démarrage

  // ── Vérification session 48h au montage ─────────────────────────────────
  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        // Session valide → passe directement aux tabs
        router.replace('/(tabs)');
        return;
      }
      setChecking(false);

      // Animations d'entrée
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue:1, duration:900, useNativeDriver:true }),
        Animated.timing(slideAnim, { toValue:0, duration:750, useNativeDriver:true }),
        Animated.timing(cardFade,  { toValue:1, duration:1000, useNativeDriver:true }),
        Animated.spring(cardSlide, { toValue:0, tension:60, friction:12, useNativeDriver:true }),
      ]).start();

      // Pulsation logo
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.06, duration:1800, useNativeDriver:true }),
        Animated.timing(pulseAnim, { toValue:1,    duration:1800, useNativeDriver:true }),
      ])).start();
    })();
  }, []);

  // ── Animation changement de mode ──────────────────────────────────────────
  useEffect(() => {
    cardSlide.setValue(30);
    cardFade.setValue(0);
    Animated.parallel([
      Animated.timing(cardFade,  { toValue:1, duration:280, useNativeDriver:true }),
      Animated.spring(cardSlide, { toValue:0, tension:80, friction:12, useNativeDriver:true }),
    ]).start();
  }, [mode]);

  // ── Connexion et sauvegarde session ──────────────────────────────────────
  const loginAndNavigate = useCallback(async (userId: string, email: string, role: 'user' | 'superuser' = 'user') => {
    await saveSession(userId, email, role);
    router.replace('/(tabs)');
  }, [router]);

  // ── AUTO-CONNECT (dev / demo) ─────────────────────────────────────────────
  const handleAutoConnect = useCallback(async () => {
    setLoading(true);
    try {
      // ↓ Remplacer par vos credentials de test Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email:    'demo@universe-app.com',
        password: 'Universe2024!',
      });

      if (error || !data.user) {
        // Fallback : session locale sans Supabase (mode hors-ligne dev)
        await loginAndNavigate('demo-user-id', 'demo@universe-app.com');
        return;
      }

      await loginAndNavigate(data.user.id, data.user.email ?? '', 'user');
    } catch {
      // Fallback local
      await loginAndNavigate('demo-user-id', 'demo@universe-app.com');
    } finally {
      setLoading(false);
    }
  }, [loginAndNavigate]);

  // ── GOOGLE (squelette OAuth — à compléter en prod) ────────────────────────
  const handleGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'universe://(tabs)',
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Le redirect OAuth gère la suite
    } catch (e: any) {
      Alert.alert('Erreur Google', e?.message ?? 'Connexion impossible.');
      setLoading(false);
    }
  }, []);

  // ── APPLE (squelette — à compléter en prod) ───────────────────────────────
  const handleApple = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: 'universe://(tabs)' },
      });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Erreur Apple', e?.message ?? 'Connexion impossible.');
      setLoading(false);
    }
  }, []);

  // ── EMAIL / MOT DE PASSE ─────────────────────────────────────────────────
  const handleEmailLogin = useCallback(async (email: string, pw: string) => {
    setEmailLoading(true);
    setEmailError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) { setEmailError(error.message); return; }
      if (data.user) await loginAndNavigate(data.user.id, email);
    } catch {
      setEmailError('Connexion impossible. Vérifie tes identifiants.');
    } finally {
      setEmailLoading(false);
    }
  }, [loginAndNavigate]);

  // ── MAGIC LINK super-users ────────────────────────────────────────────────
  const handleMagicLink = useCallback(async (email: string) => {
    setMlLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: 'universe://universe-admin',
          shouldCreateUser: false, // Seuls les users existants reçoivent le lien
        },
      });
      if (error) Alert.alert('Erreur', error.message);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le lien.');
    } finally {
      setMlLoading(false);
    }
  }, []);

  // ── Affichage loading initial (vérif session) ─────────────────────────────
  if (checking) {
    return (
      <View style={{ flex:1, backgroundColor:'#03000A', alignItems:'center', justifyContent:'center' }}>
        <GalaxyBackground />
        <ActivityIndicator color={C.neonL} size="large" />
      </View>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light" />
      <GalaxyBackground />
      <StarField />

      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── LOGO SECTION ──────────────────────────────────────────── */}
          <Animated.View
            style={[s.logoWrap, { opacity:fadeAnim, transform:[{ translateY:slideAnim }] }]}
          >
            <Animated.View style={{ transform:[{ scale:pulseAnim }], alignItems:'center' }}>
              {/* Halo */}
              <View style={s.halo} />

              {/* Titre */}
              <Text style={s.logoText}>UNIVERSE</Text>

              {/* Underline dégradé */}
              <LinearGradient
                colors={['#7C5EFC', '#A78BFA', '#7C5EFC']}
                style={s.logoLine}
                start={{ x:0, y:0 }} end={{ x:1, y:0 }}
              />
            </Animated.View>

            <Text style={s.tagline}>
              Le cinéma indépendant{'\n'}à portée de main
            </Text>

            <Text style={s.taglineEn}>Independent Cinema Streaming</Text>

            {/* Genres pills */}
            <View style={s.pillRow}>
              {['Thriller', 'Drame', 'Romance', 'Sci-Fi', 'Horreur'].map(g => (
                <View key={g} style={s.pill}>
                  <Text style={s.pillTxt}>{g}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── CARD AUTH ─────────────────────────────────────────────── */}
          <Animated.View
            style={[s.card, { opacity:cardFade, transform:[{ translateY:cardSlide }] }]}
          >
            <BlurView intensity={Platform.OS === 'ios' ? 24 : 16} tint="dark" style={s.cardBlur}>

              {/* ── Titre de section ── */}
              <View style={s.cardHeader}>
                {mode !== 'main' && (
                  <TouchableOpacity onPress={() => setMode('main')} hitSlop={10}>
                    <Ionicons name="chevron-back" size={18} color={C.muted} />
                  </TouchableOpacity>
                )}
                <Text style={s.cardTitle}>
                  {mode === 'main'  ? 'Rejoindre l\'Univers'      :
                   mode === 'email' ? 'Connexion par email'       :
                                     'Accès équipe Universe'}
                </Text>
              </View>

              {/* ── MODE PRINCIPAL ── */}
              {mode === 'main' && (
                <View style={s.authOptions}>

                  {/* AUTO-CONNECT (démo / dev) */}
                  <TouchableOpacity
                    style={s.autoBtn}
                    onPress={handleAutoConnect}
                    activeOpacity={0.85}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={['#7C5EFC', '#5B3FCC']}
                      style={s.autoBtnGrad}
                      start={{ x:0, y:0 }} end={{ x:1, y:0 }}
                    >
                      {loading
                        ? <ActivityIndicator color={C.white} size="small" />
                        : <Ionicons name="planet" size={18} color={C.white} />
                      }
                      <View>
                        <Text style={s.autoBtnTxt}>Entrer dans l'Univers</Text>
                        <Text style={s.autoBtnSub}>Accès immédiat</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={s.orRow}>
                    <View style={s.orLine} />
                    <Text style={s.orTxt}>ou continuer avec</Text>
                    <View style={s.orLine} />
                  </View>

                  {/* GOOGLE */}
                  <SocialBtn
                    icon="logo-google"
                    label="Google"
                    onPress={handleGoogle}
                    loading={false}
                    color={C.google}
                  />

                  {/* APPLE (iOS uniquement) */}
                  {Platform.OS === 'ios' && (
                    <SocialBtn
                      icon="logo-apple"
                      label="Apple"
                      onPress={handleApple}
                      loading={false}
                      color={C.apple}
                    />
                  )}

                  {/* EMAIL */}
                  <SocialBtn
                    icon="mail-outline"
                    label="Email & mot de passe"
                    onPress={() => setMode('email')}
                    color={C.offWhite}
                  />

                  {/* SUPER USER — accès équipe */}
                  <TouchableOpacity
                    style={s.superUserBtn}
                    onPress={() => setMode('magic')}
                    activeOpacity={0.80}
                  >
                    <Ionicons name="shield-checkmark-outline" size={13} color={C.neonL} />
                    <Text style={s.superUserTxt}>Accès équipe Universe</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── MODE EMAIL ── */}
              {mode === 'email' && (
                <EmailPanel
                  onLogin={handleEmailLogin}
                  loading={emailLoading}
                  error={emailError}
                />
              )}

              {/* ── MODE MAGIC LINK ── */}
              {mode === 'magic' && (
                <MagicLinkPanel
                  onSend={handleMagicLink}
                  loading={mlLoading}
                />
              )}

            </BlurView>
          </Animated.View>

          {/* ── FOOTER ────────────────────────────────────────────────── */}
          <Animated.View style={[s.footer, { opacity:fadeAnim }]}>
            <Text style={s.footerTxt}>
              En continuant, vous acceptez nos{' '}
              <Text style={s.footerLink}>Conditions d'utilisation</Text>
              {' '}et notre{' '}
              <Text style={s.footerLink}>Politique de confidentialité</Text>.
            </Text>
            <Text style={s.footerCopy}>© 2025 Universe — All rights reserved</Text>
          </Animated.View>

          <View style={{ height:40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex:1, backgroundColor:'#03000A' },
  scroll: { paddingHorizontal:20, paddingTop:SH * 0.10, paddingBottom:20 },

  // Logo
  logoWrap: { alignItems:'center', marginBottom:36 },
  halo:     {
    position:'absolute', width:200, height:200, borderRadius:100,
    backgroundColor:'rgba(124,94,252,0.14)',
    transform:[{ scale:1.5 }],
  },
  logoText: {
    fontSize:48, fontWeight:'900', color:C.white,
    letterSpacing:10, includeFontPadding:false,
    textShadowColor:'rgba(124,94,252,0.6)',
    textShadowOffset:{ width:0, height:0 },
    textShadowRadius:20,
  },
  logoLine:  { width:80, height:3, borderRadius:2, marginTop:10 },
  tagline:   { marginTop:22, fontSize:19, color:C.offWhite, textAlign:'center', lineHeight:27, fontWeight:'600' },
  taglineEn: { marginTop:6, fontSize:12, color:C.muted, textAlign:'center', letterSpacing:1.5, fontStyle:'italic' },
  pillRow:   { flexDirection:'row', flexWrap:'wrap', justifyContent:'center', gap:8, marginTop:20 },
  pill:      { backgroundColor:'rgba(255,255,255,0.06)', paddingVertical:6, paddingHorizontal:12, borderRadius:20, borderWidth:1, borderColor:'rgba(255,255,255,0.10)' },
  pillTxt:   { color:'#C4A3FF', fontSize:12, fontWeight:'500' },

  // Card
  card:     { borderRadius:24, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  cardBlur: { padding:24, gap:16 },
  cardHeader:{ flexDirection:'row', alignItems:'center', gap:10, marginBottom:4 },
  cardTitle: { color:C.white, fontSize:17, fontWeight:'800', flex:1 },

  // Auth
  authOptions: { gap:0 },
  autoBtn:    { borderRadius:18, overflow:'hidden', marginBottom:20, shadowColor:'#7C5EFC', shadowOpacity:0.35, shadowRadius:16, shadowOffset:{width:0,height:6}, elevation:8 },
  autoBtnGrad:{ flexDirection:'row', alignItems:'center', gap:14, paddingVertical:18, paddingHorizontal:22 },
  autoBtnTxt: { color:C.white, fontSize:16, fontWeight:'800' },
  autoBtnSub: { color:'rgba(255,255,255,0.60)', fontSize:11, marginTop:2 },

  orRow:  { flexDirection:'row', alignItems:'center', gap:10, marginBottom:10 },
  orLine: { flex:1, height:StyleSheet.hairlineWidth, backgroundColor:'rgba(255,255,255,0.12)' },
  orTxt:  { color:C.muted, fontSize:11 },

  superUserBtn: { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:12, marginTop:4 },
  superUserTxt: { color:C.neonL, fontSize:12, fontWeight:'600' },

  // Footer
  footer:    { marginTop:28, alignItems:'center', gap:8 },
  footerTxt: { color:'rgba(255,255,255,0.28)', fontSize:10, textAlign:'center', lineHeight:16 },
  footerLink:{ color:'rgba(255,255,255,0.50)', textDecorationLine:'underline' },
  footerCopy:{ color:'rgba(255,255,255,0.18)', fontSize:10 },
});