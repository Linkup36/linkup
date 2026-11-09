import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { ArrowLeft, Camera, ImagePlus, X, CheckCircle2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

const CATEGORIES = [
  'Phones & Tablets',
  'Electronics',
  'Fashion',
  'Beauty',
  'Home & Kitchen',
  'Vehicles',
  'Food & Groceries',
];

const CONDITIONS = ['Brand New', 'Refurbished', 'Used'];

export function ListProductScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [condition, setCondition] = useState(CONDITIONS[0]);
  const [stock, setStock] = useState('1');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Pick image from native photo gallery
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permissions are required to upload pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...uris]);
    }
  };

  // Capture photo with device camera
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permissions are required to take photos of items.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitProduct = async () => {
    if (!title.trim() || !price.trim()) {
      Alert.alert('Required Fields', 'Please enter a product title and price.');
      return;
    }
    if (!user) {
      Alert.alert('Not Logged In', 'You must be signed in to list products for sale.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload images to Supabase storage 'products' bucket
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const localUri = images[i];
        const filename = `${user.id}/${Date.now()}_${i}.jpg`;
        const response = await fetch(localUri);
        const blob = await response.blob();

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('products')
          .upload(filename, blob, { contentType: 'image/jpeg' });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('products')
            .getPublicUrl(uploadData.path);
          uploadedUrls.push(publicUrlData.publicUrl);
        }
      }

      // 2. Insert product row in Supabase
      const { data, error } = await supabase.from('products').insert({
        seller_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        category,
        condition,
        stock: parseInt(stock, 10) || 1,
        images: uploadedUrls.length > 0 ? uploadedUrls : [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'
        ],
      }).select().single();

      if (error) throw error;

      Alert.alert('Success!', 'Your item is now live on the marketplace.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Listing Failed', err.message || 'Could not publish your product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeView>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List an Item for Sale</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Photo Gallery Picker */}
        <Text style={styles.sectionLabel}>Product Photos (Up to 5)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {images.map((uri, index) => (
            <View key={index} style={styles.photoThumbWrap}>
              <Image source={{ uri }} style={styles.photoThumb} />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => handleRemoveImage(index)}
              >
                <X size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}

          {images.length < 5 && (
            <View style={styles.addPhotoButtons}>
              <TouchableOpacity style={styles.addPhotoBox} onPress={handleTakePhoto} activeOpacity={0.7}>
                <Camera size={22} color="#4f46e5" />
                <Text style={styles.addPhotoText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addPhotoBox} onPress={handlePickImage} activeOpacity={0.7}>
                <ImagePlus size={22} color="#4f46e5" />
                <Text style={styles.addPhotoText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Title & Description */}
        <Text style={styles.fieldLabel}>Product Title *</Text>
        <TextInput
          placeholder="e.g. iPhone 14 Pro Max 256GB Deep Purple"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          placeholder="Provide details about condition, accessories, battery health..."
          placeholderTextColor="#94a3b8"
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        {/* Pricing */}
        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Price (₦) *</Text>
            <TextInput
              placeholder="e.g. 350000"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              style={styles.input}
              value={price}
              onChangeText={setPrice}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.fieldLabel}>Original Price (₦)</Text>
            <TextInput
              placeholder="Optional discount"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              style={styles.input}
              value={originalPrice}
              onChangeText={setOriginalPrice}
            />
          </View>
        </View>

        {/* Category Pills */}
        <Text style={styles.fieldLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.pill, category === cat && styles.pillActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.pillText, category === cat && styles.pillTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Condition */}
        <Text style={styles.fieldLabel}>Condition</Text>
        <View style={styles.conditionRow}>
          {CONDITIONS.map((cond) => (
            <TouchableOpacity
              key={cond}
              style={[styles.condBtn, condition === cond && styles.condBtnActive]}
              onPress={() => setCondition(cond)}
            >
              <Text style={[styles.condText, condition === cond && styles.condTextActive]}>{cond}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          title="Publish Product"
          onPress={handleSubmitProduct}
          loading={submitting}
          style={{ marginTop: 28 }}
        />
      </ScrollView>
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  photoScroll: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  photoThumbWrap: {
    position: 'relative',
    marginRight: 10,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addPhotoBox: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4f46e5',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
    marginBottom: 6,
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
  priceRow: {
    flexDirection: 'row',
  },
  pillsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
  },
  pillActive: {
    backgroundColor: '#4f46e5',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  condBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  condBtnActive: {
    backgroundColor: '#4f46e5',
  },
  condText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  condTextActive: {
    color: '#ffffff',
  },
});
