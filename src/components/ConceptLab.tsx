/**
 * FairFix Concept Lab: Calm Edition
 * Architectural previews of future platform concepts.
 * All items keep the honest "CONCEPT, NOT IMPLEMENTED" chip.
 * Restyled with Calm tokens: cream, terracotta, no monospace font.
 */
import React from 'react';
import { Lock, Sparkles, Video, Bot, Compass } from 'lucide-react';
import { Card } from './ui/index.js';

interface ConceptFeature {
  id: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  problem: string;
  architecture: string[];
  readiness: string;
}

export const ConceptLab: React.FC = () => {
  const concepts: ConceptFeature[] = [
    {
      id: 'video_diagnosis',
      title: 'Peer Video Triage',
      badge: 'WebRTC & Gemini Vision',
      icon: Video,
      summary: 'Short pre-dispatch video call allowing a tradesperson to inspect the leaking pipe joint before riding out.',
      problem: 'Workers currently arrive blind, requiring an initial inspection visit before returning with parts.',
      architecture: [
        'WebRTC peer-to-peer audio/video streaming',
        'Frame capture piped to Gemini 2.5 Flash for automated plumbing fixture identification',
        'Estimated diagnostic turnaround under 90 seconds',
      ],
      readiness: 'Architecture draft complete. Prototype awaiting WebRTC turn-server allocation.',
    },
    {
      id: 'voice_negotiation',
      title: 'Multilingual Voice Assistant',
      badge: 'Gemini Multimodal Live',
      icon: Bot,
      summary: 'Real-time conversational voice engine in Kannada, Tamil, Hindi, and English.',
      problem: 'Typing numerical counter-offers on phones slows down on-site tradespeople with wet or dusty hands.',
      architecture: [
        'Bidirectional WebSocket audio streaming',
        'Automatic dialect detection and translation to Indian English terms',
        'Direct extraction of structured pricing proposals into the job state machine',
      ],
      readiness: 'Interface mock verified. WebSocket pipeline under testing.',
    },
    {
      id: 'indoor_navigation',
      title: 'Apartment Campus Wayfinding',
      badge: 'BLE RSSI & Vector Anchors',
      icon: Compass,
      summary: 'Turn-by-turn indoor routing for large gated societies in Bellandur and Whitefield.',
      problem: 'Tradespeople lose 10-15 minutes navigating gated communities with 20+ residential towers.',
      architecture: [
        'Pre-mapped outdoor-to-tower transition vectors',
        'BLE beacon trilateration for underground parking levels',
        'Gate pass code automation with visitor security desks',
      ],
      readiness: 'Hardware BOM identified. Requires society RWA partnerships.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 select-none bg-[#FCF5E8] text-[#2A1B12]">
      {/* Header Card */}
      <Card className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F4EBDA] text-[#6B5B4E] text-[12px] font-medium rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-[#B5541E]" />
          <span>Exploratory Engineering R&amp;D</span>
        </div>

        <h1 className="text-h2">
          Concept Lab
        </h1>

        <p className="text-[14px] text-[#6B5B4E] leading-relaxed">
          Architectural blueprints for future platform iterations. To maintain absolute engineering integrity, every feature in this laboratory is marked non-operational.
        </p>
      </Card>

      {/* Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {concepts.map((concept) => {
          const Icon = concept.icon;
          return (
            <Card key={concept.id} className="flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4EBDA] text-[#B5541E] text-[11px] font-medium">
                    <Lock className="w-3 h-3 text-[#B5541E]" />
                    <span>CONCEPT</span>
                  </span>
                  <span className="text-[11px] text-[#6B5B4E]">
                    {concept.badge}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-[#F4EBDA] flex items-center justify-center text-[#B5541E] shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-heading font-bold text-[16px] text-[#2A1B12]">
                    {concept.title}
                  </h3>
                </div>

                <p className="text-[14px] text-[#6B5B4E] leading-relaxed">
                  {concept.summary}
                </p>

                <div className="p-3 bg-[#FCF5E8] rounded-[16px] border border-[#EADFC9] text-[12px] space-y-1">
                  <span className="font-bold text-[#2A1B12]">The Problem</span>
                  <p className="text-[#6B5B4E]">{concept.problem}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#EADFC9] text-[12px] text-[#6B5B4E]">
                <span>State: {concept.readiness}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
