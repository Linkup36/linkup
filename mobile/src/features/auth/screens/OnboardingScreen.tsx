import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { supabase } from '../../../services/supabase';
import {
  ShoppingBag,
  Store,
  Truck,
  Megaphone,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Enugu'];
const ZONES: Record<string, string[]> = {
  Lagos: ['Ikeja / Mainland', 'Lekki Phase 1', 'Victoria Island', 'Yaba / Surulere', 'Ajah / Sangotedo'],
  Abuja: ['Central Area', 'Garki / Wuse', 'Maitama', 'Gwarinpa', 'Kubwa'],
  'Port Harcourt': ['Old GRA', 'New GRA', 'Peter Odili', 'Rumuokoro'],
  Ibadan: ['Bodija', 'Ring Road', 'Samonda', 'Oluyole'],
  Enugu: ['Independence Layout', 'New Haven', 'GRA'],
};

export function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const { user, refreshProfile } = useAuth();

  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState('buyer');
  const [selectedCity, setSelectedCity] = useState(CITIES[0]);
  const [selectedZone, setSelectedZone] = useState(ZONES[CITIES[0]][0]);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const handleFinishOnboarding = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Safe update payload
      const updatePayload: any = {
        bio: bio.trim(),
        onboarding_completed: true,
      };

      // Try resolving city and zone UUIDs from database
      try {
        const { data: cityData } = await supabase
          .from('cities')
          .select('id')
          .ilike('name', selectedCity)
          .maybeSingle();

        if (cityData?.id) {
          updatePayload.city_id = cityData.id;
          const { data: zoneData } = await supabase
            .from('delivery_zones')
            .select('id')
            .eq('city_id', cityData.id)
            .ilike('name', selectedZone)
            .maybeSingle();

          if (zoneData?.id) {
            updatePayload.zone_id = zoneData.id;
          }
        }
      } catch (locErr) {
        console.warn('[Onboarding] Location lookup warning:', locErr);
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', user.id);

      if (error) throw error;

      // Ensure role is recorded in user_roles via manage_user_roles RPC
      const rolesToSet = selectedRole && selectedRole !== 'buyer' ? [selectedRole, 'buyer'] : ['buyer'];
      try {
        await supabase.rpc('manage_user_roles', {
          p_user_id: user.id,
          p_roles: rolesToSet,
        });
      } catch (roleErr) {
        console.warn('[Onboarding] Error managing roles via RPC:', roleErr);
      }

      await refreshProfile();

      if (selectedRole === 'seller') {
        navigation.navigate('SellerDashboard');
      } else if (selectedRole === 'logistics' || selectedRole === 'driver') {
        navigation.navigate('LogisticsDashboard');
      } else if (selectedRole === 'promoter') {
        navigation.navigate('PromoterDashboard');
      } else {
        navigation.navigate('MainTabs', { screen: 'HomeTab' });
      }
    } catch (e: any) {
      Alert.alert('Onboarding Error', e.message || 'Could not complete setup.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeView edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Step Indicator */}
            <View style={styles.stepIndicatorRow}>
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  style={[
                    styles.stepBar,
                    step >= s ? styles.stepBarActive : styles.stepBarInactive,
                  ]}
                />
              ))}
            </View>

            {step === 1 && (
              <View>
                <View style={styles.header}>
                  <BrandLogo size="md" style={{ marginBottom: 14 }} />
                  <Text style={styles.title}>How will you use Linkup?</Text>
                  <Text style={styles.subtitle}>
                    Select your primary activity. You can always switch modes later in your profile.
                  </Text>
                </View>

            <View style={styles.rolesList}>
              {[
                { id: 'buyer', label: 'Buyer & Shopper', icon: ShoppingBag, desc: 'Find deals, shop gadgets, and send courier packages' },
                { id: 'seller', label: 'Merchant / Seller', icon: Store, desc: 'List products, manage inventory, and receive customer orders' },
                { id: 'promoter', label: 'Affiliate Promoter', icon: Megaphone, desc: 'Earn recurring commission by referring buyers' },
                { id: 'logistics', label: 'Courier Rider', icon: Truck, desc: 'Earn money delivering on-demand packages across town' },
              ].map((r) => {
                const Icon = r.icon;
                const active = selectedRole === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.roleCard, active && styles.roleCardActive]}
                    onPress={() => setSelectedRole(r.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.roleLeft}>
                      <View style={[styles.roleIconBox, active && styles.roleIconBoxActive]}>
                        <Icon size={20} color={active ? '#ffffff' : colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{r.label}</Text>
                        <Text style={styles.roleSubtitle}>{r.desc}</Text>
                      </View>
                    </View>
                    {active && <CheckCircle2 size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button title="Continue" onPress={() => setStep(2)} style={{ marginTop: 28 }} />
          </View>
        )}

        {step === 2 && (
          <View>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <MapPin size={24} color="#4f46e5" />
              </View>
              <Text style={styles.title}>Where are you located?</Text>
              <Text style={styles.subtitle}>
                We use your local city and zone to show nearby items and calculate delivery fees.
              </Text>
            </View>

            {/* City Selection */}
            <Text style={styles.sectionHeading}>Select City</Text>
            <View style={styles.pillsWrap}>
              {CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, selectedCity === c && styles.pillActive]}
                  onPress={() => {
                    setSelectedCity(c);
                    setSelectedZone(ZONES[c][0]);
                  }}
                >
                  <Text style={[styles.pillText, selectedCity === c && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Zone Selection */}
            <Text style={[styles.sectionHeading, { marginTop: 18 }]}>Select Delivery Zone</Text>
            <View style={styles.pillsWrap}>
              {(ZONES[selectedCity] || []).map((z) => (
                <TouchableOpacity
                  key={z}
                  style={[styles.pill, selectedZone === z && styles.pillActive]}
                  onPress={() => setSelectedZone(z)}
                >
                  <Text style={[styles.pillText, selectedZone === z && styles.pillTextActive]}>{z}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.navRow}>
              <Button title="Back" variant="outline" onPress={() => setStep(1)} style={{ flex: 1 }} />
              <Button title="Continue" onPress={() => setStep(3)} style={{ flex: 1 }} />
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Sparkles size={24} color="#16a34a" />
              </View>
              <Text style={styles.title}>Almost Ready!</Text>
              <Text style={styles.subtitle}>
                Tell the community a little bit about yourself or your business.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Short Bio / Tagline (Optional)</Text>
            <TextInput
              placeholder="e.g. Gadget enthusiast & verified seller based in Lekki."
              placeholderTextColor="#94a3b8"
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
            />

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Your Setup Summary</Text>
              <Text style={styles.summaryText}>• Mode: {selectedRole.toUpperCase()}</Text>
              <Text style={styles.summaryText}>• City: {selectedCity}</Text>
              <Text style={styles.summaryText}>• Hub: {selectedZone}</Text>
            </View>

            <View style={styles.navRow}>
              <Button title="Back" variant="outline" onPress={() => setStep(2)} style={{ flex: 1 }} />
              <Button
                title="Finish & Start"
                onPress={handleFinishOnboarding}
                loading={saving}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  </SafeView>
);
}

const styles = StyleSheet.create({
  scroll: {
    padding: 24,
    paddingBottom: 40,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  stepBar: {
    height: 4,
    borderRadius: 2,
  },
  stepBarActive: {
    width: 32,
    backgroundColor: colors.primary,
  },
  stepBarInactive: {
    width: 16,
    backgroundColor: '#e2e8f0',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  rolesList: {
    gap: 10,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#FFF7ED',
  },
  roleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  roleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconBoxActive: {
    backgroundColor: colors.primary,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  roleTitleActive: {
    color: colors.primary,
  },
  roleSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  pillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pillActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
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
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#475569',
    marginVertical: 2,
  },
});
