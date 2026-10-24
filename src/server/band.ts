/**
 * FairFix Live Fair-Price Band Algorithm
 * 
 * Computes transparent, anti-gamed price ranges for every category and neighborhood:
 * 1. Queries completed jobs within 10 km, last 90 days.
 * 2. Enforces anti-gaming: max 2 jobs per worker-customer pair per week.
 * 3. Removes statistical outliers via IQR (Interquartile Range) rule.
 * 4. Computes low (25th percentile), typical (median), and high (75th percentile).
 * 5. Applies confidence rating (high, low (few jobs), estimate).
 * 6. Bounds weekly movement by BAND_MAX_WEEKLY_MOVE (10%) against prior snapshot.
 * 7. Yields human-readable audit string.
 */
import { CONFIG, SERVICE_CATEGORIES } from '../config.js';
import { getDb } from './db.js';
import { haversineDistanceKm } from './matching.js';

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

/**
 * Calculates percentile value from a sorted array of numbers using linear interpolation.
 */
function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

/**
 * Computes the fair price band for a category at a specific location.
 */
export function calculateFairPriceBand(
  category: string,
  lat: number,
  lng: number
): PriceBandResult {
  const db = getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Baseline fallback config
  const catConfig = SERVICE_CATEGORIES.find((c) => c.id === category);
  const baseline = catConfig ? catConfig.baselinePrice : 500;

  // 1. Fetch completed jobs in the category from last 90 days
  const query = `
    SELECT id, customer_id, worker_id, agreed_price, lat, lng, completed_at
    FROM jobs
    WHERE category = ?
      AND status IN ('completed', 'rated')
      AND agreed_price IS NOT NULL
      AND completed_at >= ?
    ORDER BY completed_at DESC
  `;

  const rows = db.prepare(query).all(category, ninetyDaysAgo) as any[];

  // Filter within 10 km
  const nearbyJobs = rows.filter((job) => {
    const dist = haversineDistanceKm(lat, lng, job.lat, job.lng);
    return dist <= CONFIG.BAND_QUERY_RADIUS_KM;
  });

  // 2. Anti-gaming: max 2 jobs per worker-customer pair per 7-day window
  const pairWeekCounts: Record<string, number> = {};
  const validPairJobs: any[] = [];

  for (const job of nearbyJobs) {
    if (!job.customer_id || !job.worker_id) {
      validPairJobs.push(job);
      continue;
    }
    // Determine 7-day bucket (epoch week)
    const jobDate = new Date(job.completed_at || now.toISOString());
    const weekNumber = Math.floor(jobDate.getTime() / (7 * 24 * 60 * 60 * 1000));
    const pairKey = `${job.customer_id}_${job.worker_id}_${weekNumber}`;
    const count = (pairWeekCounts[pairKey] || 0) + 1;
    pairWeekCounts[pairKey] = count;

    if (count <= 2) {
      validPairJobs.push(job);
    }
  }

  const rawPrices = validPairJobs.map((j) => Number(j.agreed_price)).filter((p) => !isNaN(p) && p > 0);
  const totalCount = rawPrices.length;

  // 3. Confidence determination
  let confidence: 'high' | 'low (few jobs)' | 'estimate' = 'estimate';
  let isEstimate = false;

  if (totalCount >= CONFIG.MIN_JOBS_FOR_CONFIDENCE) {
    confidence = 'high';
  } else if (totalCount > 0) {
    confidence = 'low (few jobs)';
  } else {
    confidence = 'estimate';
    isEstimate = true;
  }

  // Handle 0 jobs: use per-category baseline
  if (totalCount === 0) {
    const low = Math.round(baseline * 0.85);
    const typical = baseline;
    const high = Math.round(baseline * 1.20);
    return {
      category,
      lat,
      lng,
      low,
      typical,
      high,
      jobCount: 0,
      outliersRemoved: 0,
      confidence: 'estimate',
      explanation: `Estimate based on market baseline (no completed jobs within 10 km yet).`,
      isEstimate: true,
      computedAt: now.toISOString(),
    };
  }

  // 4. Outlier removal via IQR (Interquartile Range)
  rawPrices.sort((a, b) => a - b);
  const q1Raw = getPercentile(rawPrices, 25);
  const q3Raw = getPercentile(rawPrices, 75);
  const iqr = q3Raw - q1Raw;
  const lowerFence = Math.max(50, q1Raw - 1.5 * iqr);
  const upperFence = q3Raw + 1.5 * iqr;

  const filteredPrices = rawPrices.filter((p) => p >= lowerFence && p <= upperFence);
  const outliersRemoved = rawPrices.length - filteredPrices.length;

  // Working prices after outlier rejection
  const finalPrices = filteredPrices.length > 0 ? filteredPrices : rawPrices;
  finalPrices.sort((a, b) => a - b);

  let low = getPercentile(finalPrices, 25);
  let typical = getPercentile(finalPrices, 50);
  let high = getPercentile(finalPrices, 75);

  // Fallback spread if all jobs had identical price
  if (low === high) {
    low = Math.round(typical * 0.9);
    high = Math.round(typical * 1.1);
  }

  // 5. Anti-gaming weekly move limiter (BAND_MAX_WEEKLY_MOVE = 10%)
  // Check latest recorded snapshot for this category
  const prevSnapshot = db.prepare(`
    SELECT low, typical, high, computed_at
    FROM price_band_snapshots
    WHERE category = ?
    ORDER BY computed_at DESC
    LIMIT 1
  `).get(category) as any;

  if (prevSnapshot) {
    const prevDate = new Date(prevSnapshot.computed_at);
    const daysSince = (now.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

    // If within 7 days, clamp movement to +/- 10%
    if (daysSince <= 7) {
      const clamp = (val: number, prev: number) => {
        const minVal = Math.round(prev * (1 - CONFIG.BAND_MAX_WEEKLY_MOVE));
        const maxVal = Math.round(prev * (1 + CONFIG.BAND_MAX_WEEKLY_MOVE));
        return Math.max(minVal, Math.min(maxVal, val));
      };
      low = clamp(low, prevSnapshot.low);
      typical = clamp(typical, prevSnapshot.typical);
      high = clamp(high, prevSnapshot.high);
    }
  }

  const explanation = `Based on ${totalCount} completed jobs in the last 90 days within 10 km. Outliers removed: ${outliersRemoved}.`;

  return {
    category,
    lat,
    lng,
    low,
    typical,
    high,
    jobCount: totalCount,
    outliersRemoved,
    confidence,
    explanation,
    isEstimate,
    computedAt: now.toISOString(),
  };
}

/**
 * Recomputes and snapshots the price band for a category when a job completes.
 */
export function recordPriceBandSnapshot(category: string, lat: number, lng: number): PriceBandResult {
  const db = getDb();
  const band = calculateFairPriceBand(category, lat, lng);
  const id = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const areaKey = `lat${lat.toFixed(2)}_lng${lng.toFixed(2)}`;

  db.prepare(`
    INSERT INTO price_band_snapshots (id, category, area_key, low, typical, high, job_count, confidence, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    band.category,
    areaKey,
    band.low,
    band.typical,
    band.high,
    band.jobCount,
    band.confidence,
    band.computedAt
  );

  return band;
}

/**
 * Evaluates where a given offer or worker base rate stands relative to the band.
 */
export function comparePriceToBand(
  amount: number,
  band: PriceBandResult,
  perspective: 'customer' | 'worker' = 'customer'
): PriceComparison {
  const diff = Math.round(((amount - band.typical) / band.typical) * 100);

  if (amount < band.low) {
    const warning =
      perspective === 'worker'
        ? 'Your rate is below typical rates paid for completed jobs nearby.'
        : 'Your price is below the fair-price band. Workers may counter-offer or take longer to respond.';

    return {
      status: 'below',
      percentDiffFromTypical: diff,
      label: `${Math.abs(diff)}% below typical`,
      warning,
    };
  }

  if (amount > band.high) {
    const warning =
      perspective === 'worker'
        ? `Your rate is ${diff}% above typical rates paid for completed jobs nearby.`
        : 'Your price is above the fair-price band. You may be offering more than the typical local range.';

    return {
      status: 'above',
      percentDiffFromTypical: diff,
      label: `${diff}% above typical`,
      warning,
    };
  }

  const diffStr = diff === 0 ? 'Exact typical' : `${Math.abs(diff)}% ${diff > 0 ? 'above' : 'below'} typical`;
  return {
    status: 'within',
    percentDiffFromTypical: diff,
    label: `Within fair band (${diffStr})`,
  };
}

/**
 * Returns a comprehensive audit log of jobs excluded from price band computations
 * due to anti-gaming pair caps, IQR outlier fences, or weekly movement caps.
 */
export function getPriceBandAuditLog(category?: string) {
  const db = getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const categoriesToAudit = category ? [category] : SERVICE_CATEGORIES.map(c => c.id);
  const auditEntries: any[] = [];

  for (const cat of categoriesToAudit) {
    const rows = db.prepare(`
      SELECT j.id, j.customer_id, j.worker_id, j.category, j.agreed_price, j.lat, j.lng, j.completed_at, j.is_seed,
             c.name as customer_name, w.name as worker_name
      FROM jobs j
      LEFT JOIN users c ON j.customer_id = c.id
      LEFT JOIN users w ON j.worker_id = w.id
      WHERE j.category = ?
        AND j.status IN ('completed', 'rated')
        AND j.agreed_price IS NOT NULL
        AND j.completed_at >= ?
      ORDER BY j.completed_at DESC
    `).all(cat, ninetyDaysAgo) as any[];

    // 1. Check pair cap
    const pairWeekCounts: Record<string, number> = {};
    const validPairJobs: any[] = [];

    for (const job of rows) {
      if (!job.customer_id || !job.worker_id) {
        validPairJobs.push(job);
        continue;
      }
      const jobDate = new Date(job.completed_at || now.toISOString());
      const weekNumber = Math.floor(jobDate.getTime() / (7 * 24 * 60 * 60 * 1000));
      const pairKey = `${job.customer_id}_${job.worker_id}_${weekNumber}`;
      const count = (pairWeekCounts[pairKey] || 0) + 1;
      pairWeekCounts[pairKey] = count;

      if (count > 2) {
        auditEntries.push({
          job_id: job.id,
          category: cat,
          agreed_price: job.agreed_price,
          customer_id: job.customer_id,
          customer_name: job.customer_name || 'Customer',
          worker_id: job.worker_id,
          worker_name: job.worker_name || 'Worker',
          reason: 'pair_cap',
          rule_label: 'Pair Frequency Cap (Anti-Gaming)',
          details: `Job #${job.id.replace(/^job_/, '')} was the ${count}th job between same customer & worker within 7 days. Maximum 2 allowed.`,
          is_seed: Boolean(job.is_seed),
          timestamp: job.completed_at,
        });
      } else {
        validPairJobs.push(job);
      }
    }

    // 2. Check IQR outliers on remaining jobs
    const rawPrices = validPairJobs.map((j) => Number(j.agreed_price)).filter((p) => !isNaN(p) && p > 0);
    if (rawPrices.length >= 4) {
      rawPrices.sort((a, b) => a - b);
      const q1Raw = getPercentile(rawPrices, 25);
      const q3Raw = getPercentile(rawPrices, 75);
      const iqr = q3Raw - q1Raw;
      const lowerFence = Math.max(50, q1Raw - 1.5 * iqr);
      const upperFence = q3Raw + 1.5 * iqr;

      for (const job of validPairJobs) {
        const price = Number(job.agreed_price);
        if (price < lowerFence || price > upperFence) {
          auditEntries.push({
            job_id: job.id,
            category: cat,
            agreed_price: price,
            customer_id: job.customer_id,
            customer_name: job.customer_name || 'Customer',
            worker_id: job.worker_id,
            worker_name: job.worker_name || 'Worker',
            reason: 'outlier',
            rule_label: 'Statistical Outlier (IQR Filter)',
            details: `Price ₹${price.toLocaleString('en-IN')} fell outside acceptable interquartile fence [₹${lowerFence.toLocaleString('en-IN')} - ₹${upperFence.toLocaleString('en-IN')}]. Rejected to protect market band.`,
            is_seed: Boolean(job.is_seed),
            timestamp: job.completed_at,
          });
        }
      }
    }

    // 3. Check for weekly cap dampening
    const snapshots = db.prepare(`
      SELECT low, typical, high, computed_at
      FROM price_band_snapshots
      WHERE category = ?
      ORDER BY computed_at DESC
      LIMIT 2
    `).all(cat) as any[];

    if (snapshots.length >= 2) {
      const latest = snapshots[0];
      const previous = snapshots[1];
      const diffPercent = Math.round(Math.abs((latest.typical - previous.typical) / previous.typical) * 100);
      if (diffPercent >= 9) {
        auditEntries.push({
          job_id: `snap_${latest.computed_at}`,
          category: cat,
          agreed_price: latest.typical,
          customer_id: 'SYSTEM',
          customer_name: 'Band Stability Engine',
          worker_id: 'SYSTEM',
          worker_name: 'Anti-Volatility Guard',
          reason: 'weekly_cap',
          rule_label: '10% Max Weekly Shift Bound',
          details: `Median shift bounded to max 10% movement (from ₹${previous.typical} to ₹${latest.typical}) to prevent market manipulation.`,
          is_seed: true,
          timestamp: latest.computed_at,
        });
      }
    }
  }

  return auditEntries;
}
