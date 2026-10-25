/**
 * FairFix Demo Controls Floating Panel - "Mark III Forge"
 * Collapsible bottom-right HUD tool for pitch demonstrations:
 * - 1-Click Database Reset to pristine seed
 * - Simulate Worker Counter-Offer
 * - Fast-Forward Complete Job Flow (Request -> Negotiate -> Accept -> Start -> Complete -> Rate)
 * - Deliberate ₹3,500 Outlier Injection (proves 1.5x IQR anti-gaming algorithm keeps fair band stable)
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDemoUser } from '../context/DemoUserContext.js';
import { useToast, ForgeButton, Badge } from './ui/index.js';
import { 
  Zap, 
  RotateCcw, 
  FastForward, 
  ShieldAlert, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2,
  Sliders,
  Info,
  Navigation,
  Gauge
} from 'lucide-react';

export const DemoControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [simulatedGpsActive, setSimulatedGpsActive] = useState(false);
  const [timeScale10x, setTimeScale10x] = useState(false);
  const simStepRef = useRef(0);

  const { refreshUsers, currentUser, hideDemoControls } = useDemoUser();
  const { showToast } = useToast();

  // Simulated GPS feeder loop (interpolates 20 steps along straight line)
  useEffect(() => {
    if (!simulatedGpsActive) {
      simStepRef.current = 0;
      return;
    }

    const intervalTime = timeScale10x ? 700 : 2500;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/jobs');
        if (!res.ok) return;
        const jobs = await res.json();
        const activeJob = jobs.find((j: any) => ['accepted', 'in_progress'].includes(j.status));

        if (!activeJob) return;

        const startLat = activeJob.lat - 0.018;
        const startLng = activeJob.lng - 0.015;
        const destLat = activeJob.lat;
        const destLng = activeJob.lng;

        const totalSteps = 20;
        const currentStep = Math.min(totalSteps, simStepRef.current);
        const progress = currentStep / totalSteps;

        const curLat = startLat + progress * (destLat - startLat);
        const curLng = startLng + progress * (destLng - startLng);

        await fetch(`/api/tracking/${activeJob.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: curLat,
            lng: curLng,
            accuracy: 10,
            speed: timeScale10x ? 200 : 20,
            timestamp: new Date().toISOString(),
            is_simulated: true,
          }),
        });

        if (simStepRef.current < totalSteps) {
          simStepRef.current += 1;
        }
      } catch (err) {
        console.error('Error feeding simulated GPS point:', err);
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [simulatedGpsActive, timeScale10x]);

  if (hideDemoControls) return null;

  const handleResetDb = async () => {
    setRunningAction('reset');
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');

      await refreshUsers();
      showToast({
        title: 'Database Reset Pristine',
        message: 'All tables re-seeded with 12 workers, 8 customers, and 66 historical jobs.',
        type: 'fair',
      });
    } catch (err) {
      showToast({ title: 'Reset Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setRunningAction(null);
    }
  };

  const handleSimulateCounter = async () => {
    setRunningAction('counter');
    try {
      const res = await fetch('/api/demo/simulate-counter', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No active job to counter on');

      showToast({
        title: 'Worker Counter Dispatched',
        message: `Counter-offer of ₹${data.amount} placed in Round ${data.round} on Job ${String(data.job_id).replace(/^job_/, '')}.`,
        type: 'fair',
      });
    } catch (err) {
      showToast({ title: 'Simulation Notice', message: (err as Error).message, type: 'caution' });
    } finally {
      setRunningAction(null);
    }
  };

  const handleFastForward = async () => {
    setRunningAction('ff');
    try {
      const res = await fetch('/api/demo/simulate-fast-forward', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fast-forward failed');

      await refreshUsers();
      showToast({
        title: 'Simulation Complete!',
        message: `Job ${String(data.job_id).replace(/^job_/, '')} agreed at ₹${data.agreed_price}, completed, and rated 5 stars! Fair band updated.`,
        type: 'fair',
      });
    } catch (err) {
      showToast({ title: 'Simulation Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setRunningAction(null);
    }
  };

  const handleTriggerOutlier = async () => {
    setRunningAction('outlier');
    try {
      const res = await fetch('/api/demo/trigger-outlier', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Outlier injection failed');

      showToast({
        title: 'IQR Anti-Gaming Verified!',
        message: `₹3,500 outlier injected & rejected by IQR rule (outliers: ${data.outliers_removed}). Fair band stayed at ₹${data.band_low}-₹${data.band_high}!`,
        type: 'fair',
      });
    } catch (err) {
      showToast({ title: 'Outlier Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="mb-2 w-80 sm:w-96 bg-[#0E1016] border border-[#FFB81C]/50 rounded-2xl p-4 shadow-[0_0_35px_rgba(0,0,0,0.9)] hud-panel-brackets space-y-3"
          >
            <div className="flex items-center justify-between border-b border-[#2A2E3A] pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#5EE6FF] shadow-[0_0_8px_#5EE6FF] animate-pulse" />
                <h4 className="font-heading font-black text-xs uppercase tracking-wider text-white">
                  Demo Fast-Forward Controls
                </h4>
              </div>
              <Badge variant="fair" size="sm">
                24h Prototype
              </Badge>
            </div>

            <p className="text-xs text-[#A7A29A] font-sans leading-relaxed">
              Use these shortcuts during demo presentation to trigger multi-party state machine events and verify algorithmic integrity:
            </p>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {/* Simulated GPS Toggle & Speed */}
              <div className="p-3 rounded-xl bg-[#07070A] border border-[#5EE6FF]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase text-white">
                    <Navigation className="w-3.5 h-3.5 text-[#5EE6FF]" />
                    <span>Simulated GPS Broadcast</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !simulatedGpsActive;
                      setSimulatedGpsActive(next);
                      showToast({
                        title: next ? 'Simulated GPS Active' : 'Simulated GPS Paused',
                        message: next ? 'Feeding 20 waypoints along route at 20 km/h.' : 'Simulation stopped.',
                        type: next ? 'fair' : 'info',
                      });
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-heading font-bold uppercase cursor-pointer border transition ${
                      simulatedGpsActive
                        ? 'bg-[#5EE6FF] text-black border-[#5EE6FF] shadow-[0_0_10px_#5EE6FF]'
                        : 'bg-[#151821] text-[#A7A29A] border-[#2A2E3A] hover:text-white'
                    }`}
                  >
                    {simulatedGpsActive ? 'Active (ON)' : 'Disabled (OFF)'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs font-sans text-[#A7A29A] pt-1 border-t border-[#2A2E3A]">
                  <span>Time-scale speed:</span>
                  <div className="flex items-center gap-1.5 font-heading text-xs uppercase font-bold">
                    <button
                      type="button"
                      onClick={() => setTimeScale10x(false)}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        !timeScale10x ? 'bg-[#FFB81C] text-black' : 'bg-[#151821] text-[#A7A29A]'
                      }`}
                    >
                      1x (20 km/h)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeScale10x(true)}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        timeScale10x ? 'bg-[#FFB81C] text-black' : 'bg-[#151821] text-[#A7A29A]'
                      }`}
                    >
                      10x Fast
                    </button>
                  </div>
                </div>
              </div>

              {/* Simulate Counter-Offer */}
              <button
                onClick={handleSimulateCounter}
                disabled={Boolean(runningAction)}
                className="w-full p-2.5 rounded-xl bg-[#151821] hover:bg-[#1C202B] border border-[#2A2E3A] hover:border-[#FFB81C]/50 transition text-left cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase text-white group-hover:text-[#FFD65A]">
                    <Zap className="w-3.5 h-3.5 text-[#FFB81C]" />
                    <span>Simulate Worker Counter-Offer</span>
                  </div>
                  <p className="text-xs text-[#A7A29A] font-sans mt-0.5">
                    Submits an alternating counter on latest active job
                  </p>
                </div>
                <span className="text-xs text-[#A7A29A] font-mono group-hover:text-white">&rarr;</span>
              </button>

              {/* Fast-Forward Complete Flow */}
              <button
                onClick={handleFastForward}
                disabled={Boolean(runningAction)}
                className="w-full p-2.5 rounded-xl bg-[#151821] hover:bg-[#1C202B] border border-[#2A2E3A] hover:border-[#5EE6FF]/50 transition text-left cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase text-white group-hover:text-[#5EE6FF]">
                    <FastForward className="w-3.5 h-3.5 text-[#5EE6FF]" />
                    <span>Fast-Forward Complete Job</span>
                  </div>
                  <p className="text-xs text-[#A7A29A] font-sans mt-0.5">
                    Request &rarr; Accept &rarr; Start &rarr; Complete &rarr; Rate 5★ &rarr; Recompute
                  </p>
                </div>
                <span className="text-xs text-[#A7A29A] font-mono group-hover:text-white">&rarr;</span>
              </button>

              {/* Trigger Outlier Job */}
              <button
                onClick={handleTriggerOutlier}
                disabled={Boolean(runningAction)}
                className="w-full p-2.5 rounded-xl bg-[#151821] hover:bg-[#1C202B] border border-[#2A2E3A] hover:border-[#FF5C6C]/50 transition text-left cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase text-white group-hover:text-[#FF5C6C]">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#FF5C6C]" />
                    <span>Test Anti-Gaming (₹3,500 Outlier)</span>
                  </div>
                  <p className="text-xs text-[#A7A29A] font-sans mt-0.5">
                    Demonstrates IQR outlier filter protecting fair band
                  </p>
                </div>
                <span className="text-xs text-[#A7A29A] font-mono group-hover:text-white">&rarr;</span>
              </button>

              {/* Reset Database */}
              <button
                onClick={handleResetDb}
                disabled={Boolean(runningAction)}
                className="w-full p-2.5 rounded-xl bg-[#07070A] hover:bg-[#151821] border border-[#2A2E3A] hover:border-white/30 transition text-left cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5 font-heading text-xs font-bold uppercase text-[#A7A29A] group-hover:text-white">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Pristine Database Reset</span>
                  </div>
                  <p className="text-xs text-[#A7A29A] font-sans mt-0.5">
                    Wipes state and re-seeds with canonical demo records
                  </p>
                </div>
                <span className="text-xs text-[#A7A29A] font-mono group-hover:text-white">&rarr;</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button: 40px icon button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full bg-gradient-to-r from-[#8E0B16] to-[#D7261E] border border-[rgba(255,184,28,0.5)] text-white flex items-center justify-center shadow-[0_0_20px_rgba(215,38,30,0.6)] hover:brightness-110 active:scale-95 transition cursor-pointer"
        title="Toggle Demo Simulator Controls"
        aria-label="Toggle Demo Simulator Controls"
      >
        <Zap className="w-4 h-4 text-[#FFB81C] animate-pulse" />
      </button>
    </div>
  );
};
