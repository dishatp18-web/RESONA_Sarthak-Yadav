/**
 * FairFix Hyperlocal Matching Engine
 * Calculates Haversine distance, travel ETA, and sorts workers based on:
 * 1. Verification status (verified first)
 * 2. Estimated arrival time (distance / AVG_TRAVEL_SPEED_KMH)
 * 3. Rating average
 */
import { CONFIG } from '../config.js';
import { getDb } from './db.js';

export interface MatchedWorker {
  id: string;
  name: string;
  phone: string; // masked unless explicitly unmasked
  lat: number;
  lng: number;
  categories: string[];
  base_rate: number;
  rate_unit: 'per_job' | 'per_hour';
  radius_km: number;
  available: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  distance_km: number;
  eta_minutes: number;
  eta_label: string;
  verification_reject_reason?: string | null;
  is_flagged?: boolean;
  is_suspended?: boolean;
}

import { haversineDistanceKm } from '../utils/geo.js';
export { haversineDistanceKm };

/**
 * Calculates estimated arrival time in minutes from distance and city travel speed.
 */
export function calculateEtaMinutes(distanceKm: number, speedKmh = CONFIG.AVG_TRAVEL_SPEED_KMH): number {
  const hours = distanceKm / speedKmh;
  const minutes = Math.max(5, Math.round(hours * 60)); // minimum realistic 5 mins for immediate dispatch
  return minutes;
}

/**
 * Masks a phone number for privacy during matching / negotiation.
 * Example: +91 98765 43210 -> +91 98••• ••210
 */
export function maskPhoneNumber(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return '••••';
  const prefix = cleaned.slice(0, 5);
  const suffix = cleaned.slice(-3);
  return `${prefix}••••${suffix}`;
}

/**
 * Finds matching available workers for a category near a customer location.
 */
export function findMatchingWorkers(
  category: string,
  customerLat: number,
  customerLng: number,
  isJobAccepted = false
): MatchedWorker[] {
  const db = getDb();

  const query = `
    SELECT 
      u.id, u.name, u.phone, u.lat, u.lng,
      w.categories, w.base_rate, w.rate_unit, w.radius_km, w.available,
      w.verification_status, w.verification_reject_reason, w.is_flagged, w.is_suspended,
      w.rating_avg, w.rating_count, w.jobs_completed
    FROM workers w
    JOIN users u ON w.user_id = u.id
    WHERE w.available = 1 AND (w.is_suspended = 0 OR w.is_suspended IS NULL)
  `;

  const rows = db.prepare(query).all() as any[];
  const matched: MatchedWorker[] = [];

  for (const row of rows) {
    let cats: string[] = [];
    try {
      cats = JSON.parse(row.categories);
    } catch {
      cats = [row.categories];
    }

    if (!cats.includes(category)) {
      continue;
    }

    const dist = haversineDistanceKm(customerLat, customerLng, row.lat, row.lng);

    // Must be within worker's operational radius
    if (dist > row.radius_km) {
      continue;
    }

    const eta = calculateEtaMinutes(dist);

    matched.push({
      id: row.id,
      name: row.name,
      phone: isJobAccepted ? row.phone : maskPhoneNumber(row.phone),
      lat: row.lat,
      lng: row.lng,
      categories: cats,
      base_rate: row.base_rate,
      rate_unit: row.rate_unit,
      radius_km: row.radius_km,
      available: Boolean(row.available),
      verification_status: row.verification_status,
      verification_reject_reason: row.verification_reject_reason,
      is_flagged: Boolean(row.is_flagged),
      is_suspended: Boolean(row.is_suspended),
      rating_avg: row.rating_avg,
      rating_count: row.rating_count,
      jobs_completed: row.jobs_completed,
      distance_km: dist,
      eta_minutes: eta,
      eta_label: `~${eta} min (estimate)`,
    });
  }

  // Sorting hierarchy:
  // 0. Flagged workers rank LAST in matching
  // 1. Verified first
  // 2. Estimated arrival (distance / speed)
  // 3. Rating average descending
  matched.sort((a, b) => {
    // Flagged workers always rank last
    if (a.is_flagged && !b.is_flagged) return 1;
    if (!a.is_flagged && b.is_flagged) return -1;

    // Verified boost
    if (a.verification_status === 'verified' && b.verification_status !== 'verified') return -1;
    if (b.verification_status === 'verified' && a.verification_status !== 'verified') return 1;

    if (a.eta_minutes !== b.eta_minutes) {
      return a.eta_minutes - b.eta_minutes;
    }

    return b.rating_avg - a.rating_avg;
  });

  return matched;
}
