import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZE, RADIUS, GRADIENTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // ─── LOGIQUE CENTRALE DE CONNEXION ─────────────────────────────────────────
  
  /**
   * Exécute l'appel API de connexion.
   * Accepte les arguments directement pour contourner l'asynchronicité du State React.
   */
  async function performLogin(emailArg: string, passwordArg: string, isDemo: boolean = false) {
    if (isDemo) setIsDemoLoading(true);
    else setLoading(true);

    try {
      // Nettoyage basique
      const cleanEmail = emailArg.trim().toLowerCase();
      
      // Appel au contexte d'auth
      await login(cleanEmail, passwordArg);
      
      // Redirection immédiate
      router.replace('/(tabs)');
      
    } catch (e: any) {
      console.error("Login Error:", e);
      Alert.alert(
        'Échec de connexion',
        e.message || 'Impossible de se connecter au serveur.'
      );
    } finally {
      setLoading(false);
      setIsDemoLoading(false);
    }
  }

  // ─── HANDLERS ──────────────────────────────────────────────────────────────

  // Connexion standard (utilisateur tape ses infos)
  const handleStandardLogin = () => {
    if (!email || !password) {
      Alert.alert('Champs manquants', 'Veuillez entrer votre email et mot de passe.');
      return;
    }
    performLogin(email, password, false);
  };

  // Connexion Démo (Valeurs en dur + exécution immédiate)
  const handleDemoLogin = () => {
    const demoEmail = 'demo@universe.com';
    const demoPass = 'demo123';

    // 1. Mise à jour visuelle des champs (UX)
    setEmail(demoEmail);
    setPassword(demoPass);

    // 2. Exécution Logique immédiate (ne pas attendre le State)
    performLogin(demoEmail, demoPass, true);
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Fond dégradé global */}
      <LinearGradient 
        colors={[COLORS.backgroundDeep || '#000', COLORS.background || '#111']} 
        style={StyleSheet.absoluteFillObject} 
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent} 
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary || '#888'} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.logoSmall}>UNIVERSE</Text>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.subtitle}>Explorez l'inconnu.</Text>
            </View>

            {/* Formulaire */}
            <View style={styles.form}>
              
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.textTertiary || '#666'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={COLORS.textDisabled || '#555'}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.textTertiary || '#666'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textDisabled || '#555'}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Ionicons 
                      name={showPass ? 'eye-off' : 'eye'} 
                      size={20} 
                      color={COLORS.textTertiary || '#666'} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Bouton de Connexion */}
              <TouchableOpacity
                onPress={handleStandardLogin}
                disabled={loading || isDemoLoading}
                style={[styles.btnContainer, { marginTop: 10 }]}
                activeOpacity={0.8}
              >
            
              </TouchableOpacity>

              {/* Bouton Démo Spécial */}
              <TouchableOpacity
                onPress={handleDemoLogin}
                disabled={loading || isDemoLoading}
                style={styles.demoBtn}
                activeOpacity={0.7}
              >
                 {isDemoLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.demoBtnText}>Utiliser le compte Démo</Text>
                  )}
              </TouchableOpacity>

            </View>

            {/* Switch Registration */}
            <TouchableOpacity onPress={() => router.replace('/(auth)/register')} style={styles.footerLink}>
              <Text style={styles.footerText}>
                Pas encore de compte ? <Text style={styles.footerTextBold}>S'inscrire</Text>
              </Text>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#000',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SIZE.padding || 24,
    paddingBottom: 40,
  },
  backBtn: {
    marginTop: 10,
    padding: 8,
    alignSelf: 'flex-start',
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
  },
  logoSmall: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.textPrimary || '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary || '#AAA',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary || '#CCC',
    marginLeft: 4,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface || '#1A1A1A',
    borderWidth: 1,
    borderColor: COLORS.borderLight || '#333',
    borderRadius: RADIUS.m || 12,
    height: 56,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary || '#FFF',
    fontSize: 16,
    height: '100%',
  },
  eyeBtn: {
    padding: 8,
  },
  btnContainer: {
    borderRadius: RADIUS.circle || 99,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  gradientBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  demoBtn: {
    marginTop: 0,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border || '#333',
    borderRadius: RADIUS.circle || 99,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  demoBtnText: {
    fontSize: 14,
    color: COLORS.textSecondary || '#AAA',
    fontWeight: '600',
  },
  footerLink: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textTertiary || '#666',
    fontSize: 14,
  },
  footerTextBold: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});