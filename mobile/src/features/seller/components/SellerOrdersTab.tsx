import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import {
  ShoppingBag,
  ChevronRight,
  Smartphone,
  MapPin,
  Truck,
  Check,
  Activity,
  ArrowLeft,
  Radio,
  Clock,
  Users,
  Navigation,
  LocateFixed,
  X,
  Phone,
  ShieldCheck,
} from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';

interface SellerOrdersTabProps {
  orders: any[];
  totalOrders: number;
  ordersPage: number;
  setOrdersPage: (updater: (p: number) => number) => void;
  pageSize: number;
  sellerZone?: string;
  sellerZoneId?: string;
  sellerCityId?: string;
  sellerAddress?: string;
  onUpdateOrderStatus: (orderId: string, status: string) => Promise<void>;
  onBroadcastOrder: (payload: {
    orderId: string;
    zone: string;
    zoneId: string;
    pickupAddress: string;
    pickupTime: string;
    lat?: number;
    lng?: number;
    riderId?: string;
  }) => Promise<void>;
  isUpdatingStatus?: boolean;
  isBroadcasting?: boolean;
}

const PICKUP_WINDOW_PRESETS = [
  { label: 'Ready Now', offsetMins: 15 },
  { label: 'In 30 Mins', offsetMins: 30 },
  { label: 'In 1 Hour', offsetMins: 60 },
  { label: 'In 2 Hours', offsetMins: 120 },
  { label: 'In 4 Hours', offsetMins: 240 },
];

