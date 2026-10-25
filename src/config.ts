/**
 * FairFix Core Configuration
 * Centralized settings for hyperlocal matching, price bands, and Indian city defaults (Bengaluru).
 */

export interface CityNeighborhood {
  id: string;
  name: string;
  lat: number;
  lng: number;
  areaKey: string;
}

export const CITY_CENTER = {
  name: 'Bengaluru (Koramangala)',
  lat: 12.9352,
  lng: 77.6245,
};

export const NEIGHBORHOODS: CityNeighborhood[] = [
  { id: 'koramangala', name: 'Koramangala 4th Block', lat: 12.9352, lng: 77.6245, areaKey: 'blr_south' },
  { id: 'hsr_layout', name: 'HSR Layout Sector 1', lat: 12.9121, lng: 77.6446, areaKey: 'blr_south' },
  { id: 'indiranagar', name: 'Indiranagar 100ft Rd', lat: 12.9784, lng: 77.6408, areaKey: 'blr_east' },
  { id: 'jayanagar', name: 'Jayanagar 4th T Block', lat: 12.9250, lng: 77.5938, areaKey: 'blr_south' },
  { id: 'whitefield', name: 'Whitefield Main Rd', lat: 12.9698, lng: 77.7499, areaKey: 'blr_east' },
  { id: 'marathahalli', name: 'Marathahalli Bridge', lat: 12.9591, lng: 77.7009, areaKey: 'blr_east' },
];

export const SERVICE_CATEGORIES = [
  { id: 'plumbing', name: 'Plumber', baselinePrice: 450, unit: 'per_job', icon: 'Wrench' },
  { id: 'electrician', name: 'Electrician', baselinePrice: 400, unit: 'per_job', icon: 'Zap' },
  { id: 'cleaning', name: 'House Cleaning', baselinePrice: 750, unit: 'per_job', icon: 'Sparkles' },
  { id: 'appliance', name: 'AC & Appliance Repair', baselinePrice: 950, unit: 'per_job', icon: 'Fan' },
  { id: 'carpentry', name: 'Carpenter & Painter', baselinePrice: 650, unit: 'per_job', icon: 'Hammer' },
  { id: 'cook_maid', name: 'Cooking & Housekeeping', baselinePrice: 500, unit: 'per_job', icon: 'Utensils' },
] as const;

export type CategoryId = typeof SERVICE_CATEGORIES[number]['id'];

export const CATEGORY_LABELS: Record<string, string> = {
  plumbing: 'Plumbing Services',
  electrician: 'Electrical Services',
  cleaning: 'House Cleaning',
  appliance: 'AC & Appliance Repair',
  carpentry: 'Carpentry & Painting',
  cook_maid: 'Cooking & Housekeeping',
};

export function getCategoryLabel(catId: string): string {
  return CATEGORY_LABELS[catId] || catId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const CONFIG = {
  CITY_CENTER,
  DEFAULT_SEARCH_RADIUS_KM: 5,
  BAND_QUERY_RADIUS_KM: 10,
  MIN_JOBS_FOR_CONFIDENCE: 5,
  BAND_MAX_WEEKLY_MOVE: 0.10, // 10%
  AVG_TRAVEL_SPEED_KMH: 20,
  MAX_NEGOTIATION_ROUNDS: 3,
};
