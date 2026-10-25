/**
 * PriceBandGauge: Calm Edition
 * Simplified track: base track, emerald fair zone, user marker,
 * ONE clear sentence, no jargon.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { PriceBandResult } from '../types.js';
import { formatINR } from './ui/index.js';

export interface PriceBandGaugeProps {
  band: PriceBandResult | null;
  value?: number;
  currentPrice?: number;
  perspective?: 'customer' | 'worker' | 'explorer';
  category?: string;
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
}) => {
  const effectivePrice = value !== undefined ? value : legacyCurrentPrice !== undefined ? legacyCurrentPrice : 450;
  const triggerChange = onChange || onPriceChange;

  if (!band) {
    return (
      <div className="bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 text-center text-sm text-[#6B5B4E]">
        Loading price guide...
      </div>
    );
  }

  // Geometric scale
  const gaugeMin = Math.max(0, Math.round(band.low * 0.7));
  const gaugeMax = Math.round(band.high * 1.3);
  const gaugeRange = gaugeMax - gaugeMin || 1;

  const lowPct = Math.max(0, Math.min(100, ((band.low - gaugeMin) / gaugeRange) * 100));
  const highPct = Math.max(0, Math.min(100, ((band.high - gaugeMin) / gaugeRange) * 100));
  const typicalPct = Math.max(0, Math.min(100, ((band.typical - gaugeMin) / gaugeRange) * 100));
  const currentPct = Math.max(0, Math.min(100, ((effectivePrice - gaugeMin) / gaugeRange) * 100));

  const isFair = effectivePrice >= band.low && effectivePrice <= band.high;
  const isAbove = effectivePrice > band.high;

  // Single summary sentence per Calm rules
  let summarySentence = `₹${band.low} to ₹${band.high} is typical near you.`;
  if (perspective === 'worker') {
    if (isFair) {
      summarySentence = `Your rate of ₹${effectivePrice} is within the typical range for completed jobs nearby.`;
    } else if (isAbove) {
      summarySentence = `Your rate is ₹${effectivePrice - band.typical} above what customers paid nearby.`;
    } else {
      summarySentence = `Your rate is ₹${band.typical - effectivePrice} below what customers paid nearby.`;
    }
  }

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

  return (
    <div className="space-y-3">
      {/* Gauge Track */}
      <div
        className="relative pt-4 pb-6 px-1 select-none outline-none"
        tabIndex={0}
        role="slider"
        aria-label="Price band gauge"
        aria-valuemin={gaugeMin}
        aria-valuemax={gaugeMax}
        aria-valuenow={effectivePrice}
        onKeyDown={handleKeyDown}
      >
        {/* Base Track */}
        <div className="h-2 w-full bg-[#EADFC9] rounded-full overflow-hidden relative flex">
          {/* Below track offset */}
          <div style={{ width: `${lowPct}%` }} className="h-full bg-[#EADFC9]" />
          {/* Fair Zone (Emerald) */}
          <div
            style={{ width: `${Math.max(2, highPct - lowPct)}%` }}
            className="h-full bg-[#059669] rounded-full"
            title="Fair market band"
          />
          {/* Above track */}
          <div style={{ width: `${Math.max(0, 100 - highPct)}%` }} className="h-full bg-[#EADFC9]" />
        </div>

        {/* Typical Marker line */}
        <div
          style={{ left: `${typicalPct}%` }}
          className="absolute top-3.5 bottom-5 w-0.5 bg-[#2A1B12] -translate-x-1/2 pointer-events-none z-10"
          title={`Typical: ₹${band.typical}`}
        />

        {/* User Price Marker Dot */}
        <motion.div
          animate={{ left: `${currentPct}%` }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="absolute top-2.5 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
        >
          <div className="w-5 h-5 rounded-full bg-[#B5541E] border-2 border-white shadow-sm" />
        </motion.div>

        {/* Low and High text labels */}
        <div
          style={{ left: `${lowPct}%` }}
          className="absolute bottom-0 -translate-x-1/2 text-[12px] leading-[16px] text-[#6B5B4E] font-medium"
        >
          ₹{band.low}
        </div>
        <div
          style={{ left: `${highPct}%` }}
          className="absolute bottom-0 -translate-x-1/2 text-[12px] leading-[16px] text-[#6B5B4E] font-medium"
        >
          ₹{band.high}
        </div>
      </div>

      {/* ONE Sentence */}
      <p className="text-[14px] leading-[20px] text-[#2A1B12] font-medium">
        {summarySentence}
      </p>
    </div>
  );
};
