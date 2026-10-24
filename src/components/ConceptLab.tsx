import React from 'react';
import {
  Sparkles,
  Cpu,
  MessageSquare,
  Compass,
  Lock,
  ArrowUpRight,
  ExternalLink,
  Layers,
  Shield,
  Activity,
  FileCode,
} from 'lucide-react';

export const ConceptLab: React.FC = () => {
  const concepts = [
    {
      id: 'quantum-hardware',
      title: 'D-Wave Physical Quantum Annealer Pipeline',
      badge: 'QUBO HARDWARE EMBEDDING',
      icon: Cpu,
      accentColor: 'border-[#5EE6FF]/40 text-[#5EE6FF]',
      summary:
        'Direct hardware submission of the FairFix QUBO Hamiltonian onto a 5,000+ qubit Pegasus graph (D-Wave Advantage 4.1 QPU) via Leap Ocean SDK.',
      problem:
        'Classical simulated annealing on multi-core CPU scales well up to ~100 variables, but dense city-wide 1,000-request batches encounter thermal bottlenecks.',
      architecture: [
        'QUBO Formulation extracted directly from FairFix cost matrix',
        'Minor-embedding via Ocean minorminer onto Pegasus graph topology',
        '50-microsecond quantum annealing pulses with reverse anneal scheduling',
        'Sub-millisecond spin readout returned via async job queue',
      ],
      readiness: 'Formulation complete & verified in classical simulator. Awaiting dedicated QPU API token & minor-embedding calibration.',
    },
    {
      id: 'whatsapp-onboarding',
      title: 'WhatsApp Voice-First Blue-Collar Onboarding',
      badge: 'VOICE & MULTILINGUAL OCR',
      icon: MessageSquare,
      accentColor: 'border-emerald-500/40 text-emerald-400',
      summary:
        'Zero-app onboarding pipeline allowing vernacular workers (Kannada, Hindi, Tamil, Telugu) to register, verify Aadhaar, and negotiate entirely via WhatsApp.',
      problem:
        'Smartphone app installation and multi-step English forms create a 68% drop-off barrier for hyper-local blue-collar tradespeople.',
      architecture: [
        'Twilio / Meta Cloud WhatsApp Business API webhook listener',
        'Whisper / Indic-Conformer speech-to-text for Kannada/Hindi voice notes',
        'Gemini Vision OCR for Aadhaar / Trade license extraction & redaction',
        'Automated interactive push buttons for counter-offer rounds 1-3',
      ],
      readiness: 'Spec and interaction flows designed. Requires production WhatsApp Business API business verification.',
    },
    {
      id: 'indoor-positioning',
      title: 'High-Rise Sub-Meter Indoor Wayfinding',
      badge: 'BLE & ULTRA-WIDEBAND',
      icon: Compass,
      accentColor: 'border-[#FFB81C]/40 text-[#FFB81C]',
      summary:
        'Floor-level vertical positioning and doorway navigation inside large Bengaluru apartment complexes (e.g. Prestige Shantiniketan, Brigade Gateway).',
      problem:
        'Standard satellite GPS drifts up to 40 meters horizontally and cannot detect floor elevation or block towers in dense multi-tower societies.',
      architecture: [
        'Barometric pressure differential sensing for vertical floor detection',
        'Fixed BLE 5.1 Angle-of-Arrival (AoA) gateway beacons in lobbies & towers',
        'Crowdsourced Wi-Fi BSSID RSSI fingerprinting maps with Kalman smoothing',
        'Security gate automated entry OTP exchange with Society Guard systems',
      ],
      readiness: 'Hardware BOM identified. Requires society RWA partnership and beacon hardware installation.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8 pb-16">
      {/* Header Banner */}
      <div className="border border-zinc-800 bg-[#07070A] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FFB81C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#111218] border border-zinc-800 text-[#FFB81C] text-xs font-mono font-medium tracking-wide uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Exploratory Engineering R&amp;D</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Concept Lab &amp; Strategic Roadmap</span>
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">
              Architectural blueprints for future platform iterations. To maintain absolute engineering integrity, every feature in this laboratory is marked non-operational.
            </p>
          </div>

          <div className="p-3 bg-[#111218] border border-zinc-800 text-right font-mono">
            <div className="text-[10px] text-zinc-500 uppercase">Status Discipline</div>
            <div className="text-xs text-amber-400 font-semibold mt-0.5">Strict Non-Operational Mock</div>
          </div>
        </div>
      </div>

      {/* 3 Non-Interactive Concept Cards with Hatched Borders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {concepts.map((concept) => {
          const Icon = concept.icon;
          return (
            <div
              key={concept.id}
              className="relative flex flex-col justify-between bg-[#111218] border-2 border-dashed border-zinc-700/80 p-6 shadow-xl transition-all hover:border-zinc-500"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.015), rgba(255, 255, 255, 0.015) 10px, transparent 10px, transparent 20px)',
              }}
            >
              <div>
                {/* Mandatory Concept Chip */}
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-950/40 border border-red-500/50 text-red-400 font-mono text-[10px] uppercase font-bold tracking-wider">
                    <Lock className="w-3 h-3 text-red-400" />
                    <span>CONCEPT, NOT IMPLEMENTED</span>
                  </span>
                  <span className={`text-[9px] font-mono px-2 py-0.5 border ${concept.accentColor}`}>
                    {concept.badge}
                  </span>
                </div>

                {/* Card Title & Icon */}
                <div className="flex items-start gap-3 mt-1">
                  <div className="p-2.5 bg-[#07070A] border border-zinc-800 shrink-0 mt-0.5">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-wide">{concept.title}</h3>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{concept.summary}</p>
                  </div>
                </div>

                {/* Problem Statement */}
                <div className="mt-4 p-3 bg-[#07070A] border border-zinc-900 text-xs">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">The Problem</div>
                  <p className="text-zinc-300 mt-1 text-[11px] leading-relaxed">{concept.problem}</p>
                </div>

                {/* Architecture Specifications */}
                <div className="mt-4 space-y-1.5">
                  <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Planned Architecture</div>
                  <ul className="space-y-1 text-[11px] text-zinc-400">
                    {concept.architecture.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#FFB81C] font-mono shrink-0">&gt;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Footer / Disabled Button */}
              <div className="mt-6 pt-4 border-t border-zinc-800/80 space-y-3">
                <div className="text-[10px] font-mono text-zinc-500 leading-tight">
                  <span className="text-zinc-400 font-semibold">Current State: </span>
                  {concept.readiness}
                </div>

                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 px-3 bg-zinc-900 border border-zinc-800 text-zinc-500 font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Deployment Locked (Roadmap Concept)</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Production Comparison Note */}
      <div className="p-4 bg-[#111218] border border-zinc-800 flex items-center justify-between text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#5EE6FF]" />
          <span>Need live working features? Switch to the customer, worker, price explorer, or batch dispatch tabs above.</span>
        </div>
        <span className="text-zinc-500 hidden sm:inline">FairFix Phase 3</span>
      </div>
    </div>
  );
};
