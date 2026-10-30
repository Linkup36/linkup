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
  Platform,
} from 'react-native';
import {
  Bell,
  Send,
  Users,
  Store,
  Truck,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
  Check,
  Megaphone,
  Radio,
  ExternalLink,
} from 'lucide-react-native';
import { colors } from '../../../../theme/colors';
import { supabase, invokeEdgeFunction } from '../../../../services/supabase';
import { Button } from '../../../../components/ui/Button';
import { AppModal } from '../../../../components/ui/AppModal';
import { toast } from '../../../../components/ui';
import * as Haptics from 'expo-haptics';
import { AdminPagination } from '../AdminPagination';

const PAGE_SIZE = 5;

type RoleKey = 'buyer' | 'seller' | 'promoter' | 'logistics';

interface RoleOption {
  key: RoleKey;
  label: string;
  sublabel: string;
  icon: any;
  color: string;
  bg: string;
  borderColor: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    key: 'buyer',
    label: 'Buyers',
    sublabel: 'Shoppers & Customers',
    icon: Users,
    color: '#0284C7',
    bg: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  {
    key: 'seller',
    label: 'Sellers',
    sublabel: 'Verified Merchants',
    icon: Store,
    color: '#059669',
    bg: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  {
    key: 'promoter',
    label: 'Promoters',
    sublabel: 'Affiliate Partners',
    icon: TrendingUp,
    color: '#D97706',
    bg: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  {
    key: 'logistics',
    label: 'Logistics',
    sublabel: 'Couriers & Dispatch',
    icon: Truck,
    color: '#7C3AED',
    bg: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
];

const TEMPLATES = [
  {
    name: 'Flash Sale Deals',
    icon: Sparkles,
    roles: ['buyer'] as RoleKey[],
    title: '🔥 Flash Deals Just Dropped!',
    message: 'Explore verified stores on LinkUp with up to 25% discount and instant local courier delivery straight to your door.',
    actionUrl: '/marketplace',
  },
  {
    name: 'Merchant Notice',
    icon: Store,
    roles: ['seller'] as RoleKey[],
    title: '📦 Boost Your Store Sales This Week',
    message: 'Keep your product catalogs stocked and prices updated to appear at the top of customer search results.',
    actionUrl: '/dashboard',
  },
  {
    name: 'Promoter Commission Alert',
    icon: TrendingUp,
    roles: ['promoter'] as RoleKey[],
    title: '🚀 Commission Boost: Top Earning Products',
    message: 'High-margin trending electronics and lifestyle items are now offering up to 15% partner commission. Share your links now!',
    actionUrl: '/promoter-dashboard',
  },
  {
    name: 'Rider Demand Alert',
    icon: Truck,
    roles: ['logistics'] as RoleKey[],
    title: '🛵 High Delivery Demand Active in Your Zone',
    message: 'Multiple parcel delivery missions are waiting in your city. Turn on your online toggle in the Courier center to start earning.',
    actionUrl: '/logistics-v2',
  },
  {
    name: 'Platform Wide Update',
    icon: Megaphone,
    roles: ['buyer', 'seller', 'promoter', 'logistics'] as RoleKey[],
    title: '✨ Welcome to the Upgraded LinkUp App',
    message: 'We have rolled out faster deliveries, improved wallet cashouts, and enhanced merchant tools across Nigeria.',
    actionUrl: '/',
  },
];

export function AdminNewsletterTab() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [audienceCounts, setAudienceCounts] = useState({
    all: 0,
    buyer: 0,
    seller: 0,
    promoter: 0,
    logistics: 0,
    pushTokens: 0,
  });

  // Selected Roles (multi-select)
  const [selectedRoles, setSelectedRoles] = useState<RoleKey[]>(['buyer', 'seller', 'promoter', 'logistics']);

  // Compose State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const [messageError, setMessageError] = useState(false);

  const fetchCampaignsAndMetrics = async () => {
    try {
      setLoading(true);
      const [campaignsRes, profilesRes, rolesRes, tokensRes] = await Promise.all([
        supabase
          .from('newsletter_campaigns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role, user_id'),
        supabase
          .from('push_subscriptions')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (!campaignsRes.error) {
        setCampaigns(campaignsRes.data || []);
      }

      const totalProfiles = profilesRes.count || 0;
      let sellers = 0;
      let logistics = 0;
      let promoters = 0;
      let buyers = 0;

      const userRoleMap = new Map<string, Set<string>>();
      rolesRes.data?.forEach((r: any) => {
        if (!userRoleMap.has(r.user_id)) {
          userRoleMap.set(r.user_id, new Set());
        }
        userRoleMap.get(r.user_id)!.add(r.role);

        if (r.role === 'seller') sellers++;
        else if (r.role === 'logistics') logistics++;
        else if (r.role === 'promoter') promoters++;
        else if (r.role === 'buyer') buyers++;
      });

      setAudienceCounts({
        all: totalProfiles,
        seller: sellers,
        logistics: logistics,
        promoter: promoters,
        buyer: Math.max(buyers, totalProfiles - (sellers + logistics + promoters)),
        pushTokens: tokensRes.count || 0,
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

  const toggleRole = (role: RoleKey) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        if (prev.length === 1) {
          toast.warning('Select at least one role', {
            description: 'You need at least one target role to send a push notification.',
          });
          return prev;
        }
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSelectAllRoles = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    if (selectedRoles.length === ROLE_OPTIONS.length) {
      setSelectedRoles(['buyer']);
    } else {
      setSelectedRoles(['buyer', 'seller', 'promoter', 'logistics']);
    }
  };

  const handleApplyTemplate = (tmpl: (typeof TEMPLATES)[0]) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
    setTitle(tmpl.title);
    setMessage(tmpl.message);
    setActionUrl(tmpl.actionUrl || '');
    setSelectedRoles(tmpl.roles);
    setTitleError(false);
    setMessageError(false);
    toast.info('Template Loaded', { description: `Applied "${tmpl.name}" preset.` });
  };

  // Estimated reach based on selected roles
  const getEstimatedReach = () => {
    if (selectedRoles.length === ROLE_OPTIONS.length) return audienceCounts.all;
    let sum = 0;
    selectedRoles.forEach((r) => {
      sum += audienceCounts[r] || 0;
    });
    return Math.min(sum, audienceCounts.all || sum);
  };

  const handleSendPushNotification = () => {
    const isTitleEmpty = !title.trim();
    const isMessageEmpty = !message.trim();

    if (isTitleEmpty || isMessageEmpty) {
      setTitleError(isTitleEmpty);
      setMessageError(isMessageEmpty);
      toast.warning('Incomplete Notification', {
        description: isTitleEmpty && isMessageEmpty
          ? 'Please enter both Title and Notification Message.'
          : isTitleEmpty
          ? 'Please enter a Notification Title.'
          : 'Please enter a Notification Message.',
      });
      return;
    }

    if (selectedRoles.length === 0) {
      toast.warning('No Roles Selected', {
        description: 'Please select at least one role (Buyers, Sellers, Promoters, or Logistics).',
      });
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setShowConfirmModal(true);
  };

  const executeSendPush = async () => {
    setSending(true);
    try {
      let deliveredCount = 0;
      let tokensReached = 0;
      const estimatedTargets = getEstimatedReach();

      // 1. Attempt to dispatch via Supabase Edge Function 'send-push' with proper auth header
      const { data: edgeData, error: edgeError } = await invokeEdgeFunction(
        'send-push',
        {
          roles: selectedRoles,
          title: title.trim(),
          message: message.trim(),
          url: actionUrl.trim() || '/',
          type: 'broadcast',
          save_notification: true,
        }
      );

      if (!edgeError && edgeData?.success) {
        deliveredCount = edgeData.targets || estimatedTargets;
        tokensReached = edgeData.tokens_notified || 0;
      } else {
        console.warn('[AdminNewsletterTab] Edge function notice, using direct client dispatch fallback:', edgeError || edgeData);

        // 2. Direct client-side dispatch fallback
        const isAll = selectedRoles.length === ROLE_OPTIONS.length;
        let targetUserIds: string[] = [];

        if (isAll) {
          const { data: profs } = await supabase.from('profiles').select('id');
          targetUserIds = (profs || []).map((p: any) => p.id);
        } else {
          const userSet = new Set<string>();
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role', selectedRoles);

          rolesData?.forEach((r: any) => userSet.add(r.user_id));

          if (selectedRoles.includes('buyer')) {
            const { data: allP } = await supabase.from('profiles').select('id');
            allP?.forEach((p: any) => userSet.add(p.id));
          }
          targetUserIds = Array.from(userSet);
        }

        deliveredCount = targetUserIds.length;

        // B. Batch insert in-app notifications
        if (targetUserIds.length > 0) {
          const rows = targetUserIds.map((uid) => ({
            user_id: uid,
            title: title.trim(),
            message: message.trim(),
            type: 'broadcast',
            data: { url: actionUrl.trim() || '/', roles: selectedRoles },
            read: false,
            created_at: new Date().toISOString(),
          }));

          for (let i = 0; i < rows.length; i += 50) {
            try {
              await supabase.from('notifications').insert(rows.slice(i, i + 50));
            } catch (insErr) {
              console.warn('[AdminNewsletterTab] In-app notification insert notice:', insErr);
            }
          }

          // C. Query Expo push tokens from push_subscriptions
          let validTokens: string[] = [];

          try {
            const { data: subs } = await supabase
              .from('push_subscriptions')
              .select('endpoint')
              .in('user_id', targetUserIds);

            if (subs && subs.length > 0) {
              const extracted = subs
                .map((s: any) => s.endpoint)
                .filter(
                  (t: any) =>
                    typeof t === 'string' &&
                    (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
                );
              validTokens.push(...extracted);
            }
          } catch {
            // push_subscriptions fallback
          }

          // Optional fallback to profiles if column push_token exists in database
          if (validTokens.length === 0) {
            try {
              const { data: profTokens } = await supabase
                .from('profiles')
                .select('push_token')
                .in('id', targetUserIds);

              if (profTokens && Array.isArray(profTokens)) {
                const profExtracted = profTokens
                  .map((p: any) => p.push_token)
                  .filter(
                    (t: any) =>
                      typeof t === 'string' &&
                      (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
                  );
                validTokens.push(...profExtracted);
              }
            } catch {
              // profiles.push_token column not present
            }
          }

          tokensReached = validTokens.length;

          // D. Send via Expo HTTP Push API
          if (validTokens.length > 0) {
            const messages = validTokens.map((t) => ({
              to: t,
              title: title.trim(),
              body: message.trim(),
              sound: 'default',
              priority: 'high',
              data: { url: actionUrl.trim() || '/', type: 'broadcast' },
            }));

            for (let i = 0; i < messages.length; i += 100) {
              try {
                await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(messages.slice(i, i + 100)),
                });
              } catch (err) {
                console.warn('[ExpoPush] Push send warning:', err);
              }
            }
          }
        }
      }

      // 3. Record campaign in newsletter_campaigns
      try {
        await (supabase as any).from('newsletter_campaigns').insert({
          title: title.trim(),
          subject: title.trim(),
          content: message.trim(),
          target_audience: selectedRoles.join(','),
          status: 'sent',
          recipients_count: deliveredCount,
          success_count: tokensReached > 0 ? tokensReached : deliveredCount,
          sent_at: new Date().toISOString(),
          metadata: {
            channel: 'push_notification',
            roles: selectedRoles,
            url: actionUrl.trim() || '/',
            tokens_reached: tokensReached,
          },
        });
      } catch (recErr) {
        console.warn('[AdminNewsletterTab] Campaign record note:', recErr);
      }

      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
      toast.success('Push Notification Dispatched! 🚀', {
        description: `Sent to ${deliveredCount.toLocaleString()} users across ${selectedRoles.length} roles (${tokensReached} push tokens).`,
      });

      setTitle('');
      setMessage('');
      setActionUrl('');
      setTitleError(false);
      setMessageError(false);
      setShowConfirmModal(false);
      fetchCampaignsAndMetrics();
    } catch (err: any) {
      console.error('[AdminNewsletterTab] Push dispatch error:', err);
      toast.error('Dispatch Failed', { description: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Audience Reach Overview */}
      <View style={styles.audienceSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionOverline}>SELECTABLE TARGET ROLES</Text>
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={handleSelectAllRoles}
            activeOpacity={0.7}
          >
            <Text style={styles.selectAllText}>
              {selectedRoles.length === ROLE_OPTIONS.length ? 'Clear All' : 'Select All Roles'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4 Multi-Select Role Cards: Buyers, Sellers, Promoters, Logistics */}
        <View style={styles.roleGrid}>
          {ROLE_OPTIONS.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedRoles.includes(item.key);
            const count = audienceCounts[item.key] || 0;

            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.roleCard,
                  { backgroundColor: item.bg, borderColor: isSelected ? item.color : item.borderColor },
                  isSelected && styles.roleCardSelected,
                ]}
                onPress={() => toggleRole(item.key)}
                activeOpacity={0.8}
              >
                <View style={styles.roleCardTop}>
                  <View style={[styles.roleIconBox, { backgroundColor: '#FFFFFF' }]}>
                    <Icon size={18} color={item.color} strokeWidth={2.4} />
                  </View>
                  <View
                    style={[
                      styles.checkboxCircle,
                      isSelected
                        ? { backgroundColor: item.color, borderColor: item.color }
                        : { borderColor: '#CBD5E1' },
                    ]}
                  >
                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                </View>

                <Text style={[styles.roleCount, { color: item.color }]}>
                  {count.toLocaleString()}
                </Text>
                <Text style={styles.roleLabel}>{item.label}</Text>
                <Text style={styles.roleSublabel} numberOfLines={1}>
                  {item.sublabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Summary Info Bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryLeft}>
            <Radio size={14} color="#059669" />
            <Text style={styles.summaryText}>
              Targeting <Text style={styles.summaryBold}>{selectedRoles.length}</Text> of 4 roles (~
              <Text style={styles.summaryBold}>{getEstimatedReach().toLocaleString()}</Text> members)
            </Text>
          </View>
          <View style={styles.tokenBadge}>
            <Smartphone size={12} color={colors.primary} />
            <Text style={styles.tokenBadgeText}>
              {audienceCounts.pushTokens} Active Push Devices
            </Text>
          </View>
        </View>
      </View>

      {/* Preset Push Templates */}
      <View style={styles.templateSection}>
        <Text style={styles.sectionOverline}>QUICK-FILL PUSH TEMPLATES</Text>
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
                  <Icon size={14} color={colors.primary} />
                </View>
                <Text style={styles.templateName}>{tmpl.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Live Push Notification Lock Screen Preview */}
      <View style={styles.previewContainer}>
        <Text style={styles.previewOverline}>LIVE LOCK-SCREEN PUSH PREVIEW</Text>
        <View style={styles.phoneLockCard}>
          <View style={styles.previewTopBar}>
            <View style={styles.previewAppInfo}>
              <View style={styles.previewAppIcon}>
                <Bell size={12} color="#FFFFFF" strokeWidth={2.4} />
              </View>
              <Text style={styles.previewAppName}>LINKUP</Text>
              <Text style={styles.previewAppSub}>&bull; NOW</Text>
            </View>
            <View style={styles.previewAudiencePill}>
              <Text style={styles.previewAudienceText}>
                {selectedRoles.map((r) => r.toUpperCase()).join(' & ')}
              </Text>
            </View>
          </View>

          <Text style={styles.previewTitle} numberOfLines={1}>
            {title.trim() || 'Notification Title Here'}
          </Text>
          <Text style={styles.previewBody} numberOfLines={2}>
            {message.trim() || 'The push notification message body will display right here on user lock screens...'}
          </Text>

          {actionUrl.trim() ? (
            <View style={styles.previewActionRow}>
              <ExternalLink size={10} color={colors.primary} />
              <Text style={styles.previewActionText}>Opens: {actionUrl}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Push Notification Compose Form */}
      <View style={styles.composeCard}>
        <View style={styles.composeHeader}>
          <Bell size={18} color={colors.primary} strokeWidth={2.4} />
          <Text style={styles.composeTitle}>Compose Role Push Broadcast</Text>
        </View>

        {/* Selected Roles Feedback Pills */}
        <View style={styles.activePillsRow}>
          <Text style={styles.activePillsLabel}>TARGETED ROLES:</Text>
          {selectedRoles.map((r) => (
            <View key={r} style={styles.roleActivePill}>
              <Text style={styles.roleActivePillText}>{r.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>
          Notification Title / Header <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          placeholder="e.g. 🔥 Weekend Marketplace Flash Sale!"
          placeholderTextColor="#94A3B8"
          style={[styles.textInput, titleError && styles.inputErrorBorder]}
          value={title}
          onChangeText={(val) => {
            setTitle(val);
            if (titleError) setTitleError(false);
          }}
          maxLength={70}
        />
        {titleError ? (
          <Text style={styles.inputErrorText}>Please enter a notification title</Text>
        ) : null}

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>
          Notification Message Body <Text style={styles.requiredStar}>*</Text>
        </Text>
        <TextInput
          placeholder="Enter the push notification message text (appears on lock screens and in notification inboxes)..."
          placeholderTextColor="#94A3B8"
          style={[styles.textInput, styles.textArea, messageError && styles.inputErrorBorder]}
          value={message}
          onChangeText={(val) => {
            setMessage(val);
            if (messageError) setMessageError(false);
          }}
          multiline
          maxLength={250}
        />
        {messageError ? (
          <Text style={styles.inputErrorText}>Please enter the notification message body</Text>
        ) : null}

        <Text style={[styles.inputLabel, { marginTop: 12 }]}>
          Destination App Route / Deep Link (Optional)
        </Text>
        <TextInput
          placeholder="e.g. /marketplace or /seller or /send or /promoter-dashboard"
          placeholderTextColor="#94A3B8"
          style={styles.textInput}
          value={actionUrl}
          onChangeText={setActionUrl}
        />

        {/* Quick URL Shortcuts */}
        <View style={styles.quickUrlsRow}>
          {[
            { label: 'Marketplace', url: '/marketplace' },
            { label: 'Seller Hub', url: '/dashboard' },
            { label: 'Promoter', url: '/promoter-dashboard' },
            { label: 'Logistics', url: '/logistics-v2' },
          ].map((u, i) => (
            <TouchableOpacity
              key={i}
              style={styles.quickUrlChip}
              onPress={() => setActionUrl(u.url)}
            >
              <Text style={styles.quickUrlText}>{u.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title={`Dispatch Push to ${selectedRoles.length} Roles (${getEstimatedReach().toLocaleString()} Users)`}
          icon={Send}
          onPress={handleSendPushNotification}
          loading={sending}
          style={{ marginTop: 20, backgroundColor: colors.primary }}
        />
      </View>

      {/* Broadcast History Feed */}
      <View style={styles.pastSection}>
        <Text style={styles.sectionOverline}>RECENT NOTIFICATION BROADCASTS</Text>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>Loading campaign records...</Text>
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Bell size={32} color="#CBD5E1" />
            <Text style={styles.emptyHistoryTitle}>No Push Notifications Sent Yet</Text>
            <Text style={styles.emptyHistoryDesc}>
              Push notifications and announcements sent to buyers, sellers, promoters, or couriers will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {campaigns
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((c) => {
                const targetStr = (c.target_audience || 'ALL').toUpperCase();
                return (
                  <View key={c.id} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <View style={styles.historySubjectWrap}>
                        <Bell size={14} color={colors.primary} style={{ marginTop: 2 }} />
                        <Text style={styles.historySubject} numberOfLines={1}>
                          {c.title || c.subject}
                        </Text>
                      </View>
                      <View style={styles.audienceBadge}>
                        <Text style={styles.audienceBadgeText}>{targetStr}</Text>
                      </View>
                    </View>

                    <Text style={styles.historyBody} numberOfLines={2}>
                      {c.content}
                    </Text>

                    <View style={styles.historyFooter}>
                      <Text style={styles.historyDate}>
                        Sent {new Date(c.created_at).toLocaleDateString()} at{' '}
                        {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      <View style={styles.recipientsBadge}>
                        <Users size={11} color="#059669" />
                        <Text style={styles.recipientsBadgeText}>
                          {(c.recipients_count || c.success_count || 0).toLocaleString()} Targets
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}

            <AdminPagination
              currentPage={currentPage}
              totalPages={Math.ceil(campaigns.length / PAGE_SIZE) || 1}
              totalItems={campaigns.length}
              onPageChange={setCurrentPage}
            />
          </View>
        )}
      </View>

      {/* Broadcast Dispatch Confirmation Modal */}
      <AppModal
        visible={showConfirmModal}
        onClose={() => !sending && setShowConfirmModal(false)}
        title="Dispatch Push Broadcast 🚀"
        subtitle="Review targets and payload before broadcasting"
        primaryButton={{
          label: sending ? 'Dispatching Broadcast...' : 'Yes, Dispatch Broadcast Now',
          onPress: executeSendPush,
          loading: sending,
          disabled: sending,
          variant: 'primary',
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowConfirmModal(false),
          disabled: sending,
          variant: 'outline',
        }}
        avoidKeyboard
      >
        <View style={styles.confirmModalContent}>
          {/* Target Audience Summary Box */}
          <View style={styles.confirmAudienceBox}>
            <Text style={styles.confirmAudienceLabel}>TARGET ROLES ({selectedRoles.length})</Text>
            <View style={styles.confirmRolesRow}>
              {selectedRoles.map((r) => {
                const opt = ROLE_OPTIONS.find((item) => item.key === r);
                if (!opt) return null;
                const IconComponent = opt.icon;
                return (
                  <View
                    key={r}
                    style={[
                      styles.confirmRoleBadge,
                      { backgroundColor: opt.bg, borderColor: opt.borderColor },
                    ]}
                  >
                    <IconComponent size={13} color={opt.color} />
                    <Text style={[styles.confirmRoleText, { color: opt.color }]}>{opt.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.confirmStatsRow}>
              <View style={styles.confirmStatItem}>
                <Users size={14} color="#0284C7" />
                <Text style={styles.confirmStatText}>
                  <Text style={styles.confirmStatBold}>{getEstimatedReach().toLocaleString()}</Text> Target Users
                </Text>
              </View>
              <View style={styles.confirmStatDivider} />
              <View style={styles.confirmStatItem}>
                <Smartphone size={14} color="#059669" />
                <Text style={styles.confirmStatText}>
                  <Text style={styles.confirmStatBold}>~{audienceCounts.pushTokens || 0}</Text> Push Devices
                </Text>
              </View>
            </View>
          </View>

          {/* Device Push Notification Preview Mockup */}
          <Text style={styles.confirmPreviewHeading}>DEVICE NOTIFICATION PREVIEW</Text>
          <View style={styles.notificationMockup}>
            <View style={styles.mockupHeader}>
              <View style={styles.mockupBrand}>
                <View style={styles.mockupAppIcon}>
                  <Bell size={10} color="#FFFFFF" />
                </View>
                <Text style={styles.mockupAppName}>LINKUP MARKETPLACE</Text>
              </View>
              <Text style={styles.mockupTime}>now</Text>
            </View>

            <Text style={styles.mockupTitle}>{title.trim() || 'Notification Title'}</Text>
            <Text style={styles.mockupBody}>{message.trim() || 'Notification body content preview...'}</Text>

            {actionUrl.trim() ? (
              <View style={styles.mockupActionRow}>
                <ExternalLink size={11} color="#2563EB" />
                <Text style={styles.mockupActionText} numberOfLines={1}>
                  Deep link: {actionUrl.trim()}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.confirmWarningBox}>
            <Text style={styles.confirmWarningText}>
              ⚠️ This will send in-app inbox notifications and immediate mobile push alerts to all active devices registered under the selected roles.
            </Text>
          </View>
        </View>
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
  audienceSection: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionOverline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  selectAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  selectAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
  },
  roleCardSelected: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roleIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  roleCount: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  roleSublabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  summaryText: {
    fontSize: 11,
    color: '#475569',
  },
  summaryBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  tokenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tokenBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  templateSection: {
    marginBottom: 16,
  },
  templateScroll: {
    marginTop: 6,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
    gap: 6,
  },
  templateIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  previewContainer: {
    marginBottom: 16,
  },
  previewOverline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  phoneLockCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  previewTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  previewAppInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewAppIcon: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAppName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  previewAppSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  previewAudiencePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewAudienceText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FDBA74',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  previewBody: {
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 2,
    lineHeight: 16,
  },
  previewActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  previewActionText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
  },
  composeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  composeTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  activePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  activePillsLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginRight: 2,
  },
  roleActivePill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  roleActivePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  requiredStar: {
    color: '#EF4444',
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
    height: 84,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  quickUrlsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickUrlChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quickUrlText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  pastSection: {
    marginTop: 6,
  },
  loaderWrap: {
    padding: 24,
    alignItems: 'center',
  },
  loaderText: {
    fontSize: 11,
    color: '#94A3B8',
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
    marginTop: 8,
  },
  emptyHistoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  emptyHistoryDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 260,
  },
  historyList: {
    gap: 10,
    marginTop: 8,
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
  historySubjectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    paddingRight: 8,
  },
  historySubject: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
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
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  historyDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  recipientsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recipientsBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  inputErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '600',
  },
  confirmModalContent: {
    paddingVertical: 4,
    gap: 16,
  },
  confirmAudienceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmAudienceLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  confirmRolesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  confirmRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  confirmRoleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  confirmStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  confirmStatDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
  },
  confirmStatText: {
    fontSize: 12,
    color: '#64748B',
  },
  confirmStatBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmPreviewHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  notificationMockup: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  mockupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mockupBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mockupAppIcon: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupAppName: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  mockupTime: {
    fontSize: 10,
    color: '#64748B',
  },
  mockupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mockupBody: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
  },
  mockupActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  mockupActionText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
  confirmWarningBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  confirmWarningText: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
  },
});
