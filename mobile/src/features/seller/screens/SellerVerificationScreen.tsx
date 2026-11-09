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
} from 'react-native';
import { SafeView } from '../../../components/ui/SafeView';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../services/supabase';
import { ArrowLeft, Camera, ShieldCheck, CheckCircle2, FileText, Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

const ID_TYPES = ['National ID (NIN)', "Driver's License", 'International Passport', "Voter's Card"];

export function SellerVerificationScreen() {
  const navigation = useNavigation();
  const { user, profile, refreshProfile } = useAuth();

  const [idType, setIdType] = useState(ID_TYPES[0]);
  const [idNumber, setIdNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [cacNumber, setCacNumber] = useState('');
  const [docImageUri, setDocImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickDocument = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setDocImageUri(result.assets[0].uri);
    }
  };

  const handleCaptureDocument = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission required to photograph ID.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setDocImageUri(result.assets[0].uri);
    }
  };

  const handleSubmitKYC = async () => {
    if (!idNumber.trim() || !docImageUri) {
      Alert.alert('Missing Info', 'Please provide your ID number and upload a clear photo of your ID.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      // 1. Upload ID document to Supabase storage 'kyc-documents' bucket
      const filename = `${user.id}/kyc_${Date.now()}.jpg`;
      const response = await fetch(docImageUri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('kyc-documents')
        .upload(filename, blob, { contentType: 'image/jpeg' });

      let publicUrl = '';
      if (!uploadErr && uploadData) {
        publicUrl = supabase.storage.from('kyc-documents').getPublicUrl(uploadData.path).data.publicUrl;
      }

      // 2. Insert into seller_verifications table
      const { error: insertErr } = await supabase.from('seller_verifications').insert({
        seller_id: user.id,
        id_type: idType,
        id_number: idNumber.trim(),
        id_document_url: publicUrl || docImageUri,
        business_name: businessName.trim() || null,
        cac_number: cacNumber.trim() || null,
        status: 'pending',
      });

      if (insertErr) throw insertErr;

      // 3. Update profile KYC status
      await supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', user.id);
      await refreshProfile();

      Alert.alert(
        'Verification Submitted',
        'Your KYC documents have been uploaded for review. Our compliance team verifies accounts within 24 hours.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Could not submit verification.');
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
        <Text style={styles.headerTitle}>Merchant Verification (KYC)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.banner}>
          <ShieldCheck size={28} color="#4f46e5" />
          <View style={styles.bannerText}>
            <Text style={styles.bannerTitle}>Verified Seller Badge</Text>
            <Text style={styles.bannerSubtitle}>
              Protect your business and gain trust from thousands of active buyers on Linkup.
            </Text>
          </View>
        </View>

        {/* ID Type Selector */}
        <Text style={styles.label}>Select Government ID *</Text>
        <View style={styles.idTypesWrap}>
          {ID_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.idChip, idType === type && styles.idChipActive]}
              onPress={() => setIdType(type)}
            >
              <Text style={[styles.idChipText, idType === type && styles.idChipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>ID Number (NIN / License No.) *</Text>
        <TextInput
          placeholder="e.g. 12345678901"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={idNumber}
          onChangeText={setIdNumber}
        />

        {/* Document Photo Upload */}
        <Text style={styles.label}>Upload ID Document Photo *</Text>
        {docImageUri ? (
          <View style={styles.previewBox}>
            <Image source={{ uri: docImageUri }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity style={styles.changeBtn} onPress={handlePickDocument}>
              <Text style={styles.changeBtnText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadButtons}>
            <TouchableOpacity style={styles.uploadBtn} onPress={handleCaptureDocument} activeOpacity={0.7}>
              <Camera size={22} color="#4f46e5" />
              <Text style={styles.uploadBtnText}>Take Live Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument} activeOpacity={0.7}>
              <Upload size={22} color="#4f46e5" />
              <Text style={styles.uploadBtnText}>Upload from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Optional Business Details */}
        <Text style={[styles.label, { marginTop: 24 }]}>Registered Business Name (Optional)</Text>
        <TextInput
          placeholder="e.g. Apex Gadgets Ltd"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={businessName}
          onChangeText={setBusinessName}
        />

        <Text style={styles.label}>CAC / RC Number (Optional)</Text>
        <TextInput
          placeholder="e.g. RC 1928374"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={cacNumber}
          onChangeText={setCacNumber}
        />

        <Button
          title="Submit for Verification"
          onPress={handleSubmitKYC}
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
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#eef2ff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#312e81',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#4338ca',
    marginTop: 2,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 14,
    marginBottom: 6,
  },
  idTypesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  idChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  idChipActive: {
    backgroundColor: '#4f46e5',
  },
  idChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  idChipTextActive: {
    color: '#ffffff',
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
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadBtn: {
    flex: 1,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  previewBox: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  changeBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
