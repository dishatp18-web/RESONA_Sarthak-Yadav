/**
 * FairFix Fair-Price Explorer - "Mark III Forge" Edition
 * Category chips, area chips, PriceBandGauge hero, inline SVG price sparkline,
 * and an explicit outlier list detailing which jobs were pruned and why.
 */
import React, { useState, useEffect } from 'react';
import { SERVICE_CATEGORIES, NEIGHBORHOODS, getCategoryLabel } from '../config.js';
import { PriceBandResult } from '../types.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { HudPanel, ForgeButton, Badge, formatINR } from './ui/index.js';
import { 
  TrendingUp, 
  MapPin, 
  Calculator, 
  Layers, 
  Activity,
  AlertTriangle,
  Info
} from 'lucide-react';

interface RecentJobPoint {
  id: string;
  price: number;
  date: string;
  isOutlier: boolean;
  reason?: string;
}

export const FairPriceExplorer: React.FC = () => {
  const [category, setCategory] = useState<string>('plumbing');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(NEIGHBORHOODS[0]);
  const [testAmount, setTestAmount] = useState<number>(450);

  const [band, setBand] = useState<PriceBandResult | null>(null);
  const [recentPoints, setRecentPoints] = useState<RecentJobPoint[]>([]);

  useEffect(() => {
    let isCancelled = false;
    const fetchBand = async () => {
      try {
        const res = await fetch(
          `/api/price-band?category=${category}&lat=${selectedNeighborhood.lat}&lng=${selectedNeighborhood.lng}&price=${testAmount}&perspective=customer`
        );
        if (!res.ok) throw new Error('Failed to load band');
        const data = await res.json();
        if (!isCancelled) {
          setBand(data.band);
        }
      } catch (err) {
        console.error('Error fetching explorer band:', err);
      }
    };

    fetchBand();
    return () => {
      isCancelled = true;
    };
  }, [category, selectedNeighborhood, testAmount]);

  // Fetch recent completed jobs for sparkline and outlier list
  useEffect(() => {
    let isCancelled = false;
    const fetchRecentJobs = async () => {
      try {
        const res = await fetch(`/api/jobs`);
        if (!res.ok) return;
        const allJobs = await res.json();
        const catJobs = allJobs.filter(
          (j: any) => j.category === category && ['completed', 'rated'].includes(j.status)
        );

        // Take last 10 completed jobs
        const sorted = catJobs.slice(0, 10);
        if (!isCancelled && band) {
          const iqrUpper = band.high + (band.high - band.low) * 1.5;
          const iqrLower = Math.max(50, band.low - (band.high - band.low) * 1.5);

          const points: RecentJobPoint[] = sorted.map((j: any) => {
            const price = Number(j.agreed_price || j.offered_price);
            const isOutlier = price > iqrUpper || price < iqrLower;
            return {
              id: j.id,
              price,
              date: j.completed_at || j.created_at,
              isOutlier,
              reason: isOutlier
                ? price > iqrUpper
                  ? `${formatINR(price)} exceeds upper fence (Q3 + 1.5*IQR)`
                  : `${formatINR(price)} below lower fence (Q1 - 1.5*IQR)`
                : undefined,
            };
          });
          setRecentPoints(points);
        }
      } catch (err) {
        console.error('Error loading recent job points:', err);
      }
    };

    fetchRecentJobs();
    return () => {
      isCancelled = true;
    };
  }, [category, band]);

  // Generate inline SVG sparkline path
  const renderSparkline = () => {
    if (recentPoints.length < 2) return null;

    const prices = recentPoints.map((p) => p.price);
    const min = Math.min(...prices) * 0.9;
    const max = Math.max(...prices) * 1.1;
    const range = max - min || 1;

    const width = 360;
    const height = 70;

    const coords = recentPoints.map((p, idx) => {
      const x = (idx / (recentPoints.length - 1)) * (width - 20) + 10;
      const y = height - 10 - ((p.price - min) / range) * (height - 20);
      return { x, y, point: p };
    });

    const pathD = coords.reduce((acc, c, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`, '');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
        <defs>
          <linearGradient id="sparklineForgeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB81C" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8E0B16" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Fill Area */}
        <path
          d={`${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`}
          fill="url(#sparklineForgeGrad)"
        />

        {/* Stroke Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#FFB81C"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {coords.map((c, i) => (
          <g key={i}>
            <circle
              cx={c.x}
              cy={c.y}
              r={c.point.isOutlier ? 4.5 : 3}
              fill={c.point.isOutlier ? '#FF5C6C' : '#5EE6FF'}
              stroke="#07070A"
              strokeWidth="1.5"
            />
            {c.point.isOutlier && (
              <circle
                cx={c.x}
                cy={c.y}
                r="7"
                fill="none"
                stroke="#FF5C6C"
                strokeWidth="1"
                className="animate-ping"
              />
            )}
          </g>
        ))}
      </svg>
    );
  };

  const outlierPoints = recentPoints.filter((p) => p.isOutlier);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <HudPanel variant="default" className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D7261E]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-heading font-bold tracking-wider px-2 py-0.5 rounded bg-[#FFB81C]/15 text-[#FFD65A] border border-[#FFB81C]/30">
                Core Differentiator
              </span>
              <Badge variant="neutral" size="sm">
                Demo data
              </Badge>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-wider uppercase mt-1">
              Live Fair-Price Band Monitor
            </h1>
            <p className="text-xs sm:text-sm text-[#A7A29A] mt-1 max-w-2xl font-sans">
              Algorithmic price bands derived from real completed transactions in Bangalore. Outliers eliminated via IQR rule; velocity capped at &plusmn;10% weekly.
            </p>
          </div>
        </div>
      </HudPanel>

      {/* Selectors */}
      <HudPanel variant="default" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Category Chips */}
          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A] mb-2">
              Select Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SERVICE_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id);
                      setTestAmount(cat.baselinePrice);
                    }}
                    className={`p-2.5 rounded-lg border text-left text-xs font-heading font-bold uppercase tracking-wider transition cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#8E0B16] to-[#D7261E] border-[#FFB81C] text-white shadow-[0_0_15px_rgba(255,184,28,0.3)]'
                        : 'bg-[#151821] hover:bg-[#1C202B] border-[#2A2E3A] text-[#A7A29A] hover:text-white'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {cat.id === 'cook_maid' && (
                      <span className="block text-[9px] font-mono text-[#FFB81C] mt-0.5">
                        (3 jobs: Low Conf)
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Area Chips */}
          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A] mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#FFB81C]" />
              Select Hyperlocal Area
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NEIGHBORHOODS.map((n) => {
                const isSelected = selectedNeighborhood.id === n.id;
                return (
                  <button
                    key={n.id}
                    onClick={() => setSelectedNeighborhood(n)}
                    className={`p-2.5 rounded-lg border text-left text-xs font-heading font-bold uppercase tracking-wider transition cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#8E0B16] to-[#D7261E] border-[#FFB81C] text-white shadow-[0_0_15px_rgba(255,184,28,0.3)]'
                        : 'bg-[#151821] hover:bg-[#1C202B] border-[#2A2E3A] text-[#A7A29A] hover:text-white'
                    }`}
                  >
                    <p className="truncate">{n.name}</p>
                    <p className="text-[10px] text-[#A7A29A] font-mono mt-0.5">{n.areaKey}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rate Simulator Bar */}
        <div className="pt-3 border-t border-[#2A2E3A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#5EE6FF]" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-white">
              Simulate Any Rate on Live Band:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-44">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-heading font-bold text-[#A7A29A] text-xs">
                ₹
              </span>
              <input
                type="number"
                step={25}
                value={testAmount || ''}
                onChange={(e) => setTestAmount(Number(e.target.value))}
                className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl pl-8 pr-3 py-2 font-heading text-sm font-bold text-white focus:outline-none focus:border-[#FFB81C] tabular-nums"
              />
            </div>
            {band && (
              <ForgeButton variant="ghost" size="sm" onClick={() => setTestAmount(band.typical)}>
                Reset
              </ForgeButton>
            )}
          </div>
        </div>
      </HudPanel>

      {/* Hero Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <PriceBandGauge
            band={band}
            currentPrice={testAmount}
            perspective="explorer"
            onPriceChange={(price) => setTestAmount(price)}
          />

          {/* Sparkline & Outlier Pruning Section */}
          <HudPanel variant="default" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#5EE6FF]" />
                <h4 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                  Completed Job Transaction Sparkline (Last 10 Jobs)
                </h4>
              </div>
              <span className="text-[11px] font-mono text-[#A7A29A]">
                Red points = Outliers Pruned
              </span>
            </div>

            {/* Sparkline */}
            <div className="p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A]">
              {renderSparkline()}
            </div>

            {/* Outlier Pruning Log */}
            <div className="space-y-2 pt-2">
              <h5 className="font-heading font-bold text-xs text-[#FFD65A] uppercase tracking-wider">
                Outliers Pruned by IQR Rule ({outlierPoints.length})
              </h5>
              {outlierPoints.length === 0 ? (
                <p className="text-xs text-[#A7A29A] font-sans">
                  No statistical outliers detected in the current window for {getCategoryLabel(category)}.
                </p>
              ) : (
                <div className="space-y-2">
                  {outlierPoints.map((pt, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#FF5C6C] shrink-0" />
                        <div>
                          <span className="font-bold text-white">{formatINR(pt.price)}</span>
                          <span className="text-[#A7A29A] text-[11px] ml-2">Job {pt.id}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#FF5C6C]">
                        {pt.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </HudPanel>
        </div>

        {/* Algorithm Technical Transparency Spec */}
        <div className="lg:col-span-4 space-y-5">
          <HudPanel variant="default" className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5EE6FF]" />
              <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">Mathematical Architecture</h3>
            </div>

            <div className="space-y-3 text-xs text-[#A7A29A] font-sans">
              <div className="p-3 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                <span className="text-white font-heading font-bold uppercase tracking-wider block mb-0.5">1. IQR Rule</span>
                <p className="text-[11px] leading-relaxed">
                  Drops values &lt; Q1 - 1.5&times;IQR or &gt; Q3 + 1.5&times;IQR. Deliberate extreme quotes are filtered automatically.
                </p>
              </div>

              <div className="p-3 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                <span className="text-white font-heading font-bold uppercase tracking-wider block mb-0.5">2. Anti-Gaming Pair Cap</span>
                <p className="text-[11px] leading-relaxed">
                  Worker-customer pairs contribute at most 2 completed jobs per 7-day rolling window to stop collusive artificial rate surges.
                </p>
              </div>

              <div className="p-3 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                <span className="text-white font-heading font-bold uppercase tracking-wider block mb-0.5">3. 10% Weekly Velocity Bound</span>
                <p className="text-[11px] leading-relaxed">
                  Bands may not fluctuate more than 10% week-over-week against recent snapshots, ensuring market predictability.
                </p>
              </div>

              <div className="p-3 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                <span className="text-white font-heading font-bold uppercase tracking-wider block mb-0.5">4. Sparse Fallback Tier</span>
                <p className="text-[11px] leading-relaxed">
                  Categories with &lt;5 jobs are explicitly flagged as &ldquo;Low: Few jobs&rdquo; (test with Cook &amp; Maid, which has 3 jobs).
                </p>
              </div>
            </div>
          </HudPanel>
        </div>
      </div>
    </div>
  );
};
