import React, {
    memo, useState, useEffect, useCallback,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    TextInput, Modal, Pressable, ScrollView,
    KeyboardAvoidingView, Platform,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { BlurView }       from 'expo-blur';
  import { Ionicons }       from '@expo/vector-icons';
  import { SafeAreaView }   from 'react-native-safe-area-context';
  import * as Haptics       from 'expo-haptics';
  
  import { useSettings }           from './SettingsContext';
  import { G, ROLE_META }          from './types';
  import type { UserRole }         from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface Props {
    visible: boolean;
    onClose: () => void;
  }
  
  const ROLES: UserRole[] = ['director', 'critic', 'dop', 'viewer'];
  
  const EditProfileModal = memo(function EditProfileModal({ visible, onClose }: Props) {
    const { user, updateProfile } = useSettings();
  
    const [username, setUsername] = useState(user.username);
    const [bio,      setBio]      = useState(user.bio);
    const [role,     setRole]     = useState<UserRole>(user.role);
    const [saving,   setSaving]   = useState(false);
  
    // Sync si user change depuis l'extérieur
    useEffect(() => {
      if (visible) {
        setUsername(user.username);
        setBio(user.bio);
        setRole(user.role);
      }
    }, [visible, user]);
  
    const handleSave = useCallback(async () => {
      if (!username.trim() || saving) return;
      setSaving(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Simule un appel réseau
      await new Promise(r => setTimeout(r, 350));
      updateProfile({ username: username.trim(), bio: bio.trim(), role });
      setSaving(false);
      onClose();
    }, [username, bio, role, saving, updateProfile, onClose]);
  
    const canSave = username.trim().length >= 2 && !saving;
  
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <Pressable style={s.backdrop} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.kv}
        >
          <View style={s.sheet}>
            {/* Handle */}
            <View style={s.handle} />
  
            {/* Titre */}
            <View style={s.topBar}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={s.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <Text style={s.sheetTitle}>Modifier le profil</Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                style={[s.saveBtn, canSave && s.saveBtnActive]}
              >
                <Text style={[s.saveTxt, canSave && s.saveTxtActive]}>
                  {saving ? '…' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
  
            <LinearGradient
              colors={['transparent', 'rgba(192,96,255,0.22)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.sep}
            />
  
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
  
              {/* Avatar */}
              <View style={s.avatarSection}>
                <LinearGradient
                  colors={['#C060FF', '#86EEFF', '#FFD60A']}
                  start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
                  style={s.avatarRing}
                >
                  <View style={s.avatarInner}>
                    <Image source={{ uri: user.avatar_url }} style={s.avatar} />
                  </View>
                </LinearGradient>
                <TouchableOpacity style={s.changeAviBtn} activeOpacity={0.85}>
                  <Text style={s.changeAviTxt}>Changer la photo</Text>
                </TouchableOpacity>
              </View>
  
              {/* Champs */}
              <View style={s.fields}>
                {/* Username */}
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Nom d'utilisateur</Text>
                  <View style={s.inputWrap}>
                    <Text style={s.at}>@</Text>
                    <TextInput
                      value={username}
                      onChangeText={setUsername}
                      style={s.input}
                      placeholderTextColor={G.textTert}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={30}
                    />
                    <Text style={[s.charCount, username.length > 25 && { color: G.gold }]}>
                      {30 - username.length}
                    </Text>
                  </View>
                </View>
  
                {/* Bio */}
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Bio</Text>
                  <View style={[s.inputWrap, s.bioWrap]}>
                    <TextInput
                      value={bio}
                      onChangeText={setBio}
                      style={[s.input, s.bioInput]}
                      placeholderTextColor={G.textTert}
                      placeholder="Parlez de votre rapport au cinéma…"
                      multiline
                      maxLength={160}
                      textAlignVertical="top"
                    />
                  </View>
                  <Text style={s.bioCount}>{bio.length}/160</Text>
                </View>
  
                {/* Rôle */}
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Rôle dans le cinéma</Text>
                  <View style={s.roleGrid}>
                    {ROLES.map(r => {
                      const meta  = ROLE_META[r];
                      const on    = role === r;
                      return (
                        <TouchableOpacity
                          key={r}
                          onPress={() => setRole(r)}
                          style={[s.roleOption, on && s.roleOptionOn]}
                          activeOpacity={0.8}
                        >
                          {on && (
                            <LinearGradient
                              colors={[`${meta.color}20`, `${meta.color}08`]}
                              style={StyleSheet.absoluteFill}
                            />
                          )}
                          <Text style={s.roleEmoji}>{meta.emoji}</Text>
                          <Text style={[s.roleLabel, on && { color: meta.color }]}>
                            {meta.label}
                          </Text>
                          {on && (
                            <View style={[s.roleCheck, { backgroundColor: meta.bg, borderColor: meta.color }]}>
                              <Ionicons name="checkmark" size={9} color={meta.color} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  });
  
  export default EditProfileModal;
  
  const s = StyleSheet.create({
    backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    kv:         { justifyContent: 'flex-end' },
    sheet:      { backgroundColor: '#0E0028', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%', borderTopWidth: 1, borderColor: 'rgba(192,96,255,0.2)', paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
    handle:     { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 14, marginBottom: 4 },
  
    topBar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
    cancelTxt:  { color: 'rgba(237,232,255,0.45)', fontSize: 15, fontWeight: '600' },
    sheetTitle: { color: G.sW, fontSize: 16, fontWeight: '800' },
    saveBtn:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)' },
    saveBtnActive:{ backgroundColor: G.primary },
    saveTxt:    { color: 'rgba(237,232,255,0.35)', fontSize: 14, fontWeight: '700' },
    saveTxtActive:{ color: '#fff' },
    sep:        { height: 1 },
  
    avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 14 },
    avatarRing:    { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
    avatarInner:   { width: 82, height: 82, borderRadius: 41, overflow: 'hidden', backgroundColor: G.bg0 },
    avatar:        { width: '100%', height: '100%' },
    changeAviBtn:  { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: G.primaryDim, borderRadius: 99, borderWidth: 1, borderColor: G.borderActive },
    changeAviTxt:  { color: G.primary, fontSize: 13, fontWeight: '700' },
  
    fields:     { paddingHorizontal: 20, gap: 20, paddingBottom: 20 },
    field:      { gap: 8 },
    fieldLabel: { color: 'rgba(237,232,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: G.glass, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, paddingHorizontal: 14, height: 48, gap: 6 },
    bioWrap:    { height: 100, alignItems: 'flex-start', paddingVertical: 12 },
    at:         { color: G.primary, fontSize: 16, fontWeight: '700' },
    input:      { flex: 1, color: G.sW, fontSize: 15 },
    bioInput:   { height: 76 },
    charCount:  { color: G.textTert, fontSize: 11, fontWeight: '600' },
    bioCount:   { color: G.textTert, fontSize: 11, textAlign: 'right' },
  
    roleGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    roleOption:    { flex: 1, minWidth: '45%', alignItems: 'center', paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, backgroundColor: G.glass, gap: 6, overflow: 'hidden', position: 'relative' },
    roleOptionOn:  { borderColor: 'rgba(192,96,255,0.45)' },
    roleEmoji:     { fontSize: 22 },
    roleLabel:     { color: 'rgba(237,232,255,0.55)', fontSize: 12, fontWeight: '700' },
    roleCheck:     { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  });