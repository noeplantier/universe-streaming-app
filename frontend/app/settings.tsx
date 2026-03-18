import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

function SettingsItem({ icon, title, subtitle, onPress, danger, rightElement }: {
  icon: string; title: string; subtitle?: string;
  onPress?: () => void; danger?: boolean; rightElement?: React.ReactNode;
}) {
  return (
    <TouchableOpacity testID={`settings-${title.toLowerCase().replace(/\s/g, '-')}`} onPress={onPress} style={styles.settingsItem} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.settingsItemIcon, { backgroundColor: danger ? 'rgba(255,59,48,0.15)' : 'rgba(140,46,186,0.15)' }]}>
        <Ionicons name={icon as any} size={18} color={danger ? COLORS.error : COLORS.primary} />
      </View>
      <View style={styles.settingsItemInfo}>
        <Text style={[styles.settingsItemTitle, danger && { color: COLORS.error }]}>{title}</Text>
        {subtitle && <Text style={styles.settingsItemSub}>{subtitle}</Text>}
      </View>
      {rightElement || (onPress && !danger && <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />)}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [autoPlay, setAutoPlay] = useState(true);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');

  async function handleLogout() {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/welcome');
        }},
      ]
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="settings-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Paramètres</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile Card */}
        {user && (
          <View style={styles.profileCard}>
            <LinearGradient colors={['#240056', '#8C2EBA']} style={StyleSheet.absoluteFillObject} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
            <Image source={{ uri: user.avatar_url }} style={styles.profileAvatar} />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.username}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
              <View style={styles.profileRoleBadge}>
                <Text style={styles.profileRoleText}>{user.role === 'director' ? '🎬 Réalisateur' : user.role === 'critic' ? '✍️ Critique' : '👁️ Spectateur'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Subscription */}
        <View style={styles.premiumCard}>
          <LinearGradient colors={['#1A052E', '#240056']} style={StyleSheet.absoluteFillObject} />
          <View style={styles.premiumContent}>
            <View>
              <Text style={styles.premiumTitle}>✨ UNIVERSE Premium</Text>
              <Text style={styles.premiumSub}>Sans pub · HD · Contenu exclusif</Text>
            </View>
            <TouchableOpacity testID="settings-premium-btn" activeOpacity={0.85}>
              <LinearGradient colors={GRADIENTS.primary} style={styles.premiumBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.premiumBtnText}>3,99€/mois</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <SectionHeader title="Compte" />
        <View style={styles.settingsGroup}>
          <SettingsItem icon="person-outline" title="Modifier le profil" onPress={() => {}} />
          <SettingsItem icon="lock-closed-outline" title="Changer le mot de passe" onPress={() => {}} />
          <SettingsItem icon="card-outline" title="Abonnement & Facturation" onPress={() => {}} />
        </View>

        {/* Preferences */}
        <SectionHeader title="Préférences" />
        <View style={styles.settingsGroup}>
          <SettingsItem
            icon="language-outline"
            title="Langue"
            subtitle={language === 'fr' ? 'Français' : 'English'}
            onPress={() => setLanguage(l => l === 'fr' ? 'en' : 'fr')}
          />
          <SettingsItem
            icon="notifications-outline"
            title="Notifications"
            rightElement={
              <Switch
                testID="settings-notifications-switch"
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: COLORS.surface, true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingsItem
            icon="play-circle-outline"
            title="Lecture auto"
            subtitle="Passer automatiquement à l'épisode suivant"
            rightElement={
              <Switch
                testID="settings-autoplay-switch"
                value={autoPlay}
                onValueChange={setAutoPlay}
                trackColor={{ false: COLORS.surface, true: COLORS.primary }}
                thumbColor="#fff"
              />
            }
          />
          <SettingsItem icon="film-outline" title="Qualité vidéo" subtitle="Automatique (recommandé)" onPress={() => {}} />
          <SettingsItem icon="closed-captioning-outline" title="Sous-titres" subtitle="Français par défaut" onPress={() => {}} />
        </View>

        {/* Community */}
        <SectionHeader title="Communauté" />
        <View style={styles.settingsGroup}>
          <SettingsItem icon="people-outline" title="Gérer les abonnements" onPress={() => {}} />
          <SettingsItem icon="bookmark-outline" title="Ma Watchlist" onPress={() => {}} />
          <SettingsItem icon="trophy-outline" title="Mes badges" subtitle="Voir vos accomplissements" onPress={() => {}} />
        </View>

        {/* About */}
        <SectionHeader title="À propos" />
        <View style={styles.settingsGroup}>
          <SettingsItem icon="document-text-outline" title="Conditions d'utilisation" onPress={() => {}} />
          <SettingsItem icon="shield-checkmark-outline" title="Politique de confidentialité" onPress={() => {}} />
          <SettingsItem icon="help-circle-outline" title="Centre d'aide" onPress={() => {}} />
          <SettingsItem icon="information-circle-outline" title="Version" subtitle="UNIVERSE v1.0.0" />
        </View>

        {/* Logout */}
        <View style={[styles.settingsGroup, { marginTop: 8 }]}>
          <SettingsItem icon="log-out-outline" title="Se déconnecter" onPress={handleLogout} danger />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>UNIVERSE · Cinéma Indépendant</Text>
          <Text style={styles.footerSubText}>Fait avec 💜 pour les artistes</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: SPACING.screenEdge, borderRadius: RADIUS.lg, padding: 16, overflow: 'hidden', marginBottom: 12 },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  profileEmail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  profileRoleBadge: { backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 },
  profileRoleText: { color: '#fff', fontSize: 11 },
  premiumCard: { flexDirection: 'row', marginHorizontal: SPACING.screenEdge, borderRadius: RADIUS.lg, overflow: 'hidden', padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  premiumContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flex: 1 },
  premiumTitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  premiumSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  premiumBtn: { borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 8 },
  premiumBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: COLORS.textTertiary, paddingHorizontal: SPACING.screenEdge, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  settingsGroup: { backgroundColor: COLORS.surface, marginHorizontal: SPACING.screenEdge, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight },
  settingsItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  settingsItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingsItemInfo: { flex: 1 },
  settingsItemTitle: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  settingsItemSub: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  footer: { alignItems: 'center', paddingTop: 32, paddingBottom: 16, gap: 6 },
  footerText: { color: COLORS.textTertiary, fontSize: 13, fontWeight: '600', letterSpacing: 2 },
  footerSubText: { color: COLORS.textTertiary, fontSize: 11 },
});
