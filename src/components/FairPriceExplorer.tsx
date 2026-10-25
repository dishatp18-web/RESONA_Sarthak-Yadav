import React, { useState, useEffect } from 'react';
import { SERVICE_CATEGORIES, NEIGHBORHOODS, getCategoryLabel } from '../config.js';
import { PriceBandResult } from '../types.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { 
  Chip, 
  Card, 
  Sheet, 
  TextLink, 
  DemoDataPill, 
  formatINR 
} from './ui/index.js';

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
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const fetchBand = async () => {
      try {
        const res = await fetch(
          `/api/price-band?category=${category}&lat=${selectedNeighborhood.lat}&lng=${selectedNeighborhood.lng}&price=${testAmount}&perspective=customer`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled) {
          setBand(data.band);
        }
      } catch (err) {
        // Fallback
      }
    };

    fetchBand();
    return () => {
      isCancelled = true;
    };
  }, [category, selectedNeighborhood, testAmount]);

  // Fetch recent completed jobs for sparkline and unusual prices
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

        const sorted = catJobs.slice(0, 10);
        if (!isCancelled && band) {
          const upperFence = band.high + (band.high - band.low) * 1.5;
          const lowerFence = Math.max(50, band.low - (band.high - band.low) * 1.5);

          const points: RecentJobPoint[] = sorted.map((j: any) => {
            const price = Number(j.agreed_price || j.offered_price);
            const isOutlier = price > upperFence || price < lowerFence;
            return {
              id: j.id,
              price,
              date: j.completed_at || j.created_at,
              isOutlier,
              reason: isOutlier
                ? price > upperFence
                  ? `₹${price} was higher than normal range`
                  : `₹${price} was lower than normal range`
                : undefined,
            };
          });
          setRecentPoints(points);
        }
      } catch (err) {
        // Fallback
      }
    };

    fetchRecentJobs();
    return () => {
      isCancelled = true;
    };
  }, [category, band]);

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
        <path
          d={pathD}
          fill="none"
          stroke="#B5541E"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={c.point.isOutlier ? 4.5 : 3.5}
            fill={c.point.isOutlier ? '#DC2626' : '#059669'}
            stroke="#FFFBF3"
            strokeWidth="2"
          />
        ))}
      </svg>
    );
  };

  const unusualPoints = recentPoints.filter((p) => p.isOutlier);

  return (
    <div className="w-full max-w-lg mx-auto h-full flex flex-col justify-between overflow-hidden px-6 py-4 space-y-6 select-none">
      {/* Title & Demo Data Pill */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-h2">
            Prices
          </h1>
          <DemoDataPill />
        </div>
        <p className="text-[14px] leading-[20px] text-[#6B5B4E]">
          Recent prices paid for trades in {selectedNeighborhood.name.split(' ')[0]}.
        </p>
      </div>

      {/* Category Chips */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-6 px-6">
          {SERVICE_CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <Chip
                key={cat.id}
                selected={isSelected}
                onClick={() => {
                  setCategory(cat.id);
                  setTestAmount(cat.baselinePrice);
                }}
              >
                {cat.name}
              </Chip>
            );
          })}
        </div>
      </div>

      {/* The Big Gauge in a Calm Card */}
      <Card className="space-y-4">
        <PriceBandGauge
          band={band}
          value={testAmount}
          perspective="customer"
          onChange={(p) => setTestAmount(p)}
        />

        {/* Links: "How is this calculated?" & "Details" */}
        <div className="flex items-center justify-between pt-2 border-t border-[#EADFC9]">
          <TextLink onClick={() => setShowHowItWorks(true)}>
            How is this calculated?
          </TextLink>
          <TextLink onClick={() => setShowDetailsSheet(true)}>
            Details
          </TextLink>
        </div>
      </Card>

      {/* "How is this calculated?" Sheet */}
      <Sheet
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
        title="How is this calculated?"
      >
        <div className="space-y-4 text-[14px] leading-[22px] text-[#2A1B12]">
          <p>
            FairFix computes live price benchmarks directly from completed repair jobs in your neighborhood.
          </p>
          <div className="bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 space-y-2">
            <ul className="list-disc list-inside space-y-1.5 text-[#6B5B4E]">
              <li><strong>Typical price:</strong> The middle price paid for repairs.</li>
              <li><strong>Fair band:</strong> The central 50% range of completed local jobs.</li>
              <li><strong>Unusual prices removed:</strong> High or low outliers are discarded automatically.</li>
            </ul>
          </div>
        </div>
      </Sheet>

      {/* "Details" Sheet with Sparkline, unusual prices removed, and band history */}
      <Sheet
        isOpen={showDetailsSheet}
        onClose={() => setShowDetailsSheet(false)}
        title={`${getCategoryLabel(category)} details`}
      >
        <div className="space-y-5 text-[14px] text-[#2A1B12]">
          {/* Sparkline */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-[16px]">
              Recent completed prices
            </span>
            <div className="bg-[#FCF5E8] rounded-[20px] p-4 border border-[#EADFC9]">
              {renderSparkline()}
            </div>
          </div>

          {/* Unusual prices removed */}
          <div className="space-y-2">
            <span className="font-heading font-bold text-[16px]">
              Unusual prices removed
            </span>
            {unusualPoints.length === 0 ? (
              <p className="text-[12px] text-[#6B5B4E]">
                No unusual prices removed in recent jobs.
              </p>
            ) : (
              <div className="space-y-2">
                {unusualPoints.map((pt) => (
                  <div
                    key={pt.id}
                    className="p-3 rounded-[16px] bg-[#FCF5E8] border border-[#EADFC9] flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-[#DC2626]">₹{pt.price}</span>
                    <span className="text-[#6B5B4E]">{pt.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Band history note */}
          <div className="space-y-1 pt-2 border-t border-[#EADFC9] text-[12px] text-[#6B5B4E]">
            <p>
              Updated automatically each time a customer rates a completed repair.
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
};
