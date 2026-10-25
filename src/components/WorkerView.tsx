import React, { useState, useEffect } from 'react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { PriceBandResult } from '../types.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { NegotiationThread } from './NegotiationThread.js';
import { getCategoryLabel } from '../config.js';
import { FairPriceExplorer } from './FairPriceExplorer.js';
import { JobsView } from './JobsView.js';
import { 
  Card, 
  PrimaryButton, 
  SecondaryButton, 
  TextLink, 
  DemoDataPill, 
  useToast, 
  formatINR 
} from './ui/index.js';
import { 
  CheckCircle2, 
  Clock, 
  Inbox, 
  Briefcase, 
  Sliders, 
  TrendingUp, 
  ChevronRight,
  ArrowLeft 
} from 'lucide-react';

export interface WorkerViewProps {
  initialSection?: 'requests' | 'jobs' | 'rate' | 'prices';
  onNavigate?: (route: string) => void;
}

export const WorkerView: React.FC<WorkerViewProps> = ({
  initialSection = 'requests',
  onNavigate,
}) => {
  const { currentUser, refreshUsers } = useDemoUser();
  const { showToast } = useToast();

  const [workerTab, setWorkerTab] = useState<'requests' | 'jobs' | 'rate' | 'prices'>(initialSection);
  const [baseRate, setBaseRate] = useState<number>(currentUser?.base_rate ?? 450);
  const [savingRate, setSavingRate] = useState(false);
  const [band, setBand] = useState<PriceBandResult | null>(null);

  const [incomingJobs, setIncomingJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const primaryCategory = currentUser?.categories?.[0] || 'plumbing';

  useEffect(() => {
    if (initialSection) setWorkerTab(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (currentUser) {
      setBaseRate(currentUser.base_rate ?? 450);
    }
  }, [currentUser]);

  // Load price band for worker's category and location
  useEffect(() => {
    if (!currentUser) return;
    const fetchBand = async () => {
      try {
        const res = await fetch(
          `/api/price-band?category=${primaryCategory}&lat=${currentUser.lat}&lng=${currentUser.lng}&price=${baseRate}&perspective=worker`
        );
        if (!res.ok) return;
        const data = await res.json();
        setBand(data.band);
      } catch (err) {
        // Fallback
      }
    };
    fetchBand();
  }, [primaryCategory, currentUser, baseRate]);

  // Fetch incoming & active jobs for worker
  const fetchWorkerJobs = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/jobs?workerId=${currentUser.id}&incoming=true`);
      if (!res.ok) return;
      const data = await res.json();
      setIncomingJobs(data);
    } catch (err) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchWorkerJobs();
    const interval = setInterval(fetchWorkerJobs, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Handle Save Base Rate
  const handleSaveRate = async () => {
    if (!currentUser) return;
    setSavingRate(true);
    try {
      const res = await fetch(`/api/workers/${currentUser.id}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_rate: baseRate }),
      });
      if (!res.ok) throw new Error('Failed to save rate');
      showToast({ title: 'Saved', message: 'Your base rate has been updated.', type: 'fair' });
      await refreshUsers();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSavingRate(false);
    }
  };

  if (selectedJobId) {
    return (
      <div className="h-full flex flex-col bg-[#FCF5E8] text-[#2A1B12]">
        <div className="px-6 py-3 bg-[#FFFBF3] border-b border-[#EADFC9] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => setSelectedJobId(null)}
            className="flex items-center gap-1.5 text-[14px] font-heading font-medium text-[#B5541E] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Requests</span>
          </button>
          <span className="text-[14px] text-[#6B5B4E]">
            Job {selectedJobId.replace(/^job_/, '')}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <NegotiationThread
            jobId={selectedJobId}
            onClose={() => setSelectedJobId(null)}
            onJobUpdated={fetchWorkerJobs}
          />
        </div>
      </div>
    );
  }

  // Rate sentence calculation
  const getRateSentence = () => {
    if (!band) return null;
    const diff = baseRate - band.typical;
    if (diff > 0) {
      return `Your rate is ₹${diff} above what customers paid nearby.`;
    }
    if (diff < 0) {
      return `Your rate is ₹${Math.abs(diff)} below what customers paid nearby.`;
    }
    return 'Your rate matches what customers typically paid nearby.';
  };

  return (
    <div className="w-full max-w-lg mx-auto h-full flex flex-col justify-between overflow-hidden select-none px-6 py-4 space-y-6">
      {/* 1. Requests: simple cards */}
      {workerTab === 'requests' && (
        <div className="space-y-4 flex-1 overflow-y-auto pr-0.5">
          <div className="space-y-1">
            <h2 className="text-h2">
              Requests
            </h2>
            <p className="text-[14px] text-[#6B5B4E]">
              Incoming service requests in {getCategoryLabel(primaryCategory)}.
            </p>
          </div>

          <div className="space-y-3">
            {incomingJobs.length === 0 ? (
              <div className="p-8 text-center text-[#6B5B4E] space-y-2">
                <Inbox className="w-8 h-8 mx-auto text-[#6B5B4E]" />
                <p className="font-heading font-bold text-[16px] text-[#2A1B12]">
                  No new requests right now
                </p>
                <p className="text-[14px] text-[#6B5B4E]">
                  Nearby customer requests will appear here in real time.
                </p>
              </div>
            ) : (
              incomingJobs.map((j) => (
                <div
                  key={j.id}
                  onClick={() => setSelectedJobId(j.id)}
                  className="p-4 rounded-[20px] bg-[#FFFBF3] border border-[#EADFC9] hover:bg-[#F4EBDA]/40 transition-colors cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-heading font-bold text-[16px] text-[#2A1B12] truncate">
                      {j.customer_name || 'Customer'}, Job {j.id.replace(/^job_/, '')}
                    </div>
                    <p className="text-[14px] text-[#6B5B4E] line-clamp-1">
                      {j.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-heading font-bold text-[16px] text-[#2A1B12]">
                      ₹{j.agreed_price || j.offered_price}
                    </div>
                    <TextLink onClick={(e) => { e.stopPropagation(); setSelectedJobId(j.id); }} className="text-[12px] font-semibold">
                      Reply
                    </TextLink>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Jobs: as in JobsView */}
      {workerTab === 'jobs' && (
        <div className="h-full flex-1">
          <JobsView
            selectedJobId={null}
            onSelectJob={(id) => setSelectedJobId(id)}
            onNavigate={onNavigate || (() => {})}
            forcedRole="worker"
          />
        </div>
      )}

      {/* 3. Rate: input + gauge + one sentence */}
      {workerTab === 'rate' && (
        <div className="space-y-6 flex-1 overflow-y-auto">
          <div className="space-y-1">
            <h2 className="text-h2">
              Your rate
            </h2>
            <p className="text-[14px] text-[#6B5B4E]">
              Set your base quote for {getCategoryLabel(primaryCategory)} repairs.
            </p>
          </div>

          <div className="space-y-4">
            {/* Input (large Display size) */}
            <div className="bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 flex items-center justify-between">
              <span className="font-heading font-extrabold text-[40px] text-[#B5541E] leading-none">
                ₹
              </span>
              <input
                type="number"
                min={50}
                step={25}
                value={baseRate || ''}
                onChange={(e) => setBaseRate(Number(e.target.value))}
                className="w-full bg-transparent text-right font-heading font-extrabold text-[40px] text-[#B5541E] leading-none focus:outline-none"
                aria-label="Your base rate"
              />
            </div>

            {/* Gauge */}
            <Card>
              <PriceBandGauge
                band={band}
                value={baseRate}
                perspective="worker"
                onChange={(p) => setBaseRate(p)}
              />
            </Card>

            {/* One sentence */}
            {getRateSentence() && (
              <p className="text-[14px] leading-[20px] text-[#2A1B12] font-medium">
                {getRateSentence()}
              </p>
            )}

            <PrimaryButton fullWidth onClick={handleSaveRate} loading={savingRate}>
              Save rate
            </PrimaryButton>
          </div>
        </div>
      )}

      {/* 4. Prices */}
      {workerTab === 'prices' && (
        <div className="h-full flex-1">
          <FairPriceExplorer />
        </div>
      )}
    </div>
  );
};
