import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingDown,
  ShieldCheck,
  MapPin,
  Clock,
  IndianRupee,
  Layers,
  Sparkles,
} from 'lucide-react';

interface RequestItem {
  id: string;
  customer_name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  offered_price: number;
}

interface WorkerItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categories: string[];
  base_rate: number;
  radius_km: number;
  verification_status: 'verified' | 'pending' | 'unverified' | 'rejected';
  rating_avg: number;
  available: boolean;
  is_flagged: boolean;
}

interface TracePoint {
  sweep: number;
  temperature: number;
  energy: number;
  violations: number;
}

interface DispatchResponse {
  success: boolean;
  assignments: { reqId: string; workerId: string; cost: number; eta: number }[];
  totalAnnealingCost: number;
  exactCost: number | null;
  optimalityGapPercent: number | null;
  exactSolverUsed: boolean;
  energyTrace: TracePoint[];
  computationTimeMs: number;
  matrixSize: { requests: number; workers: number };
  costMatrix: number[][];
  costBreakdowns: any[][];
  disclaimer: string;
  annealingSweeps: number;
  finalTemperature: number;
}

export const BatchDispatch: React.FC = () => {
  const [preset, setPreset] = useState<'4x4' | '6x6' | 'full'>('4x4');
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<DispatchResponse | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ r: number; w: number } | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  const [animatedSweep, setAnimatedSweep] = useState<number | null>(null);

  // Fetch pending batch on preset change
  useEffect(() => {
    fetchBatch(preset);
  }, [preset]);

  const fetchBatch = async (selectedPreset: string) => {
    setLoading(true);
    setResult(null);
    setSelectedCell(null);
    try {
      const res = await fetch(`/api/dispatch/pending-batch?preset=${selectedPreset}`);
      const data = await res.json();
      setRequests(data.requests || []);
      setWorkers(data.workers || []);
    } catch (err) {
      console.error('Failed to fetch batch data', err);
    } finally {
      setLoading(false);
    }
  };

  const runAnnealing = async () => {
    if (requests.length === 0 || workers.length === 0) return;
    setRunning(true);
    setSelectedCell(null);
    try {
      const res = await fetch('/api/dispatch/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, workers, typicalPrice: 500 }),
      });
      const data: DispatchResponse = await res.json();
      setResult(data);

      // Simple animation through sweeps
      if (data.energyTrace && data.energyTrace.length > 0) {
        let idx = 0;
        const interval = setInterval(() => {
          if (idx < data.energyTrace.length) {
            setAnimatedSweep(data.energyTrace[idx].sweep);
            idx++;
          } else {
            clearInterval(interval);
            setAnimatedSweep(null);
          }
        }, 30);
      }
    } catch (err) {
      console.error('Dispatch solver failed', err);
    } finally {
      setRunning(false);
    }
  };

  const isAssigned = (reqId: string, workerId: string) => {
    if (!result) return false;
    return result.assignments.some((a) => a.reqId === reqId && a.workerId === workerId);
  };

  // SVG Chart Dimensions for Energy Trace
  const trace = result?.energyTrace || [];
  const minEnergy = trace.length ? Math.min(...trace.map((t) => t.energy)) : 0;
  const maxEnergy = trace.length ? Math.max(...trace.map((t) => t.energy)) : 100;
  const energyRange = maxEnergy - minEnergy || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. MANDATORY HONESTY LABEL & HEADER */}
      <div className="border border-[#FFB81C]/30 bg-[#07070A] p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFB81C]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        {/* Mandatory Transparency Chip */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#111218] border border-[#FFB81C]/40 text-[#FFB81C] text-xs font-mono font-medium tracking-wide uppercase mb-3">
          <Cpu className="w-3.5 h-3.5 text-[#FFB81C]" />
          <span>Quantum-inspired: classical simulated annealing on a QUBO. Not run on quantum hardware.</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Batch Dispatch Engine</span>
              <span className="text-xs px-2 py-0.5 border border-[#5EE6FF]/30 text-[#5EE6FF] font-mono font-normal">
                QUBO Solver
              </span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-3xl">
              Solves multi-request multi-worker hyper-local assignment via classical simulated annealing on an Ising/QUBO Hamiltonian.
              Benchmarked directly against the exact Hungarian algorithm for $N \le 6$.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-[#111218] border border-zinc-800 p-0.5">
              <button
                type="button"
                onClick={() => setPreset('4x4')}
                className={`px-3 py-2 text-xs font-mono font-semibold transition-colors min-h-[44px] flex items-center justify-center ${
                  preset === '4x4'
                    ? 'bg-[#FFB81C] text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                4x4 Benchmark
              </button>
              <button
                type="button"
                onClick={() => setPreset('6x6')}
                className={`px-3 py-2 text-xs font-mono font-semibold transition-colors min-h-[44px] flex items-center justify-center ${
                  preset === '6x6'
                    ? 'bg-[#FFB81C] text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                6x6 Benchmark
              </button>
              <button
                type="button"
                onClick={() => setPreset('full')}
                className={`px-3 py-2 text-xs font-mono font-semibold transition-colors min-h-[44px] flex items-center justify-center ${
                  preset === 'full'
                    ? 'bg-[#FFB81C] text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                8x12 Full Batch
              </button>
            </div>

            <button
              type="button"
              onClick={runAnnealing}
              disabled={running || loading}
              className="flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-[#FFB81C] hover:bg-[#FFB81C]/90 text-black font-semibold text-xs tracking-wide uppercase transition-all shadow-md disabled:opacity-50 cursor-pointer"
            >
              {running ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-black" />
                  <span>Annealing...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-black" />
                  <span>Solve QUBO</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchBatch(preset)}
              title="Reset & Reload"
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center border border-zinc-800 bg-[#111218] hover:border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. THREE-PANEL OPERATIONAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Request & Worker Pool (3 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Pending Service Requests */}
          <div className="bg-[#111218] border border-zinc-800 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#FFB81C]" />
                <span>Pending Requests ({requests.length})</span>
              </h3>
              <span className="text-xs font-mono text-zinc-500">Row Indices i</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {requests.map((req, idx) => (
                <div
                  key={req.id}
                  className="p-2.5 bg-[#07070A] border border-zinc-800 hover:border-zinc-700 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[#FFB81C] font-semibold">
                      [{idx}] {req.customer_name}
                    </span>
                    <span className="px-1.5 py-0.5 bg-zinc-900 border border-zinc-700 font-mono text-xs text-zinc-300 capitalize">
                      {req.category}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-xs truncate mt-1">{req.description}</p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-900 text-xs text-zinc-500 font-mono">
                    <span className="flex items-center gap-1">
                      <IndianRupee className="w-3 h-3 text-[#5EE6FF]" />
                      Offer: ₹{req.offered_price}
                    </span>
                    <span>{req.id}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Worker Pool */}
          <div className="bg-[#111218] border border-zinc-800 p-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-[#5EE6FF]" />
                <span>Worker Pool ({workers.length})</span>
              </h3>
              <span className="text-xs font-mono text-zinc-500">Col Indices j</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {workers.map((w, idx) => (
                <div
                  key={w.id}
                  className="p-2.5 bg-[#07070A] border border-zinc-800 hover:border-zinc-700 transition-colors text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-white font-medium">
                      [{idx}] {w.name}
                    </span>
                    <span
                      className={`text-xs font-mono px-1 py-0.5 uppercase ${
                        w.verification_status === 'verified'
                          ? 'border border-emerald-500/40 text-emerald-400'
                          : 'border border-amber-500/40 text-amber-400'
                      }`}
                    >
                      {w.verification_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-zinc-400 font-mono">
                    <span>Base: ₹{w.base_rate}</span>
                    <span>★ {w.rating_avg.toFixed(1)}</span>
                    <span className="text-zinc-500">R: {w.radius_km}km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: QUBO Cost Matrix Heatmap (5 cols) */}
        <div className="lg:col-span-5 bg-[#111218] border border-zinc-800 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5 text-[#FFB81C]" />
                  <span>QUBO Coupling Matrix $c[i][j]$</span>
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Lower cost is better. Gold highlighted cells indicate active assignment $x_{'{i,j}'} = 1$.
                </p>
              </div>

              {animatedSweep !== null && (
                <span className="text-xs font-mono text-[#5EE6FF] animate-pulse">
                  Sweep: {animatedSweep}
                </span>
              )}
            </div>

            {/* Matrix Heatmap Table */}
            {result?.costMatrix ? (
              <div className="overflow-x-auto pb-2">
                <table className="w-full border-collapse font-mono text-xs">
                  <thead>
                    <tr>
                      <th className="p-1 text-zinc-500 border-b border-zinc-800 text-left font-normal">
                        R \ W
                      </th>
                      {workers.map((w, j) => (
                        <th
                          key={w.id}
                          title={w.name}
                          className="p-1.5 text-center text-zinc-400 border-b border-zinc-800 font-mono text-xs"
                        >
                          W{j}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r, i) => (
                      <tr key={r.id}>
                        <td
                          title={r.customer_name}
                          className="p-1.5 text-zinc-400 border-r border-zinc-800 font-mono text-xs whitespace-nowrap"
                        >
                          R{i}
                        </td>
                        {workers.map((w, j) => {
                          const cost = result.costMatrix[i]?.[j] ?? 9999;
                          const assigned = isAssigned(r.id, w.id);
                          const isInfeasible = cost >= 10000;
                          const isSelected = selectedCell?.r === i && selectedCell?.w === j;

                          // Heatmap background color logic
                          let cellBg = 'bg-[#07070A]';
                          let cellText = 'text-zinc-400';
                          if (isInfeasible) {
                            cellBg = 'bg-red-950/20 text-red-700';
                          } else if (cost < 30) {
                            cellBg = 'bg-emerald-950/40 text-emerald-300';
                          } else if (cost < 60) {
                            cellBg = 'bg-cyan-950/30 text-cyan-300';
                          }

                          return (
                            <td
                              key={w.id}
                              onClick={() => setSelectedCell({ r: i, w: j })}
                              className={`p-1.5 text-center cursor-pointer transition-all border border-zinc-900 ${cellBg} ${cellText} ${
                                assigned
                                  ? '!bg-[#FFB81C]/20 !border-2 !border-[#FFB81C] !text-[#FFB81C] font-bold shadow-lg scale-105 z-10'
                                  : 'hover:border-zinc-700'
                              } ${isSelected ? 'ring-2 ring-[#5EE6FF]' : ''}`}
                            >
                              <div className="flex flex-col items-center justify-center">
                                <span>{isInfeasible ? '✕' : cost.toFixed(0)}</span>
                                {assigned && (
                                  <CheckCircle2 className="w-2.5 h-2.5 text-[#FFB81C] mt-0.5" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center text-zinc-500 font-mono text-xs border border-dashed border-zinc-800">
                Click &quot;Solve QUBO&quot; above to run simulated annealing on this batch.
              </div>
            )}
          </div>

          {/* Cell Breakdown Inspector */}
          {selectedCell && result?.costBreakdowns && (
            <div className="mt-4 p-3 bg-[#07070A] border border-zinc-800 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-300 pb-2 border-b border-zinc-800">
                <span className="text-[#FFB81C] font-semibold">
                  Coupling Inspector: R{selectedCell.r} × W{selectedCell.w}
                </span>
                <span className="text-zinc-500">
                  {requests[selectedCell.r]?.customer_name} ➔ {workers[selectedCell.w]?.name}
                </span>
              </div>
              {(() => {
                const b = result.costBreakdowns[selectedCell.r]?.[selectedCell.w];
                if (!b) return null;
                if (!b.isFeasible) {
                  return (
                    <div className="pt-2 text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Infeasible: Category mismatch or out of service radius (Cost = M = 10,000)</span>
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-zinc-400">
                    <div>ETA: {b.etaMinutes}m ({b.distanceKm} km)</div>
                    <div>Price Diff Term: +{(0.5 * b.priceDiffPercent).toFixed(1)}</div>
                    <div>Rating Penalty: +{b.ratingTerm.toFixed(1)}</div>
                    <div>Unverified Term: +{b.unverifiedTerm}</div>
                    <div className="col-span-2 pt-1 border-t border-zinc-900 font-bold text-white flex justify-between">
                      <span>Total Matrix Weight:</span>
                      <span className="text-[#FFB81C]">₹{b.totalCost}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Energy Trace & Benchmark Metrics (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Classical Annealer vs Hungarian Benchmark */}
          <div className="bg-[#111218] border border-zinc-800 p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2 pb-3 border-b border-zinc-800 mb-3">
              <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ground-State Benchmark</span>
            </h3>

            {result ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="p-2.5 bg-[#07070A] border border-zinc-800">
                  <div className="text-xs text-zinc-500 uppercase">Simulated Annealing</div>
                  <div className="text-lg font-bold text-[#FFB81C] mt-0.5">
                    ₹{result.totalAnnealingCost}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    Sweeps: {result.annealingSweeps} · Time: {result.computationTimeMs}ms
                  </div>
                </div>

                {result.exactSolverUsed ? (
                  <div className="p-2.5 bg-[#07070A] border border-zinc-800">
                    <div className="text-xs text-zinc-500 uppercase">Hungarian Exact Optimum</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">
                      ₹{result.exactCost}
                    </div>
                    <div className="text-xs font-semibold mt-1 flex items-center justify-between">
                      <span className="text-zinc-400">Optimality Gap:</span>
                      <span
                        className={
                          result.optimalityGapPercent === 0
                            ? 'text-emerald-400'
                            : 'text-[#5EE6FF]'
                        }
                      >
                        {result.optimalityGapPercent}% {result.optimalityGapPercent === 0 && '(Exact)'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-[#07070A] border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                    <span className="text-zinc-300 font-semibold">Exact Check Skipped:</span>
                    <p className="mt-1 text-zinc-500">
                      Permutation solver scales as O(N!). For N &gt; 6, exact verification is omitted to prevent blocking.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 font-mono text-xs">
                Awaiting solver execution...
              </div>
            )}
          </div>

          {/* Energy vs. Sweeps Line Chart (Inline SVG) */}
          <div className="bg-[#111218] border border-zinc-800 p-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2 pb-2 border-b border-zinc-800 mb-2">
              <Cpu className="w-3.5 h-3.5 text-[#5EE6FF]" />
              <span>Energy Trace E(x)</span>
            </h3>

            {trace.length > 1 ? (
              <div className="pt-2">
                <div className="h-28 w-full relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#27272a" strokeDasharray="2,2" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#27272a" strokeDasharray="2,2" strokeWidth="0.5" />
                    <line x1="0" y1="75" x2="100" y2="75" stroke="#27272a" strokeDasharray="2,2" strokeWidth="0.5" />

                    {/* Polyline */}
                    <polyline
                      fill="none"
                      stroke="#5EE6FF"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      points={trace
                        .map((pt, idx) => {
                          const x = (idx / (trace.length - 1)) * 100;
                          const y = 90 - ((pt.energy - minEnergy) / energyRange) * 80;
                          return `${x},${isNaN(y) ? 50 : y}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                </div>

                <div className="flex justify-between items-center text-xs font-mono text-zinc-500 mt-2">
                  <span>Sweep 1 (T=80)</span>
                  <span className="text-[#5EE6FF]">Ground State (T={result?.finalTemperature})</span>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500 font-mono text-xs">
                No energy trajectory yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. COLLAPSIBLE QUBO EXPLANATION PANEL */}
      <div className="border border-zinc-800 bg-[#111218]">
        <button
          type="button"
          onClick={() => setShowFormula(!showFormula)}
          className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-mono text-zinc-300 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2 font-semibold">
            <Info className="w-4 h-4 text-[#FFB81C]" />
            <span>How it Works: Quadratic Unconstrained Binary Optimization (QUBO)</span>
          </span>
          {showFormula ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFormula && (
          <div className="p-5 border-t border-zinc-800 bg-[#07070A] text-xs font-mono text-zinc-300 space-y-3 leading-relaxed">
            <p>
              In FairFix&apos;s batch dispatch, we map multi-worker assignment to an Ising-spin QUBO problem over binary decision variables{' '}
              <code className="text-[#FFB81C]">x[i, j] ∈ &#123;0, 1&#125;</code>, indicating whether worker <code className="text-white">j</code> is assigned to service request <code className="text-white">i</code>.
            </p>

            <div className="p-3 bg-[#111218] border border-zinc-800 text-[#5EE6FF] overflow-x-auto text-sm">
              <code>
                H(x) = ∑ c[i,j]·x[i,j] + A·∑_i (∑_j x[i,j] - 1)² + A·∑_j ∑_(i&lt;k) x[i,j]·x[k,j]
              </code>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs text-zinc-400">
              <div>
                <span className="text-white font-semibold">1. Linear Objective (c[i,j]):</span>
                <p className="mt-1">
                  Combines travel ETA (1.0/min), price variance vs fair band (0.5/% diff), worker rating term, and unverified penalty (+6).
                </p>
              </div>
              <div>
                <span className="text-white font-semibold">2. Request Constraint:</span>
                <p className="mt-1">
                  Penalizes unfulfilled or duplicate request assignments with multiplier $A = 1000$.
                </p>
              </div>
              <div>
                <span className="text-white font-semibold">3. Worker Double-Booking:</span>
                <p className="mt-1">
                  Cross-terms penalize assigning multiple jobs to the same worker simultaneously.
                </p>
              </div>
            </div>

            <div className="pt-2 text-zinc-500 text-xs border-t border-zinc-900">
              Note: This engine currently executes via classical Metropolis-Hastings Markov Chain Monte Carlo with geometric temperature cooling. The formulation is directly compatible with future physical quantum annealing processors (such as D-Wave Advantage) via minor embedding.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
