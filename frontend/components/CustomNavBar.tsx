// app/components/CustomNavBar.tsx
import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const COLORS = {
  accent: '#A855F7',
};

// ─────────────────────────────────────────────────────────────────────────────
// 🔹 NAV ITEM (memoized)
// ─────────────────────────────────────────────────────────────────────────────
type NavItemProps = {
  icon: React.ReactNode;
  label?: string;
  onPress: () => void;
};

const NavItem = memo(({ icon, label, onPress }: NavItemProps) => {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      {label && <Text style={styles.navLabel}>{label}</Text>}
    </TouchableOpacity>
  );
});

NavItem.displayName = 'NavItem';

// ─────────────────────────────────────────────────────────────────────────────
// 🚀 MAIN NAVBAR
// ─────────────────────────────────────────────────────────────────────────────
function CustomNavBar() {
  const router = useRouter();

  const navigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        
        <NavItem
          icon={<Ionicons name="home" size={24} color="white" />}
          label="Accueil"
          onPress={() => navigate('/search')}
        />

        <NavItem
          icon={<MaterialCommunityIcons name="play-box-multiple" size={24} color="white" />}
          label="Véloces"
          onPress={() => navigate('/')}
        />

        {/* 🌟 CENTER CTA */}
        <TouchableOpacity
          style={styles.centerButton}
          onPress={() => navigate('/create')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="star-four-points" size={36} color="white" />
        </TouchableOpacity>

        <NavItem
          icon={<Ionicons name="people" size={24} color="white" />}
          label="Amies"
          onPress={() => navigate('/social')}
        />

        <NavItem
          icon={
            <Image
              source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s',}}
              style={styles.profile}
            />
          }
          label="Profil"
          onPress={() => navigate('/profile')}
        />

      </BlurView>
    </View>
  );
}

export default memo(CustomNavBar);

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 STYLES
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 12,
      left: 10,
      right: 10,
      height: 70,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      zIndex: 999, 
  
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 20,
    },

  blur: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingTop: 8,
  },

  navLabel: {
    color: 'white',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },

  centerButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: 4,
    justifyContent: 'center',
    alignItems: 'center',

    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',

    shadowColor: COLORS.accent,
    shadowRadius: 10,
    shadowOpacity: 0.6,
    elevation: 10,
  },

  profile: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
});