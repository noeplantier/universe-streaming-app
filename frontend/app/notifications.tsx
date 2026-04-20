import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';
import { notificationsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Notif {
  id: string; type: string; message: string;
  read: boolean; created_at: string; avatar?: string;
}

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  like:         { icon: 'heart',                 color: '#FF3B30' },
  follow:       { icon: 'person-add',            color: COLORS.primary },
  new_film:     { icon: 'film',                  color: COLORS.success },
  comment:      { icon: 'chatbubble',            color: '#60A5FA' },
  review_like:  { icon: 'star',                  color: '#FFD60A' },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    notificationsAPI.getAll()
      .then(setNotifs)
      .catch(() => {})
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="notif-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unread > 0 && <Text style={styles.headerSub}>{unread} non lues</Text>}
          </View>
          <TouchableOpacity style={styles.clearBtn}>
            <Text style={styles.clearText}>Tout lire</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

     
       : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
          renderItem={({ item }) => {
            const notifStyle = NOTIF_ICONS[item.type] || { icon: 'notifications', color: COLORS.primary };
            return (
              <TouchableOpacity
                testID={`notif-item-${item.id}`}
                style={[styles.notifCard, !item.read && styles.notifCardUnread]}
                activeOpacity={0.8}
              >
                {!item.read && <View style={styles.unreadDot} />}
                <View style={[styles.notifIcon, { backgroundColor: `${notifStyle.color}20` }]}>
                  <Ionicons name={notifStyle.icon as any} size={20} color={notifStyle.color} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={styles.notifMessage}>{item.message}</Text>
                  <Text style={styles.notifTime}>À l&aposinstant</Text>
                </View>
                {item.avatar && (
                  <Image source={{ uri: item.avatar }} style={styles.notifAvatar} />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>Aucune notification</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 11, color: COLORS.primary, marginTop: 2 },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  clearText: { color: "#fff", fontSize: 13, fontWeight: '900' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notifCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: SPACING.screenEdge, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    position: 'relative',
  },
  notifCardUnread: { backgroundColor: 'rgba(140,46,186,0.05)' },
  unreadDot: { position: 'absolute', left: 8, top: '50%', width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifMessage: { color: COLORS.textPrimary, fontSize: 13, lineHeight: 19 },
  notifTime: { color: COLORS.textTertiary, fontSize: 11, marginTop: 3 },
  notifAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
});
