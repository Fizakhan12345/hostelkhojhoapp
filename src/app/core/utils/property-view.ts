// core/utils/property-view.ts
// Turns raw DB rows into clean view objects, whatever your exact column names are.
import { environment } from '../../../environment';


export const PROPERTY_DETAIL_ROUTE = '/properties';
const API_ORIGIN = (environment.apiUrl || '').replace(/\/api\/?$/, '');

function pick(obj: any, keys: string[]): any {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

function absoluteUrl(path: string | null): string | null {
  if (!path || typeof path !== 'string') return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return `${API_ORIGIN}/${path.replace(/^\/+/, '')}`;
}

function imageFromItem(item: any): string | null {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return pick(item, ['image_url', 'url', 'path', 'image', 'file_path', 'src']);
}

function resolveImage(p: any): string | null {
  // 1. single-image columns
  const single = pick(p, ['cover_image', 'main_image', 'thumbnail', 'image', 'image_url', 'photo', 'featured_image']);
  if (single) return absoluteUrl(single);

  // 2. images column (JSON array or comma-separated string)
  let images = p?.images ?? p?.photos ?? null;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = images.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  if (Array.isArray(images) && images.length) return absoluteUrl(imageFromItem(images[0]));

  // 3. property_images table rows (attached by the backend as `gallery`)
  if (Array.isArray(p?.gallery) && p.gallery.length) {
    const primary = p.gallery.find((g: any) => g.is_primary || g.is_cover) || p.gallery[0];
    return absoluteUrl(imageFromItem(primary));
  }
  return null;
}

export interface PropertyView {
  id: number;
  name: string;
  location: string;
  price: number | null;
  gender: string | null;
  image: string | null;
}

export function toPropertyView(p: any): PropertyView {
  const locality = pick(p, ['locality', 'area', 'address_line', 'address']);
  const city = pick(p, ['city', 'city_name']);
  const price = Number(pick(p, ['monthly_rent', 'rent', 'price', 'price_per_month', 'starting_price', 'min_price', 'rent_amount']));

  return {
    id: Number(p?.id),
    name: pick(p, ['name', 'title', 'property_name', 'hostel_name']) || 'Hostel',
    location: [locality, city].filter(Boolean).join(', '),
    price: Number.isFinite(price) && price > 0 ? price : null,
    gender: pick(p, ['gender', 'gender_type', 'for_gender']),
    image: resolveImage(p),
  };
}

export type BookingGroup = 'upcoming' | 'active' | 'past' | 'cancelled';

export interface BookingView {
  id: number;
  ref: string;
  status: string;
  paymentStatus: string | null;
  group: BookingGroup;
  checkIn: string | null;
  checkOut: string | null;
  bookedOn: string | null;
  amount: number | null;
  roomType: string | null;
  property: PropertyView | null;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function toBookingView(b: any): BookingView {
  const status = String(pick(b, ['status', 'booking_status']) || 'pending').toLowerCase();
  const checkIn = pick(b, ['check_in', 'check_in_date', 'move_in_date', 'start_date', 'from_date']);
  const checkOut = pick(b, ['check_out', 'check_out_date', 'move_out_date', 'end_date', 'to_date']);
  const amount = Number(pick(b, ['total_amount', 'amount', 'total_price', 'grand_total', 'final_amount', 'price']));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inDate = toDate(checkIn);
  const outDate = toDate(checkOut);

  let group: BookingGroup;
  if (/cancel|reject|refund|fail/.test(status)) group = 'cancelled';
  else if (/complete|checked_out|checkout/.test(status) || (outDate && outDate < today)) group = 'past';
  else if (inDate && inDate > today) group = 'upcoming';
  else if (inDate) group = 'active';
  else group = 'upcoming';

  return {
    id: Number(b.id),
    ref: pick(b, ['booking_ref', 'booking_code', 'booking_number', 'reference', 'booking_id']) || `#${b.id}`,
    status,
    paymentStatus: pick(b, ['payment_status']),
    group,
    checkIn,
    checkOut,
    bookedOn: pick(b, ['created_at', 'booked_at', 'booking_date']),
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    roomType: pick(b, ['room_type', 'sharing_type', 'occupancy', 'bed_type']),
    property: b.property ? toPropertyView(b.property) : null,
  };
}
