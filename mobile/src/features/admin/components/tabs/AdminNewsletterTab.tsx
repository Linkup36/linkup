import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Mail,
  Send,
  Users,
  Store,
  Truck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase } from '../../../../services/supabase';
import { AppModal } from '../../../../components/ui/AppModal';
import { Button } from '../../../../components/ui/Button';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 5;

const TEMPLATES = [
  {
    name: 'Flash Sale Deals',
    icon: Sparkles,
    subject: '🔥 Exclusive Weekend Deals Just Dropped!',
    title: 'Special Weekend Marketplace Offers',
    content:
      'Explore verified stores on Linkup with up to 25% discount and instant local courier delivery straight to your doorstep.',
    audience: 'all',
  },
  {
    name: 'Merchant Notice',
    icon: Store,
    subject: '📦 Boost Your Store Sales This Week on Linkup',
    title: 'Store Optimization Tips',
    content:
      'Make sure your product catalogs are stocked and prices updated to appear at the top of customer searches.',
    audience: 'sellers',
  },
  {
    name: 'Rider Demand Alert',
    icon: Truck,
    subject: '🛵 High Delivery Demand in Your Zone - Active Missions',
    title: 'New Delivery Missions Available',
    content:
      'High parcel delivery demand is active in your city. Turn on your online toggle in the Courier fleet center to start earning.',
    audience: 'logistics',
  },
];

