import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';
import { SafeView } from '../../../components/ui/SafeView';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Headphones,
  RefreshCw,
} from 'lucide-react-native';
import { useSendOrderTracking } from '../hooks/useSendOrderTracking';
import { RealtimeTrackingView } from '../components/tracking/RealtimeTrackingView';
import { SendSupportModal } from '../components/support/SendSupportModal';
import { colors } from '../../../theme/colors';

type SendTrackingRouteProp = RouteProp<RootStackParamList, 'SendTracking'>;

export function SendTrackingScreen() {
  const route = useRoute<SendTrackingRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const initialOrderId = route.params?.orderId || '';
  const [activeOrderId, setActiveOrderId] = useState<string>(initialOrderId);
  const [searchInput, setSearchInput] = useState<string>('');
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const scrollRef = useRef<any>(null);

  const { order, riderCoords, isLoading, refetch } = useSendOrderTracking(activeOrderId);

  const handleSearch = () => {
    if (searchInput.trim()) {
      setActiveOrderId(searchInput.trim().toUpperCase());
    }
  };

  return (
    <SafeView edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#0f172a" strokeWidth={2.5} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Track My Order</Text>
            <Text style={styles.sub}>
              {order?.status === 'finding_rider'
                ? 'Stay updated in real time'
                : 'Track your package in real time'}
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          {activeOrderId ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => refetch()}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color="#64748b" />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.supportPill}
            onPress={() => setSupportModalOpen(true)}
            activeOpacity={0.8}
          >
            <Headphones size={15} color="#ea580c" />
            <Text style={styles.supportPillText}>Support</Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search Bar for tracking any package */}
          <View style={styles.searchCard}>
            <Text style={styles.searchLabel}>Track Any Package ID</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. LSEND-250512-9876"
                placeholderTextColor="#94a3b8"
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="characters"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                  }, Platform.OS === 'ios' ? 70 : 120);
                }}
              />
              <TouchableOpacity style={styles.searchActionBtn} onPress={handleSearch} activeOpacity={0.8}>
                <Search size={16} color="#ffffff" strokeWidth={2.6} />
                <Text style={styles.searchActionBtnText}>Track</Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* Loading State */}
        {activeOrderId && isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Connecting to live tracking satellite...</Text>
          </View>
        )}

        {/* Order Not Found State */}
        {activeOrderId && !isLoading && !order && (
          <View style={styles.notFoundCard}>
            <View style={styles.notFoundIconWrap}>
              <AlertCircle size={32} color="#dc2626" />
            </View>
            <Text style={styles.notFoundTitle}>Order Not Found</Text>
            <Text style={styles.notFoundSub}>
              We couldn't locate package with ID{' '}
              <Text style={{ fontWeight: '800', color: '#0f172a' }}>{activeOrderId}</Text>.
              Please verify the tracking ID or check your delivery history.
            </Text>

            <View style={styles.notFoundActions}>
              <TouchableOpacity
                style={styles.sendPackageBtn}
                onPress={() => navigation.navigate('MainTabs', { screen: 'SendTab' })}
              >
                <Text style={styles.sendPackageBtnText}>Send a Package</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => navigation.navigate('SendHistory')}
              >
                <Text style={styles.historyBtnText}>Past Deliveries</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Live Tracking View */}
        {activeOrderId && order && (
          <RealtimeTrackingView
            order={order}
            riderCoords={riderCoords}
            onRefresh={refetch}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Support Modal */}
      <SendSupportModal
        visible={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        orderId={activeOrderId}
        orderStatus={order?.status}
      />
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
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  sub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ffbe1a',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  supportPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  searchLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginBottom: 6,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#0f172a',
  },
  searchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  searchActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  notFoundCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  notFoundIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  notFoundSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  notFoundActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  sendPackageBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendPackageBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  historyBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  historyBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
});
