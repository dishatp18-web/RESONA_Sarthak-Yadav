/**
 * FairFix Frontend & Shared TypeScript Definitions
 */

export interface User {
  id: string;
  name: string;
  role: 'customer' | 'worker' | 'admin';
  phone: string;
  lat: number;
  lng: number;
  created_at: string;
  // Worker-specific properties when role === 'worker'
  categories?: string[];
  base_rate?: number;
  rate_unit?: 'per_job' | 'per_hour';
  radius_km?: number;
  available?: boolean;
  verification_status?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_doc_path?: string | null;
  verification_reject_reason?: string | null;
  is_flagged?: boolean;
  is_suspended?: boolean;
  rating_avg?: number;
  rating_count?: number;
  jobs_completed?: number;
}

export interface PriceBandResult {
  category: string;
  lat: number;
  lng: number;
  low: number;
  typical: number;
  high: number;
  jobCount: number;
  outliersRemoved: number;
  confidence: 'high' | 'low (few jobs)' | 'estimate';
  explanation: string;
  isEstimate: boolean;
  computedAt: string;
}

export interface PriceComparison {
  status: 'below' | 'within' | 'above';
  percentDiffFromTypical: number;
  label: string;
  warning?: string;
}

export interface MatchedWorker {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  categories: string[];
  base_rate: number;
  rate_unit: 'per_job' | 'per_hour';
  radius_km: number;
  available: boolean;
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  verification_reject_reason?: string | null;
  is_flagged?: boolean;
  is_suspended?: boolean;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  distance_km: number;
  eta_minutes: number;
  eta_label: string;
}

export interface Job {
  id: string;
  customer_id: string;
  worker_id?: string | null;
  category: string;
  description: string;
  lat: number;
  lng: number;
  offered_price: number;
  agreed_price?: number | null;
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'rated' | 'cancelled' | 'disputed';
  created_at: string;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  is_seed: number;
  share_token?: string | null;
  customer_name?: string;
  customer_phone?: string;
  worker_name?: string;
  worker_phone?: string;
  worker_verification_status?: string;
}

export interface ReportItem {
  id: string;
  job_id: string;
  reporter_id: string;
  reporter_name?: string;
  worker_id: string;
  worker_name?: string;
  reason: 'no-show' | 'overcharged' | 'unsafe behaviour' | 'poor work' | 'other';
  details?: string;
  status: 'pending' | 'cleared' | 'actioned';
  created_at: string;
}

export interface IncidentItem {
  id: string;
  job_id: string;
  reported_by: string;
  reporter_name?: string;
  worker_name?: string;
  lat: number;
  lng: number;
  status: 'active' | 'resolved';
  details?: string;
  created_at: string;
}

export interface TrackingPoint {
  id: string;
  job_id: string;
  lat: number;
  lng: number;
  accuracy: number;
  speed: number;
  ts: string;
}

export interface BandAuditItem {
  job_id: string;
  category: string;
  agreed_price: number;
  customer_id: string;
  worker_id: string;
  reason: 'outlier' | 'pair_cap' | 'weekly_cap';
  details: string;
  is_seed: number;
  timestamp: string;
}
