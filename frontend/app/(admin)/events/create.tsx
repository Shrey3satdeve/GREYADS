import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronDown, CheckCircle, Camera, Image as ImageIcon, MapPin, Calendar, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../utils/api';
import { storage } from '../../../utils/firebase';
import { COLORS, RADIUS, SPACING, CATEGORIES, COVER_IMAGES, CATEGORY_COLORS, getCategoryImage } from '../../../constants/theme';
import { rw, rh, rf, rs, SCREEN_W } from '../../../utils/responsive';
import { useDialog } from '../../../components/AppDialog';

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
    is_recommended: false,
  });
  const [venueSuggestions, setVenueSuggestions] = useState<any[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [posterUris, setPosterUris] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const router = useRouter();
  const { showDialog, DialogComponent } = useDialog();

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showDialog({ title: 'Permission Needed', message: 'Allow access to your photo library to upload a poster.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.6,
    });
    if (!result.canceled && result.assets) {
      const newUris = result.assets.map(asset => asset.uri);
      setPosterUris(prev => [...prev, ...newUris]);
    }
  };

  const takePicture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showDialog({ title: 'Permission Needed', message: 'Allow camera access to take a photo.' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPosterUris(prev => [...prev, result.assets[0].uri]);
    }
  };

  const uploadImage = async (uri: string) => {
    const filename = `events/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    
    // In React Native with @react-native-firebase/storage, putFile is much more stable than put(blob)
    if (Platform.OS !== 'web' && (uri.startsWith('file://') || uri.startsWith('/'))) {
      const storageRef = storage.ref(filename);
      const cleanUri = uri.replace('file://', '');
      await storageRef.putFile(cleanUri);
      return await storageRef.getDownloadURL();
    }

    // Fallback for web or non-file URIs
    const response = await fetch(uri);
    const blob = await response.blob();
    const storageRef = (storage as any).ref(filename);
    await storageRef.put(blob);
    return await storageRef.getDownloadURL();
  };

  const handleCreate = async () => {
    if (!form.title || !form.description || !form.venue || !form.price || !form.total_tickets) {
      showDialog({ title: 'Missing Fields', message: 'Please fill all required fields.' });
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
      if (posterUris.length > 0) {
        const uploadResults = await Promise.allSettled(posterUris.map(uri => 
          (uri.startsWith('https://') || uri.startsWith('http://')) 
            ? Promise.resolve(uri) 
            : uploadImage(uri)
        ));
        const imageUrls = uploadResults
          .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled' && !!result.value)
          .map((result) => result.value);

        if (imageUrls.length > 0) {
          payload.cover_image_url = imageUrls[0];
          payload.images = imageUrls;
        } else {
          payload.cover_image_url = getCategoryImage(form.category, form.title);
          payload.images = [payload.cover_image_url];
        }
      } else {
        payload.cover_image_url = getCategoryImage(form.category, form.title);
        payload.images = [payload.cover_image_url];
      }
      payload.is_recommended = form.is_recommended;
      await api.post('/events', payload);
      setCreated(true);
    } catch (err: any) {
      showDialog({ title: 'Error', message: err.message || 'Failed to create event' });
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
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(admin)/events')}>
          <Text style={styles.primaryBtnText}>View All Events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => { setCreated(false); setPosterUris([]); setForm(f => ({ ...f, title: '', description: '', venue: '', price: '', total_tickets: '', tags: '' })); }}>
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
          <View style={styles.labelRow}>
            <Text style={styles.label}>Event Images ({posterUris.length})</Text>
            {posterUris.length > 0 && (
              <TouchableOpacity onPress={() => setPosterUris([])}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.posterSection}>
            {posterUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll} contentContainerStyle={{ gap: rs(10), paddingRight: 20 }}>
                {posterUris.map((uri, idx) => (
                  <View key={idx} style={styles.posterPreview}>
                    <Image source={{ uri }} style={styles.posterImg} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setPosterUris(prev => prev.filter((_, i) => i !== idx))}>
                      <X size={12} color="#FFF" />
                    </TouchableOpacity>
                    {idx === 0 && (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeText}>Cover</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.posterBtns}>
              <TouchableOpacity style={styles.posterBtn} onPress={pickImage}>
                <ImageIcon size={rf(20)} color="#7C3AED" />
                <Text style={styles.posterBtnText}>Add Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.posterBtn} onPress={takePicture}>
                <Camera size={rf(20)} color="#3B82F6" />
                <Text style={styles.posterBtnText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
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

          {/* Venue & Location Suggestions */}
          <Text style={styles.label}>Venue *</Text>
          <View style={styles.venueContainer}>
            <TextInput 
              testID="input-venue" 
              style={styles.input} 
              value={form.venue} 
              onChangeText={v => {
                set('venue', v);
                if (v.length > 2) {
                  // Fetch location suggestions (Nominatim API)
                  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(v)}&limit=5`)
                    .then(res => res.json())
                    .then(data => setVenueSuggestions(data))
                    .catch(() => {});
                } else {
                  setVenueSuggestions([]);
                }
              }} 
              placeholder="e.g. MMRDA Grounds, Mumbai" 
              placeholderTextColor={COLORS.textTertiary} 
            />
            {venueSuggestions.length > 0 && (
              <View style={styles.suggestionsList}>
                {venueSuggestions.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.suggestionItem} 
                    onPress={() => {
                      set('venue', item.display_name);
                      setVenueSuggestions([]);
                    }}
                  >
                    <MapPin size={14} color={COLORS.textSecondary} />
                    <Text style={styles.suggestionText} numberOfLines={1}>{item.display_name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Date & Time * Modern Pickers */}
          <Text style={styles.label}>Date & Time *</Text>
          <View style={styles.row}>
            <TouchableOpacity 
              style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Calendar size={18} color={COLORS.textSecondary} />
              <Text style={{ color: form.date ? COLORS.textPrimary : COLORS.textTertiary }}>
                {form.date ? new Date(form.date).toLocaleDateString() : 'Select Date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.input, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }]}
              onPress={() => setShowTimePicker(true)}
            >
              <Clock size={18} color={COLORS.textSecondary} />
              <Text style={{ color: form.date ? COLORS.textPrimary : COLORS.textTertiary }}>
                {form.date ? new Date(form.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Select Time'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recommendation Panel Toggle */}
          <View style={styles.recommendRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Show in Recommendation Panel</Text>
              <Text style={styles.recommendSub}>Feautured on the community home screen</Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggleBase, form.is_recommended && styles.toggleActive]}
              onPress={() => set('is_recommended', !form.is_recommended)}
            >
              <View style={[styles.toggleCircle, form.is_recommended && styles.toggleCircleActive]} />
            </TouchableOpacity>
          </View>

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
      
      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modernPicker}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <Calendar size={48} color={COLORS.textTertiary} strokeWidth={1} />
            {/* Simple date picker for demo - in production use @react-native-community/datetimepicker */}
            <TextInput 
              style={styles.modalInput} 
              placeholder="YYYY-MM-DD" 
              placeholderTextColor={COLORS.textTertiary}
              onChangeText={v => {
                const parts = (form.date || '').split('T');
                set('date', `${v}T${parts[1] || '12:00'}`);
              }}
            />
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.doneBtnText}>Confirm Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modernPicker}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <Clock size={48} color={COLORS.textTertiary} strokeWidth={1} />
            <TextInput 
              style={styles.modalInput} 
              placeholder="HH:MM" 
              placeholderTextColor={COLORS.textTertiary}
              onChangeText={v => {
                const parts = (form.date || '').split('T');
                set('date', `${parts[0] || '2026-03-25'}T${v}`);
              }}
            />
            <TouchableOpacity style={styles.doneBtn} onPress={() => setShowTimePicker(false)}>
              <Text style={styles.doneBtnText}>Confirm Time</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {DialogComponent}
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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(6), marginTop: rs(4) },
  clearText: { color: COLORS.error, fontSize: rf(11), fontWeight: '600' },
  posterSection: { marginBottom: rs(12) },
  previewScroll: { marginBottom: rs(12) },
  posterBtns: { flexDirection: 'row', gap: rs(10) },
  posterBtn: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', paddingVertical: rs(16), alignItems: 'center', gap: rs(4) },
  posterBtnText: { color: COLORS.textSecondary, fontSize: rf(12), fontWeight: '600' },
  posterPreview: { position: 'relative', width: rs(120), height: rh(80), borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  posterImg: { width: '100%', height: '100%', borderRadius: RADIUS.md },
  removeImageBtn: { position: 'absolute', top: rs(4), right: rs(4), width: 22, height: 22, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  coverBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(124, 58, 237, 0.9)', paddingVertical: 2, alignItems: 'center' },
  coverBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
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
  venueContainer: { position: 'relative', zIndex: 10 },
  suggestionsList: { position: 'absolute', top: rs(48), left: 0, right: 0, backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, elevation: 10, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, zIndex: 100 },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: rs(10), padding: rs(14), borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  suggestionText: { color: COLORS.textSecondary, fontSize: rf(13) },
  recommendRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: rs(16), borderWidth: 1, borderColor: COLORS.border, marginTop: rs(10), marginBottom: rs(12) },
  recommendSub: { color: COLORS.textTertiary, fontSize: rf(11), marginTop: 2 },
  toggleBase: { width: rs(44), height: rs(24), borderRadius: rs(12), backgroundColor: COLORS.bgTertiary, padding: 2, borderWidth: 1, borderColor: COLORS.border },
  toggleActive: { backgroundColor: '#7C3AED80', borderColor: '#7C3AED' },
  toggleCircle: { width: rs(18), height: rs(18), borderRadius: rs(9), backgroundColor: COLORS.textSecondary },
  toggleCircleActive: { transform: [{ translateX: rs(20) }], backgroundColor: '#7C3AED' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: rs(20) },
  modernPicker: { width: '100%', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(24), alignItems: 'center', gap: rs(20), borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.textPrimary, fontSize: rf(18), fontWeight: '800' },
  modalInput: { width: '100%', backgroundColor: COLORS.bgTertiary, borderRadius: RADIUS.md, padding: rs(14), color: COLORS.textPrimary, fontSize: rf(16), textAlign: 'center', borderWidth: 1, borderColor: COLORS.border },
  doneBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: rs(32), paddingVertical: rs(14), width: '100%', alignItems: 'center' },
  doneBtnText: { color: '#000', fontSize: rf(16), fontWeight: '700' },
});
