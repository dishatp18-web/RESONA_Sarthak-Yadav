/**
 * FairFix Live Fair-Price Band Display Card & Chips
 * The core platform differentiator: algorithmic fair bands with confidence & anti-gaming transparency.
 */
import React from 'react';
import { PriceBandResult, PriceComparison } from '../types.js';
import { TrendingUp, AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

interface PriceBandCardProps {
  band: PriceBandResult | null;
  comparison?: PriceComparison | null;
  currentAmount?: number;
  compact?: boolean;
}

export const PriceBandCard: React.FC<PriceBandCardProps> = ({
  band,
  comparison,
  currentAmount,
  compact = false,
}) => {
  if (!band) {
    return (
      <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 animate-pulse text-xs text-slate-400">
        Computing live fair-price band from nearby jobs...
      </div>
    );
  }

  const confidenceBadge = () => {
    switch (band.confidence) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" /> High Confidence ({band.jobCount} jobs)
          </span>
        );
      case 'low (few jobs)':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" /> Low Confidence ({band.jobCount} jobs)
          </span>
        );
      case 'estimate':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
            <Info className="w-3 h-3" /> Baseline Estimate
          </span>
        );
    }
  };

  if (compact) {
    return (
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Fair-Price Band</span>
            <span className="text-xs text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
              Demo data
            </span>
          </div>
          {confidenceBadge()}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-white tracking-tight">
            ₹{band.low.toLocaleString()} - ₹{band.high.toLocaleString()}
          </span>
          <span className="text-xs text-amber-300 font-medium">
            (Typical: ₹{band.typical.toLocaleString()})
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-850 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
      {/* Background Accent glow */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white flex items-center gap-1.5">
              Live Fair-Price Band
              <span className="text-xs font-normal uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-400/30">
                Demo data
              </span>
            </h4>
            <p className="text-xs text-slate-400 capitalize">{band.category.replace('_', ' & ')} near you</p>
          </div>
        </div>
        {confidenceBadge()}
      </div>

      {/* Primary Band Numbers */}
      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 mb-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Fair Range</span>
            <span className="text-2xl font-black text-white tracking-tight">
              ₹{band.low.toLocaleString()} – ₹{band.high.toLocaleString()}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-amber-400/90 font-medium block">Typical (Median)</span>
            <span className="text-xl font-bold text-amber-300">
              ₹{band.typical.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Visual Range Bar */}
        <div className="mt-3 relative pt-2 pb-1">
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-indigo-500/30 w-1/4" title="Low percentile" />
            <div className="h-full bg-emerald-500/80 w-1/2 relative" title="Fair market band">
              {/* Typical marker pin */}
              <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-amber-400 transform -translate-x-1/2" />
            </div>
            <div className="h-full bg-indigo-500/30 w-1/4" title="High percentile" />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
            <span>₹{band.low} (25th%)</span>
            <span className="text-amber-400 font-semibold">Typical (50th%)</span>
            <span>₹{band.high} (75th%)</span>
          </div>
        </div>
      </div>

      {/* Real-time Counter-offer or Input Comparison Chip */}
      {comparison && currentAmount !== undefined && currentAmount > 0 && (
        <div className="mb-3">
          {comparison.status === 'within' ? (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-semibold text-emerald-300">{comparison.label}</span>
                <span className="block text-xs text-emerald-400/90 mt-0.5">
                  Offers within this band have 88% higher acceptance rates.
                </span>
              </div>
            </div>
          ) : comparison.status === 'below' ? (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <span>{comparison.label}</span>
                  <span className="text-xs uppercase tracking-wide bg-amber-500/30 text-amber-200 px-1.5 py-0.2 rounded">
                    Notice
                  </span>
                </div>
                <p className="text-xs text-amber-300/90 mt-0.5">
                  {comparison.warning || 'Your offer is below typical market rate. Workers may counter-offer or take longer to respond.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs text-purple-200">
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                  <span>{comparison.label}</span>
                  <span className="text-xs uppercase tracking-wide bg-purple-500/30 text-purple-200 px-1.5 py-0.2 rounded">
                    Above Band
                  </span>
                </div>
                <p className="text-xs text-purple-300/90 mt-0.5">
                  {comparison.warning || 'Offer is higher than typical fair range. You can proceed, but may be paying a premium.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explanation string & Anti-gaming disclosure */}
      <div className="text-xs text-slate-400 flex items-start gap-1.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
        <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-slate-300">{band.explanation}</p>
          <p className="text-xs text-slate-500">
            Outliers rejected using 1.5&times;IQR rule &bull; Max 2 jobs/pair/week anti-gaming cap &bull; Max &plusmn;10% weekly velocity.
          </p>
        </div>
      </div>
    </div>
  );
};
