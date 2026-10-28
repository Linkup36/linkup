import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  HelpCircle,
  MessageCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Send,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const FAQS = [
  {
    q: 'How does Linkup Escrow protection work?',
    a: 'When you make a payment for a marketplace item or package delivery, funds are held securely in Linkup Escrow. Payment is only released to the seller or courier once you verify delivery.',
  },
  {
    q: 'How fast are P2P deliveries dispatched?',
    a: 'Dispatch riders are typically matched within 5 to 15 minutes. Average delivery time across town is 30-45 minutes depending on traffic.',
  },
  {
    q: 'How do I withdraw money from my Linkup Wallet?',
    a: 'Navigate to your Account tab > My Wallet > Withdraw. Enter your verified 10-digit Nigerian bank account. Payouts are processed within 1-2 hours.',
  },
  {
    q: 'How can I become a verified seller?',
    a: 'Go to your Account > Merchant Dashboard > Complete Identity KYC. Upload your NIN, Driver’s License, or International Passport photo.',
  },
];

export function SupportScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleOpenWhatsApp = () => {
    Linking.openURL('https://wa.me/2348039876543?text=Hello%20Linkup%20Support,%20I%20need%20assistance');
  };

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert('Required Fields', 'Please enter a subject and message describing your issue.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user?.id,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        status: 'open',
      });

      if (error) throw error;

      setTicketSubject('');
      setTicketMessage('');
      Alert.alert('Ticket Submitted', 'Our support team has received your ticket and will respond shortly.');
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'Could not submit support ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* WhatsApp Direct Banner */}
        <TouchableOpacity style={styles.whatsappCard} onPress={handleOpenWhatsApp} activeOpacity={0.85}>
          <View style={styles.whatsappLeft}>
            <View style={styles.whatsappIconBox}>
              <MessageCircle size={22} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.whatsappTitle}>Chat with Live Agent</Text>
              <Text style={styles.whatsappSub}>Available 24/7 on WhatsApp</Text>
            </View>
          </View>
          <View style={styles.chatBadge}>
            <Text style={styles.chatBadgeText}>Open</Text>
          </View>
        </TouchableOpacity>

        {/* FAQs Section */}
        <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
        <View style={styles.faqList}>
          {FAQS.map((item, index) => {
            const isOpen = expandedFaq === index;
            return (
              <TouchableOpacity
                key={index}
                style={styles.faqCard}
                onPress={() => toggleFaq(index)}
                activeOpacity={0.7}
              >
                <View style={styles.faqQuestionRow}>
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  {isOpen ? <ChevronUp size={18} color="#4f46e5" /> : <ChevronDown size={18} color="#94a3b8" />}
                </View>
                {isOpen && <Text style={styles.faqAnswer}>{item.a}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Submit Support Ticket */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>Open a Support Ticket</Text>
        <View style={styles.ticketCard}>
          <Text style={styles.inputLabel}>Subject</Text>
          <TextInput
            placeholder="e.g. Issue with delivery #SEND-1234"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={ticketSubject}
            onChangeText={setTicketSubject}
          />

          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Describe your issue</Text>
          <TextInput
            placeholder="Provide any details to help us resolve this faster..."
            placeholderTextColor="#94a3b8"
            style={[styles.input, styles.textArea]}
            value={ticketMessage}
            onChangeText={setTicketMessage}
            multiline
            numberOfLines={4}
          />

          <Button
            title="Submit Ticket"
            onPress={handleSubmitTicket}
            loading={submitting}
            style={{ marginTop: 20 }}
          />
        </View>
      </ScrollView>
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16a34a',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  whatsappLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  whatsappIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  whatsappSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  chatBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chatBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#16a34a',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  faqList: {
    gap: 10,
  },
  faqCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
    paddingRight: 10,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#475569',
    marginTop: 10,
    lineHeight: 18,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#0f172a',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
});
