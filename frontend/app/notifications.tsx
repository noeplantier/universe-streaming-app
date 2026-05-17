import React, { useState, useEffect, useCallback } from 'react';
import {
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../constants/theme';
import api from '../services/api';
import GalaxyBackground from '@/components/social/GalaxyBackground';
import { useAuth } from '../contexts/AuthContext'; 
import { C } from './(tabs)/create';

// Types d'actions possibles depuis profile.tsx et social.tsx
export type NotifType = 
  | 'like' 
  | 'follow' 
  | 'new_film' 
  | 'comment' 
  | 'review_like' 
  | 'mention'
  | 'seen_film'
  | 'system';

interface Notif {
  id: string; 
  type: NotifType; 
  title: string;       
  body: string;        
  data?: any;          
  read: boolean; 
  created_at: string; 
  avatar?: string;
}

const NOTIF_ICONS: Record<NotifType, { icon: string; color: string }> = {
  like:         { icon: 'heart',                 color: '#FF3B30' },
  follow:       { icon: 'person-add',            color: COLORS.primary },
  new_film:     { icon: 'film',                  color: COLORS.success || '#34C759' },
  comment:      { icon: 'chatbubble',            color: '#60A5FA' },
  review_like:  { icon: 'star',                  color: '#FFD60A' },
  mention:      { icon: 'at',                    color: '#FF9F0A' },
  seen_film:    { icon: 'eye',                   color: '#A2845E' },
  system:       { icon: 'information-circle',    color: '#8E8E93' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth(); 
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    // 1. Validation stricte du format UUID (ex: 123e4567-e89b-12d3-a456-426614174000)
    const isValidUUID = (id: string) => {
      const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return regex.test(id);
    };

    // 2. Récupération sécurisée du user_id
    let userId = user?.id;

    // Si pas de user ou ID invalide, on ne lance pas la requête
    if (!userId || !isValidUUID(userId)) {
      console.warn("L'ID utilisateur est invalide ou manquant, requête annulée :", userId);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      const data = await api.notifications.getAll(userId);
      setNotifs(data || []);
    } catch (error) {
      console.error("Erreur chargement notifications", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markAllAsRead = async () => {
    // Si vous avez un endpoint pour tout marquer comme lu :
    // await api.notifications.markAllAsRead();
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handlePressNotif = (notif: Notif) => {
    if (notif.type === 'follow') router.push('/profile' as any);
    else if (notif.type === 'like' || notif.type === 'comment') router.push('/(tabs)/social' as any);
    setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <GalaxyBackground />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity testID="notif-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary || '#A1A1AA'} />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && <Text style={styles.headerSub}>{unreadCount} non lues</Text>}
          </View>
          
          <TouchableOpacity style={styles.clearBtn} onPress={markAllAsRead}>
            <Text style={styles.clearText}>Tout lire</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          renderItem={({ item }) => {
            const notifStyle = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
            const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : "À l'instant";

            return (
              <TouchableOpacity
                testID={`notif-item-${item.id}`}
                style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                activeOpacity={0.8}
                onPress={() => handlePressNotif(item)}
              >
                {!item.read && <View style={styles.unreadDot} />}
                <View style={[styles.notifIcon, { backgroundColor: `${notifStyle.color}20` }]}>
                  <Ionicons name={notifStyle.icon as any} size={20} color={notifStyle.color} />
                </View>
                
                <View style={styles.notifContent}>
                  <Text style={styles.notifMessage}>
                    <Text style={{fontWeight: 'bold'}}>{item.title} </Text>
                    {item.body}
                  </Text>
                  <Text style={styles.notifTime}>{dateStr}</Text>
                </View>

                {item.avatar && (
                  <Image source={{ uri: item.avatar }} style={styles.notifAvatar} />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTertiary || '#52525B'} />
              <Text style={styles.emptyText}>Aucune interaction pour le moment</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090514' },
  safeArea: { zIndex: 10 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: SPACING.screenEdge || 16, 
    paddingVertical: 12 
  },
  backBtn: { width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary || '#FFF' },
  headerSub: { fontSize: 11, color: COLORS.primary || C.navyMid, marginTop: 2, fontWeight: 'bold' },
  clearBtn: { paddingVertical: 6, minWidth: 60, alignItems: 'flex-end' },
  clearText: { color: COLORS.primary || C.navyMid, fontSize: 13, fontWeight: '700' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notifCard: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12,
    paddingHorizontal: SPACING.screenEdge || 16, 
    paddingVertical: 14,
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.borderLight || 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  notifCardUnread: { backgroundColor: 'rgba(140,46,186,0.05)' },
  unreadDot: { position: 'absolute', left: 6, top: '50%', marginTop: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary || '#8C2EBA' },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifMessage: { color: COLORS.textPrimary || '#FFF', fontSize: 13, lineHeight: 19 },
  notifTime: { color: COLORS.textTertiary || '#A1A1AA', fontSize: 11, marginTop: 4 },
  notifAvatar: { width: 40, height: 40, borderRadius: RADIUS?.full || 20, borderWidth: 1, borderColor: COLORS.border || 'rgba(255,255,255,0.1)' },
  empty: { alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyText: { color: COLORS.textSecondary || '#A1A1AA', fontSize: 15 },
});