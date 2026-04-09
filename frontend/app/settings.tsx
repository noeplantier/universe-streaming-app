// ─────────────────────────────────────────────────────────────────────────────
// app/settings.tsx  —  Paramètres UNIVERSE
//
// Orchestrateur fin : toutes les actions modifient directement le context
// (optimiste, persisté AsyncStorage, appliqué à l'app en temps réel).
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useCallback, useRef, memo,
} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Animated, Platform, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import * as Haptics       from 'expo-haptics';

// Context
import { SettingsProvider, useSettings } from '@/components/settings/SettingsContext';

// Components
import ProfileCard   from '@/components/settings/ProfileCard';
import {
  SectionHeader, SettingsGroup,
  SettingsRow, SettingsToggle, SettingsPicker,
} from '@/components/settings/SettingsGroup';

// Galaxy background (même que social)
import GalaxyBackground from '@/components/social/GalaxyBackground';

// Types
import {
  G,
  LANGUAGE_LABELS, QUALITY_LABELS, SUBTITLE_SIZE_LABELS, FEED_SORT_LABELS,
  type AppLanguage, type VideoQuality, type SubtitleSize, type FeedSort,
} from '@/components/settings/types';

const { width: W, height: H } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Options des pickers (memoïsées à module-level)
// ─────────────────────────────────────────────────────────────────────────────

const LANG_OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English'  },
  { value: 'es', label: 'Español'  },
  { value: 'de', label: 'Deutsch'  },
];

const QUALITY_OPTIONS: { value: VideoQuality; label: string; description?: string }[] = [
  { value: 'auto',  label: 'Automatique', description: 'Adapte selon votre réseau' },
  { value: '4k',    label: '4K Ultra HD',  description: 'Meilleure qualité · +données mobiles' },
  { value: '1080p', label: '1080p HD',     description: 'Recommandé pour la plupart des écrans' },
  { value: '720p',  label: '720p',         description: 'Bon équilibre qualité/données' },
  { value: '480p',  label: '480p',         description: 'Économise les données mobiles' },
];

const SUB_LANG_OPTIONS: { value: AppLanguage; label: string }[] = LANG_OPTIONS;

const SUB_SIZE_OPTIONS: { value: SubtitleSize; label: string }[] = [
  { value: 'small',  label: 'Petit'  },
  { value: 'medium', label: 'Moyen'  },
  { value: 'large',  label: 'Grand'  },
];

const FEED_SORT_OPTIONS: { value: FeedSort; label: string; description?: string }[] = [
  { value: 'recommended', label: 'Recommandé',  description: 'Personnalisé selon vos goûts' },
  { value: 'recent',      label: 'Plus récent', description: 'Chronologique inverse' },
  { value: 'trending',    label: 'Tendances',   description: 'Ce qui buzz cette semaine' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

const SettingsHeader = memo(function SettingsHeader() {
  const router   = useRouter();
  const { settings, resetSettings } = useSettings();

  const handleReset = useCallback(() => {
    Alert.alert(
      'Réinitialiser',
      'Tous vos paramètres seront remis à zéro. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetSettings();
          },
        },
      ],
    );
  }, [resetSettings]);

  return (
    <View style={hdr.row}>
      <TouchableOpacity onPress={() => router.back()} style={hdr.backBtn} activeOpacity={0.7}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Ionicons name="chevron-back" size={22} color="rgba(237,232,255,0.7)" />
      </TouchableOpacity>

      <View style={hdr.center}>
        <Text style={hdr.title}>Paramètres</Text>
        <Text style={hdr.sub}>UNIVERSE · Cinéma Indé</Text>
      </View>

      <TouchableOpacity onPress={handleReset} style={hdr.resetBtn} activeOpacity={0.7}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Ionicons name="refresh-outline" size={18} color="rgba(237,232,255,0.4)" />
      </TouchableOpacity>
    </View>
  );
});

