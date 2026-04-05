import React, {
    memo, useState, useCallback, useRef,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    TextInput, Modal, Pressable, FlatList, Animated,
    KeyboardAvoidingView, Platform,
  } from 'react-native';
  import { Ionicons }     from '@expo/vector-icons';
  import { LinearGradient }from 'expo-linear-gradient';
  import * as Haptics     from 'expo-haptics';
  
  import { useSocial }  from './SocialContext';
  import { G, ME }      from './types';
  import type { Comment, PostData } from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface CommentRowProps {
    comment: Comment;
    postId:  string;
  }
  
  const CommentRow = memo(function CommentRow({ comment, postId }: CommentRowProps) {
    const { toggleCommentLike } = useSocial();
    const scale = useRef(new Animated.Value(1)).current;
  
    const handleLike = useCallback(() => {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 80, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 12 }),
      ]).start();
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleCommentLike(postId, comment.id);
    }, [comment.id, postId, toggleCommentLike, scale]);
  
    return (
      <View style={s.row}>
        <Image source={{ uri: comment.author.avi }} style={s.avi} />
        <View style={{ flex: 1 }}>
          <View style={s.bubble}>
            <Text style={s.name}>{comment.author.name}</Text>
            <Text style={s.txt}>{comment.text}</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.time}>{comment.time}</Text>
            {comment.likes > 0 && (
              <Text style={s.time}>{comment.likes} j'aime</Text>
            )}
            <TouchableOpacity><Text style={[s.time, { color: G.primary }]}>Répondre</Text></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={handleLike} style={s.likeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons
              name={comment.liked ? 'heart' : 'heart-outline'}
              size={14}
              color={comment.liked ? G.red : 'rgba(237,232,255,0.35)'}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    );
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface Props {
    visible: boolean;
    onClose: () => void;
    post:    PostData | null;
  }
  
  const CommentsModal = memo(function CommentsModal({ visible, onClose, post }: Props) {
    const { addComment } = useSocial();
    const [text, setText]     = useState('');
    const [sending, setSending] = useState(false);
  
    const handleSend = useCallback(async () => {
      if (!post || text.trim().length === 0 || sending) return;
      setSending(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Petit délai simulé "envoi réseau"
      await new Promise(r => setTimeout(r, 300));
      addComment(post.id, text.trim());
      setText('');
      setSending(false);
    }, [post, text, sending, addComment]);
  
    if (!visible || !post) return null;
  
    const commentCount = post.comments.length;
  
    return (
      <Modal
        transparent
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={onClose} />
  
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.kvRoot}
        >
          <View style={s.sheet}>
            {/* Handle */}
            <View style={s.handle} />
  
            {/* Titre */}
            <View style={s.titleRow}>
              <Text style={s.title}>{commentCount} commentaire{commentCount !== 1 ? 's' : ''}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
  
            {/* Séparateur violet */}
            <LinearGradient
              colors={['transparent', G.primary, 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.sep}
            />
  
            {/* Liste des commentaires */}
            <FlatList
              data={post.comments}
              keyExtractor={c => c.id}
              renderItem={({ item }) => <CommentRow comment={item} postId={post.id} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 12 }}
              ListEmptyComponent={
                <View style={s.empty}>
                  <Ionicons name="chatbubble-outline" size={32} color="rgba(255,255,255,0.1)" />
                  <Text style={s.emptyTxt}>Soyez le premier à commenter</Text>
                </View>
              }
              style={{ maxHeight: 340 }}
            />
  
            {/* Barre d'envoi */}
            <View style={s.inputRow}>
              <Image source={{ uri: ME.avi }} style={s.myAvi} />
              <View style={[s.inputBox, text.length > 0 && s.inputBoxActive]}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Votre réponse…"
                  placeholderTextColor="rgba(237,232,255,0.3)"
                  style={s.input}
                  multiline
                  maxLength={400}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={text.trim().length === 0 || sending}
                  style={[s.sendBtn, text.trim().length > 0 && s.sendBtnActive]}
                >
                  <Ionicons
                    name={sending ? 'hourglass' : 'send'}
                    size={16}
                    color={text.trim().length > 0 ? '#000' : 'rgba(237,232,255,0.25)'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  });
  
  export default CommentsModal;
  
  const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
    kvRoot:   { justifyContent: 'flex-end' },
    sheet:    {
      backgroundColor: '#0E0028', borderTopLeftRadius: 26, borderTopRightRadius: 26,
      padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      borderTopWidth: 1, borderColor: 'rgba(192,96,255,0.2)',
    },
    handle:   { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title:    { color: G.sW, fontSize: 16, fontWeight: '800' },
    sep:      { height: 1, marginBottom: 16 },
  
    row:      { flexDirection: 'row', gap: 10, marginBottom: 14, paddingRight: 4 },
    avi:      { width: 34, height: 34, borderRadius: 17 },
    bubble:   { flex: 1, backgroundColor: G.glass, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: G.glassBorder },
    name:     { color: G.sW, fontSize: 12, fontWeight: '700', marginBottom: 3 },
    txt:      { color: 'rgba(237,232,255,0.82)', fontSize: 13, lineHeight: 18 },
    meta:     { flexDirection: 'row', gap: 12, marginTop: 5, paddingLeft: 4 },
    time:     { color: 'rgba(237,232,255,0.35)', fontSize: 11 },
    likeBtn:  { paddingTop: 10, alignSelf: 'flex-start' },
  
    empty:    { alignItems: 'center', paddingVertical: 32, gap: 10 },
    emptyTxt: { color: 'rgba(255,255,255,0.25)', fontSize: 14 },
  
    inputRow:      { flexDirection: 'row', gap: 10, alignItems: 'flex-end', marginTop: 8 },
    myAvi:         { width: 36, height: 36, borderRadius: 18 },
    inputBox:      { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: G.glass, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: G.glassBorder, gap: 10 },
    inputBoxActive:{ borderColor: G.primary },
    input:         { flex: 1, color: '#fff', fontSize: 14, maxHeight: 80 },
    sendBtn:       { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
    sendBtnActive: { backgroundColor: G.primary },
  });