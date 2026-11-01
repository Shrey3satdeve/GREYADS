import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, FlatList, Share,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MapPin, Calendar, Clock, Tag, Users, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';
import BrandMark from '../../components/BrandMark';
import { useDialog } from '../../components/AppDialog';
import { COLORS, CATEGORY_COLORS, RADIUS, SPACING, getCategoryImage, getEventImage } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

interface EventDetail {
  id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  cover_image_url: string;
  images?: string[];
  category: string;
  price: number;
  currency: string;
  total_tickets: number;
  available_tickets: number;
  organizer_name: string;
  tags: string[];
  status: string;
}

const sanitizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const hasMeaningfulText = (value: unknown) => {
  const normalized = sanitizeText(value);
  if (!normalized) return false;
  if (/^-+$/.test(normalized)) return false;

  const lowered = normalized.toLowerCase();
  return !['n/a', 'na', 'none', 'null', 'undefined', 'tbd'].includes(lowered);
};

const normalizeTags = (value: unknown) => {
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  return Array.from(
    new Set(
      rawTags
        .map((tag) => sanitizeText(tag))
        .filter((tag) => hasMeaningfulText(tag))
    )
  );
};

// Carousel slide — uri is already resolved by getEventImage
function CarouselImage({ uri, fallbackUri }: { uri: string; fallbackUri: string }) {
  const [src, setSrc] = useState(uri);
  useEffect(() => { setSrc(uri); }, [uri]);
  const { width } = Dimensions.get('window');
  return (
    <View style={{ width, height: 320 }}>
      <Image source={{ uri: src }} style={styles.heroImg} onError={() => setSrc(fallbackUri)} />
      <LinearGradient colors={['rgba(0,0,0,0.3)', 'transparent', '#000000']} style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const router = useRouter();
  const { token } = useAuth();
  const { showDialog, DialogComponent } = useDialog();
  const eventId = useMemo(() => {
    if (Array.isArray(id)) return String(id[0] || '').trim();
    return String(id || '').trim();
  }, [id]);

  useEffect(() => {
    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      setEvent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const decodedEventId = decodeURIComponent(eventId);
    const candidateIds = Array.from(new Set([eventId, decodedEventId].filter(Boolean)));

    (async () => {
      try {
        for (const candidateId of candidateIds) {
          const data = await api.get(`/events/${candidateId}`);
          if (data?.event?.id) {
            setEvent(data.event);
            return;
          }
        }
        setEvent(null);
      } catch {
        setEvent(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  useEffect(() => {
    if (!token || !eventId || eventId === 'undefined' || eventId === 'null') {
      setLiked(false);
      return;
    }

    (async () => {
      try {
        const data = await api.get(`/wishlist/check/${eventId}`);
        setLiked(Boolean(data?.liked));
      } catch {
        setLiked(false);
      }
    })();
  }, [eventId, token]);

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out this event: ${event.title}\n\nVenue: ${event.venue}\nDate: ${formatDate(event.date)}\n\nDownload GreyAdz to book tickets!`,
        url: 'https://greyadz.com/events/' + event.id, // Primary for iOS
      });
    } catch (error: any) {
      showDialog({ title: 'Share Failed', message: error?.message || 'Unable to share this event right now.' });
    }
  };

  const toggleLike = async () => {
    if (!event) return;
    if (!token) {
      router.push({
        pathname: '/(auth)/login' as any,
        params: { redirect: `/event/${event.id}` },
      } as any);
      return;
    }

    const nextLiked = !liked;
    setWishlistBusy(true);
    setLiked(nextLiked);

    try {
      if (nextLiked) {
        await api.post('/wishlist', { event_id: event.id });
      } else {
        await api.delete(`/wishlist/${event.id}`);
      }
    } catch (error: any) {
      setLiked(!nextLiked);
      showDialog({
        title: 'Wishlist Update Failed',
        message: error?.message || 'Please try again.',
      });
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleBookPress = () => {
    if (!event || event.available_tickets === 0) {
      return;
    }

    if (!token) {
      router.push({
        pathname: '/(auth)/login' as any,
        params: { redirect: `/book/${event.id}` },
      } as any);
      return;
    }

    router.push(`/book/${event.id}` as any);
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadWrap}>
        <Text style={styles.errorText}>Event not found</Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)' as any)} style={styles.backBtn}>
          <Text style={{ color: '#FFF' }}>Browse Events</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[event.category] || '#FFF';
  const soldPct = event.total_tickets > 0
    ? Math.round(((event.total_tickets - event.available_tickets) / event.total_tickets) * 100)
    : 0;
  const stickyBarBottom = Math.max(insets.bottom + 8, 16);
  const stickyBarHeight = 92;
  const eventDescription = hasMeaningfulText(event.description)
    ? sanitizeText(event.description)
    : null;
  const eventTags = normalizeTags(event.tags);

  const fallbackImg = getCategoryImage(event.category, event.title);
  const carouselData = (event.images && event.images.length > 0)
    ? event.images.map(img => getEventImage(img, event.category, event.title))
    : [getEventImage(event.cover_image_url, event.category, event.title)];

  return (
    <View style={styles.container} testID="event-detail-screen">
      {DialogComponent}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: stickyBarBottom + stickyBarHeight + 32 }}
      >
        {/* Hero Carousel */}
        <View style={styles.hero}>
          <FlatList
            data={carouselData}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              setActiveImg(Math.round(x / width));
            }}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item }) => (
              <CarouselImage
                uri={item}
                fallbackUri={getCategoryImage(event.category, event.title)}
              />
            )}
          />

          {/* Pagination Dots */}
          {carouselData.length > 1 && (
            <View style={styles.pagination}>
              {carouselData.map((_, i) => (
                <View key={i} style={[styles.dot, activeImg === i && styles.activeDot]} />
              ))}
            </View>
          )}

          {/* Overlay Buttons */}
          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <TouchableOpacity testID="back-btn" style={styles.circleBtn} onPress={() => router.back()}>
              <ArrowLeft size={20} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.heroActions}>
              <TouchableOpacity testID="share-btn" style={styles.circleBtn} onPress={handleShare}>
                <Share2 size={18} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity testID="like-btn" style={[styles.circleBtn, liked && { backgroundColor: '#EF4444' }, wishlistBusy && { opacity: 0.7 }]} onPress={toggleLike} disabled={wishlistBusy}>
                <Heart size={18} color="#FFF" fill={liked ? '#FFF' : 'none'} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Category + Status */}
          <View style={styles.topRow}>
            <View style={[styles.catChip, { backgroundColor: catColor + '20', borderColor: catColor + '50' }]}>
              <Text style={[styles.catChipText, { color: catColor }]}>{event.category}</Text>
            </View>
            <View style={[styles.statusChip, event.available_tickets === 0 && styles.soldOutChip]}>
              <Text style={[styles.statusChipText, event.available_tickets === 0 && { color: COLORS.error }]}>
                {event.available_tickets === 0 ? 'Sold Out' : `${event.available_tickets} left`}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          {/* Meta Info */}
          <View style={styles.metaCard}>
            <View style={styles.metaItem}>
              <View style={styles.metaIconWrap}>
                <Calendar size={16} color="#3B82F6" />
              </View>
              <View>
                <Text style={styles.metaLabel}>Date</Text>
                <Text style={styles.metaValue}>{formatDate(event.date)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaItem}>
              <View style={styles.metaIconWrap}>
                <Clock size={16} color="#F59E0B" />
              </View>
              <View>
                <Text style={styles.metaLabel}>Time</Text>
                <Text style={styles.metaValue}>{formatTime(event.date)}</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaItem}>
              <View style={styles.metaIconWrap}>
                <MapPin size={16} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.metaLabel}>Venue</Text>
                <Text style={styles.metaValue} numberOfLines={2}>{event.venue}</Text>
              </View>
            </View>
          </View>

          {/* Capacity */}
          <View style={styles.capacityCard}>
            <View style={styles.capacityHeader}>
              <Users size={14} color={COLORS.textSecondary} />
              <Text style={styles.capacityLabel}>Availability</Text>
              <Text style={styles.capacityPct}>{soldPct}% filled</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${soldPct}%`, backgroundColor: soldPct > 80 ? COLORS.error : COLORS.success }]} />
            </View>
          </View>

          {/* Description */}
          {eventDescription && (
            <>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{eventDescription}</Text>
            </>
          )}

          {/* Tags */}
          {eventTags.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tags}>
                {eventTags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Tag size={10} color={COLORS.textTertiary} />
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Organizer */}
          <Text style={styles.sectionTitle}>Organizer</Text>
          <View style={styles.organizer}>
            <BrandMark size={36} imageScale={0.7} />
            <Text style={styles.orgName}>{event.organizer_name}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Book CTA */}
      <View style={[styles.bookBar, { bottom: stickyBarBottom, paddingBottom: Math.max(insets.bottom, 14) }]}>
        <View>
          <Text style={styles.bookPriceLabel}>Per ticket</Text>
          <Text style={styles.bookPrice}>₹{event.price.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          testID="book-ticket-btn"
          style={[styles.bookBtn, event.available_tickets === 0 && styles.bookBtnDisabled]}
          onPress={handleBookPress}
          activeOpacity={0.85}
          disabled={event.available_tickets === 0}
        >
          <Text style={styles.bookBtnText}>
            {event.available_tickets === 0 ? 'Sold Out' : 'Get Tickets'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: COLORS.textSecondary, fontSize: 16 },
  backBtn: { padding: 12, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md },
  hero: { height: 320, width, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  pagination: { position: 'absolute', bottom: 20, flexDirection: 'row', width: '100%', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  activeDot: { backgroundColor: '#FFF', width: 14 },
  heroOverlay: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  heroActions: { flexDirection: 'row', gap: 8 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  content: { padding: 20, paddingTop: 16 },
  topRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  catChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  catChipText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  soldOutChip: { borderColor: COLORS.error + '50', backgroundColor: COLORS.error + '15' },
  statusChipText: { fontSize: 11, fontWeight: '600', color: COLORS.success },
  title: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, lineHeight: 32, marginBottom: 16 },
  metaCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14, gap: 12 },
  metaItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  metaIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  metaLabel: { color: COLORS.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.border },
  capacityCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20, gap: 8 },
  capacityHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  capacityLabel: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  capacityPct: { color: COLORS.textTertiary, fontSize: 12 },
  progressBg: { height: 6, backgroundColor: COLORS.bgTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 6 },
  description: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  tagText: { color: COLORS.textTertiary, fontSize: 12 },
  organizer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orgAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  orgAvatarText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  orgName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  bookBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.border },
  bookPriceLabel: { color: COLORS.textTertiary, fontSize: 11, marginBottom: 2 },
  bookPrice: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  bookBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: 32, paddingVertical: 14, shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  bookBtnDisabled: { backgroundColor: COLORS.bgCard },
  bookBtnText: { color: COLORS.btnPrimaryText, fontSize: 15, fontWeight: '700' },
});
