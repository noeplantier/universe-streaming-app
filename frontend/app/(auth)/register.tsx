import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username || !email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Inscription échouée', e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A004D', '#000000']} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity testID="register-back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.logoSmall}>UNIVERSE</Text>
              <Text style={styles.title}>Inscription</Text>
              <Text style={styles.subtitle}>Rejoignez la galaxie du cinéma indépendant 🚀</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom d'utilisateur</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={18} color={COLORS.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    testID="register-username-input"
                    style={styles.input}
                    placeholder="votre_pseudo"
                    placeholderTextColor={COLORS.textTertiary}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoComplete="username"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color={COLORS.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    testID="register-email-input"
                    style={styles.input}
                    placeholder="votre@email.com"
                    placeholderTextColor={COLORS.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color={COLORS.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    testID="register-password-input"
                    style={[styles.input, { flex: 1 }]}
                    placeholder="••••••••"
                    placeholderTextColor={COLORS.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Ionicons name={showPass ? 'eye-off' : 'eye'} size={18} color={COLORS.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                testID="register-submit-btn"
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
                style={{ marginTop: 8 }}
              >
           
              </TouchableOpacity>
            </View>

            <TouchableOpacity testID="register-login-link" onPress={() => router.replace('/(auth)/login')} style={styles.switchLink}>
              <Text style={styles.switchText}>Déjà un compte ? <Text style={styles.switchTextBold}>Se connecter</Text></Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.screenEdge, paddingBottom: 40 },
  backBtn: { padding: 8, marginTop: 8, alignSelf: 'flex-start' },
  header: { marginTop: 20, marginBottom: 36 },
  logoSmall: { fontSize: 14, fontWeight: '900', color: COLORS.primary, letterSpacing: 6, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500', marginLeft: 4 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 16 },
  eyeBtn: { padding: 4 },
  submitBtn: {
    borderRadius: RADIUS.full, paddingVertical: 17, alignItems: 'center',
    shadowColor: '#8C2EBA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6,
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  switchLink: { marginTop: 32, alignItems: 'center' },
  switchText: { color: COLORS.textSecondary, fontSize: 14 },
  switchTextBold: { color: COLORS.primary, fontWeight: '700' },
});
