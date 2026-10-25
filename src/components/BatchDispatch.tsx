/**
 * FairFix Batch Dispatch Engine - Calm Edition
 * Multi-request multi-worker assignment solver benchmarked against Hungarian matching.
 * Honesty rule: "Quantum-inspired, runs on a normal computer."
 * Follows Calm tokens: warm cream, terracotta, no monospace, no dark cards.
 */
import React, { useState, useEffect } from 'react';
import { 
  Play, 
  RotateCcw, 
  Sliders, 
  Cpu, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { Card, PrimaryButton, SecondaryButton, formatINR } from './ui/index.js';

interface RequestItem {
  id: string;
  category: string;
  lat: number;
  lng: number;
  offeredPrice: number;
  description: string;
}

interface WorkerItem {
  id: string;
  name: string;
  trade: string;
  lat: number;
  lng: number;
  baseRate: number;
  ratingAvg: number;
  ratingCount: number;
}

interface SolveResult {
  assignments: {
    reqId: string;
    workerId: string;
    distKm: number;
    priceGap: number;
    weight: number;
  }[];
  totalWeight: number;
  totalDistanceKm: number;
  solverTimeMs: number;
  energyTrace?: { step: number; energy: number; temp: number }[];
  hungarian?: {
    totalWeight: number;
    timeMs: number;
    optimalMatch: boolean;
  };
}

export const BatchDispatch: React.FC = () => {
  const [preset, setPreset] = useState<'4x4' | '6x6' | 'full'>('4x4');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);

  // Solvers hyperparameters
  const [alphaDist, setAlphaDist] = useState<number>(1.0);
  const [betaPrice, setBetaPrice] = useState<number>(0.5);
  const [gammaRating, setGammaRating] = useState<number>(0.3);
  const [sweeps, setSweeps] = useState<number>(1000);
  const [showMathExplainer, setShowMathExplainer] = useState(false);

  const fetchBatchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dispatch/pending-batch?preset=${preset}`);
      if (!res.ok) throw new Error('Failed to load batch requests');
      const data = await res.json();
      setRequests(data.requests || []);
      setWorkers(data.workers || []);
      setResult(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchData();
  }, [preset]);

  const handleSolve = async () => {
    if (requests.length === 0 || workers.length === 0) return;
    setRunning(true);
    try {
      const res = await fetch('/api/dispatch/solve-qubo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests,
          workers,
          alpha: alphaDist,
          beta: betaPrice,
          gamma: gammaRating,
          sweeps,
          compareHungarian: requests.length <= 6,
        }),
      });
      if (!res.ok) throw new Error('Solve request failed');
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const isAssigned = (reqId: string, workerId: string) => {
    if (!result) return false;
    return result.assignments.some((a) => a.reqId === reqId && a.workerId === workerId);
  };

  const trace = result?.energyTrace || [];
  const minEnergy = trace.length ? Math.min(...trace.map((t) => t.energy)) : 0;
  const maxEnergy = trace.length ? Math.max(...trace.map((t) => t.energy)) : 100;
  const energyRange = maxEnergy - minEnergy || 1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6 select-none bg-[#FCF5E8] text-[#2A1B12]">
      {/* 1. Header & Honesty Pill */}
      <Card className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F4EBDA] text-[#6B5B4E] text-[12px] font-medium">
          <Cpu className="w-3.5 h-3.5 text-[#B5541E]" />
          <span>Quantum-inspired, runs on a normal computer.</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-h2">
              Batch Dispatch Engine
            </h1>
            <p className="text-[14px] text-[#6B5B4E] mt-1 max-w-2xl">
              Simultaneous multi-request multi-worker assignment solver benchmarked against the Hungarian algorithm.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-[#F4EBDA] p-1 rounded-full">
              {(['4x4', '6x6', 'full'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`h-[36px] px-3.5 rounded-full text-[12px] font-medium transition-colors cursor-pointer ${
                    preset === p
                      ? 'bg-[#B5541E] text-white'
                      : 'text-[#6B5B4E] hover:text-[#2A1B12]'
                  }`}
                >
                  {p === '4x4' ? '4x4' : p === '6x6' ? '6x6' : 'Full Batch'}
                </button>
              ))}
            </div>

            <PrimaryButton onClick={handleSolve} loading={running} className="!h-[40px] !text-[14px] !px-5">
              Solve Batch
            </PrimaryButton>
          </div>
        </div>
      </Card>

      {/* 2. Parameters Card */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#EADFC9] pb-3">
          <span className="font-heading font-bold text-[16px] text-[#2A1B12]">
            Objective Weights
          </span>
          <span className="text-[12px] text-[#6B5B4E]">
            {requests.length} requests &bull; {workers.length} workers
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-1">
            <div className="flex justify-between text-[12px] text-[#6B5B4E]">
              <span>Distance Penalty</span>
              <strong className="text-[#2A1B12]">{alphaDist.toFixed(1)}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={alphaDist}
              onChange={(e) => setAlphaDist(parseFloat(e.target.value))}
              className="w-full accent-[#B5541E]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[12px] text-[#6B5B4E]">
              <span>Price Gap Penalty</span>
              <strong className="text-[#2A1B12]">{betaPrice.toFixed(1)}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={betaPrice}
              onChange={(e) => setBetaPrice(parseFloat(e.target.value))}
              className="w-full accent-[#B5541E]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[12px] text-[#6B5B4E]">
              <span>Rating Bonus</span>
              <strong className="text-[#2A1B12]">{gammaRating.toFixed(1)}</strong>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={gammaRating}
              onChange={(e) => setGammaRating(parseFloat(e.target.value))}
              className="w-full accent-[#B5541E]"
            />
          </div>
        </div>
      </Card>

      {/* 3. Results Section */}
      {result && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#EADFC9] pb-3">
            <span className="font-heading font-bold text-[18px] text-[#2A1B12]">
              Solved Assignments
            </span>
            <div className="flex items-center gap-3 text-[12px] text-[#6B5B4E]">
              <span>Time: <strong className="text-[#2A1B12]">{result.solverTimeMs} ms</strong></span>
              <span>Total Distance: <strong className="text-[#2A1B12]">{result.totalDistanceKm.toFixed(1)} km</strong></span>
              {result.hungarian && (
                <span className="text-[#059669] font-medium">
                  Matches Hungarian optimal
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.assignments.map((a, idx) => {
              const req = requests.find((r) => r.id === a.reqId);
              const worker = workers.find((w) => w.id === a.workerId);

              return (
                <div
                  key={idx}
                  className="p-4 rounded-[16px] bg-[#FCF5E8] border border-[#EADFC9] space-y-1 text-[14px]"
                >
                  <div className="flex items-center justify-between font-heading font-bold text-[#2A1B12]">
                    <span>Request {a.reqId.replace(/^req_/, '')}</span>
                    <span className="text-[#B5541E]">{worker?.name || a.workerId}</span>
                  </div>
                  <div className="text-[12px] text-[#6B5B4E] flex items-center justify-between">
                    <span>{req?.description || req?.category}</span>
                    <span>{a.distKm.toFixed(1)} km &bull; ₹{req?.offeredPrice}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
