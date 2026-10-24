/**
 * PriceBandGauge: Signature Hero Component for "Mark III Forge"
 * 
 * Steel track, glowing --grad-forge fair zone, gold median tick,
 * keyboard-accessible slider spring marker with cyan arc glow,
 * recompute pulse & delta badges, and collapsible math breakdown.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PriceBandResult } from '../types.js';
import { getCategoryLabel } from '../config.js';
import { Badge, HudPanel, formatINR } from './ui/index.js';
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export interface PriceBandGaugeProps {
  band: PriceBandResult | null;
  value?: number;
  currentPrice?: number;
  perspective?: 'customer' | 'worker' | 'explorer';
  category?: string;
  areaKey?: string;
  onChange?: (price: number) => void;
  onPriceChange?: (price: number) => void;
  compact?: boolean;
}

export const PriceBandGauge: React.FC<PriceBandGaugeProps> = ({
  band,
  value,
  currentPrice: legacyCurrentPrice,
  perspective = 'customer',
  onChange,
  onPriceChange,
  compact = false,
}) => {
  const effectivePrice = value !== undefined ? value : legacyCurrentPrice !== undefined ? legacyCurrentPrice : 450;
  const triggerChange = onChange || onPriceChange;

  const [showExplanation, setShowExplanation] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);
  const prevTypicalRef = useRef<number | null>(null);

  // Monitor for band recomputations and show subtle pulse & delta badge
  useEffect(() => {
    if (!band) return;

    if (prevTypicalRef.current !== null && prevTypicalRef.current !== band.typical) {
      const diff = band.typical - prevTypicalRef.current;
      setDelta(diff);
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 5000);
      return () => clearTimeout(timer);
    }
    prevTypicalRef.current = band.typical;
  }, [band]);

  if (!band) {
    return (
      <HudPanel className="p-4 animate-pulse text-xs text-[#A7A29A]">
        Forging live market fair-price band from nearby jobs...
      </HudPanel>
    );
  }

  // Calculate geometric scale range
  const gaugeMin = Math.max(0, Math.round(band.low * 0.7));
  const gaugeMax = Math.round(band.high * 1.3);
  const gaugeRange = gaugeMax - gaugeMin || 1;

  // Percentage positions
  const lowPct = Math.max(0, Math.min(100, ((band.low - gaugeMin) / gaugeRange) * 100));
  const highPct = Math.max(0, Math.min(100, ((band.high - gaugeMin) / gaugeRange) * 100));
  const typicalPct = Math.max(0, Math.min(100, ((band.typical - gaugeMin) / gaugeRange) * 100));
  const currentPct = Math.max(0, Math.min(100, ((effectivePrice - gaugeMin) / gaugeRange) * 100));

  // Determine current position status
  let status: 'below' | 'fair' | 'above' = 'fair';
  let statusLabel = 'In the fair band';
  let statusColor = '#5EE6FF'; // fair (cyan arc)

  if (effectivePrice < band.low) {
    status = 'below';
    statusLabel = 'Below band';
    statusColor = '#FFB81C'; // caution (gold)
  } else if (effectivePrice > band.high) {
    status = 'above';
    statusLabel = 'Above band';
    statusColor = '#FFB81C'; // caution (gold)
  }

  // Handle keyboard nudging
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!triggerChange) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      triggerChange(effectivePrice + 25);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      triggerChange(Math.max(50, effectivePrice - 25));
    }
  };

  // Role-Aware copy
  const perspectiveHeader =
    perspective === 'worker'
      ? 'Your Rate vs. What Customers Paid Nearby'
      : perspective === 'explorer'
      ? 'Live Completed-Job Market Band'
      : 'Typical Price Near You';

  const perspectiveHelper =
    perspective === 'worker'
      ? status === 'fair'
        ? 'Your rate matches the typical market range for completed jobs nearby.'
        : status === 'above'
        ? 'Your rate is above the 75th percentile of completed jobs nearby.'
        : 'Your rate is below what customers typically pay in this neighborhood.'
      : status === 'fair'
      ? 'Offers inside the band are easier to compare.'
      : status === 'above'
      ? 'Your price is above the fair-price band. You may be offering more than the typical local range.'
      : 'Your price is below the fair-price band. Workers may counter-offer or take longer to respond.';

  const confidenceBadge = () => {
    switch (band.confidence) {
      case 'high':
        return (
          <Badge variant="fair" icon={CheckCircle2}>
            High Confidence ({band.jobCount} jobs)
          </Badge>
        );
      case 'low (few jobs)':
        return (
          <Badge variant="caution" icon={AlertTriangle}>
            Low: Few Jobs ({band.jobCount})
          </Badge>
        );
      case 'estimate':
      default:
        return (
          <Badge variant="caution" icon={Info}>
            Baseline Estimate
          </Badge>
        );
    }
  };

  // Check if band was computed in the last 60 seconds
  const isWithin60s = band.computedAt
    ? Date.now() - new Date(band.computedAt).getTime() < 60000
    : false;
  const showUpdatedJustNow = justUpdated && isWithin60s;
  const computedTimeStr = band.computedAt
    ? new Date(band.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  // Distance between user's typed price and typical median
  const priceDiffFromTypical = effectivePrice - band.typical;

  return (
    <HudPanel variant="highlight" className="p-4 sm:p-6 relative overflow-hidden">
      {/* Background radial accent glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#D7261E]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#8E0B16]/30 border border-[#FFB81C]/40 flex items-center justify-center text-[#FFB81C]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-[#F4F1EC]">
                {perspectiveHeader}
              </h4>
              <Badge variant="neutral" size="sm">
                Demo data
              </Badge>
              {showUpdatedJustNow ? (
                <span
                  role="status"
                  aria-live="polite"
                  className="px-2 py-0.5 rounded text-xs font-heading font-bold uppercase tracking-wider bg-[#5EE6FF]/20 text-[#5EE6FF] border border-[#5EE6FF]/40 animate-pulse"
                >
                  Updated just now
                </span>
              ) : computedTimeStr ? (
                <span className="text-xs font-mono text-[#A7A29A]">
                  Band computed at {computedTimeStr}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[#A7A29A] font-sans capitalize">
              {getCategoryLabel(band.category)} &bull; Bengaluru
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Typed price vs Typical median comparison chip in CAUTION style (never red) */}
          {priceDiffFromTypical < 0 ? (
            <span className="inline-flex items-center text-xs font-heading font-bold px-2 py-0.5 rounded bg-[#FFB81C]/15 text-[#FFB81C] border border-[#FFB81C]/35">
              <ArrowDown className="w-3 h-3 mr-0.5 text-[#FFB81C]" />
              {formatINR(Math.abs(priceDiffFromTypical))} below typical
            </span>
          ) : priceDiffFromTypical > 0 ? (
            <span className="inline-flex items-center text-xs font-heading font-bold px-2 py-0.5 rounded bg-[#FFB81C]/15 text-[#FFB81C] border border-[#FFB81C]/35">
              <ArrowUp className="w-3 h-3 mr-0.5 text-[#FFB81C]" />
              {formatINR(priceDiffFromTypical)} above typical
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-heading font-bold px-2 py-0.5 rounded bg-[#5EE6FF]/15 text-[#5EE6FF] border border-[#5EE6FF]/35">
              <CheckCircle2 className="w-3 h-3 mr-0.5 text-[#5EE6FF]" />
              Matches typical
            </span>
          )}
          {confidenceBadge()}
        </div>
      </div>

      {/* Hero Numbers */}
      <div className="flex items-baseline justify-between mb-5 bg-[#07070A]/80 border border-[#2A2E3A] rounded-xl p-3.5">
        <div>
          <span className="text-xs uppercase tracking-wider font-heading text-[#A7A29A] block font-bold">
            Fair Market Band
          </span>
          <span className="font-heading text-xl sm:text-2xl font-black text-white tracking-tight tabular-nums">
            {formatINR(band.low)} – {formatINR(band.high)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wider font-heading text-[#FFB81C] font-bold block">
            Typical (Median)
          </span>
          <span className="font-heading text-lg sm:text-xl font-bold text-[#FFD65A] tabular-nums">
            {formatINR(band.typical)}
          </span>
        </div>
      </div>

      {/* Signature Visual: 3-Zone Horizontal Steel Track with --grad-forge */}
      {(() => {
        const isCloseToTypical = Math.abs(currentPct - typicalPct) < 10;
        return (
          <div
            className="relative pt-8 pb-10 px-2 my-2 outline-none"
            tabIndex={0}
            role="slider"
            aria-label="Your offered price on live band"
            aria-valuemin={gaugeMin}
            aria-valuemax={gaugeMax}
            aria-valuenow={effectivePrice}
            aria-valuetext={`${formatINR(effectivePrice)}: ${statusLabel}`}
            onKeyDown={handleKeyDown}
          >
            {/* Track Base */}
            <div className="h-3 w-full bg-[#151821] border border-[#2A2E3A] rounded-full overflow-hidden relative flex">
              {/* Below Zone */}
              <div
                style={{ width: `${lowPct}%` }}
                className="h-full bg-[#FFB81C]/15 border-r border-[#FFB81C]/30 transition-all duration-500"
                title="Below fair band"
              />

              {/* Fair Zone (Glowing --grad-forge Bar) */}
              <div
                style={{ width: `${highPct - lowPct}%` }}
                className="h-full bg-gradient-to-r from-[#8E0B16] via-[#D7261E] to-[#FFB81C] shadow-[0_0_14px_rgba(255,184,28,0.4)] relative transition-all duration-500"
                title="Fair market band"
              />

              {/* Above Zone */}
              <div
                style={{ width: `${100 - highPct}%` }}
                className="h-full bg-[#FFB81C]/15 border-l border-[#FFB81C]/30 transition-all duration-500"
                title="Above fair band"
              />
            </div>

            {/* Typical Value Tick with Label ABOVE the track */}
            <div
              style={{ left: `${typicalPct}%` }}
              className="absolute top-2 bottom-5 w-0.5 bg-[#FFD65A] -translate-x-1/2 pointer-events-none transition-all duration-500 z-10 shadow-[0_0_8px_#FFD65A]"
            >
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#0E1016] text-[#FFD65A] border border-[#FFB81C]/50 text-xs font-heading font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                Typ: {formatINR(band.typical)}
              </div>
            </div>

            {/* Low and High Indicators */}
            <div
              style={{ left: `${lowPct}%` }}
              className="absolute bottom-0 -translate-x-1/2 text-xs font-mono text-[#A7A29A]"
            >
              {formatINR(band.low)}
            </div>
            <div
              style={{ left: `${highPct}%` }}
              className="absolute bottom-0 -translate-x-1/2 text-xs font-mono text-[#A7A29A]"
            >
              {formatINR(band.high)}
            </div>

            {/* Spring Marker Dot with Label BELOW the track (anti-collision offset) */}
            <motion.div
              animate={{ left: `${currentPct}%` }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="absolute top-7 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
            >
              {/* Glowing Pin Dot on track */}
              <div
                style={{ backgroundColor: statusColor, boxShadow: `0 0 14px ${statusColor}` }}
                className="w-4 h-4 rounded-full border-2 border-white"
              />

              {/* Floating Pill Label BELOW the track */}
              <div
                style={{ borderColor: `${statusColor}60`, backgroundColor: '#07070A' }}
                className={`text-xs font-heading font-bold px-2 py-0.5 rounded border shadow-2xl flex items-center gap-1 whitespace-nowrap transition-all duration-200 ${
                  isCloseToTypical ? 'mt-3.5' : 'mt-1.5'
                }`}
              >
                {status === 'fair' ? (
                  <span style={{ color: statusColor }}>●</span>
                ) : status === 'below' ? (
                  <ArrowDown className="w-3 h-3 text-[#FFB81C]" />
                ) : (
                  <ArrowUp className="w-3 h-3 text-[#FFB81C]" />
                )}
                <span className="text-[#F4F1EC] font-mono">{formatINR(effectivePrice)}</span>
                <span style={{ color: statusColor }}>({statusLabel})</span>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Status Warning / Info Strip */}
      <div
        style={{
          borderColor: status === 'fair' ? 'rgba(94,230,255,0.3)' : 'rgba(255,184,28,0.35)',
          backgroundColor: status === 'fair' ? 'rgba(94,230,255,0.08)' : 'rgba(255,184,28,0.08)',
        }}
        className="p-3 rounded-xl border text-xs flex items-start gap-2.5 mt-2 transition-colors duration-200"
      >
        {status === 'fair' ? (
          <CheckCircle2 className="w-4 h-4 text-[#5EE6FF] shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-[#FFB81C] shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p className="font-heading font-bold text-white text-xs uppercase tracking-wider">
            {status === 'fair' ? 'Within Fair Band' : statusLabel}
          </p>
          <p className="text-xs text-[#F4F1EC] mt-0.5 leading-relaxed font-sans">
            {perspectiveHelper}
          </p>
        </div>
      </div>

      {/* Quick Tap Snap Chips */}
      {triggerChange && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#2A2E3A] text-xs">
          <span className="text-xs text-[#A7A29A] font-heading uppercase font-bold">Snap to:</span>
          <button
            type="button"
            onClick={() => triggerChange(band.low)}
            className="px-2.5 py-1 rounded bg-[#151821] hover:bg-[#1C202B] text-[#F4F1EC] border border-[#2A2E3A] text-xs font-mono transition cursor-pointer"
          >
            Low: {formatINR(band.low)}
          </button>
          <button
            type="button"
            onClick={() => triggerChange(band.typical)}
            className="px-2.5 py-1 rounded bg-[#FFB81C]/15 hover:bg-[#FFB81C]/25 text-[#FFD65A] border border-[#FFB81C]/40 text-xs font-mono font-bold transition cursor-pointer"
          >
            Typical: {formatINR(band.typical)}
          </button>
          <button
            type="button"
            onClick={() => triggerChange(band.high)}
            className="px-2.5 py-1 rounded bg-[#151821] hover:bg-[#1C202B] text-[#F4F1EC] border border-[#2A2E3A] text-xs font-mono transition cursor-pointer"
          >
            High: {formatINR(band.high)}
          </button>
        </div>
      )}

      {/* Collapsible Math Explanation */}
      <div className="mt-4 pt-3 border-t border-[#2A2E3A]">
        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full flex items-center justify-between text-left text-xs text-[#A7A29A] hover:text-[#F4F1EC] transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5 font-heading uppercase tracking-wider font-bold">
            <Info className="w-3.5 h-3.5 text-[#5EE6FF]" />
            How is this calculated? ({band.jobCount} jobs, {band.outliersRemoved} outliers pruned)
          </span>
          {showExplanation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden text-xs text-[#A7A29A] mt-2 space-y-1.5 bg-[#07070A] p-3 rounded-xl border border-[#2A2E3A] font-sans"
            >
              <p className="text-[#F4F1EC] font-medium">{band.explanation}</p>
              <ul className="list-disc list-inside space-y-1 text-[#A7A29A] text-xs">
                <li><strong>Outlier Removal:</strong> Values outside Q1 - 1.5&times;IQR and Q3 + 1.5&times;IQR are eliminated automatically.</li>
                <li><strong>Anti-Gaming Cap:</strong> Max 2 jobs per customer-worker pair per 7-day rolling window.</li>
                <li><strong>Weekly Velocity Bound:</strong> Band movements are capped at &plusmn;10% week-over-week.</li>
                <li><strong>Confidence Tiers:</strong> &ge;5 jobs = High confidence; 1–4 jobs = Low confidence; 0 = Category baseline estimate.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </HudPanel>
  );
};
