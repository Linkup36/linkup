import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { colors } from '../../../theme/colors';
import { toast } from '../../../components/ui/GooeyToast';
import { useGeolocation } from '../../logistics/hooks/useGeolocation';
import { getAvailableSizes } from '../../marketplace/utils/product-sizes';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  X,
  PackagePlus,
  ChevronDown,
  Check,
} from 'lucide-react-native';

const FALLBACK_CATEGORIES = [
  'Clothing & Apparel',
  'Footwear & Shoes',
  'Phones & Tablets',
  'Electronics & Gadgets',
  'Beauty & Personal Care',
  'Home & Kitchen',
  'Jewelry & Accessories',
  'Food & Groceries',
  'Vehicles & Auto',
];

export function ListProductScreen() {
  const navigation = useNavigation<any>();
  const { user, profile } = useAuth();
  const { position } = useGeolocation();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [inventory, setInventory] = useState('1');
  const [category, setCategory] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [cityId, setCityId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Dynamic Metadata State
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [zones, setZones] = useState<{ id: string; name: string; city_id: string }[]>([]);

  // Picker Modal State
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    title: string;
    items: { label: string; value: string }[];
    selectedValue: string;
    onSelect: (val: string) => void;
  }>({
    visible: false,
    title: '',
    items: [],
    selectedValue: '',
    onSelect: () => {},
  });

  // 1. Fetch Categories, Cities, and Profile Defaults
  useEffect(() => {
    async function fetchMetadata() {
      try {
        // Fetch Categories
        const { data: catData } = await supabase
          .from('categories')
          .select('name')
          .order('name');
        if (catData && catData.length > 0) {
          const names = catData.map((c: any) => c.name);
          setCategories(names);
          if (!category) setCategory(names[0]);
        } else if (!category) {
          setCategory(FALLBACK_CATEGORIES[0]);
        }

        // Fetch Cities
        const { data: cityData } = await supabase
          .from('cities')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        if (cityData && cityData.length > 0) {
          setCities(cityData);
        }

        // Auto-select seller's default city & zone from profile if available
        if (profile?.city_id) {
          setCityId(profile.city_id);
        }
        if (profile?.zone_id) {
          setZoneId(profile.zone_id);
        }
      } catch (err) {
        console.warn('[ListProductScreen] Error loading metadata:', err);
      }
    }

    fetchMetadata();
  }, [profile]);

  // 2. Fetch Zones when City changes
  useEffect(() => {
    async function fetchZones() {
      if (!cityId) {
        setZones([]);
        setZoneId('');
        return;
      }
      try {
        const { data: zoneData } = await supabase
          .from('delivery_zones')
          .select('id, name, city_id')
          .eq('city_id', cityId)
          .eq('is_active', true)
          .order('name');
        if (zoneData) {
          setZones(zoneData);
          // If current zoneId is not in the new zones, reset it
          if (!zoneData.some((z) => z.id === zoneId)) {
            setZoneId(zoneData[0]?.id || '');
          }
        }
      } catch (err) {
        console.warn('[ListProductScreen] Error loading zones:', err);
      }
    }

    fetchZones();
  }, [cityId]);

  // Sizes available for the active category
  const availableSizes = getAvailableSizes(category);

  const toggleSize = (size: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  // Image Handlers
  const handlePickGallery = async () => {
    Haptics.selectionAsync().catch(() => {});
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Permission to access photos is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris].slice(0, 5));
    }
  };

  const handleTakePhoto = async () => {
    Haptics.selectionAsync().catch(() => {});
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Permission to access camera is required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImages((prev) => [...prev, result.assets[0].uri].slice(0, 5));
    }
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Submit
  const handleSubmitProduct = async () => {
    if (!title.trim()) {
      toast.error('Please enter a product title');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }
    if (!category) {
      toast.error('Please select a product category');
      return;
    }
    if (!cityId) {
      toast.error('Please select your city for delivery routing');
      return;
    }
    if (images.length === 0) {
      toast.error('Please upload at least one product photo');
      return;
    }
    if (!user) {
      toast.error('You must be signed in to publish products');
      return;
    }

    setSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      // 1. Upload images to 'product-images' storage bucket (matching web)
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const localUri = images[i];
        const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
        const cleanExt = ext === 'png' ? 'png' : 'jpeg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        const response = await fetch(localUri);
        const blob = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(path, blob, { contentType: `image/${cleanExt}` });

        if (uploadError) {
          console.error('[ListProductScreen] Image upload error:', uploadError);
          throw new Error('Image upload failed: ' + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(uploadData.path);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // 2. Insert product row in Supabase (matching exact schema & web columns)
      const { error: insertError } = await supabase.from('products').insert({
        seller_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        category,
        inventory: Math.max(1, parseInt(inventory, 10) || 1),
        images: uploadedUrls,
        latitude: position?.latitude || null,
        longitude: position?.longitude || null,
        city_id: cityId || null,
        zone_id: zoneId || null,
        sizes: selectedSizes,
      });

      if (insertError) {
        throw insertError;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success('Product posted successfully!');
      navigation.goBack();
    } catch (err: any) {
      console.error('[ListProductScreen] Error publishing product:', err);
      toast.error(err.message || 'Could not publish product. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCityName = cities.find((c) => c.id === cityId)?.name || 'Select City';
  const selectedZoneName = zones.find((z) => z.id === zoneId)?.name || 'Select Zone';

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color="#0f172a" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerSubtitle}>New Listing</Text>
          <Text style={styles.headerTitle}>List a Product</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Photos (Up to 5) *</Text>
          <View style={styles.photoGrid}>
            {images.map((uri, index) => (
              <View key={index} style={styles.photoThumbWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <TouchableOpacity
                  style={styles.removePhotoBtn}
                  onPress={() => handleRemoveImage(index)}
                  activeOpacity={0.8}
                >
                  <X size={13} color="#ffffff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}

            {images.length < 5 && (
              <View style={styles.addPhotoGroup}>
                <TouchableOpacity
                  style={styles.addPhotoBox}
                  onPress={handlePickGallery}
                  activeOpacity={0.7}
                >
                  <ImagePlus size={22} color={colors.primary} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPhotoBox}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                >
                  <Camera size={22} color={colors.primary} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Product title"
            placeholderTextColor="#94a3b8"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your product"
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Category *</Text>
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={() =>
              setPickerModal({
                visible: true,
                title: 'Select Category',
                items: categories.map((c) => ({ label: c, value: c })),
                selectedValue: category,
                onSelect: (val) => setCategory(val),
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.selectBtnText}>{category || 'Select category'}</Text>
            <ChevronDown size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Available Sizes (if category supports sizes) */}
        {availableSizes && availableSizes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Available Sizes</Text>
            <View style={styles.sizesRow}>
              {availableSizes.map((size) => {
                const isSelected = selectedSizes.includes(size);
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.sizeBadge, isSelected && styles.sizeBadgeActive]}
                    onPress={() => toggleSize(size)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.sizeBadgeText, isSelected && styles.sizeBadgeTextActive]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Price & Quantity Available */}
        <View style={styles.row}>
          <View style={[styles.section, styles.half]}>
            <Text style={styles.fieldLabel}>Your Earnings (₦) *</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={price}
              onChangeText={setPrice}
            />
            {price && !isNaN(parseFloat(price)) && parseFloat(price) > 0 && (
              <View style={styles.earningsBox}>
                <View style={styles.earningsRow}>
                  <Text style={styles.earningsLabel}>You receive:</Text>
                  <Text style={styles.earningsValue}>
                    ₦{parseFloat(price).toLocaleString()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.section, styles.half]}>
            <Text style={styles.fieldLabel}>Quantity Available</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={inventory}
              onChangeText={(t) =>
                setInventory(Math.max(1, parseInt(t, 10) || 1).toString())
              }
            />
          </View>
        </View>

        {/* City & Zone Delivery Routing */}
        <View style={styles.row}>
          <View style={[styles.section, styles.half]}>
            <Text style={styles.fieldLabel}>City *</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() =>
                setPickerModal({
                  visible: true,
                  title: 'Select City',
                  items: cities.map((c) => ({ label: c.name, value: c.id })),
                  selectedValue: cityId,
                  onSelect: (val) => {
                    setCityId(val);
                    setZoneId('');
                  },
                })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.selectBtnText} numberOfLines={1}>
                {selectedCityName}
              </Text>
              <ChevronDown size={16} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={[styles.section, styles.half]}>
            <Text style={styles.fieldLabel}>Zone</Text>
            <TouchableOpacity
              style={[styles.selectBtn, !cityId && styles.selectBtnDisabled]}
              onPress={() => {
                if (!cityId) {
                  toast.info('Please select a city first');
                  return;
                }
                setPickerModal({
                  visible: true,
                  title: 'Select Delivery Zone',
                  items: zones.map((z) => ({ label: z.name, value: z.id })),
                  selectedValue: zoneId,
                  onSelect: (val) => setZoneId(val),
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.selectBtnText} numberOfLines={1}>
                {selectedZoneName}
              </Text>
              <ChevronDown size={16} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Post Product Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!title.trim() ||
              !price.trim() ||
              !category ||
              !cityId ||
              images.length === 0 ||
              submitting) &&
              styles.submitBtnDisabled,
          ]}
          onPress={handleSubmitProduct}
          disabled={
            !title.trim() ||
            !price.trim() ||
            !category ||
            !cityId ||
            images.length === 0 ||
            submitting
          }
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <PackagePlus size={18} color="#ffffff" strokeWidth={3} />
              <Text style={styles.submitBtnText}>Post Product</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Select Picker Modal */}
      <Modal
        visible={pickerModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModal((prev) => ({ ...prev, visible: false }))}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerModal((prev) => ({ ...prev, visible: false }))}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerModal.title}</Text>
              <TouchableOpacity
                onPress={() => setPickerModal((prev) => ({ ...prev, visible: false }))}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={pickerModal.items}
              keyExtractor={(item) => item.value}
              style={{ maxHeight: 340 }}
              renderItem={({ item }) => {
                const isSelected = item.value === pickerModal.selectedValue;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => {
                      pickerModal.onSelect(item.value);
                      setPickerModal((prev) => ({ ...prev, visible: false }));
                    }}
                  >
                    <Text
                      style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  scroll: {
    padding: 18,
    gap: 18,
    paddingBottom: 48,
  },
  section: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  selectBtnDisabled: {
    opacity: 0.5,
  },
  selectBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    marginRight: 6,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumbWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  addPhotoBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.primary,
  },
  sizesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#ffffff',
  },
  earningsBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  earningsValue: {
    fontSize: 11,
    fontWeight: '900',
    color: '#15803d',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 10,
  },
  submitBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: 440,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  modalItemActive: {
    backgroundColor: '#fff7ed',
  },
  modalItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  modalItemTextActive: {
    color: colors.primary,
    fontWeight: '900',
  },
});