const hdr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  backBtn:  { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.glassBorder },
  resetBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: G.glassBorder },
  center:   { alignItems: 'center', flex: 1 },
  title:    { color: G.sW, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  sub:      { color: 'rgba(237,232,255,0.30)', fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginTop: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Corps (consomme le context)
// ─────────────────────────────────────────────────────────────────────────────

function SettingsBody() {
  const router = useRouter();
  const { settings, setSetting, logout } = useSettings();

  // ── Déconnexion ───────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: () => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            logout();
            router.replace('/(auth)/welcome');
          },
        },
      ],
    );
  }, [logout, router]);

  // ── Suppression de compte ─────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes vos données seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => {} },
      ],
    );
  }, []);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={sc.listContent}
    >
      {/* ── Profil héro ── */}
      <ProfileCard />



      {/* ═══════════════════════════════════════════════════════════════════
          LECTURE
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Lecture" icon="play-circle-outline" />
      <SettingsGroup>
        <SettingsToggle
          icon="play-circle-outline"
          title="Lecture automatique"
          subtitle="Lance la vidéo sans appuyer sur Play"
          value={settings.autoPlay}
          onChange={v => setSetting('autoPlay', v)}
        />
        <SettingsToggle
          icon="arrow-forward-circle-outline"
          title="Épisode suivant automatique"
          subtitle="Passe à l'épisode suivant en fin de lecture"
          value={settings.autoNextEpisode}
          onChange={v => setSetting('autoNextEpisode', v)}
        />
        <SettingsPicker<VideoQuality>
          icon="videocam-outline"
          title="Qualité vidéo"
          value={settings.videoQuality}
          options={QUALITY_OPTIONS}
          onChange={v => setSetting('videoQuality', v)}
        />
        <SettingsToggle
          icon="cellular-outline"
          title="Économiseur de données"
          subtitle="Réduit la qualité sur réseau mobile"
          value={settings.dataSaver}
          onChange={v => setSetting('dataSaver', v)}
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          SOUS-TITRES
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Sous-titres" icon="closed-captioning-outline" />
      <SettingsGroup>
        <SettingsToggle
          icon="closed-captioning-outline"
          title="Sous-titres activés"
          value={settings.subtitlesEnabled}
          onChange={v => setSetting('subtitlesEnabled', v)}
        />
        <SettingsPicker<AppLanguage>
          icon="language-outline"
          title="Langue des sous-titres"
          value={settings.subtitleLanguage}
          options={SUB_LANG_OPTIONS}
          onChange={v => setSetting('subtitleLanguage', v)}
        />
        <SettingsPicker<SubtitleSize>
          icon="text-outline"
          title="Taille des sous-titres"
          value={settings.subtitleSize}
          options={SUB_SIZE_OPTIONS}
          onChange={v => setSetting('subtitleSize', v)}
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          NOTIFICATIONS
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Notifications" icon="notifications-outline" />
      <SettingsGroup>
        <SettingsToggle
          icon="film-outline"
          title="Nouveaux épisodes"
          subtitle="Alertes quand une série se met à jour"
          value={settings.notifNewEpisode}
          onChange={v => setSetting('notifNewEpisode', v)}
        />
        <SettingsToggle
          icon="people-outline"
          title="Activité sociale"
          subtitle="Likes, commentaires, abonnements"
          value={settings.notifSocial}
          onChange={v => setSetting('notifSocial', v)}
        />
        <SettingsToggle
          icon="trophy-outline"
          title="Festivals & Sorties"
          subtitle="Infos festivals, avant-premières"
          value={settings.notifFestival}
          onChange={v => setSetting('notifFestival', v)}
        />
        <SettingsToggle
          icon="mail-outline"
          title="Newsletter mensuelle"
          value={settings.notifNewsletter}
          onChange={v => setSetting('notifNewsletter', v)}
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          VIE PRIVÉE
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Vie privée" icon="shield-checkmark-outline" />
      <SettingsGroup>
        <SettingsToggle
          icon="eye-off-outline"
          title="Profil privé"
          subtitle="Seuls vos abonnés vous voient"
          value={settings.privateProfile}
          onChange={v => setSetting('privateProfile', v)}
        />
        <SettingsToggle
          icon="bookmark-outline"
          title="Watchlist publique"
          subtitle="Visible par votre communauté"
          value={settings.publicWatchlist}
          onChange={v => setSetting('publicWatchlist', v)}
        />
        <SettingsToggle
          icon="bar-chart-outline"
          title="Analytics & Amélioration"
          subtitle="Aide à améliorer l'app anonymement"
          value={settings.analyticsOpt}
          onChange={v => setSetting('analyticsOpt', v)}
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          COMMUNAUTÉ & FEED
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Communauté" icon="people-outline" />
      <SettingsGroup>
        <SettingsPicker<FeedSort>
          icon="funnel-outline"
          title="Tri du feed"
          value={settings.feedSort}
          options={FEED_SORT_OPTIONS}
          onChange={v => setSetting('feedSort', v)}
        />
        <SettingsRow
          icon="people-outline"
          title="Gérer les abonnements"
          onPress={() => {}}
        />
        <SettingsRow
          icon="bookmark-outline"
          title="Ma Watchlist"
          onPress={() => router.push('/watchlist')}
        />
        <SettingsRow
          icon="trophy-outline"
          title="Mes badges"
          subtitle="Voir vos accomplissements"
          onPress={() => {}}
          badge="Nouveau"
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          APP
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Application" icon="phone-portrait-outline" />
      <SettingsGroup>
        <SettingsPicker<AppLanguage>
          icon="language-outline"
          title="Langue de l'app"
          value={settings.language}
          options={LANG_OPTIONS}
          onChange={v => setSetting('language', v)}
        />
        <SettingsToggle
          icon="phone-portrait-outline"
          title="Retour haptique"
          subtitle="Vibrations lors des interactions"
          value={settings.haptics}
          onChange={v => setSetting('haptics', v)}
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          COMPTE
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="Compte" icon="person-outline" />
      <SettingsGroup>
        <SettingsRow icon="lock-closed-outline"     title="Changer le mot de passe" onPress={() => {}} />
        <SettingsRow icon="card-outline"             title="Abonnement & Facturation" onPress={() => {}} />
        <SettingsRow icon="download-outline"         title="Exporter mes données"     onPress={() => {}} last />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          À PROPOS
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionHeader title="À propos" icon="information-circle-outline" />
      <SettingsGroup>
        <SettingsRow icon="document-text-outline"     title="Conditions d'utilisation" onPress={() => {}} />
        <SettingsRow icon="shield-checkmark-outline"  title="Politique de confidentialité" onPress={() => {}} />
        <SettingsRow icon="help-circle-outline"       title="Centre d'aide"            onPress={() => {}} />
        <SettingsRow icon="star-outline"              title="Évaluer l'app"            onPress={() => {}} />
        <SettingsRow
          icon="information-circle-outline"
          title="Version"
          subtitle="UNIVERSE v2.0.0 · Build 420"
          last
        />
      </SettingsGroup>

      {/* ═══════════════════════════════════════════════════════════════════
          ACTIONS DESTRUCTIVES
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginTop: 8 }}>
        <SettingsGroup>
          <SettingsRow
            icon="log-out-outline"
            title="Se déconnecter"
            onPress={handleLogout}
            danger
          />
          <SettingsRow
            icon="trash-outline"
            title="Supprimer mon compte"
            onPress={handleDeleteAccount}
            danger
            last
          />
        </SettingsGroup>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <View style={sc.footer}>
        <Text style={sc.footerTitle}>UNIVERSE</Text>
        <Text style={sc.footerSub}>Cinéma Indépendant · Fait avec 💜</Text>
        <View style={sc.footerDots}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[sc.dot, i === 1 && sc.dotActive]} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal — enveloppe dans SettingsProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  return (
    <SettingsProvider>
      <View style={sc.root}>
        <StatusBar style="light" />
        <GalaxyBackground />

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <SettingsHeader />
          <SettingsBody />
        </SafeAreaView>
      </View>
    </SettingsProvider>
  );
}

const sc = StyleSheet.create({
  root:        { flex: 1, backgroundColor: G.bg0 },
  listContent: { paddingBottom: 120, paddingTop: 4 },
  footer:      { alignItems: 'center', paddingTop: 36, paddingBottom: 12, gap: 6 },
  footerTitle: { color: G.primary, fontSize: 14, fontWeight: '900', letterSpacing: 3 },
  footerSub:   { color: G.textTert, fontSize: 11, letterSpacing: 0.5 },
  footerDots:  { flexDirection: 'row', gap: 6, marginTop: 8 },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotActive:   { backgroundColor: G.primary, width: 14 },
});