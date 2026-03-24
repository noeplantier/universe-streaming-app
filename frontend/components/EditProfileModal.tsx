import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';

interface User {
  id: string; username: string; email: string; avatar_url: string;
  bio: string; role: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  user: User;
  onSave: (data: { username: string; bio: string }) => Promise<void>;
}

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=150&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&q=80',
];

export default function EditProfileModal({ visible, onClose, user, onSave }: Props) {
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar_url);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!username.trim()) {
      Alert.alert('Erreur', 'Le nom d\'utilisateur est requis');
      return;
    }
    setSaving(true);
    try {
      await onSave({ username: username.trim(), bio: bio.trim() });
      onClose();
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.title}>Modifier le profil</Text>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.saveBtnText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Current Avatar */}
              <View style={styles.avatarSection}>
                <View style={styles.currentAvatarWrap}>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Image source={{ uri: selectedAvatar }} style={styles.currentAvatar} />
                  </LinearGradient>
                  <View style={styles.editAvatarBadge}>
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </View>
                <Text style={styles.changeAvatarText}>Changer la photo</Text>
              </View>

              {/* Avatar Options */}
              <View style={styles.avatarOptions}>
                {AVATAR_OPTIONS.map((url, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setSelectedAvatar(url)}
                    style={[styles.avatarOption, selectedAvatar === url && styles.avatarOptionSelected]}
                  >
                    <Image source={{ uri: url }} style={styles.avatarOptionImg} />
                    {selectedAvatar === url && (
                      <View style={styles.avatarCheck}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Username */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nom d&aposutilisateur</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={COLORS.textTertiary} />
                  <TextInput
                    testID="edit-username-input"
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Votre nom d'utilisateur"
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="none"
                    maxLength={30}
                  />
                </View>
              </View>

              {/* Bio */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <View style={[styles.inputWrap, { alignItems: 'flex-start', minHeight: 100 }]}>
                  <Ionicons name="document-text-outline" size={18} color={COLORS.textTertiary} style={{ marginTop: 12 }} />
                  <TextInput
                    testID="edit-bio-input"
                    style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Parlez de vous et de votre passion pour le cinéma..."
                    placeholderTextColor={COLORS.textTertiary}
                    multiline
                    maxLength={150}
                  />
                </View>
                <Text style={styles.charCount}>{bio.length}/150</Text>
              </View>

              {/* Role (read-only) */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rôle</Text>
                <View style={styles.roleDisplay}>
                  <Text style={styles.roleText}>
                    {user.role === 'director' ? '🎬 Réalisateur' : user.role === 'critic' ? '✍️ Critique' : user.role === 'creator' ? '⭐ Créateur' : '👁️ Spectateur'}
                  </Text>
                  <Text style={styles.roleNote}>Contactez-nous pour changer de rôle</Text>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity testID="edit-save-btn" onPress={handleSave} disabled={saving} style={styles.saveButton}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnGradText}>Enregistrer les modifications</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#0B0014',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.screenEdge,
    paddingBottom: 40,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, marginBottom: 16 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  saveBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  avatarSection: { alignItems: 'center', marginBottom: 20 },
  currentAvatarWrap: { position: 'relative', marginBottom: 8 },
  avatarRing: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  currentAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.background },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  changeAvatarText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  avatarOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24 },
  avatarOption: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  avatarOptionSelected: { borderColor: COLORS.primary },
  avatarOptionImg: { width: '100%', height: '100%' },
  avatarCheck: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.background },
  inputGroup: { marginBottom: 20 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: RADIUS.md, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.textPrimary, fontSize: 15, paddingVertical: 14 },
  charCount: { color: COLORS.textTertiary, fontSize: 11, textAlign: 'right', marginTop: 4 },
  roleDisplay: { backgroundColor: 'rgba(140,46,186,0.1)', borderRadius: RADIUS.md, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  roleText: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  roleNote: { color: COLORS.textTertiary, fontSize: 11 },
  saveButton: { marginTop: 8, marginBottom: 20 },
  saveBtnGrad: { borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center' },
  saveBtnGradText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
