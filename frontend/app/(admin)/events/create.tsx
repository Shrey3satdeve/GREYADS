import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronDown, CheckCircle } from 'lucide-react-native';
import { api } from '../../../utils/api';
import { COLORS, RADIUS, SPACING, CATEGORIES } from '../../../constants/theme';

const COVER_IMAGES: Record<string, string> = {
  Music: 'https://images.unsplash.com/photo-1571751239008-50cad6cb9265?w=800&q=80',
  Technology: 'https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80',
  Food: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80',
  Business: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&q=80',
  Sports: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80',
  Arts: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=80',
  All: 'https://images.unsplash.com/photo-1540317228636-69a076b0b248?w=800&q=80',
};

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
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const router = useRouter();

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    if (!form.title || !form.description || !form.venue || !form.price || !form.total_tickets) {
      Alert.alert('Missing Fields', 'Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/events', {
        title: form.title,
        description: form.description,
        date: new Date(form.date).toISOString(),
        venue: form.venue,
        cover_image_url: COVER_IMAGES[form.category] || COVER_IMAGES.Music,
        category: form.category,
        price: parseFloat(form.price),
        total_tickets: parseInt(form.total_tickets),
        organizer_name: form.organizer_name,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
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
          <CheckCircle size={52} color={COLORS.success} strokeWidth={1.5} />
        </View>
        <Text style={styles.successTitle}>Event Created!</Text>
        <Text style={styles.successSub}>Your event is now live on the platform</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(admin)/events/')}>
          <Text style={styles.primaryBtnText}>View All Events</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} onPress={() => { setCreated(false); setForm(f => ({ ...f, title: '', description: '', venue: '', price: '', total_tickets: '', tags: '' })); }}>
          <Text style={styles.ghostBtnText}>Create Another</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const InputRow = ({ label, field, placeholder, keyboard, multi }: any) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={`input-${field}`}
        style={[styles.input, multi && styles.inputMulti]}
        value={form[field as keyof typeof form]}
        onChangeText={(v) => set(field, v)}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary}
        keyboardType={keyboard || 'default'}
        multiline={multi}
        numberOfLines={multi ? 4 : 1}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Event</Text>
          <TouchableOpacity testID="close-create-btn" style={styles.closeBtn} onPress={() => router.back()}>
            <X size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <InputRow label="Event Title *" field="title" placeholder="e.g. Neon Dreams Festival" />
          <InputRow label="Description *" field="description" placeholder="Describe the event..." multi />

          {/* Category */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity testID="category-picker" style={styles.picker} onPress={() => setShowCatPicker(!showCatPicker)}>
              <Text style={styles.pickerText}>{form.category}</Text>
              <ChevronDown size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
            {showCatPicker && (
              <View style={styles.dropdown}>
                {CATEGORIES.filter(c => c !== 'All').map(cat => (
                  <TouchableOpacity key={cat} testID={`cat-option-${cat}`} style={styles.dropdownItem} onPress={() => { set('category', cat); setShowCatPicker(false); }}>
                    <Text style={[styles.dropdownText, form.category === cat && { color: '#FFF', fontWeight: '700' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <InputRow label="Venue *" field="venue" placeholder="e.g. MMRDA Grounds, Mumbai" />

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date & Time *</Text>
            <TextInput
              testID="input-date"
              style={styles.input}
              value={form.date}
              onChangeText={(v) => set('date', v)}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput testID="input-price" style={styles.input} value={form.price} onChangeText={v => set('price', v)} placeholder="999" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Total Tickets *</Text>
              <TextInput testID="input-tickets" style={styles.input} value={form.total_tickets} onChangeText={v => set('total_tickets', v)} placeholder="200" placeholderTextColor={COLORS.textTertiary} keyboardType="numeric" />
            </View>
          </View>

          <InputRow label="Organizer Name" field="organizer_name" placeholder="GreyAdz Events" />
          <InputRow label="Tags (comma separated)" field="tags" placeholder="music, festival, outdoor" />

          <TouchableOpacity
            testID="submit-create-event-btn"
            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>Create Event</Text>}
          </TouchableOpacity>
          <View style={{ height: 110 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  scroll: { paddingHorizontal: 20 },
  inputGroup: { marginBottom: 14 },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 13, color: COLORS.textPrimary, fontSize: 14, borderWidth: 1, borderColor: COLORS.border },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 13, borderWidth: 1, borderColor: COLORS.border },
  pickerText: { color: COLORS.textPrimary, fontSize: 14 },
  dropdown: { backgroundColor: COLORS.bgCard2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, marginTop: 4, overflow: 'hidden' },
  dropdownItem: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  dropdownText: { color: COLORS.textSecondary, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 },
  submitBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  submitBtnText: { color: COLORS.btnPrimaryText, fontSize: 16, fontWeight: '700' },
  successWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.success + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800' },
  successSub: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center' },
  primaryBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12 },
  ghostBtnText: { color: COLORS.textSecondary, fontSize: 14 },
});
