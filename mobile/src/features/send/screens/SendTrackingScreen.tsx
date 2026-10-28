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
  Package,
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

  // If order is actively found and loaded, render the immersive full-bleed tracking view (mockup design)
  if (activeOrderId && order) {
    return (
      <RealtimeTrackingView
        order={order}
        riderCoords={riderCoords}
        onRefresh={refetch}
        onSearchAnother={(newId) => setActiveOrderId(newId)}
      />
    );
  }

  // Fallback / Initial Search Mode when order is not yet loaded or not found
  return (
    <SafeView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={19} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Track Package</Text>
            <Text style={styles.sub}>Stay updated with real-time delivery GPS</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          {activeOrderId ? (
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => refetch()}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color="#64748B" />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.supportPill}
            onPress={() => setSupportModalOpen(true)}
            activeOpacity={0.8}
          >
            <Headphones size={14} color="#FA7E2B" />
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
            <View style={styles.searchHeaderRow}>
              <Package size={16} color="#FA7E2B" />
              <Text style={styles.searchLabel}>Enter Package Tracking ID</Text>
            </View>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. LSEND-250512-9876"
                placeholderTextColor="#94A3B8"
                value={searchInput}
                onChangeText={setSearchInput}
                autoCapitalize="characters"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                style={styles.searchActionBtn}
                onPress={handleSearch}
                activeOpacity={0.85}
              >
                <Search size={16} color="#FFFFFF" strokeWidth={2.6} />
                <Text style={styles.searchActionBtnText}>Track</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Loading State */}
          {activeOrderId && isLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#FA7E2B" />
              <Text style={styles.loadingText}>Connecting to live tracking satellite...</Text>
            </View>
          )}

          {/* Order Not Found State */}
          {activeOrderId && !isLoading && !order && (
            <View style={styles.notFoundCard}>
              <View style={styles.notFoundIconWrap}>
                <AlertCircle size={32} color="#DC2626" />
              </View>
              <Text style={styles.notFoundTitle}>Package Not Found</Text>
              <Text style={styles.notFoundSub}>
                We couldn't locate package with ID{' '}
                <Text style={{ fontWeight: '800', color: '#0F172A' }}>{activeOrderId}</Text>.
                Please verify your tracking code or view past orders.
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  sub: {
    fontSize: 11,
    color: '#64748B',
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
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  supportPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FA7E2B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#0F172A',
  },
  searchActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FA7E2B',
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  searchActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  notFoundCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  notFoundIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  notFoundSub: {
    fontSize: 12,
    color: '#64748B',
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
    backgroundColor: '#FA7E2B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sendPackageBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  historyBtn: {
    backgroundColor: '#F1F5F9',
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