export function SellerOrdersTab({
  orders,
  totalOrders,
  ordersPage,
  setOrdersPage,
  pageSize,
  sellerZone,
  sellerZoneId,
  sellerCityId,
  sellerAddress,
  onUpdateOrderStatus,
  onBroadcastOrder,
  isUpdatingStatus = false,
  isBroadcasting = false,
}: SellerOrdersTabProps) {
  const { profile } = useAuth();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<'broadcast' | 'agent'>('broadcast');

  // Broadcast / Agent selector state
  const [selectedZone, setSelectedZone] = useState<string>(sellerZone || '');
  const [pickupPoint, setPickupPoint] = useState<string>(sellerAddress || '');
  const [pickupPresetMins, setPickupPresetMins] = useState<number>(120);
  const [pickupTimeIso, setPickupTimeIso] = useState<string>('');
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [zones, setZones] = useState<any[]>([]);
  const [zoneAgentCount, setZoneAgentCount] = useState<number>(0);

  // Direct Agent Selector state
  const [agentZoneFilter, setAgentZoneFilter] = useState<string>('All Zones');
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    if (selectorOpen) {
      if (sellerAddress && !pickupPoint) setPickupPoint(sellerAddress);
      if (sellerZone && !selectedZone) setSelectedZone(sellerZone);
      const targetTime = new Date(Date.now() + pickupPresetMins * 60 * 1000);
      setPickupTimeIso(targetTime.toISOString().slice(0, 16));
      loadDeliveryZones();
    }
  }, [selectorOpen, sellerAddress, sellerZone]);

  useEffect(() => {
    const targetTime = new Date(Date.now() + pickupPresetMins * 60 * 1000);
    setPickupTimeIso(targetTime.toISOString().slice(0, 16));
  }, [pickupPresetMins]);

  async function loadDeliveryZones() {
    try {
      const cityId = sellerCityId || profile?.city_id;
      let query = supabase.from('delivery_zones').select('*').eq('is_active', true);

      if (cityId) {
        query = query.eq('city_id', cityId);
      } else {
        const { data: abuja } = await supabase
          .from('cities')
          .select('id')
          .eq('name', 'Abuja')
          .maybeSingle();
        if (abuja?.id) {
          query = query.eq('city_id', abuja.id);
        }
      }

      const { data } = await query.order('name');
      const formatted = ((data as any[]) || []).map((z) => ({
        id: z.id,
        name: z.name,
        label: String(z.name).split(' (')[0],
        area: String(z.name).split(' (')[1]?.replace(')', '') || z.name,
      }));
      setZones(formatted);

      if (!selectedZone && formatted.length > 0) {
        if (sellerZoneId) {
          const match = formatted.find((z) => z.id === sellerZoneId);
          if (match) setSelectedZone(match.name);
          else setSelectedZone(formatted[0].name);
        } else {
          setSelectedZone(formatted[0].name);
        }
      }
    } catch (e) {
      console.warn('[SellerOrdersTab] Error loading delivery zones:', e);
    }
  }

  // Count active partners in selected zone
  useEffect(() => {
    async function fetchAgentCount() {
      if (!selectedZone || zones.length === 0) {
        setZoneAgentCount(0);
        return;
      }
      const zoneObj = zones.find((z) => z.name === selectedZone);
      if (!zoneObj) {
        setZoneAgentCount(0);
        return;
      }
      try {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('zone_id', zoneObj.id);
        setZoneAgentCount(count || 0);
      } catch {
        setZoneAgentCount(0);
      }
    }
    fetchAgentCount();
  }, [selectedZone, zones]);

  // Fetch verified logistics agents when in 'agent' mode
  useEffect(() => {
    if (!selectorOpen || dispatchMode !== 'agent') return;

    async function fetchVerifiedAgents() {
      setLoadingAgents(true);
      try {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'logistics');

        const logisticsUserIds = (roleData || []).map((r: any) => r.user_id);
        if (logisticsUserIds.length === 0) {
          setAgents([]);
          return;
        }

        // Check both logistics_verifications and logistics_kyc for verified status
        const [{ data: verifData }, { data: kycData }] = await Promise.all([
          (supabase as any)
            .from('logistics_verifications')
            .select('user_id, full_name, phone_number, home_address, status')
            .in('user_id', logisticsUserIds)
            .eq('status', 'verified'),
          (supabase as any)
            .from('logistics_kyc')
            .select('user_id, full_name, phone_number, home_address, status')
            .in('user_id', logisticsUserIds)
            .eq('status', 'verified'),
        ]);

        const combinedVerifs = [...(verifData || []), ...(kycData || [])];
        const verifiedIds = Array.from(new Set(combinedVerifs.map((v: any) => v.user_id)));
        const targetIds = verifiedIds.length > 0 ? verifiedIds : logisticsUserIds;

        let profileQuery = supabase
          .from('profiles')
          .select('id, display_name, avatar_url, latitude, longitude, zone, zone_id, phone')
          .in('id', targetIds);

        if (agentZoneFilter !== 'All Zones') {
          const zObj = zones.find((z) => z.name === agentZoneFilter);
          if (zObj) {
            profileQuery = profileQuery.eq('zone_id', zObj.id);
          } else {
            profileQuery = profileQuery.eq('zone', agentZoneFilter);
          }
        }

        const { data: profilesList } = await profileQuery;
        if (!profilesList || profilesList.length === 0) {
          setAgents([]);
          return;
        }

        const { data: detailsList } = await (supabase as any)
          .from('logistics_details')
          .select('user_id, vehicle_type')
          .in(
            'user_id',
            profilesList.map((p: any) => p.id)
          );

        const formattedAgents = (profilesList as any[]).map((prof) => {
          const verif = combinedVerifs.find((v: any) => v.user_id === prof.id);
          const det = (detailsList || []).find((d: any) => d.user_id === prof.id);
          return {
            id: prof.id,
            display_name: prof.display_name || verif?.full_name || 'Verified Rider',
            full_name: verif?.full_name,
            avatar_url: prof.avatar_url,
            phone_number: verif?.phone_number || prof.phone,
            home_address: verif?.home_address,
            vehicle_type: det?.vehicle_type || 'Motorcycle',
            latitude: prof.latitude,
            longitude: prof.longitude,
            zone: prof.zone || zones.find((z) => z.id === prof.zone_id)?.label || 'Active Zone',
            isVerified: true,
          };
        });

        setAgents(formattedAgents);
      } catch (e) {
        console.warn('[SellerOrdersTab] Agents fetch error:', e);
      } finally {
        setLoadingAgents(false);
      }
    }

    fetchVerifiedAgents();
  }, [selectorOpen, dispatchMode, agentZoneFilter, zones]);

  const handlePinPickupLocation = async () => {
    setIsLocating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Permission Denied', {
          description: 'Location access is required to pin your pickup point.',
        });
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setPickupCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      });

      if (!pickupPoint.trim()) {
        try {
          const [geo] = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (geo) {
            const addr = [geo.streetNumber, geo.street, geo.district, geo.city]
              .filter(Boolean)
              .join(', ');
            if (addr) setPickupPoint(addr);
          }
        } catch { }
      }

      toast.success('Location Pinned!', {
        description: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} captured`,
      });
    } catch (e: any) {
      toast.error('Could Not Get Location', {
        description: e?.message || 'Please enter your pickup address manually.',
      });
    } finally {
      setIsLocating(false);
    }
  };

  const handleInitiateBroadcast = (orderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setActiveOrderId(orderId);
    setDispatchMode('broadcast');
    setSelectorOpen(true);
  };

  const handleConfirmDispatch = async () => {
    if (!activeOrderId) return;
    const zoneObj = zones.find((z) => z.name === selectedZone) || zones[0];
    const zoneName = selectedZone || zoneObj?.name || 'Standard Zone';
    const zoneId = zoneObj?.id || sellerZoneId || '';

    if (!pickupPoint.trim()) {
      toast.error('Pickup Point Required', {
        description: 'Please specify where the courier should pick up the package.',
      });
      return;
    }

    await onBroadcastOrder({
      orderId: activeOrderId,
      zone: zoneName,
      zoneId,
      pickupAddress: pickupPoint.trim(),
      pickupTime: pickupTimeIso || new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      lat: pickupCoords?.lat,
      lng: pickupCoords?.lng,
      riderId: dispatchMode === 'agent' && selectedAgentId ? selectedAgentId : undefined,
    });

    setSelectorOpen(false);
    setActiveOrderId(null);
    setSelectedAgentId(null);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return { bg: '#DCFCE7', text: '#15803D', label: 'COMPLETED' };
      case 'confirmed':
      case 'processing':
        return { bg: '#FEF3C7', text: '#B45309', label: status.toUpperCase() };
      case 'awaiting_agent':
      case 'broadcast':
        return { bg: '#FFEDD5', text: '#E96F28', label: 'FINDING PARTNER' };
      case 'accepted':
      case 'assigned':
        return { bg: '#E0E7FF', text: '#4338CA', label: 'PARTNER FOUND' };
      case 'out_for_pickup':
      case 'arrived_at_seller':
        return { bg: '#FEF3C7', text: '#B45309', label: status.replace(/_/g, ' ').toUpperCase() };
      case 'picked_up':
      case 'started':
        return { bg: '#F3E8FF', text: '#7E22CE', label: 'IN TRANSIT' };
      case 'out_for_delivery':
      case 'in_transit':
        return { bg: '#FFEDD5', text: '#E96F28', label: 'OUT FOR DELIVERY' };
      case 'arrived_at_destination':
      case 'arrived':
        return { bg: '#CFFAFE', text: '#0E7490', label: 'ARRIVED AT BUYER' };
      case 'delivered':
        return { bg: '#FEF3C7', text: '#D97706', label: 'DELIVERED' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: status.replace(/_/g, ' ').toUpperCase() };
    }
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.eyebrow}>ORDER FULFILLMENT</Text>
        <Text style={styles.title}>Orders Summary</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <ShoppingBag size={30} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No Active Orders</Text>
          <Text style={styles.emptySubtitle}>YOUR ORDERS QUEUE IS CURRENTLY CLEAR.</Text>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {orders.map((o) => {
            const recipientData = Array.isArray(o.order_recipient)
              ? o.order_recipient[0]
              : o.order_recipient;
            const recipient = recipientData || o.shipping_info || {};
            const shipment = o.shipments?.[0];
            const orderStatus = String(o.status || 'pending').toLowerCase();
            const status = ['completed', 'disputed', 'cancelled', 'refunded'].includes(orderStatus)
              ? orderStatus
              : shipment && shipment.status && shipment.status !== 'pending'
                ? String(shipment.status).toLowerCase()
                : orderStatus;

            const badge = getStatusBadgeStyle(status);
            const itemsTotal = (o.order_items || []).reduce(
              (sum: number, item: any) =>
                sum + Number(item.price_at_purchase || 0) * Number(item.quantity || 1),
              0
            );
            const displayAmount =
              itemsTotal ||
              Number(
                o.order_settlements?.[0]?.seller_amount ||
                o.order_settlements?.seller_amount ||
                o.grand_total ||
                o.total_amount ||
                0
              );

            return (
              <View key={o.id} style={styles.orderCard}>
                {/* Card Top Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={styles.orderIdPill}>
                      <Text style={styles.orderIdText}>#{String(o.id).slice(0, 4)}</Text>
                    </View>
                    <View>
                      <View style={styles.badgeDateRow}>
                        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </Text>
                        </View>
                        <Text style={styles.orderDateText}>
                          {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}
                        </Text>
                      </View>
                      <View style={styles.txRefRow}>
                        <Text style={styles.txRefText}>Transaction Reference</Text>
                        <ChevronRight size={12} color="#94A3B8" />
                      </View>
                    </View>
                  </View>

                  {displayAmount > 0 && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.amountSmallLabel}>ORDER VALUE</Text>
                      <Text style={styles.amountValue}>
                        ₦{displayAmount.toLocaleString('en-NG')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Card Content */}
                <View style={styles.cardContent}>
                  {/* Order Items */}
                  <View style={styles.sectionBlock}>
                    <View style={styles.sectionHeadingRow}>
                      <ShoppingBag size={12} color="#64748B" />
                      <Text style={styles.sectionHeadingText}>ORDER DETAILS</Text>
                    </View>

                    <View style={{ gap: 8 }}>
                      {(o.order_items || []).map((item: any, idx: number) => {
                        const prod = item.products || {};
                        const prodTitle = prod.title || 'Product';
                        const prodImg = prod.images?.[0] || '';
                        const purchasePrice = Number(item.price_at_purchase) || 0;
                        const qty = Number(item.quantity) || 1;

                        return (
                          <View key={item.id || idx} style={styles.orderItemRow}>
                            <View style={styles.orderItemLeft}>
                              <View style={styles.itemThumbWrap}>
                                {prodImg ? (
                                  <Image source={{ uri: prodImg }} style={styles.itemThumb} />
                                ) : (
                                  <Smartphone size={16} color="#94A3B8" />
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemTitle} numberOfLines={1}>
                                  {prodTitle}
                                </Text>
                                <View style={styles.itemSubRow}>
                                  <Text style={styles.itemQtyText}>Qty: {qty}</Text>
                                  {item.size ? (
                                    <View style={styles.itemSizeBadge}>
                                      <Text style={styles.itemSizeText}>SIZE: {item.size}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                            <Text style={styles.itemPriceText}>
                              ₦{(purchasePrice * qty).toLocaleString('en-NG')}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Delivery Destination */}
                  <View style={styles.destinationBox}>
                    <View style={styles.sectionHeadingRow}>
                      <MapPin size={12} color="#64748B" />
                      <Text style={styles.sectionHeadingText}>DELIVERY DESTINATION</Text>
                    </View>
                    <View style={styles.recipientHeaderRow}>
                      <Text style={styles.recipientName}>
                        {recipient.full_name || 'Guest Customer'}
                      </Text>
                      {recipient.phone ? (
                        <TouchableOpacity
                          style={styles.callCustomerBtn}
                          onPress={() => Linking.openURL(`tel:${recipient.phone}`)}
                        >
                          <Phone size={11} color={colors.primary} />
                          <Text style={styles.callCustomerText}>{recipient.phone}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={styles.recipientAddress}>
                      {recipient.address_line || 'No address provided'}
                    </Text>

                    <View style={styles.locationTagsRow}>
                      {recipient.cities?.name ? (
                        <View style={styles.locationTag}>
                          <Text style={styles.locationTagText}>{recipient.cities.name}</Text>
                        </View>
                      ) : null}
                      {recipient.delivery_zones?.name ? (
                        <View style={styles.locationTag}>
                          <Text style={styles.locationTagText}>
                            {recipient.delivery_zones.name}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Assigned Rider Section */}
                  {shipment && shipment.status !== 'pending' && (
                    <View style={styles.riderBox}>
                      <View style={styles.riderTopRow}>
                        <Text style={styles.riderBoxEyebrow}>
                          LOCAL DELIVERY PARTNER
                        </Text>
                        <View style={styles.riderStatusPill}>
                          <Text style={styles.riderStatusPillText}>
                            {String(shipment.status).replace(/_/g, ' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.riderInfoRow}>
                        <View style={styles.riderAvatar}>
                          <Text style={styles.riderAvatarText}>
                            {(shipment.rider?.display_name ||
                              shipment.profiles?.display_name ||
                              'R')?.[0]?.toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.riderNameText}>
                            {shipment.rider?.display_name ||
                              shipment.profiles?.display_name ||
                              'Waiting for Rider'}
                          </Text>
                          <View style={styles.riderMetaRow}>
                            <Text style={styles.riderZoneText}>
                              {shipment.delivery_zones?.name || shipment.zone || 'Standard Zone'}
                            </Text>
                            {shipment.tracking_code ? (
                              <>
                                <View style={styles.metaDot} />
                                <Text style={styles.trackingCodeText}>
                                  {shipment.tracking_code}
                                </Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* Card Footer Actions */}
                <View style={styles.cardFooter}>
                  {status === 'pending' && (
                    <TouchableOpacity
                      style={styles.acceptOrderBtn}
                      disabled={isUpdatingStatus}
                      onPress={async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                        setActiveOrderId(o.id);
                        await onUpdateOrderStatus(o.id, 'confirmed');
                      }}
                      activeOpacity={0.85}
                    >
                      {isUpdatingStatus && activeOrderId === o.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Check size={15} color="#FFFFFF" strokeWidth={3} />
                          <Text style={styles.acceptOrderBtnText}>ACCEPT ORDER</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {(status === 'confirmed' || status === 'processing') &&
                    (!shipment || shipment.status === 'pending') && (
                      <TouchableOpacity
                        style={styles.findPartnerBtn}
                        disabled={isBroadcasting}
                        onPress={() => handleInitiateBroadcast(o.id)}
                        activeOpacity={0.85}
                      >
                        <Truck size={15} color="#FFFFFF" strokeWidth={2.6} />
                        <Text style={styles.findPartnerBtnText}>FIND DELIVERY PARTNER</Text>
                      </TouchableOpacity>
                    )}

                  {(status === 'awaiting_agent' || status === 'broadcast') && (
                    <View style={styles.waitingAgentBanner}>
                      <Truck size={14} color="#2563EB" />
                      <Text style={styles.waitingAgentText}>
                        WAITING FOR A PARTNER TO ACCEPT...
                      </Text>
                    </View>
                  )}

                  {status === 'delivered' && (
                    <View style={styles.awaitingBuyerBanner}>
                      <Activity size={14} color="#D97706" />
                      <Text style={styles.awaitingBuyerText}>AWAITING BUYER CONFIRMATION</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination */}
      {totalOrders > pageSize && (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            style={[styles.pageCircleBtn, ordersPage === 0 && styles.pageBtnDisabled]}
            disabled={ordersPage === 0}
            onPress={() => setOrdersPage((p) => Math.max(0, p - 1))}
          >
            <ArrowLeft size={16} color={ordersPage === 0 ? '#CBD5E1' : '#0F172A'} />
          </TouchableOpacity>

          <View style={styles.pagePill}>
            <Text style={styles.pagePillText}>PAGE {ordersPage + 1}</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.pageCircleBtn,
              (ordersPage + 1) * pageSize >= totalOrders && styles.pageBtnDisabled,
            ]}
            disabled={(ordersPage + 1) * pageSize >= totalOrders}
            onPress={() => setOrdersPage((p) => p + 1)}
          >
            <ChevronRight
              size={16}
              color={(ordersPage + 1) * pageSize >= totalOrders ? '#CBD5E1' : '#0F172A'}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Zone Broadcast & Logistics Agent Selector Modal */}
      <Modal
        visible={selectorOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectorOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectorOpen(false)}
          />

          <View style={styles.sheetContainer}>
            <View style={styles.grabHandle} />

            {/* Modal Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.radioIconCircle}>
                  {dispatchMode === 'broadcast' ? (
                    <Radio size={22} color="#FFFFFF" strokeWidth={2.5} />
                  ) : (
                    <Truck size={22} color="#FFFFFF" strokeWidth={2.5} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>
                    {dispatchMode === 'broadcast' ? 'Find Delivery Partner' : 'Select Verified Rider'}
                  </Text>
                  <Text style={styles.sheetSubtitle}>
                    {dispatchMode === 'broadcast'
                      ? 'Available partners in this area will be notified of your request.'
                      : 'Assign directly to a verified logistics rider in your network.'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectorOpen(false)}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher: Zone Broadcast vs Direct Rider */}
            <View style={styles.modeSwitchRow}>
              <TouchableOpacity
                style={[
                  styles.modeSwitchTab,
                  dispatchMode === 'broadcast' && styles.modeSwitchTabActive,
                ]}
                onPress={() => setDispatchMode('broadcast')}
              >
                <Radio
                  size={13}
                  color={dispatchMode === 'broadcast' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.modeSwitchText,
                    dispatchMode === 'broadcast' && styles.modeSwitchTextActive,
                  ]}
                >
                  Zone Broadcast
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeSwitchTab,
                  dispatchMode === 'agent' && styles.modeSwitchTabActive,
                ]}
                onPress={() => setDispatchMode('agent')}
              >
                <Truck size={13} color={dispatchMode === 'agent' ? '#FFFFFF' : '#64748B'} />
                <Text
                  style={[
                    styles.modeSwitchText,
                    dispatchMode === 'agent' && styles.modeSwitchTextActive,
                  ]}
                >
                  Select Rider
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 430 }}
              contentContainerStyle={{ paddingBottom: 16, gap: 16 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Pickup Point Input (Shared) */}
              <View>
                <View style={styles.pickupLabelRow}>
                  <Text style={styles.fieldLabel}>PRODUCT PICKUP POINT</Text>
                  <TouchableOpacity
                    style={[
                      styles.pinLocationBtn,
                      pickupCoords && styles.pinLocationBtnActive,
                    ]}
                    onPress={handlePinPickupLocation}
                    disabled={isLocating}
                  >
                    {isLocating ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <LocateFixed
                          size={11}
                          color={pickupCoords ? colors.primary : '#FFFFFF'}
                        />
                        <Text
                          style={[
                            styles.pinLocationBtnText,
                            pickupCoords && { color: colors.primary },
                          ]}
                        >
                          {pickupCoords ? 'LOCATION PINNED' : 'PIN MY LOCATION'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  value={pickupPoint}
                  onChangeText={setPickupPoint}
                  placeholder="Specify where the agent should pick up the product"
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.gpsHintText}>
                  {pickupCoords
                    ? `📍 GPS coordinates captured (${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)})`
                    : 'Tip: Pinning your location helps agents navigate directly to you.'}
                </Text>
              </View>

              {dispatchMode === 'broadcast' ? (
                <>
                  {/* Pickup Window */}
                  <View>
                    <View style={styles.sectionHeadingRow}>
                      <Clock size={12} color="#64748B" />
                      <Text style={styles.fieldLabel}>PICKUP WINDOW</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
                    >
                      {PICKUP_WINDOW_PRESETS.map((preset) => {
                        const active = pickupPresetMins === preset.offsetMins;
                        return (
                          <TouchableOpacity
                            key={preset.label}
                            style={[styles.presetChip, active && styles.presetChipActive]}
                            onPress={() => setPickupPresetMins(preset.offsetMins)}
                          >
                            <Text
                              style={[
                                styles.presetChipText,
                                active && styles.presetChipTextActive,
                              ]}
                            >
                              {preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.gpsHintText}>
                      Ready for pickup around{' '}
                      {pickupTimeIso
                        ? new Date(pickupTimeIso).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : 'shortly'}
                    </Text>
                  </View>

                  {/* Delivery Zone Grid */}
                  <View>
                    <View style={styles.sectionHeadingRow}>
                      <MapPin size={12} color="#64748B" />
                      <Text style={styles.fieldLabel}>SELECT PICKUP ZONE</Text>
                    </View>

                    <View style={styles.zonesGrid}>
                      {zones.map((zone) => {
                        const isSelected = selectedZone === zone.name;
                        return (
                          <TouchableOpacity
                            key={zone.id}
                            style={[styles.zoneCard, isSelected && styles.zoneCardActive]}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                                () => { }
                              );
                              setSelectedZone(zone.name);
                            }}
                            activeOpacity={0.85}
                          >
                            <View style={styles.zoneDot} />
                            <Text style={styles.zoneCardLabel} numberOfLines={1}>
                              {zone.label}
                            </Text>
                            <Text style={styles.zoneCardArea} numberOfLines={1}>
                              {zone.area}
                            </Text>
                            {isSelected && (
                              <View style={styles.zoneCheckCircle}>
                                <Check size={10} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Zone Stats Preview */}
                  {selectedZone ? (
                    <View style={styles.zoneStatsPreview}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.zoneStatsIcon}>
                          <Users size={16} color={colors.primary} />
                        </View>
                        <View>
                          <Text style={styles.zoneStatsTitle}>
                            {zoneAgentCount} Active Partners
                          </Text>
                          <Text style={styles.zoneStatsSubtitle}>
                            In {selectedZone.split(' (')[0]}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.liveRequestBadge}>
                        <Navigation size={9} color="#15803D" />
                        <Text style={styles.liveRequestBadgeText}>LIVE REQUEST</Text>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                /* Direct Agent Selector View */
                <View style={{ gap: 12 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    {['All Zones', ...zones.map((z) => z.name)].map((zName) => {
                      const active = agentZoneFilter === zName;
                      return (
                        <TouchableOpacity
                          key={zName}
                          style={[styles.presetChip, active && styles.presetChipActive]}
                          onPress={() => setAgentZoneFilter(zName)}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              active && styles.presetChipTextActive,
                            ]}
                          >
                            {String(zName).split(' (')[0]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {loadingAgents ? (
                    <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.gpsHintText, { marginTop: 8 }]}>
                        Scanning verified delivery partners...
                      </Text>
                    </View>
                  ) : agents.length === 0 ? (
                    <View style={styles.emptyAgentsBox}>
                      <Truck size={24} color="#94A3B8" />
                      <Text style={styles.emptyAgentsText}>
                        No verified riders found in this filter. Try "All Zones" or use Zone Broadcast.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {agents.map((ag) => {
                        const selected = selectedAgentId === ag.id;
                        return (
                          <TouchableOpacity
                            key={ag.id}
                            style={[styles.agentItemCard, selected && styles.agentItemCardActive]}
                            onPress={() => setSelectedAgentId(ag.id)}
                          >
                            <View style={styles.riderAvatar}>
                              <Text style={styles.riderAvatarText}>
                                {ag.display_name?.[0]?.toUpperCase() || 'R'}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.riderNameText}>{ag.display_name}</Text>
                                <ShieldCheck size={13} color="#10B981" />
                              </View>
                              <Text style={styles.riderZoneText}>
                                {ag.vehicle_type} · {ag.zone}
                              </Text>
                            </View>
                            {selected && (
                              <View style={styles.zoneCheckCircleStandalone}>
                                <Check size={12} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.cancelSheetBtn}
                onPress={() => setSelectorOpen(false)}
              >
                <Text style={styles.cancelSheetBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmDispatchBtn,
                  (!pickupPoint.trim() ||
                    (dispatchMode === 'agent' && !selectedAgentId) ||
                    isBroadcasting) && { opacity: 0.5 },
                ]}
                disabled={
                  !pickupPoint.trim() ||
                  (dispatchMode === 'agent' && !selectedAgentId) ||
                  isBroadcasting
                }
                onPress={handleConfirmDispatch}
              >
                {isBroadcasting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Radio size={15} color="#FFFFFF" strokeWidth={2.6} />
                    <Text style={styles.confirmDispatchBtnText}>
                      {dispatchMode === 'agent' ? 'ASSIGN RIDER' : 'FIND A PARTNER'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.4,
    marginTop: 4,
  },
  ordersList: {
    gap: 14,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  orderIdPill: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderIdText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
  },
  badgeDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  orderDateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  txRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  txRefText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  amountSmallLabel: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  cardContent: {
    padding: 16,
    gap: 14,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sectionHeadingText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  itemThumbWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemThumb: {
    width: '100%',
    height: '100%',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  itemSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  itemQtyText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  itemSizeBadge: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemSizeText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.primary,
  },
  itemPriceText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  destinationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 4,
  },
  recipientHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  callCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  callCustomerText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  recipientAddress: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 16,
  },
  locationTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  locationTag: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  locationTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  riderBox: {
    backgroundColor: '#FFF7F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    gap: 10,
  },
  riderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  riderBoxEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 1.2,
  },
  riderStatusPill: {
    backgroundColor: 'rgba(233, 111, 40, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  riderStatusPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.primary,
  },
  riderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  riderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  riderNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  riderMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  riderZoneText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  trackingCodeText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
  },
  cardFooter: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  acceptOrderBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  acceptOrderBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  findPartnerBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  findPartnerBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  waitingAgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  waitingAgentText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 1.4,
  },
  awaitingBuyerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  awaitingBuyerText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 1.4,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingTop: 10,
  },
  pageCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pagePill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pagePillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  grabHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  radioIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0F172A',
  },
  sheetSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitchRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  modeSwitchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeSwitchTabActive: {
    backgroundColor: colors.primary,
  },
  modeSwitchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  modeSwitchTextActive: {
    color: '#FFFFFF',
  },
  pickupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
  },
  pinLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pinLocationBtnActive: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  pinLocationBtnText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  gpsHintText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 5,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  zonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  zoneCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  zoneCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7F2',
  },
  zoneDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginBottom: 6,
  },
  zoneCardLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  zoneCardArea: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  zoneCheckCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneCheckCircleStandalone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneStatsPreview: {
    backgroundColor: '#FFF7F2',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoneStatsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(233, 111, 40, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneStatsTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F172A',
  },
  zoneStatsSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  liveRequestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveRequestBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#15803D',
  },
  emptyAgentsBox: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    gap: 6,
  },
  emptyAgentsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  agentItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  agentItemCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7F2',
  },
  sheetFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelSheetBtn: {
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelSheetBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.4,
  },
  confirmDispatchBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmDispatchBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
});
