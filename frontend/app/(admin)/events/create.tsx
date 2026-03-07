import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronDown, CheckCircle, Camera, Image as ImageIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../utils/api';
import { COLORS, RADIUS, SPACING, CATEGORIES, COVER_IMAGES, CATEGORY_COLORS } from '../../../constants/theme';
import { rw, rh, rf, rs, SCREEN_W } from '../../../utils/responsive';

export default function CreateEventScreen() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    venue: '',
    category: 'Music',
    price: '',
    total_tickets: '',
    organizer_name: 'GreyAdz Events',
    tags: '',
  });
  const [posterUri, setPosterUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const router = useRouter();

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to upload a poster.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const b64 = `data:image/jpeg;base64,${asset.base64}`;
      setPosterUri(b64);
    }
  };

  const takePicture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const b64 = `data:image/jpeg;base64,${asset.base64}`;
      setPosterUri(b64);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.description || !form.venue || !form.price || !form.total_tickets) {
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        date: new Date(form.date).toISOString(),
        venue: form.venue,
        category: form.category,
        price: parseFloat(form.price),
        total_tickets: parseInt(form.total_tickets),
        organizer_name: form.organizer_name,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      if (posterUri) {
        payload.cover_image_data = posterUri;
      } else {
        payload.cover_image_url = COVER_IMAGES[form.category] || COVER_IMAGES.Music;
      }
      await api.post('/events', payload);
      setCreated(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <View style={styles.successWrap} testID="event-created-screen">
        <View style={styles.successIcon}>
          <CheckCircle size={rf(48)} color={COLORS.success} strokeWidth={1.5} />
        </View>
        <Text style={styles.successTitle}>Event Created!</Text>
        <Text style={styles.successSub}>Your event is now live on the platform</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(admin)/events/')}>
          <Text style={styles.primaryBtnText}>View All Events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => { setCreated(false); setPosterUri(null); setForm(f => ({ ...f, title: '', description: '', venue: '', price: '', total_tickets: '', tags: '' })); }}>
          <Text style={styles.ghostBtnText}>Create Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[form.category] || '#FFF';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Event</Text>
          <TouchableOpacity testID="close-create-btn" style={styles.closeBtn} onPress={() => router.back()}>
            <X size={rf(18)} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Poster Upload */}
          <Text style={styles.label}>Event Poster</Text>
          <View style={styles.posterWrap}>
            {posterUri ? (
              <View style={styles.posterPreview}>
                <Image source={{ uri: posterUri }} style={styles.posterImg} resizeMode="cover" />
                <TouchableOpacity style={styles.changePosterBtn} onPress={() => setPosterUri(null)}>
                  <X size={14} color="#FFF" />
                  <Text style={styles.changePosterText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.posterBtns}>
                <TouchableOpacity style={styles.posterBtn} onPress={pickImage}>
                  <ImageIcon size={rf(22)} color="#7C3AED" />
                  <Text style={styles.posterBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.posterBtn} onPress={takePicture}>
                  <Camera size={rf(22)} color="#3B82F6" />
                  <Text style={styles.posterBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.label}>Event Title *</Text>
          <TextInput testID="input-title" style={styles.input} value={form.title} onChangeText={v => set('title', v)} placeholder="e.g. Neon Dreams Festival" placeholderTextColor={COLORS.textTertiary} />

          {/* Description */}
          <Text style={styles.label}>Description *</Text>
          <TextInput testID="input-description" style={[styles.input, styles.inputMulti]} value={form.description} onChangeText={v => set('description', v)} placeholder="Describe your event..." placeholderTextColor={COLORS.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />

          {/* Category */}
          <Text style={styles.label}>Category *</Text>
          <TouchableOpacity testID="category-picker" style={[styles.picker, { borderColor: catColor + '60' }]} onPress={() => setShowCatPicker(!showCatPicker)}>
            <View style={[styles.catDot, { backgroundColor: catColor }]} />
            <Text style={[styles.pickerText, { color: catColor }]}>{form.category}</Text>
            <ChevronDown size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          {showCatPicker && (
            <View style={styles.dropdown}>
              {CATEGORIES.filter(c => c !== 'All').map(cat => (
                <TouchableOpacity key={cat} testID={`cat-option-${cat}`} style={[styles.dropdownItem, form.category === cat && { backgroundColor: CATEGORY_COLORS[cat] + '20' }]} onPress={() => { set('category', cat); setShowCatPicker(false); }}>
                  <View style={[styles.catDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                  <Text style={[styles.dropdownText, form.category === cat && { color: CATEGORY_COLORS[cat], fontWeight: '700' }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Venue */}
          <Text style={styles.label}>Venue *</Text>
          <TextInput testID="input-venue" style={styles.input} value={form.venue} onChangeText={v => set('venue', v)} placeholder="e.g. MMRDA Grounds, Mumbai" placeholderTextColor={COLORS.textTertiary} />

          {/* Date */}
          <Text style={styles.label}>Date & Time *</Text>
          <TextInput testID="input-date" style={styles.input} value={form.date} onChangeText={v => set('date', v)} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={COLORS.textTertiary} />

          {/* Price + Tickets */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput testID="input-price" style={styles.input} value={form.price} onChangeText={v => set('price', v)} placeholder="999" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Total Tickets *</Text>
              <TextInput testID="input-tickets" style={styles.input} value={form.total_tickets} onChangeText={v => set('total_tickets', v)} placeholder="200" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" />
            </View>
          </View>

          {/* Organizer */}
          <Text style={styles.label}>Organizer Name</Text>
          <TextInput testID="input-organizer_name" style={styles.input} value={form.organizer_name} onChangeText={v => set('organizer_name', v)} placeholder="GreyAdz Events" placeholderTextColor={COLORS.textTertiary} />

          {/* Tags */}
          <Text style={styles.label}>Tags (comma separated)</Text>
          <TextInput testID="input-tags" style={styles.input} value={form.tags} onChangeText={v => set('tags', v)} placeholder="music, festival, outdoor" placeholderTextColor={COLORS.textTertiary} />

          <TouchableOpacity
            testID="submit-create-event-btn"
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Create Event</Text>}
          </TouchableOpacity>

          <View style={{ height: rs(110) }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(20), paddingVertical: rs(14) },
  headerTitle: { color: COLORS.textPrimary, fontSize: rf(20), fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  scroll: { paddingHorizontal: rs(20) },
  label: { color: COLORS.textSecondary, fontSize: rf(13), fontWeight: '600', marginBottom: rs(6), marginTop: rs(4) },
  input: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: rs(13), color: COLORS.textPrimary, fontSize: rf(14), borderWidth: 1, borderColor: COLORS.border, marginBottom: rs(4) },
  inputMulti: { height: rh(90), textAlignVertical: 'top' },
  picker: { flexDirection: 'row', alignItems: 'center', gap: rs(8), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: rs(13), borderWidth: 1, marginBottom: rs(4) },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  pickerText: { flex: 1, fontSize: rf(14), fontWeight: '600' },
  dropdown: { backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: rs(8), overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: rs(8), padding: rs(12), borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  dropdownText: { color: COLORS.textSecondary, fontSize: rf(14) },
  row: { flexDirection: 'row', gap: rs(10) },
  posterWrap: { marginBottom: rs(8) },
  posterBtns: { flexDirection: 'row', gap: rs(10) },
  posterBtn: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', paddingVertical: rs(20), alignItems: 'center', gap: rs(6) },
  posterBtnText: { color: COLORS.textSecondary, fontSize: rf(12), fontWeight: '600' },
  posterPreview: { position: 'relative', borderRadius: RADIUS.md, overflow: 'hidden' },
  posterImg: { width: '100%', height: rh(160), borderRadius: RADIUS.md },
  changePosterBtn: { position: 'absolute', top: rs(8), right: rs(8), flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: RADIUS.full, paddingHorizontal: rs(10), paddingVertical: rs(5) },
  changePosterText: { color: '#FFF', fontSize: rf(11), fontWeight: '600' },
  submitBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingVertical: rs(15), alignItems: 'center', marginTop: rs(12) },
  submitBtnText: { color: COLORS.btnPrimaryText, fontSize: rf(16), fontWeight: '700' },
  successWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: rs(32), gap: rs(12) },
  successIcon: { width: rs(96), height: rs(96), borderRadius: rs(48), backgroundColor: COLORS.success + '15', alignItems: 'center', justifyContent: 'center', marginBottom: rs(8) },
  successTitle: { color: COLORS.textPrimary, fontSize: rf(24), fontWeight: '800' },
  successSub: { color: COLORS.textSecondary, fontSize: rf(14), textAlign: 'center' },
  primaryBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: rs(32), paddingVertical: rs(14), width: '100%', alignItems: 'center', marginTop: rs(8) },
  primaryBtnText: { color: '#000', fontSize: rf(16), fontWeight: '700' },
  ghostBtn: { paddingVertical: rs(12) },
  ghostBtnText: { color: COLORS.textSecondary, fontSize: rf(14) },
});
