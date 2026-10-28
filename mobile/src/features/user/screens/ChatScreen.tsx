import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../../navigation/types';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { ArrowLeft, Send, Image as ImageIcon, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../../theme/colors';

type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
  created_at: string;
}

export function ChatScreen() {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation();
  const { conversationId, recipientName, productId } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 1. Initial messages fetch
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data as Message[]);
      }
    } catch (err) {
      console.warn('[ChatScreen] Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Realtime subscription to conversation messages
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [newMsg, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // 3. Send message handler
  const handleSend = async () => {
    if (!inputText.trim() || !user) return;
    const content = inputText.trim();
    setInputText('');
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation last_message timestamp
      await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    } catch (err) {
      console.warn('[ChatScreen] Send message failed:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeView>
      {/* Top Navbar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.recipientName}>{recipientName}</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>Linkup Verified Member</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.messagesList}
            renderItem={({ item }) => {
              const isMine = item.sender_id === user?.id;
              return (
                <View
                  style={[
                    styles.messageBubble,
                    isMine ? styles.myBubble : styles.theirBubble,
                  ]}
                >
                  {item.image_url && (
                    <Image source={{ uri: item.image_url }} style={styles.attachedImage} resizeMode="cover" />
                  )}
                  <Text style={[styles.bubbleText, isMine ? styles.myText : styles.theirText]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.msgTime, isMine ? styles.myTime : styles.theirTime]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Type your message..."
            placeholderTextColor="#94a3b8"
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Send size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  headerCenter: {
    alignItems: 'center',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  statusText: {
    fontSize: 11,
    color: '#64748b',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  messagesList: {
    padding: 16,
    gap: 8,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 4,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myText: {
    color: '#ffffff',
  },
  theirText: {
    color: '#0f172a',
  },
  msgTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  theirTime: {
    color: '#94a3b8',
  },
  attachedImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    color: '#0f172a',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
