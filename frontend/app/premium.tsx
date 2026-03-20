import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Dimensions, Linking, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';
import { getPremiumStatus, activatePremium, PREMIUM_PLANS, PremiumStatus } from '../services/premium';
import { stripeService, SUBSCRIPTION_PLANS } from '../services/stripe';
import { useAuth } from '../contexts/AuthContext';

const { width } = Dimensions.get('window');

const PREMIUM_FEATURES = [
  { icon: 'ban-outline', title: 'Sans publicité', desc: 'Visionnage ininterrompu' },
  { icon: 'sparkles', title: 'Qualité HD', desc: 'Streaming haute définition' },
  { icon: 'star', title: 'Contenus exclusifs', desc: 'Films réservés Premium' },
  { icon: 'download-outline', title: 'Téléchargement', desc: 'Regardez hors-ligne' },
  { icon: 'people-outline', title: '4 appareils', desc: 'Partage familial' },
  { icon: 'time-outline', title: 'Accès anticipé', desc: 'Nouveautés en avant-première' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string; success?: string; cancelled?: string }>();
  const { user } = useAuth();
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'premium_monthly' | 'premium_annual'>('premium_monthly');
  const [paymentChecking, setPaymentChecking] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  // Check for return from Stripe
  useEffect(() => {
    if (params.session_id && params.success === 'true') {
      checkPaymentStatus(params.session_id);
    }
  }, [params.session_id, params.success]);

  async function loadStatus() {
    const s = await getPremiumStatus();
    setStatus(s);
    setLoading(false);
  }

  async function checkPaymentStatus(sessionId: string) {
    setPaymentChecking(true);
    try {
      stripeService.pollPaymentStatus(
        sessionId,
        async (paymentStatus) => {
          // Payment successful
          const newStatus = await activatePremium(selectedPlan === 'premium_monthly' ? 'premium' : 'premium_annual');
          setStatus(newStatus);
          setPaymentChecking(false);
          Alert.alert(
            '🎉 Bienvenue dans Premium!',
            'Votre abonnement est maintenant actif. Profitez de tous les avantages!',
            [{ text: 'Explorer', onPress: () => router.push('/(tabs)') }]
          );
        },
        (error) => {
          setPaymentChecking(false);
          Alert.alert('Erreur', error.message);
        }
      );
    } catch (e: any) {
      setPaymentChecking(false);
      Alert.alert('Erreur', e.message);
    }
  }

  async function handleActivate() {
    setActivating(true);
    try {
      const originUrl = stripeService.getOriginUrl();
      const session = await stripeService.createCheckoutSession(
        selectedPlan,
        user?.id || 'guest',
        originUrl
      );
      
      // Open Stripe Checkout
      if (Platform.OS === 'web') {
        window.location.href = session.url;
      } else {
        await Linking.openURL(session.url);
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de créer la session de paiement');
      setActivating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <LinearGradient
          colors={['#240056', '#8C2EBA', '#240056']}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroContent}>
              <View style={styles.premiumBadge}>
                <Ionicons name="diamond" size={32} color="#FFD700" />
              </View>
              <Text style={styles.heroTitle}>UNIVERSE Premium</Text>
              <Text style={styles.heroSubtitle}>
                L'expérience cinéma ultime sans compromis
              </Text>

              {status?.isPremium && (
                <View style={styles.activeBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.activeBadgeText}>Abonnement actif</Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Avantages Premium</Text>
          <View style={styles.featuresGrid}>
            {PREMIUM_FEATURES.map((feature, i) => (
              <View key={i} style={styles.featureCard}>
                <LinearGradient
                  colors={['rgba(140,46,186,0.2)', 'rgba(140,46,186,0.05)']}
                  style={styles.featureIconWrap}
                >
                  <Ionicons name={feature.icon as any} size={24} color={COLORS.primary} />
                </LinearGradient>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pricing */}
        {!status?.isPremium && (
          <View style={styles.pricingSection}>
            <Text style={styles.sectionTitle}>Choisissez votre plan</Text>

            {/* Monthly Plan */}
            <TouchableOpacity
              onPress={() => setSelectedPlan('premium')}
              style={[styles.planCard, selectedPlan === 'premium' && styles.planCardSelected]}
            >
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{PREMIUM_PLANS.premium.name}</Text>
                <Text style={styles.planDesc}>Facturation mensuelle</Text>
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.priceValue}>{PREMIUM_PLANS.premium.price}€</Text>
                <Text style={styles.pricePeriod}>/{PREMIUM_PLANS.premium.period}</Text>
              </View>
              {selectedPlan === 'premium' && (
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Annual Plan */}
            <TouchableOpacity
              onPress={() => setSelectedPlan('premium_annual')}
              style={[styles.planCard, selectedPlan === 'premium_annual' && styles.planCardSelected]}
            >
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>-{PREMIUM_PLANS.premium_annual.savings}</Text>
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{PREMIUM_PLANS.premium_annual.name}</Text>
                <Text style={styles.planDesc}>Économisez 2 mois</Text>
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.priceValue}>{PREMIUM_PLANS.premium_annual.price}€</Text>
                <Text style={styles.pricePeriod}>/{PREMIUM_PLANS.premium_annual.period}</Text>
              </View>
              {selectedPlan === 'premium_annual' && (
                <View style={styles.checkMark}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Subscribe Button */}
            <TouchableOpacity onPress={handleActivate} disabled={activating} style={styles.subscribeBtn}>
              <LinearGradient
                colors={GRADIENTS.primary}
                style={styles.subscribeBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {activating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="diamond" size={20} color="#fff" />
                    <Text style={styles.subscribeBtnText}>
                      S'abonner à {selectedPlan === 'premium' ? '3,99€/mois' : '39,99€/an'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.terms}>
              En vous abonnant, vous acceptez nos Conditions d'utilisation.
              Annulation possible à tout moment.
            </Text>
          </View>
        )}

        {/* Already Premium */}
        {status?.isPremium && (
          <View style={styles.premiumActiveSection}>
            <View style={styles.premiumActiveCard}>
              <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              <Text style={styles.premiumActiveTitle}>Vous êtes Premium!</Text>
              <Text style={styles.premiumActiveDesc}>
                Profitez de tous les avantages exclusifs.{'\n'}
                Abonnement valide jusqu'au {new Date(status.expiresAt!).toLocaleDateString('fr-FR')}
              </Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.exploreBtn}>
                <Text style={styles.exploreBtnText}>Explorer les contenus exclusifs</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Comparison Table */}
        <View style={styles.comparisonSection}>
          <Text style={styles.sectionTitle}>Comparaison</Text>
          <View style={styles.comparisonTable}>
            <View style={styles.comparisonHeader}>
              <Text style={styles.comparisonHeaderText}>Fonctionnalité</Text>
              <Text style={styles.comparisonHeaderText}>Gratuit</Text>
              <Text style={[styles.comparisonHeaderText, { color: COLORS.primary }]}>Premium</Text>
            </View>
            {[
              { name: 'Accès au catalogue', free: '✓', premium: '✓' },
              { name: 'Publicités', free: 'Oui', premium: 'Non' },
              { name: 'Qualité vidéo', free: 'SD', premium: 'HD/4K' },
              { name: 'Téléchargement', free: '✗', premium: '✓' },
              { name: 'Contenus exclusifs', free: '✗', premium: '✓' },
              { name: 'Appareils', free: '1', premium: '4' },
            ].map((row, i) => (
              <View key={i} style={styles.comparisonRow}>
                <Text style={styles.comparisonName}>{row.name}</Text>
                <Text style={styles.comparisonValue}>{row.free}</Text>
                <Text style={[styles.comparisonValue, { color: COLORS.primary }]}>{row.premium}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  header: { paddingBottom: 32 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.screenEdge, paddingVertical: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 20 },
  heroContent: { alignItems: 'center', paddingHorizontal: SPACING.screenEdge, paddingTop: 16 },
  premiumBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,215,0,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(76,217,100,0.2)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6, marginTop: 16 },
  activeBadgeText: { color: COLORS.success, fontSize: 13, fontWeight: '600' },
  featuresSection: { padding: SPACING.screenEdge, paddingTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: { width: (width - SPACING.screenEdge * 2 - 12) / 2, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight },
  featureIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  featureTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 11, color: COLORS.textTertiary },
  pricingSection: { padding: SPACING.screenEdge },
  planCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: COLORS.borderLight, position: 'relative' },
  planCardSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(140,46,186,0.1)' },
  planInfo: { flex: 1 },
  planName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  planDesc: { fontSize: 12, color: COLORS.textTertiary, marginTop: 2 },
  planPrice: { flexDirection: 'row', alignItems: 'baseline' },
  priceValue: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  pricePeriod: { fontSize: 13, color: COLORS.textTertiary },
  checkMark: { position: 'absolute', top: 12, right: 12 },
  savingsBadge: { position: 'absolute', top: -8, right: 12, backgroundColor: COLORS.success, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  savingsText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  subscribeBtn: { marginTop: 8 },
  subscribeBtnGrad: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: RADIUS.full },
  subscribeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  terms: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'center', marginTop: 12, lineHeight: 16 },
  premiumActiveSection: { padding: SPACING.screenEdge },
  premiumActiveCard: { backgroundColor: 'rgba(76,217,100,0.1)', borderRadius: RADIUS.lg, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(76,217,100,0.3)' },
  premiumActiveTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 },
  premiumActiveDesc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  exploreBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  comparisonSection: { padding: SPACING.screenEdge },
  comparisonTable: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.borderLight },
  comparisonHeader: { flexDirection: 'row', backgroundColor: 'rgba(140,46,186,0.1)', padding: 12 },
  comparisonHeaderText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  comparisonRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  comparisonName: { flex: 1, fontSize: 13, color: COLORS.textPrimary },
  comparisonValue: { flex: 1, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
