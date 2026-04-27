import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
  View, Text, StyleSheet, Modal, Animated, Pressable,
  KeyboardAvoidingView, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Platform, Image,
} from 'react-native';
import { BlurView }  from 'expo-blur';
import { Ionicons }  from '@expo/vector-icons';
import * as Haptics  from 'expo-haptics';
import { C, EDGE }   from './SocialTokens';
import type { Pro }  from './SocialTypes';
import { dbContactPro } from '@/hooks/usePostsFeed';

interface Props { pro: Pro | null; onClose: () => void }

const CONTACT_SUBJECTS = [
  'Collaboration projet', 'Casting', 'Co-production',
  'Mentorat', 'Projection / Festival', 'Autre',
] as const;

export default function ContactProModal({ pro, onClose }: Props) {
  const [subject,      setSubject]      = useState('');
  const [message,      setMessage]      = useState('');
  const [senderEmail,  setSenderEmail]  = useState('');
  const [sending,      setSending]      = useState(false);
  const [sent,         setSent]         = useState(false);
  const slideAnim = useRef(new Animated.Value(900)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const visible = !!pro;

  useEffect(() => {
    if (visible) {
      setSubject(''); setMessage(''); setSenderEmail(''); setSent(false);
      Animated.spring(slideAnim, { toValue: 0, tension: 58, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 900, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleSend = useCallback(async () => {
    if (!pro) return;
    if (!subject)                  { Alert.alert('Sujet requis', 'Choisissez un sujet.'); return; }
    if (message.trim().length < 30) { Alert.alert('Message trop court', 'Minimum 30 caractères.'); return; }
    if (!senderEmail.includes('@')) { Alert.alert('Email invalide', 'Renseignez un email valide.'); return; }

    setSending(true);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const ok = await dbContactPro(pro.id, subject, message.trim(), senderEmail.trim());
    setSending(false);

    if (ok) {
      setSent(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(successScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
      setTimeout(() => { setSent(false); onClose(); }, 2200);
    } else {
      Alert.alert('Erreur', 'Envoi impossible. Vérifiez votre connexion.');
    }
  }, [pro, subject, message, senderEmail, onClose]);

  if (!pro) return null;

  const canSend = !!subject && message.trim().length >= 30 && senderEmail.includes('@');

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View style={s.tint} pointerEvents="none" />

            {sent ? (
              /* ── SUCCESS ── */
              <View style={s.successWrap}>
                <Animated.View style={[s.successIcon, { transform: [{ scale: successScale }] }]}>
                  <Ionicons name="checkmark-circle" size={56} color={C.green} />
                </Animated.View>
                <Text style={s.successTitle}>Message envoyé !</Text>
                <Text style={s.successSub}>
                  {pro.name} recevra votre message et vous répondra par email.
                </Text>
              </View>
            ) : (
              <View style={s.inner}>
                {/* Handle */}
                <View style={s.handle} />

                {/* Header */}
                <View style={s.topRow}>
                  <View style={s.proPreview}>
                    <Image
                      source={{ uri: pro.avatar ?? `https://i.pravatar.cc/80?u=${pro.id}` }}
                      style={s.proAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={s.proName} numberOfLines={1}>{pro.name}</Text>
                      <Text style={s.proRole}>{pro.role}</Text>
                    </View>
                    {pro.verified && (
                      <View style={s.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={C.blue} />
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={8 as any}>
                    <Ionicons name="close" size={15} color={C.textSec} />
                  </TouchableOpacity>
                </View>

                <View style={s.divider} />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.scroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Subject chips */}
                  <Text style={s.label}>SUJET *</Text>
                  <View style={s.subjectGrid}>
                    {CONTACT_SUBJECTS.map(sub => {
                      const on = subject === sub;
                      return (
                        <TouchableOpacity
                          key={sub}
                          style={[s.subjectChip, on && s.subjectChipOn]}
                          onPress={() => setSubject(on ? '' : sub)}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.subjectTxt, on && s.subjectTxtOn]}>{sub}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Message */}
                  <Text style={[s.label, { marginTop: 18 }]}>VOTRE MESSAGE * <Text style={s.minTxt}>(min 30 car.)</Text></Text>
                  <View style={s.textareaWrap}>
                    <TextInput
                      style={s.textarea}
                      multiline
                      textAlignVertical="top"
                      placeholder={`Bonjour ${pro.name.split(' ')[0]},\n\nJe vous contacte au sujet de…`}
                      placeholderTextColor={C.textTert}
                      value={message}
                      onChangeText={setMessage}
                      maxLength={800}
                    />
                    <Text style={[s.charCount, message.trim().length >= 30 && { color: C.green }]}>
                      {message.trim().length}/800
                    </Text>
                  </View>

                  {/* Email */}
                  <Text style={[s.label, { marginTop: 18 }]}>VOTRE EMAIL *</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="mail-outline" size={15} color={C.textTert} />
                    <TextInput
                      style={s.input}
                      placeholder="votre@email.com"
                      placeholderTextColor={C.textTert}
                      value={senderEmail}
                      onChangeText={setSenderEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="send"
                    />
                  </View>

                  {/* Privacy note */}
                  <View style={s.privacyNote}>
                    <Ionicons name="shield-checkmark-outline" size={12} color={C.textTert} />
                    <Text style={s.privacyTxt}>
                      Votre email n'est transmis qu'au professionnel contacté. Il n'est jamais affiché publiquement.
                    </Text>
                  </View>

                  <View style={{ height: 20 }} />
                </ScrollView>

                {/* Footer */}
                <View style={s.footer}>
                  <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                    <Text style={s.cancelTxt}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.sendBtn, !canSend && { opacity: 0.38 }, sending && { opacity: 0.55 }]}
                    onPress={handleSend}
                    disabled={!canSend || sending}
                    activeOpacity={0.85}
                  >
                    {sending
                      ? <ActivityIndicator color={C.white} size="small" />
                      : <>
                          <Ionicons name="send" size={14} color={C.white} />
                          <Text style={s.sendTxt}>Envoyer</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex:1, justifyContent:'flex-end', backgroundColor:'rgba(2,8,16,0.84)' },
  kav:          { flex:1, justifyContent:'flex-end' },
  sheet:        { maxHeight:'90%', borderTopLeftRadius:28, borderTopRightRadius:28, overflow:'hidden', borderWidth:1, borderColor:C.border },
  tint:         { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(6,15,30,0.65)' },
  inner:        { flex:1 },
  handle:       { width:38, height:4, borderRadius:2, backgroundColor:C.navyLight, alignSelf:'center', marginTop:12, marginBottom:4 },
  topRow:       { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingTop:10, paddingBottom:14, gap:12 },
  proPreview:   { flex:1, flexDirection:'row', alignItems:'center', gap:12 },
  proAvatar:    { width:44, height:44, borderRadius:22, borderWidth:1.5, borderColor:'rgba(255,255,255,0.12)' },
  proName:      { color:C.text, fontSize:15, fontWeight:'800', flexShrink:1 },
  proRole:      { color:C.blue, fontSize:11, fontWeight:'700', marginTop:2 },
  verifiedBadge:{ width:26, height:26, borderRadius:13, backgroundColor:C.blueDim, alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:C.borderBlue },
  closeBtn:     { width:30, height:30, borderRadius:15, backgroundColor:C.surf, borderWidth:1, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  divider:      { height:0.5, backgroundColor:C.border, marginHorizontal:20 },
  scroll:       { paddingHorizontal:20, paddingTop:18 },
  label:        { color:C.textSec, fontSize:10, fontWeight:'700', letterSpacing:0.8, marginBottom:10, textTransform:'uppercase' },
  minTxt:       { color:C.textTert, fontWeight:'400', fontSize:9 },
  subjectGrid:  { flexDirection:'row', flexWrap:'wrap', gap:8 },
  subjectChip:  { paddingHorizontal:13, paddingVertical:8, borderRadius:20, backgroundColor:C.surf, borderWidth:1, borderColor:C.border },
  subjectChipOn:{ backgroundColor:C.navyLight, borderColor:C.borderBlue },
  subjectTxt:   { color:C.textSec, fontSize:12, fontWeight:'600' },
  subjectTxtOn: { color:C.blue, fontWeight:'700' },
  textareaWrap: { backgroundColor:C.surf, borderRadius:14, borderWidth:1, borderColor:C.border, overflow:'hidden' },
  textarea:     { paddingHorizontal:14, paddingVertical:13, color:C.text, fontSize:14, minHeight:130, lineHeight:22 },
  charCount:    { color:C.textTert, fontSize:10, textAlign:'right', paddingHorizontal:14, paddingBottom:8 },
  inputWrap:    { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.surf, borderRadius:14, borderWidth:1, borderColor:C.border, paddingHorizontal:14, paddingVertical:13 },
  input:        { flex:1, color:C.text, fontSize:14 },
  privacyNote:  { flexDirection:'row', alignItems:'flex-start', gap:7, marginTop:14, paddingHorizontal:12, paddingVertical:10, borderRadius:12, backgroundColor:C.surf, borderWidth:0.5, borderColor:C.border },
  privacyTxt:   { flex:1, color:C.textTert, fontSize:11, lineHeight:16 },
  footer:       { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingTop:14, paddingBottom:Platform.OS === 'ios' ? 34 : 18, borderTopWidth:0.5, borderTopColor:C.border },
  cancelBtn:    { paddingHorizontal:18, paddingVertical:13, borderRadius:18, backgroundColor:C.surf, borderWidth:1, borderColor:C.border },
  cancelTxt:    { color:C.textSec, fontSize:14, fontWeight:'600' },
  sendBtn:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:14, borderRadius:18, backgroundColor:C.navyBright, borderWidth:1, borderColor:C.borderBlue },
  sendTxt:      { color:C.white, fontSize:15, fontWeight:'700' },
  // Success
  successWrap:  { flex:1, alignItems:'center', justifyContent:'center', padding:40, gap:14 },
  successIcon:  {},
  successTitle: { color:C.text, fontSize:20, fontWeight:'800' },
  successSub:   { color:C.textSec, fontSize:14, textAlign:'center', lineHeight:21 },
});
