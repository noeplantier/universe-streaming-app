// app/create.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Image, Animated, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';

// ═══════════════════════════════════
// PALETTE (copie feed)
// ═══════════════════════════════════
const G = {
  bg0: '#060010',
  primL: '#C060FF',
  t1: '#F0E8FF',
  t2: 'rgba(240,232,255,0.65)',
  glass: 'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.12)',
};

// ═══════════════════════════════════
// SCREEN
// ═══════════════════════════════════
export default function CreateScreen() {
  const [mode, setMode] = useState<'video' | 'critique'>('video');
  const [video, setVideo] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;

  // animation bouton
  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  };

  // pick video
  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });

    if (!res.canceled) {
      setVideo(res.assets[0].uri);
    }
  };

  const publish = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>

        {/* HEADER */}
        <Text style={styles.header}>Créer</Text>

        {/* SWITCH */}
        <View style={styles.switch}>
          {['video', 'critique'].map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m as any)}
              style={[
                styles.switchBtn,
                mode === m && styles.switchActive
              ]}
            >
              <Ionicons
                name={m === 'video' ? 'videocam' : 'document-text'}
                size={18}
                color="#fff"
              />
              <Text style={styles.switchTxt}>
                {m === 'video' ? 'Vidéo' : 'Critique'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* UPLOAD */}
        <TouchableOpacity style={styles.upload} onPress={pickVideo}>
          {video ? (
            <>
              <Video
                source={{ uri: video }}
                style={styles.video}
                resizeMode="cover"
                isLooping
                shouldPlay
              />
              <TouchableOpacity
                style={styles.delete}
                onPress={() => setVideo(null)}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="videocam" size={28} color={G.primL} />
              <Text style={styles.uploadTxt}>
                Ajouter une vidéo
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* INPUTS */}
        <BlurView intensity={30} style={styles.input}>
          <TextInput
            placeholder="Titre"
            placeholderTextColor={G.t2}
            value={title}
            onChangeText={setTitle}
            style={styles.txt}
          />
        </BlurView>

        <BlurView intensity={30} style={[styles.input, { height: 120 }]}>
          <TextInput
            placeholder="Description..."
            placeholderTextColor={G.t2}
            value={desc}
            onChangeText={setDesc}
            multiline
            style={styles.txt}
          />
        </BlurView>

        {/* BUTTON */}
        <Animated.View style={{ transform: [{ scale }] }}>
          <TouchableOpacity
            onPress={publish}
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={loading}
          >
            <LinearGradient
              colors={['#8B2FCC', '#B855FF']}
              style={styles.btn}
            >
              <Text style={styles.btnTxt}>
                {loading ? 'Publication...' : 'Publier'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════
// STYLES
// ═══════════════════════════════════
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg0 },

  header: {
    color: '#fff',
    fontSize: 28,
    textAlign: 'center',
    marginVertical: 20,
    fontWeight: '800'
  },

  switch: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: G.glass,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20
  },

  switchBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10
  },

  switchActive: {
    backgroundColor: '#8B2FCC'
  },

  switchTxt: {
    color: '#fff',
    fontWeight: '600'
  },

  upload: {
    height: 220,
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: G.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 20
  },

  uploadTxt: {
    color: G.t2,
    marginTop: 10
  },

  video: {
    width: '100%',
    height: '100%'
  },

  delete: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 6
  },

  input: {
    marginHorizontal: 20,
    borderRadius: 14,
    padding: 14,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: G.glassBorder
  },

  txt: {
    color: '#fff'
  },

  btn: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10
  },

  btnTxt: {
    color: '#fff',
    fontWeight: '700'
  }
});