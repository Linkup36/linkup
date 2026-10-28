import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  TextInput,
  Share,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  Share2,
  Search,
  ShieldCheck,
  FileText,
  Lock,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  CreditCard,
  MapPin,
  UserCheck,
  Scroll,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { toast } from '../../../components/ui/GooeyToast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LegalSection {
  id: string;
  icon: any;
  title: string;
  badge?: string;
  summary: string;
  details: string[];
}

export function TermsAndPrivacyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const initialTab = (route.params?.initialTab as 'terms' | 'privacy') || 'terms';
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    't-1': true,
    'p-1': true,
  });

  // Framer-Motion style spring animation for tab indicator
  const tabIndicatorAnim = useRef(new Animated.Value(initialTab === 'terms' ? 0 : 1)).current;

  const handleTabSwitch = (tab: 'terms' | 'privacy') => {
    if (tab === activeTab) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    Animated.spring(tabIndicatorAnim, {
      toValue: tab === 'terms' ? 0 : 1,
      useNativeDriver: false,
      friction: 8,
      tension: 65,
    }).start();
  };

  const toggleSection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        title: 'LinkUp Marketplace & Logistics Legal Terms',
        message:
          'Review the LinkUp Terms of Service, Escrow Policy, and NDPR Privacy Policy: https://linkup.ng/legal',
      });
    } catch {}
  };

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.success('Terms & Privacy Policy Acknowledged');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  };

  // 1. Terms of Service Sections
  const termsSections: LegalSection[] = [
    {
      id: 't-1',
      icon: Scroll,
      badge: 'Core Agreement',
      title: '1. Introduction & Acceptance of Terms',
      summary:
        'By creating an account or using LinkUp Marketplace and LinkUp Send, you enter into a legally binding contract governed by the laws of the Federal Republic of Nigeria.',
      details: [
        'These Terms govern your use of the LinkUp mobile application, web services, escrow infrastructure, and logistics dispatch network.',
        'If you do not agree to these Terms, you may not register, access, or use any services provided by LinkUp.',
        'Users must be at least 18 years of age or possess the requisite legal capacity to form binding contracts in Nigeria.',
      ],
    },
    {
      id: 't-2',
      icon: UserCheck,
      badge: 'Registration Details',
      title: '2. User Registration & Identity Integrity',
      summary:
        'During onboarding, we collect your Full Name, Email, and Phone Number. You are legally required to provide accurate, up-to-date information.',
      details: [
        'Full Legal Name: Used to establish your account identity, generate verified recipient tokens, and link transaction invoices.',
        'Phone Number: Crucial for two-factor verification, courier dispatch call linking, and critical security delivery notifications.',
        'Email Address: Serves as your primary authentication handle, escrow milestone notification channel, and password recovery anchor.',
        'Account Impersonation: Providing fraudulent names, disposable numbers, or impersonating individuals or registered businesses will lead to immediate permanent ban and referral to law enforcement.',
      ],
    },
    {
      id: 't-3',
      icon: ShieldCheck,
      badge: 'Zero Fraud',
      title: '3. The LinkUp Escrow Guarantee',
      summary:
        'All purchases on the Marketplace and delivery fees for LinkUp Send are protected by our proprietary automated Escrow mechanism.',
      details: [
        'When a buyer pays for an item, funds are held securely in escrow and are never released to the merchant until delivery is confirmed.',
        'When booking courier delivery, the delivery fee is held in escrow until the recipient verifies arrival or inputs the secure delivery OTP.',
        'Inspection Window: Buyers enjoy a statutory 48-hour inspection window to report defective, misrepresented, or non-delivered merchandise.',
      ],
    },
    {
      id: 't-4',
      icon: MapPin,
      badge: 'Logistics',
      title: '4. Peer-to-Peer Logistics (LinkUp Send) Rules',
      summary:
        'Send packages with transparent GPS waypoints, verified couriers, and standardized package declarations.',
      details: [
        'Prohibited Goods: Narcotics, firearms, ammunition, hazardous chemicals, stolen goods, currency notes, and live animals are strictly banned.',
        'Accurate Weight & Dimensions: Senders must accurately declare weight tiers (Small ≤2kg, Medium ≤10kg, Large ≤25kg). Discrepancies may incur carrier adjustment charges.',
        'Packaging Standards: Senders are responsible for packaging items safely with adequate protective wrap. Fragile items must be flagged in the app.',
        'Rider Acceptance: Dispatch riders reserve the right to visually inspect parcels prior to sealing if there is reasonable suspicion of prohibited contents.',
      ],
    },
    {
      id: 't-5',
      icon: CreditCard,
      badge: 'Finance',
      title: '5. Fees, Pricing & Instant Wallet Settlements',
      summary:
        'Transparent fee schedules calculated using distance, vehicle class, and service tiers.',
      details: [
        'Logistics Delivery Fees: Base flag fare + per-kilometer routing fee + vehicle tier offset (Bike, Car, Van).',
        'Marketplace Merchant Commission: Platform commission is deducted automatically at the moment of escrow payout.',
        'Wallet Withdrawals: Verified balances can be settled instantly to all CBN-licensed Nigerian commercial banks and fintechs (Paystack/NIBSS rails).',
      ],
    },
    {
      id: 't-6',
      icon: AlertCircle,
      badge: 'Protection',
      title: '6. Disputes, Cancellations & Refunds',
      summary:
        'Clear protocols for cancellation windows, rider compensation, and dispute arbitration.',
      details: [
        'Cancellation before courier dispatch: 100% full instant refund to user wallet.',
        'Cancellation after courier is en route to pickup: Small nominal mobilization fee (₦300–₦500) credited to the dispatch rider for fuel/time.',
        'Arbitration: In disputed transactions, LinkUp Dispute Mediators review chat logs, GPS coordinates, delivery photos, and OTP proof.',
      ],
    },
  ];

  // 2. Privacy Policy Sections (NDPR Compliant)
  const privacySections: LegalSection[] = [
    {
      id: 'p-1',
      icon: UserCheck,
      badge: 'Registration Scope',
      title: '1. Information Collected at Registration & Booking',
      summary:
        'We adhere strictly to the principle of data minimization under the Nigeria Data Protection Act (NDPA) and NDPR.',
      details: [
        'Full Name: Collected during Step 1 of registration for account verification, merchant storefront creation, and delivery receipt.',
        'Email Address: Collected during Step 2 for authentication, account recovery, digital invoice delivery, and platform security notices.',
        'Phone Number: Collected during Step 3 for delivery dispatch contact, courier-to-customer phone linking, and delivery updates.',
        'Role Identity: Buyer, Seller, Courier, or Promoter. Determines access tiers, KYC depth, and wallet capabilities.',
        'Passwords: Salted and encrypted with one-way bcrypt hashing. LinkUp staff cannot view, decrypt, or access your plaintext password.',
        'Delivery Coordinates: Latitude and longitude of pickup and dropoff points, physical street addresses, and special delivery notes.',
      ],
    },
    {
      id: 'p-2',
      icon: MapPin,
      badge: 'Location Tracking',
      title: '2. Real-Time Location & Geolocation Practices',
      summary:
        'We collect location data exclusively to enable peer-to-peer delivery routing, calculate fair delivery fees, and show live courier progress.',
      details: [
        'Active Delivery Tracking: Courier GPS coordinates are broadcast to the sender and recipient ONLY while an order is actively in transit.',
        'Background Location: LinkUp does NOT track your background location when the application is closed, unless you are an active on-duty courier.',
        'Address Privacy: Precise street numbers are masked in public marketplace feeds and only disclosed to the assigned courier once an order is confirmed.',
      ],
    },
    {
      id: 'p-3',
      icon: Lock,
      badge: 'Zero Data Selling',
      title: '3. No Selling of Personal Information',
      summary:
        'LinkUp has never sold, and will never sell, lease, or monetize your personal details or contact data to third-party ad networks.',
      details: [
        'Zero Spam: Your phone number and email are never shared with marketing brokers or unsolicited advertisers.',
        'Direct Courier Masking: In-app phone linking connects senders and couriers without exposing direct private records where VoIP routing is active.',
      ],
    },
    {
      id: 'p-4',
      icon: CreditCard,
      badge: 'Financial Security',
      title: '4. Payment & Banking Data Security',
      summary:
        'PCI-DSS compliant payment processing handled via licensed payment partners (Paystack / Central Bank of Nigeria compliant gateways).',
      details: [
        'Card Numbers: LinkUp servers NEVER store, process, or transmit full 16-digit debit/credit card numbers or CVV security codes.',
        'Wallet Security: Internal wallet accounts are protected by multi-signature encryption and database Row Level Security (RLS).',
        'Settlement Bank Accounts: Stored securely solely for processing merchant and courier balance withdrawals.',
      ],
    },
    {
      id: 'p-5',
      icon: ShieldCheck,
      badge: 'NDPR Rights',
      title: '5. Your Legal Rights (NDPA / NDPR Compliance)',
      summary:
        'Under Nigerian and international data regulations, you retain full ownership and sovereign control over your personal data.',
      details: [
        'Right to Access: Request a digital copy of all personal and transaction data stored in your LinkUp account.',
        'Right to Rectification: Correct inaccurate profile names, phone numbers, or addresses anytime in Account Settings.',
        'Right to Erasure (Account Deletion): Request complete deletion of your account and purging of personal data, subject to statutory 6-year financial audit obligations.',
        'Data Portability: Export your complete order history, wallet ledger, and receipt archive in standardized JSON/CSV formats.',
      ],
    },
    {
      id: 'p-6',
      icon: HelpCircle,
      badge: 'Data Protection Officer',
      title: '6. Data Retention, Security & Inquiries',
      summary:
        'Contact our dedicated Data Protection Officer (DPO) regarding privacy concerns or data erasure requests.',
      details: [
        'Encryption in Transit & Rest: All API communications utilize TLS 1.3 encryption. Database partitions utilize AES-256 block encryption.',
        'DPO Contact: Email privacy@linkup.ng or support@linkup.ng for data audit requests.',
        'Physical Office: LinkUp Logistics & Marketplace, BANEX Plaza, Wuse 2, Abuja, FCT, Nigeria.',
      ],
    },
  ];

  const currentSections = activeTab === 'terms' ? termsSections : privacySections;

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return currentSections;
    const q = searchQuery.toLowerCase();
    return currentSections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.details.some((d) => d.toLowerCase().includes(q))
    );
  }, [currentSections, searchQuery]);

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FBE4D2" translucent />

      {/* 1. Top Curved Peach Hero Banner */}
      <View
        style={[
          styles.heroBanner,
          { paddingTop: insets.top + (Platform.OS === 'ios' ? 4 : 8) },
        ]}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <ArrowLeft size={18} color="#0F172A" strokeWidth={2.4} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Legal & Compliance</Text>
            <Text style={styles.headerSubtitle}>LinkUp Marketplace & Send</Text>
          </View>

          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.75}
          >
            <Share2 size={18} color="#0F172A" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* Badge & Last Updated */}
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <ShieldCheck size={13} color="#FA7E2B" strokeWidth={2.5} />
            <Text style={styles.trustBadgeText}>NDPR Compliant</Text>
          </View>
          <View style={styles.trustBadge}>
            <CheckCircle2 size={13} color="#15803D" strokeWidth={2.5} />
            <Text style={[styles.trustBadgeText, { color: '#15803D' }]}>Escrow Guaranteed</Text>
          </View>
          <Text style={styles.updatedText}>v2.4 • Oct 2026</Text>
        </View>

        {/* Animated Segmented Tab Switcher */}
        <View style={styles.tabContainer}>
          <Animated.View
            style={[
              styles.tabSliderIndicator,
              {
                left: tabIndicatorAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['2%', '51%'],
                }),
              },
            ]}
          />
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => handleTabSwitch('terms')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === 'terms' && styles.tabButtonTextActive]}>
              Terms of Service
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => handleTabSwitch('privacy')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === 'privacy' && styles.tabButtonTextActive]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Content Card (Overlapping White Curved Container) */}
      <View style={styles.contentCard}>
        {/* Search / Filter Input */}
        <View style={styles.searchBarWrap}>
          <Search size={16} color="#94A3B8" strokeWidth={2.2} />
          <TextInput
            placeholder={`Search ${activeTab === 'terms' ? 'terms (escrow, refund, rider)...' : 'privacy (name, phone, GPS)...'}`}
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Executive Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryIconWrap}>
                <FileText size={18} color="#FA7E2B" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryTitle}>
                  {activeTab === 'terms'
                    ? 'Summary of LinkUp Terms in 60 Seconds'
                    : 'Summary of LinkUp Privacy in 60 Seconds'}
                </Text>
                <Text style={styles.summarySub}>
                  {activeTab === 'terms'
                    ? 'Safe marketplace escrow, verified riders, and fair dispute arbitration.'
                    : 'Your name, phone, email & location data are encrypted and never sold.'}
                </Text>
              </View>
            </View>

            <View style={styles.highlightPillsRow}>
              <View style={styles.highlightPill}>
                <CheckCircle2 size={12} color="#15803D" strokeWidth={2.5} />
                <Text style={styles.highlightPillText}>
                  {activeTab === 'terms' ? 'Automated Escrow' : 'Zero Data Selling'}
                </Text>
              </View>
              <View style={styles.highlightPill}>
                <CheckCircle2 size={12} color="#15803D" strokeWidth={2.5} />
                <Text style={styles.highlightPillText}>
                  {activeTab === 'terms' ? '48hr Dispute Window' : 'One-Way Password Encryption'}
                </Text>
              </View>
              <View style={styles.highlightPill}>
                <CheckCircle2 size={12} color="#15803D" strokeWidth={2.5} />
                <Text style={styles.highlightPillText}>
                  {activeTab === 'terms' ? 'Tracked Delivery' : 'Full Right to Erasure'}
                </Text>
              </View>
            </View>
          </View>

          {/* Clauses List (Accordion) */}
          <View style={styles.sectionsList}>
            {filteredSections.map((sec) => {
              const isExpanded = Boolean(expandedSections[sec.id]);
              const SecIcon = sec.icon;

              return (
                <View key={sec.id} style={styles.sectionCard}>
                  <TouchableOpacity
                    style={styles.sectionHeader}
                    onPress={() => toggleSection(sec.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.sectionHeaderLeft}>
                      <View style={styles.sectionIconBubble}>
                        <SecIcon size={18} color="#FA7E2B" strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        {sec.badge && (
                          <View style={styles.secBadgeWrap}>
                            <Text style={styles.secBadgeText}>{sec.badge}</Text>
                          </View>
                        )}
                        <Text style={styles.sectionTitleText}>{sec.title}</Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.chevronWrap,
                        isExpanded && styles.chevronWrapActive,
                      ]}
                    >
                      <ChevronDown
                        size={17}
                        color={isExpanded ? '#FA7E2B' : '#94A3B8'}
                        strokeWidth={2.5}
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Summary Snippet */}
                  <Text style={styles.sectionSummaryText}>{sec.summary}</Text>

                  {/* Detailed Collapsible Bullet Points */}
                  {isExpanded && (
                    <View style={styles.detailsContainer}>
                      <View style={styles.dividerH} />
                      {sec.details.map((point, idx) => (
                        <View key={`${sec.id}-pt-${idx}`} style={styles.detailRow}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.detailText}>{point}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {filteredSections.length === 0 && (
              <View style={styles.emptySearchWrap}>
                <HelpCircle size={32} color="#94A3B8" />
                <Text style={styles.emptySearchTitle}>No matching clauses found</Text>
                <Text style={styles.emptySearchSub}>
                  Try searching for terms like "escrow", "location", "phone", or "refund".
                </Text>
              </View>
            )}
          </View>

          {/* Statutory Footer Disclaimer */}
          <View style={styles.statutoryFooter}>
            <Text style={styles.statutoryText}>
              LinkUp Marketplace & Peer-to-Peer Logistics Network operates in full compliance with the Federal Competition and Consumer Protection Act (FCCPA) 2018, Nigeria Data Protection Act (NDPA) 2023, and Central Bank of Nigeria (CBN) regulatory guidelines for digital escrow.
            </Text>
            <Text style={[styles.statutoryText, { marginTop: 6, fontWeight: '700' }]}>
              © 2026 LinkUp Technologies Nigeria Ltd. All Rights Reserved.
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* 3. Bottom Sticky Acceptance Bar */}
      <View
        style={[
          styles.bottomActionBar,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : 14 },
        ]}
      >
        <TouchableOpacity
          style={styles.acceptActionBtn}
          onPress={handleAccept}
          activeOpacity={0.85}
        >
          <CheckCircle2 size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.acceptActionBtnText}>I Understand & Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#FBE4D2',
  },

  // 1. Top Curved Peach Hero Banner
  heroBanner: {
    backgroundColor: '#FBE4D2',
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 1,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },

  // Trust Badges Row
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
  },
  trustBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FA7E2B',
  },
  updatedText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#78350F',
    marginLeft: 'auto',
  },

  // Segmented Tab Switcher
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 18,
    padding: 4,
    position: 'relative',
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  tabSliderIndicator: {
    position: 'absolute',
    width: '47%',
    height: 38,
    borderRadius: 14,
    backgroundColor: '#FA7E2B',
    top: 3,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 2,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // 2. White Content Card
  contentCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    marginTop: -10,
    paddingTop: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
  },

  // Search Bar
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    height: '100%',
  },

  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Executive Summary Card
  summaryCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  summaryTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#9A3412',
    marginBottom: 2,
  },
  summarySub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#7C2D12',
    lineHeight: 16,
  },
  highlightPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(254, 215, 170, 0.6)',
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  highlightPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Sections List
  sectionsList: {
    gap: 12,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  secBadgeWrap: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 3,
  },
  secBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronWrapActive: {
    backgroundColor: '#FFF7ED',
    transform: [{ rotate: '180deg' }],
  },
  sectionSummaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 18,
    marginTop: 2,
  },
  detailsContainer: {
    marginTop: 10,
    paddingTop: 10,
  },
  dividerH: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FA7E2B',
    marginTop: 6,
  },
  detailText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 17,
  },

  // Empty State
  emptySearchWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySearchSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 240,
  },

  // Statutory Footer
  statutoryFooter: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  statutoryText: {
    fontSize: 10.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 15,
  },

  // 3. Bottom Sticky Action Bar
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptActionBtn: {
    backgroundColor: '#FA7E2B',
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#FA7E2B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptActionBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
