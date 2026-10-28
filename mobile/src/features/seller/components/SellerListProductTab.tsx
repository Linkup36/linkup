import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Keyboard,
  Platform,
} from 'react-native';
import {
  Camera,
  ImagePlus,
  X,
  PackagePlus,
  MapPin,
  ChevronDown,
  Check,
  LocateFixed,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import {
  getAvailableSizes,
  prepareImageForUpload,
  uploadImageToStorage,
} from '../utils/sellerUtils';

const FALLBACK_CATEGORIES = [
  'Phones & Tablets',
  'Electronics',
  'Fashion',
  'Shoes & Footwear',
  'Beauty & Personal Care',
  'Home & Kitchen',
  'Food & Restaurants',
  'Computing',
];

interface SellerListProductTabProps {
  onSuccess?: () => void;
  applyPlatformMarkup?: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
}

export function SellerListProductTab({
  onSuccess,
  applyPlatformMarkup = false,
  scrollRef,
}: SellerListProductTabProps) {
  const { user, profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [inventory, setInventory] = useState('1');
  const [cityId, setCityId] = useState(profile?.city_id || '');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const activeFieldRef = useRef<string | null>(null);

  // Layout offset references to jump the active input field smoothly above keyboard
  const containerY = useRef(0);
  const cardY = useRef(0);
  const fieldYOffsets = useRef<Record<string, number>>({
    title: 150,
    description: 240,
    price: 520,
    inventory: 520,
  });

  const scrollToField = useCallback((fieldKey: string) => {
    if (!scrollRef?.current) return;
    const fieldOffset = fieldYOffsets.current[fieldKey] ?? 200;
    // Position the focused field comfortably near the top of the viewport (~20px below top bar)
    const targetY = Math.max(0, containerY.current + cardY.current + fieldOffset - 20);
    scrollRef.current.scrollTo({ y: targetY, animated: true });
  }, [scrollRef]);

  const handleFieldFocus = (fieldKey: string) => {
    setFocusedField(fieldKey);
    activeFieldRef.current = fieldKey;

    // Trigger multiple animated scroll ticks as the keyboard opens
    scrollToField(fieldKey);
    setTimeout(() => scrollToField(fieldKey), 60);
    setTimeout(() => scrollToField(fieldKey), 180);
    setTimeout(() => scrollToField(fieldKey), 350);
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates?.height || 360);
        if (activeFieldRef.current) {
          const key = activeFieldRef.current;
          setTimeout(() => scrollToField(key), 40);
          setTimeout(() => scrollToField(key), 180);
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToField]);
  const [zoneId, setZoneId] = useState(profile?.zone_id || '');
  const [sizes, setSizes] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    profile?.latitude && profile?.longitude
      ? { latitude: profile.latitude, longitude: profile.longitude }
      : null
  );

  const [categories, setCategories] = useState<string[]>([]);
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([]);
  const [zones, setZones] = useState<Array<{ id: string; name: string; city_id: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [processingImages, setProcessingImages] = useState(false);
  const [locating, setLocating] = useState(false);

  // Picker modals
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);

  useEffect(() => {
    async function loadMetadata() {
      try {
        const [catsRes, citiesRes, profRes] = await Promise.all([
          supabase.from('categories').select('name').order('name'),
          supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
          user
            ? supabase
              .from('profiles')
              .select('city_id, zone_id, latitude, longitude')
              .eq('id', user.id)
              .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);

        if (catsRes.data && catsRes.data.length > 0) {
          const names = catsRes.data.map((c: any) => c.name);
          setCategories(names);
          if (!category) setCategory(names[0]);
        } else {
          setCategories(FALLBACK_CATEGORIES);
          if (!category) setCategory(FALLBACK_CATEGORIES[0]);
        }

        if (citiesRes.data) {
          setCities(citiesRes.data as any[]);
        }

        const pData = profRes.data as any;
        if (pData?.city_id && !cityId) setCityId(pData.city_id);
        if (pData?.zone_id && !zoneId) setZoneId(pData.zone_id);
        if (pData?.latitude && pData?.longitude && !coords) {
          setCoords({ latitude: pData.latitude, longitude: pData.longitude });
        }
      } catch (e) {
        console.warn('[SellerListProductTab] Metadata error:', e);
        setCategories(FALLBACK_CATEGORIES);
      }
    }
    loadMetadata();
  }, [user]);

  useEffect(() => {
    async function loadZones() {
      if (!cityId) {
        setZones([]);
        return;
      }
      try {
        const { data } = await supabase
          .from('delivery_zones')
          .select('id, name, city_id')
          .eq('city_id', cityId)
          .eq('is_active', true)
          .order('name');
        setZones((data as any[]) || []);
      } catch (e) {
        console.warn('[SellerListProductTab] Zones error:', e);
      }
    }
    loadZones();
  }, [cityId]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to upload product images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.75,
    });

    if (!result.canceled && result.assets) {
      setProcessingImages(true);
      try {
        const availableSlots = Math.max(0, 5 - images.length);
        const selectedAssets = result.assets.slice(0, availableSlots);
        const prepared = await Promise.all(
          selectedAssets.map((asset) =>
            prepareImageForUpload(asset.uri, (asset as any).fileSize)
          )
        );
        setImages((prev) => [...prev, ...prepared.map((image) => image.uri)].slice(0, 5));
      } catch (error: any) {
        toast.error('Image Not Accepted', {
          description: error?.message || 'Please choose a smaller image.',
        });
      } finally {
        setProcessingImages(false);
      }
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access to photograph your product.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.75,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setProcessingImages(true);
      try {
        const prepared = await prepareImageForUpload(
          result.assets[0].uri,
          (result.assets[0] as any).fileSize
        );
        setImages((prev) => [...prev, prepared.uri].slice(0, 5));
      } catch (error: any) {
        toast.error('Image Not Accepted', {
          description: error?.message || 'Please take a lower-resolution photo.',
        });
      } finally {
        setProcessingImages(false);
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleSize = (size: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setSizes((prev) => (prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]));
  };

  const handleCaptureLocation = async () => {
    setLocating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast.error('Location Permission Denied', {
          description: 'Please enable location access to pin product coordinates.',
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      toast.success('Location Pinned!', {
        description: `Coordinates (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}) attached.`,
      });
    } catch (e: any) {
      toast.error('Location Error', { description: e?.message || 'Could not get GPS position.' });
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim() || !price.trim() || !category) {
      toast.error('Missing Fields', {
        description: 'Please enter a title, price, and select a category.',
      });
      return;
    }
    if (images.length === 0) {
      toast.error('Photos Required', {
        description: 'Please add at least 1 photo of your product.',
      });
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    try {
      // 1. Upload images to the same public bucket used by the web app.
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const uri = images[i];
        const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}_${i}.jpg`;
        const url = await uploadImageToStorage(uri, 'product-images', storagePath, true);
        uploadedUrls.push(url);
      }

      const rawPrice = parseFloat(price) || 0;
      const finalPrice = applyPlatformMarkup ? Number((rawPrice * 1.1).toFixed(2)) : rawPrice;
      const parsedInventory = Math.max(1, parseInt(inventory, 10) || 1);

      // 2. Insert into products table
      const { data: productData, error: insertError } = await supabase
        .from('products')
        .insert({
          seller_id: user.id,
          title: title.trim(),
          description: description.trim(),
          price: finalPrice,
          category,
          inventory: parsedInventory,
          images: uploadedUrls,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          city_id: cityId || null,
          zone_id: zoneId || null,
          sizes: sizes.length > 0 ? sizes : [],
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Product record failed: ${insertError.message}`);
      }

      // 3. Notify buyers in the same zone (non-blocking, matches web ListProduct.tsx)
      if (zoneId) {
        (async () => {
          try {
            const [{ data: zoneProfiles }, { data: buyerRoles }] = await Promise.all([
              supabase.from('profiles').select('id').eq('zone_id', zoneId),
              supabase.from('user_roles').select('user_id').eq('role', 'buyer'),
            ]);

            const buyerIds = (zoneProfiles || [])
              .filter(
                (p: any) =>
                  p.id !== user.id &&
                  (buyerRoles || []).some((r: any) => r.user_id === p.id)
              )
              .map((p: any) => p.id);

            if (buyerIds.length > 0) {
              const notifs = buyerIds.map((bId: string) => ({
                user_id: bId,
                type: 'new_product',
                message: `A new product "${title.trim()}" was just added in your zone! Check it out.`,
              }));
              await supabase.from('notifications').insert(notifs);

              await Promise.all(
                buyerIds.map((bId: string) =>
                  supabase.functions.invoke('send-push', {
                    body: {
                      target_user_id: bId,
                      title: 'New Product Alert! 🛍️',
                      message: `A new product "${title.trim()}" was just added in your zone! Check it out.`,
                      url: `/product/${productData?.id}`,
                    },
                  })
                )
              );
            }
          } catch (notifyErr) {
            console.warn('[SellerListProductTab] Buyer zone notify skipped:', notifyErr);
          }
        })();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      toast.success('Product Posted Successfully!', {
        description: `"${title.trim()}" is now live on Linkup Marketplace.`,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setPrice('');
      setInventory('1');
      setSizes([]);
      setImages([]);

      if (onSuccess) onSuccess();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      toast.error('Failed to Post Product', {
        description: err?.message || 'Could not publish your listing.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCityName = cities.find((c) => c.id === cityId)?.name || 'Select City';
  const selectedZoneName = zones.find((z) => z.id === zoneId)?.name || 'Select Zone';
  const availableSizes = getAvailableSizes(category);
  const numericPrice = parseFloat(price);

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        containerY.current = e.nativeEvent.layout.y;
      }}
    >
      <View>
        <Text style={styles.eyebrow}>NEW LISTING</Text>
        <Text style={styles.title}>List a Product</Text>
      </View>

      {/* Photos Section */}
      <View
        style={styles.card}
        onLayout={(e) => {
          cardY.current = e.nativeEvent.layout.y;
        }}
      >
        <Text style={styles.label}>PHOTOS (UP TO 5) *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoRow}
        >
          {images.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.photoItem}>
              <Image source={{ uri }} style={styles.photoImage} />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => handleRemoveImage(index)}
              >
                <X size={13} color="#FFFFFF" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ))}

          {images.length < 5 && (
            <>
              <TouchableOpacity
                style={styles.addPhotoBox}
                onPress={handleTakePhoto}
                activeOpacity={0.75}
              >
                <Camera size={20} color={colors.primary} />
                <Text style={styles.addPhotoText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.addPhotoBox}
                onPress={handlePickImage}
                activeOpacity={0.75}
              >
                <ImagePlus size={20} color={colors.primary} />
                <Text style={styles.addPhotoText}>Gallery</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Title */}
        <View
          onLayout={(e) => {
            fieldYOffsets.current['title'] = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>TITLE *</Text>
          <TextInput
            style={[styles.input, focusedField === 'title' && styles.inputFocused]}
            value={title}
            onChangeText={setTitle}
            onFocus={() => handleFieldFocus('title')}
            onBlur={() => setFocusedField(null)}
            placeholder="Product title (e.g. Nike Air Max 270)"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Description */}
        <View
          onLayout={(e) => {
            fieldYOffsets.current['description'] = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              focusedField === 'description' && styles.inputFocused,
            ]}
            value={description}
            onChangeText={setDescription}
            onFocus={() => handleFieldFocus('description')}
            onBlur={() => setFocusedField(null)}
            placeholder="Describe your product condition, specs, and key features..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Category */}
        <Text style={styles.label}>CATEGORY *</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {categories.map((cat) => {
            const active = category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                  setCategory(cat);
                }}
              >
                <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Available Sizes */}
        {availableSizes && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.label}>AVAILABLE SIZES</Text>
            <View style={styles.sizesGrid}>
              {availableSizes.map((sz) => {
                const selected = sizes.includes(sz);
                return (
                  <TouchableOpacity
                    key={sz}
                    style={[styles.sizeBadge, selected && styles.sizeBadgeActive]}
                    onPress={() => handleToggleSize(sz)}
                  >
                    <Text style={[styles.sizeBadgeText, selected && styles.sizeBadgeTextActive]}>
                      {sz}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Price & Inventory */}
        <View
          style={styles.twoColRow}
          onLayout={(e) => {
            fieldYOffsets.current['price'] = e.nativeEvent.layout.y;
            fieldYOffsets.current['inventory'] = e.nativeEvent.layout.y;
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>YOUR EARNINGS (₦) *</Text>
            <TextInput
              style={[styles.input, focusedField === 'price' && styles.inputFocused]}
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
              onFocus={() => handleFieldFocus('price')}
              onBlur={() => setFocusedField(null)}
              placeholder="0"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>QUANTITY AVAILABLE</Text>
            <TextInput
              style={[styles.input, focusedField === 'inventory' && styles.inputFocused]}
              keyboardType="numeric"
              value={inventory}
              onChangeText={(val) => {
                const num = parseInt(val, 10);
                setInventory(val === '' ? '' : String(Math.max(1, isNaN(num) ? 1 : num)));
              }}
              onFocus={() => handleFieldFocus('inventory')}
              onBlur={() => setFocusedField(null)}
              placeholder="1"
              placeholderTextColor="#94A3B8"
            />
          </View>
        </View>

        {/* Earnings Breakdown Box */}
        {price !== '' && !isNaN(numericPrice) && numericPrice > 0 && (
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>You receive:</Text>
              <Text style={styles.breakdownVal}>₦{numericPrice.toLocaleString('en-NG')}</Text>
            </View>
            {applyPlatformMarkup && (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>System Fee (10%):</Text>
                  <Text style={styles.breakdownVal}>
                    ₦{(numericPrice * 0.1).toLocaleString('en-NG')}
                  </Text>
                </View>
                <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                  <Text style={styles.breakdownTotalLabel}>Buyer Pays:</Text>
                  <Text style={styles.breakdownTotalVal}>
                    ₦{(numericPrice * 1.1).toLocaleString('en-NG')}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* City & Zone Selectors */}
        <View style={styles.twoColRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>CITY</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setCityModalOpen(true)}
            >
              <Text
                style={[styles.selectorBtnText, !cityId && { color: '#94A3B8' }]}
                numberOfLines={1}
              >
                {selectedCityName}
              </Text>
              <ChevronDown size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>ZONE</Text>
            <TouchableOpacity
              style={[styles.selectorBtn, !cityId && { opacity: 0.5 }]}
              disabled={!cityId}
              onPress={() => setZoneModalOpen(true)}
            >
              <Text
                style={[styles.selectorBtnText, !zoneId && { color: '#94A3B8' }]}
                numberOfLines={1}
              >
                {selectedZoneName}
              </Text>
              <ChevronDown size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* GPS Pin Bar */}
        <View style={styles.gpsBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <MapPin size={15} color={coords ? '#10B981' : '#64748B'} />
            <Text style={styles.gpsText} numberOfLines={1}>
              {coords
                ? `GPS Pinned (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`
                : 'Attach store GPS coordinates for accurate delivery distance'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gpsPinBtn}
            onPress={handleCaptureLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <LocateFixed size={12} color={colors.primary} />
                <Text style={styles.gpsPinBtnText}>{coords ? 'Update' : 'Pin GPS'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!title.trim() || !price.trim() || !category || images.length === 0 || submitting || processingImages) &&
            styles.submitBtnDisabled,
          ]}
          disabled={
            !title.trim() || !price.trim() || !category || images.length === 0 || submitting || processingImages
          }
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          {submitting || processingImages ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <PackagePlus size={18} color="#FFFFFF" strokeWidth={2.6} />
              <Text style={styles.submitBtnText}>POST PRODUCT</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Dynamic Keyboard Clearance Spacer so bottom fields scroll well above keyboard */}
      <View style={{ height: isKeyboardVisible ? Math.max(380, keyboardHeight + 80) : 40 }} />

      {/* City Picker Modal */}
      <Modal
        visible={cityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setCityModalOpen(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select City</Text>
              <TouchableOpacity onPress={() => setCityModalOpen(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {cities.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.pickerOption}
                  onPress={() => {
                    setCityId(c.id);
                    setZoneId('');
                    setCityModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      cityId === c.id && { color: colors.primary, fontWeight: '900' },
                    ]}
                  >
                    {c.name}
                  </Text>
                  {cityId === c.id && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Zone Picker Modal */}
      <Modal
        visible={zoneModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setZoneModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setZoneModalOpen(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Delivery Zone</Text>
              <TouchableOpacity onPress={() => setZoneModalOpen(false)}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 340 }}>
              {zones.map((z) => (
                <TouchableOpacity
                  key={z.id}
                  style={styles.pickerOption}
                  onPress={() => {
                    setZoneId(z.id);
                    setZoneModalOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      zoneId === z.id && { color: colors.primary, fontWeight: '900' },
                    ]}
                  >
                    {z.name}
                  </Text>
                  {zoneId === z.id && <Check size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    color: '#334155',
    letterSpacing: 1.4,
    marginTop: 14,
    marginBottom: 8,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  photoItem: {
    width: 86,
    height: 86,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoBox: {
    width: 86,
    height: 86,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  textArea: {
    height: 96,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  sizesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sizeBadgeActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sizeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  sizeBadgeTextActive: {
    color: '#FFFFFF',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  breakdownCard: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginTop: 4,
  },
  breakdownTotalLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  breakdownTotalVal: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primary,
  },
  selectorBtn: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  gpsBar: {
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gpsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  gpsPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFEDD5',
  },
  gpsPinBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  submitBtn: {
    marginTop: 22,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
});
