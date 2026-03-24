import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, FlatList, Image, TouchableOpacity, 
  Platform, Animated 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
// Importation sécurisée
import { DeviceMotion } from 'expo-sensors';
import { Video, ResizeMode } from 'expo-av';
import { COLORS, SIZE, RADIUS, GRADIENTS } from '../../constants/theme';
import { filmsAPI } from '../../services/api';

const { width, height } = Dimensions.get('window');

// Interface des données
interface Film {
  id: string;
  title: string;
  poster_url: string; // URL de l'image
  video_url?: string; // URL de la vidéo (optionnel)
  views_count: number;
  tags?: string[];
  description?: string;
}

// Hook personnalisé pour l'effet Parallax (Sécurisé)
function useDeviceMotion() {
  const [motion, setMotion] = useState({ rotation: { beta: 0, gamma: 0 } });

  useEffect(() => {
    // Vérification de sécurité : ne rien faire sur Web ou si le module est absent
    if (Platform.OS === 'web' || !DeviceMotion?.addListener) {
      return; 
    }

    // Configuration de l'intervalle de mise à jour
    DeviceMotion.setUpdateInterval(50);

    const subscription = DeviceMotion.addListener((data) => {
      setMotion(data);
    });

    return () => {
      subscription && subscription.remove();
    };
  }, []);

  return motion;
}

export default function HomeScreen() {
  const router = useRouter();
  const motion = useDeviceMotion();
  const [films, setFilms] = useState<Film[]>([]);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Données factices pour l'exemple (si l'API est vide/ne répond pas)
  const DUMMY_FILMS: Film[] = [
    {
      id: '1',
      title: 'Neon Dreams',
      poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1000&auto=format&fit=crop',
      views_count: 1240,
      tags: ['Sci-Fi', 'Cyberpunk'],
      description: "Dans un futur où les rêves sont numérisés..."
    },
    {
      id: '2',
      title: 'Lost Signal',
      poster_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?q=80&w=1000&auto=format&fit=crop',
      views_count: 850,
      tags: ['Thriller', 'Espace'],
      description: "Personne ne vous entendra crier..."
    },
    {
      id: '3',
      title: 'Velvet Night',
      poster_url: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1000&auto=format&fit=crop',
      views_count: 2100,
      tags: ['Drame', 'Noir'],
      description: "Une histoire d'amour impossible..."
    },
  ];

  useEffect(() => {
    // Simulation chargement API ou utilisation données factices
    setFilms(DUMMY_FILMS);
  }, []);

  // Calcul de l'effet Parallax basé sur le gyroscope
  const parallaxX = (motion.rotation?.gamma || 0) * 20; // Inclinaison gauche/droite
  const parallaxY = (motion.rotation?.beta || 0) * 10;  // Inclinaison haut/bas

  // Rendu d'une carte de film
  const renderItem = ({ item, index }: { item: Film; index: number }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp'
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.4, 1, 0.4],
      extrapolate: 'clamp'
    });

    return (
      <View style={{ width, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View 
          style={[
            styles.cardContainer, 
            { 
              transform: [
                { scale }, 
                { translateX: parallaxX }, // Effet Parallax X
                { translateY: parallaxY }  // Effet Parallax Y
              ],
              opacity 
            }
          ]}
        >
          {/* Image Poster */}
          <Image 
            source={{ uri: item.poster_url }} 
            style={styles.posterImage}
            resizeMode="cover"
          />
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', '#000']}
            style={styles.cardGradient}
          />

          {/* Info Content */}
          <View style={styles.cardInfo}>
            <View style={styles.tagsRow}>
              {item.tags?.map(tag => (
                <BlurView intensity={20} tint="dark" key={tag} style={styles.tagBlur}>
                  <Text style={styles.tagText}>{tag}</Text>
                </BlurView>
              ))}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardViews}>{item.views_count} vues • 2h 14m</Text>
            
            <TouchableOpacity 
              style={styles.playBtn}
              onPress={() => router.push(`/film/${item.id}`)}
            >
              <LinearGradient
                 colors={GRADIENTS.primary}
                 start={{x:0, y:0}} end={{x:1, y:0}}
                 style={styles.playBtnGradient}
              >
                  <Text style={styles.playBtnText}>Regarder</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Statique */}
      <Image 
        source={{ uri: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop' }} 
        style={[StyleSheet.absoluteFillObject, { opacity: 0.3 }]}
        blurRadius={10}
      />
      <LinearGradient
        colors={[COLORS.background, 'transparent', COLORS.background]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Titre Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>À la une</Text>
        <Text style={styles.headerSubtitle}>Sélection du jour</Text>
      </View>

      {/* Carousel Principal */}
      <Animated.FlatList
        data={films}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center' }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true } // Important pour la performance
        )}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    marginTop: 60,
    marginLeft: 24,
    marginBottom: 10,
  },
  headerTitle: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerSubtitle: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  cardContainer: {
    width: width * 0.85,
    height: height * 0.65,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    
    // Ombres
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tagBlur: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tagText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardViews: {
    color: COLORS.gray,
    fontSize: 14,
    marginBottom: 20,
  },
  playBtn: {
    borderRadius: RADIUS.circle,
    overflow: 'hidden',
  },
  playBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  playBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});