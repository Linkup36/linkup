import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { MessageSquare, ArrowLeft, ChevronRight, User } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

interface ConversationItem {
  id: string;
  last_message?: string;
  last_message_at?: string;
  product?: {
    id: string;
    title: string;
    images?: string[];
    price?: number;
  };
  other_user?: {
    id: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export function MessagesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message,
          last_message_at,
          buyer_id,
          seller_id,
          product:products(id, title, images, price)
        `)
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        // Resolve the other party for each conversation
        const mapped = await Promise.all(
          data.map(async (c: any) => {
            const otherUserId = c.buyer_id === user.id ? c.seller_id : c.buyer_id;
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', otherUserId)
              .maybeSingle();

            return {
              id: c.id,
              last_message: c.last_message || 'Started a new trade discussion',
              last_message_at: c.last_message_at,
              product: c.product,
              other_user: profile || { id: otherUserId, full_name: 'Linkup User' },
            };
          })
        );
        setConversations(mapped);
      }
    } catch (err) {
      console.warn('[MessagesScreen] Error loading conversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.convCard}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('Chat', {
                  conversationId: item.id,
                  recipientName: item.other_user?.full_name || 'Linkup User',
                  productId: item.product?.id,
                })
              }
            >
              <Image
                source={{
                  uri:
                    item.other_user?.avatar_url ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
                }}
                style={styles.avatar}
              />

              <View style={styles.convInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.other_user?.full_name || 'User'}
                  </Text>
                  {item.last_message_at && (
                    <Text style={styles.timeText}>
                      {new Date(item.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>

                {item.product && (
                  <Text style={styles.productBadge} numberOfLines={1}>
                    Item: {item.product.title}
                  </Text>
                )}

                <Text style={styles.lastMsg} numberOfLines={1}>
                  {item.last_message}
                </Text>
              </View>

              <ChevronRight size={18} color="#cbd5e1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageSquare size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No Conversations</Text>
              <Text style={styles.emptySubtitle}>
                When you enquire about an item or message a seller, your active chats will show up here.
              </Text>
            </View>
          }
        />
      )}
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  list: {
    padding: 16,
  },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  convInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  productBadge: {
    fontSize: 11,
    color: '#4f46e5',
    fontWeight: '600',
    marginTop: 2,
  },
  lastMsg: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