export function AdminNewsletterTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [audienceCounts, setAudienceCounts] = useState({
    all: 0,
    buyers: 0,
    sellers: 0,
    logistics: 0,
  });

  // Compose State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<'all' | 'buyers' | 'sellers' | 'logistics'>('all');
  const [sending, setSending] = useState(false);

  const fetchCampaignsAndMetrics = async () => {
    try {
      setLoading(true);
      const [campaignsRes, profilesRes, rolesRes] = await Promise.all([
        supabase
          .from('newsletter_campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
      ]);

      if (!campaignsRes.error) {
        setCampaigns(campaignsRes.data || []);
      }

      const totalProfiles = profilesRes.count || 0;
      let sellers = 0;
      let logistics = 0;
      let buyers = 0;

      rolesRes.data?.forEach((r: any) => {
        if (r.role === 'seller') sellers++;
        if (r.role === 'logistics') logistics++;
        if (r.role === 'buyer') buyers++;
      });

      setAudienceCounts({
        all: totalProfiles,
        sellers,
        logistics,
        buyers: Math.max(buyers, totalProfiles - (sellers + logistics)),
      });
    } catch (err: any) {
      console.warn('[AdminNewsletterTab] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignsAndMetrics();
  }, []);

  const handleApplyTemplate = (tmpl: any) => {
    Haptics.selectionAsync();
    setTitle(tmpl.title);
    setSubject(tmpl.subject);
    setContent(tmpl.content);
    setTargetAudience(tmpl.audience as any);
    toast.info('Template Applied', { description: `Loaded "${tmpl.name}" preset.` });
  };

  const handleSendBroadcast = async () => {
    if (!title.trim() || !subject.trim() || !content.trim()) {
      toast.warning('Incomplete Broadcast', {
        description: 'Please enter Title, Subject, and Content body.',
      });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Dispatch Broadcast Announcement',
      `Send "${subject}" to ${targetAudience.toUpperCase()} audience (${
        targetAudience === 'all'
          ? audienceCounts.all
          : (audienceCounts as any)[targetAudience] || 0
      } users)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispatch Now',
          onPress: async () => {
            setSending(true);
            try {
              const { error } = await supabase.from('newsletter_campaigns').insert({
                title: title.trim(),
                subject: subject.trim(),
                content: content.trim(),
                target_audience: targetAudience,
                status: 'sent',
                sent_at: new Date().toISOString(),
              });

              if (error) throw error;

              toast.success('Broadcast Dispatched! 🚀', {
                description: `Campaign delivered to ${targetAudience} audience.`,
              });

              setTitle('');
              setSubject('');
              setContent('');
              fetchCampaignsAndMetrics();
            } catch (err: any) {
              toast.error('Dispatch Failed', { description: err.message });
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Audience Reach Overview */}
      <View style={styles.audienceSection}>
        <Text style={styles.sectionOverline}>POTENTIAL AUDIENCE REACH</Text>
        <View style={styles.audienceGrid}>
          {[
            { label: 'All Users', count: audienceCounts.all, color: colors.primary, bg: '#FFF7ED' },
            { label: 'Shoppers', count: audienceCounts.buyers, color: '#0284C7', bg: '#F0F9FF' },
            { label: 'Merchants', count: audienceCounts.sellers, color: '#059669', bg: '#ECFDF5' },
            { label: 'Couriers', count: audienceCounts.logistics, color: '#7C3AED', bg: '#F5F3FF' },
          ].map((item, i) => (
            <View key={i} style={[styles.audienceBox, { backgroundColor: item.bg }]}>
              <Text style={[styles.audienceCount, { color: item.color }]}>
                {item.count.toLocaleString()}
              </Text>
              <Text style={styles.audienceLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Preset Templates */}
      <View style={styles.templateSection}>
        <Text style={styles.sectionOverline}>PRESET BROADCAST TEMPLATES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
          {TEMPLATES.map((tmpl, idx) => {
            const Icon = tmpl.icon;
            return (
              <TouchableOpacity
                key={idx}
                style={styles.templateCard}
                onPress={() => handleApplyTemplate(tmpl)}
                activeOpacity={0.7}
              >
                <View style={styles.templateIcon}>
                  <Icon size={16} color={colors.primary} />
                </View>
                <Text style={styles.templateName}>{tmpl.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Compose Form Card */}
      <View style={styles.composeCard}>
        <Text style={styles.composeTitle}>Create Announcement</Text>

        {/* Target Audience Selector */}
        <Text style={styles.inputLabel}>Target Audience</Text>
        <View style={styles.audienceToggleRow}>
          {[
            { key: 'all', label: 'All Users' },
            { key: 'buyers', label: 'Buyers Only' },
            { key: 'sellers', label: 'Merchants' },
            { key: 'logistics', label: 'Couriers' },
          ].map((a) => {
            const active = targetAudience === a.key;
            return (
              <TouchableOpacity
                key={a.key}
                style={[styles.audienceToggleChip, active && styles.audienceToggleChipActive]}
                onPress={() => setTargetAudience(a.key as any)}
              >
                <Text
                  style={[
                    styles.audienceToggleText,
                    active && styles.audienceToggleTextActive,
                  ]}
                >
                  {a.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Campaign Header Title</Text>
        <TextInput
          placeholder="e.g. Special Weekend Marketplace Offers"
          placeholderTextColor="#94A3B8"
          style={styles.textInput}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Subject Line / Banner Text</Text>
        <TextInput
          placeholder="e.g. 🔥 Flash Deals Just Dropped on Linkup!"
          placeholderTextColor="#94A3B8"
          style={styles.textInput}
          value={subject}
          onChangeText={setSubject}
        />

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>Message Content</Text>
        <TextInput
          placeholder="Write the announcement message body..."
          placeholderTextColor="#94A3B8"
          style={[styles.textInput, styles.textArea]}
          value={content}
          onChangeText={setContent}
          multiline
        />

        <Button
          title="Dispatch Broadcast"
          icon={Send}
          onPress={handleSendBroadcast}
          loading={sending}
          style={{ marginTop: 18 }}
        />
      </View>

      {/* Past Campaigns Feed */}
      <View style={styles.pastSection}>
        <Text style={styles.sectionOverline}>RECENT BROADCAST HISTORY</Text>
        {campaigns.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Mail size={32} color="#CBD5E1" />
            <Text style={styles.emptyHistoryTitle}>No past campaigns</Text>
            <Text style={styles.emptyHistoryDesc}>
              Broadcasts you send will appear here in chronological order.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {campaigns
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((c) => (
                <View key={c.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <Text style={styles.historySubject} numberOfLines={1}>
                      {c.subject || c.title}
                    </Text>
                    <View style={styles.audienceBadge}>
                      <Text style={styles.audienceBadgeText}>
                        {(c.target_audience || 'ALL').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyBody} numberOfLines={2}>
                    {c.content}
                  </Text>
                  <Text style={styles.historyDate}>
                    Sent {new Date(c.created_at).toLocaleDateString()}
                  </Text>
                </View>
              ))}

            <AdminPagination
              currentPage={currentPage}
              totalPages={Math.ceil(campaigns.length / PAGE_SIZE) || 1}
              totalItems={campaigns.length}
              onPageChange={setCurrentPage}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 24,
  },
  sectionOverline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  audienceSection: {
    marginBottom: 14,
  },
  audienceGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  audienceBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  audienceCount: {
    fontSize: 16,
    fontWeight: '900',
  },
  audienceLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  templateSection: {
    marginBottom: 14,
  },
  templateScroll: {
    flexDirection: 'row',
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    gap: 6,
  },
  templateIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  composeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  composeTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  audienceToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  audienceToggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  audienceToggleChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  audienceToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  audienceToggleTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 90,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  pastSection: {
    marginTop: 6,
  },
  emptyHistory: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  emptyHistoryDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historySubject: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    paddingRight: 8,
  },
  audienceBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  audienceBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
  },
  historyBody: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  historyDate: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 6,
  },
});
