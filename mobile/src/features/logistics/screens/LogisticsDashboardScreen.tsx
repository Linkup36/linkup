import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Phone,
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../../navigation/types';

interface AvailableDelivery {
  id: string;
  tracking_code: string;
  status: string;
  pickup_address?: string;
  dropoff_address?: string;
  delivery_fee: number;
  recipient_phone?: string;
  created_at: string;
}

export function LogisticsDashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, profile, refreshProfile } = useAuth();

  const [isOnline, setIsOnline] = useState(false);
  const [deliveries, setDeliveries] = useState<AvailableDelivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<AvailableDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const fetchDriverState = async () => {
    if (!user) return;
    try {
      // 1. Check profile is_online
      const { data: pData } = await supabase
        .from('profiles')
        .select('is_online')
        .eq('id', user.id)
        .maybeSingle();

      if (pData) {
        setIsOnline(pData.is_online || false);
      }

      // 2. Fetch active job assigned to driver
      const { data: activeData } = await supabase
        .from('shipments')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['assigned', 'in_transit'])
        .maybeSingle();

      if (activeData) {
        setActiveDelivery(activeData as AvailableDelivery);
      } else {
        setActiveDelivery(null);
      }

      // 3. Fetch available pending shipments nearby
      const { data: availableJobs } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (availableJobs) {
        setDeliveries(availableJobs as AvailableDelivery[]);
      }
    } catch (e) {
      console.warn('[LogisticsDashboard] Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDriverState();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDriverState();
  };

  const handleToggleOnline = async (val: boolean) => {
    if (!user) return;
    setTogglingOnline(true);
    setIsOnline(val);
    try {
      await supabase.from('profiles').update({ is_online: val }).eq('id', user.id);
      await refreshProfile();
    } catch (e) {
      console.warn('Failed to update online status', e);
      setIsOnline(!val);
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleAcceptJob = async (job: AvailableDelivery) => {
    if (!user) return;
    if (!isOnline) {
      Alert.alert('Go Online First', 'You must switch your status to Online to accept courier deliveries.');
      return;
    }

    try {
      const { error } = await supabase
        .from('shipments')
        .update({
          driver_id: user.id,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (error) throw error;

      Alert.alert('Delivery Accepted!', `Proceed to pickup location.`);
      fetchDriverState();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Job could not be accepted.');
    }
  };

  const handleMarkDelivered = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({
          status: 'delivered',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (error) throw error;

      Alert.alert('Delivery Complete!', 'Payment will be credited to your courier wallet balance.');
      fetchDriverState();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not complete delivery.');
    }
  };

  const formatPrice = (val: number) => '₦' + (val || 1500).toLocaleString('en-NG');

  return (
    <SafeAreaView
      edges={['top', 'bottom', 'left', 'right']}
      backgroundColor="#FFFFFF"
      statusBarStyle="dark-content"
      statusBarColor="#FFFFFF"
      contentBackgroundColor="#F8FAFC"
    >
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Courier & Rider Mode</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
      >
        {/* Online Status Toggle Card */}
        <View style={[styles.statusCard, isOnline ? styles.statusCardOnline : styles.statusCardOffline]}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
            <View>
              <Text style={styles.statusTitle}>{isOnline ? 'Online & Receiving Jobs' : 'Offline'}</Text>
              <Text style={styles.statusSub}>
                {isOnline ? 'Visible to nearby pickup requests' : 'Toggle on to receive delivery jobs'}
              </Text>
            </View>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#cbd5e1', true: '#4f46e5' }}
            thumbColor="#ffffff"
            disabled={togglingOnline}
          />
        </View>

        {/* Active In-Progress Delivery */}
        {activeDelivery && (
          <View style={styles.activeJobCard}>
            <View style={styles.activeJobHeader}>
              <View style={styles.activeJobTag}>
                <Clock size={12} color="#ffffff" />
                <Text style={styles.activeJobTagText}>Active Assignment</Text>
              </View>
              <Text style={styles.jobFee}>{formatPrice(activeDelivery.delivery_fee)}</Text>
            </View>

            <View style={styles.routeBox}>
              <View style={styles.routeItem}>
                <MapPin size={16} color="#4f46e5" />
                <Text style={styles.routeText} numberOfLines={1}>
                  Pickup: {activeDelivery.pickup_address || 'Ikeja Courier Depot'}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeItem}>
                <MapPin size={16} color="#ef4444" />
                <Text style={styles.routeText} numberOfLines={1}>
                  Dropoff: {activeDelivery.dropoff_address || 'Victoria Island'}
                </Text>
              </View>
            </View>

            <View style={styles.activeActions}>
              <Button
                title="Mark as Delivered"
                onPress={() => handleMarkDelivered(activeDelivery.id)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* Available Jobs Queue */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available Nearby Deliveries</Text>
          <Text style={styles.jobCount}>{deliveries.length} available</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color="#4f46e5" />
          </View>
        ) : deliveries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Package size={44} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Pending Deliveries</Text>
            <Text style={styles.emptySubtitle}>
              Stay online and we'll alert you as soon as a new package pickup is requested nearby.
            </Text>
          </View>
        ) : (
          deliveries.map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.jobTop}>
                <View style={styles.jobIdRow}>
                  <Truck size={16} color="#4f46e5" />
                  <Text style={styles.jobTrackingId}>Order #{job.id.slice(-6)}</Text>
                </View>
                <Text style={styles.jobEarning}>{formatPrice(job.delivery_fee)}</Text>
              </View>

              <View style={styles.jobRoute}>
                <Text style={styles.jobAddress} numberOfLines={1}>
                  📍 {job.pickup_address || 'Lagos Hub'} → {job.dropoff_address || 'Recipient'}
                </Text>
              </View>

              <Button
                title="Accept Delivery Job"
                size="sm"
                onPress={() => handleAcceptJob(job)}
                style={{ marginTop: 10 }}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 20,
  },
  statusCardOnline: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusCardOffline: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotOnline: {
    backgroundColor: '#16a34a',
  },
  dotOffline: {
    backgroundColor: '#94a3b8',
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activeJobCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
  },
  activeJobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeJobTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeJobTagText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  jobFee: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  routeBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeLine: {
    width: 2,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginLeft: 7,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
  },
  activeActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  jobCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  jobTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobTrackingId: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  jobEarning: {
    fontSize: 16,
    fontWeight: '900',
    color: '#4f46e5',
  },
  jobRoute: {
    marginTop: 8,
  },
  jobAddress: {
    fontSize: 13,
    color: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  center: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
