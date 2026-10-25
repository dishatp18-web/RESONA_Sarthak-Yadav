import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, 
  Zap, 
  Sparkles, 
  Fan, 
  Hammer, 
  Utensils, 
  X,
  ChevronRight
} from 'lucide-react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { SERVICE_CATEGORIES, NEIGHBORHOODS } from '../config.js';
import { PriceBandResult, MatchedWorker } from '../types.js';
import { MapPicker } from './MapPicker.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { 
  PrimaryButton, 
  SecondaryButton, 
  TextLink, 
  ProgressBar, 
  Sheet, 
  Card,
  useToast, 
  formatINR 
} from './ui/index.js';

interface BookWizardProps {
  initialStep?: number;
  initialCategory?: string;
  onNavigate: (route: string) => void;
}

const CATEGORY_TILES = [
  { id: 'plumbing', name: 'Plumber', icon: Wrench },
  { id: 'electrician', name: 'Electrician', icon: Zap },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles },
  { id: 'appliance', name: 'Appliances', icon: Fan },
  { id: 'carpentry', name: 'Carpentry', icon: Hammer },
  { id: 'cook_maid', name: 'Cook & Maid', icon: Utensils },
];

const SUGGESTIONS: Record<string, string[]> = {
  plumbing: [
    'Leaking kitchen sink faucet',
    'Flush tank water dripping',
    'Low shower pressure',
  ],
  electrician: [
    'Ceiling fan rattling noise',
    'Tripping switchboard MCB',
    'Install two wall sockets',
  ],
  cleaning: [
    'Deep clean 2BHK flat',
    'Bathroom tile descaling',
    'Sofa upholstery cleaning',
  ],
  appliance: [
    'Split AC not cooling',
    'Washing machine drain error',
    'Refrigerator frost buildup',
  ],
  carpentry: [
    'Wardrobe sliding door fix',
    'Main door latch alignment',
    'Wall shelf mounting',
  ],
  cook_maid: [
    'Daily dinner cooking for 4',
    'Morning breakfast and meal prep',
    'Kitchen dusting assistance',
  ],
};

export const BookWizard: React.FC<BookWizardProps> = ({
  initialStep = 1,
  initialCategory = 'plumbing',
  onNavigate,
}) => {
  const { currentUser } = useDemoUser();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(initialStep);
  const [direction, setDirection] = useState<number>(1);
  const [category, setCategory] = useState<string>(initialCategory);
  const [lat, setLat] = useState<number>(currentUser?.lat || NEIGHBORHOODS[0].lat);
  const [lng, setLng] = useState<number>(currentUser?.lng || NEIGHBORHOODS[0].lng);
  const [description, setDescription] = useState<string>(
    SUGGESTIONS[initialCategory]?.[0] || 'Inspection and repair needed'
  );
  const [scheduleTime, setScheduleTime] = useState<'now' | 'later'>('now');
  const [offeredPrice, setOfferedPrice] = useState<number>(450);

  // Price Band State
  const [band, setBand] = useState<PriceBandResult | null>(null);
  const [isCalculatedSheetOpen, setIsCalculatedSheetOpen] = useState(false);

  // Matching workers sheet state
  const [searching, setSearching] = useState(false);
  const [matchingWorkers, setMatchingWorkers] = useState<MatchedWorker[]>([]);
  const [showWorkersSheet, setShowWorkersSheet] = useState(false);
  const [submittingJob, setSubmittingJob] = useState(false);

  // Sync initial props
  useEffect(() => {
    if (initialStep >= 1 && initialStep <= 4) {
      setStep(initialStep);
    }
  }, [initialStep]);

  useEffect(() => {
    if (initialCategory) {
      setCategory(initialCategory);
      const preset = SUGGESTIONS[initialCategory]?.[0];
      if (preset) setDescription(preset);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (currentUser?.lat && currentUser?.lng) {
      setLat(currentUser.lat);
      setLng(currentUser.lng);
    }
  }, [currentUser]);

  // Fetch Live Fair-Price Band for Step 4
  useEffect(() => {
    let isCancelled = false;
    const fetchBand = async () => {
      try {
        const url = `/api/price-band?category=${category}&lat=${lat}&lng=${lng}&price=${offeredPrice}&perspective=customer`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled && data.band) {
          setBand(data.band);
        }
      } catch (err) {
        // Fallback
      }
    };
    fetchBand();
    return () => { isCancelled = true; };
  }, [category, lat, lng, offeredPrice]);

  const changeStep = (newStep: number) => {
    setDirection(newStep > step ? 1 : -1);
    setStep(newStep);
  };

  const handleNext = () => {
    if (step < 4) {
      changeStep(step + 1);
    } else {
      handleFindWorkers();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      changeStep(step - 1);
    } else {
      onNavigate('#/home');
    }
  };

  // Find Matching Workers & Open Bottom Sheet
  const handleFindWorkers = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/matching?category=${category}&lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error('Could not find nearby workers');
      const workers: MatchedWorker[] = await res.json();
      setMatchingWorkers(workers);
      setShowWorkersSheet(true);
    } catch (err) {
      showToast({
        title: 'Search Failed',
        message: (err as Error).message,
        type: 'danger',
      });
    } finally {
      setSearching(false);
    }
  };

  // Create Job & Submit
  const handleSelectWorkerAndSubmit = async (workerId?: string) => {
    if (!currentUser) return;
    setSubmittingJob(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: currentUser.id,
          category,
          description,
          lat,
          lng,
          offered_price: offeredPrice,
          worker_id: workerId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create job');
      const job = await res.json();
      setShowWorkersSheet(false);
      showToast({
        title: 'Request Sent',
        message: `Job ${job.id.replace(/^job_/, '')} created at ₹${offeredPrice}.`,
        type: 'fair',
      });
      onNavigate('#/jobs');
    } catch (err) {
      showToast({
        title: 'Submission Error',
        message: (err as Error).message,
        type: 'danger',
      });
    } finally {
      setSubmittingJob(false);
    }
  };

  const currentQuestions = [
    'What do you need?',
    'Where should they come?',
    "What's the problem?",
    'What would you like to pay?',
  ];

  return (
    <div className="w-full max-w-lg mx-auto h-full flex flex-col justify-between overflow-hidden relative select-none px-6 py-4">
      {/* 4-segment progress bar at top */}
      <div className="pb-4">
        <ProgressBar step={step} total={4} />
      </div>

      {/* Pane Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain relative flex flex-col">
        {/* H2 Question Title */}
        <h2 className="text-h2 pb-4">
          {currentQuestions[step - 1]}
        </h2>

        {/* STEP 1: Six large tiles in 2 columns */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 flex-1">
            {CATEGORY_TILES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = category === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    const preset = SUGGESTIONS[cat.id]?.[0];
                    if (preset) setDescription(preset);
                  }}
                  className={`p-4 rounded-[20px] text-left transition-colors cursor-pointer flex flex-col justify-between min-h-[96px] focus:outline-none focus:ring-2 focus:ring-[#2A1B12] ${
                    isSelected
                      ? 'bg-[#B5541E] text-white'
                      : 'bg-[#FFFBF3] border border-[#EADFC9] text-[#2A1B12] hover:bg-[#F4EBDA]'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-[#B5541E]'}`} />
                  <span className="font-heading font-bold text-[16px] leading-[22px]">
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 2: Map fills space, presets as chips */}
        {step === 2 && (
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            {/* Presets as chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-6 px-6">
              {NEIGHBORHOODS.slice(0, 5).map((n) => {
                const isMatch = Math.abs(lat - n.lat) < 0.005 && Math.abs(lng - n.lng) < 0.005;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setLat(n.lat);
                      setLng(n.lng);
                    }}
                    className={`h-[36px] min-h-[36px] px-4 rounded-full text-[14px] font-medium whitespace-nowrap cursor-pointer transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2A1B12] ${
                      isMatch
                        ? 'bg-[#B5541E] text-white'
                        : 'bg-[#F4EBDA] text-[#2A1B12] hover:bg-[#EADFC9]'
                    }`}
                  >
                    {n.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>

            {/* Map fills space */}
            <div className="flex-1 min-h-[220px] rounded-[20px] overflow-hidden border border-[#EADFC9] relative">
              <MapPicker
                lat={lat}
                lng={lng}
                onLocationChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
                interactivePin={true}
                radiusKm={5}
                heightClass="h-full"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Textarea + at most 3 one-line suggestion chips + Now/Later segmented control */}
        {step === 3 && (
          <div className="space-y-4 flex-1 flex flex-col">
            {/* Now / Later Segmented Control */}
            <div className="flex bg-[#F4EBDA] p-1 rounded-full">
              <button
                type="button"
                onClick={() => setScheduleTime('now')}
                className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
                  scheduleTime === 'now'
                    ? 'bg-[#B5541E] text-white'
                    : 'text-[#6B5B4E] hover:text-[#2A1B12]'
                }`}
              >
                Now
              </button>
              <button
                type="button"
                onClick={() => setScheduleTime('later')}
                className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
                  scheduleTime === 'later'
                    ? 'bg-[#B5541E] text-white'
                    : 'text-[#6B5B4E] hover:text-[#2A1B12]'
                }`}
              >
                Later
              </button>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs fixing..."
              className="w-full bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 text-[16px] text-[#2A1B12] placeholder-[#6B5B4E] focus:outline-none focus:ring-2 focus:ring-[#2A1B12]"
            />

            {/* Max 3 suggestion chips */}
            <div className="space-y-2">
              <span className="text-[12px] leading-[16px] text-[#6B5B4E]">
                Suggestions:
              </span>
              <div className="flex flex-col gap-2">
                {(SUGGESTIONS[category] || []).slice(0, 3).map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDescription(preset)}
                    className="h-[36px] px-4 rounded-full bg-[#F4EBDA] hover:bg-[#EADFC9] text-[#2A1B12] text-[14px] font-medium text-left truncate transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2A1B12]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Big price input, PriceBandGauge, "Use the typical price" button, caption, and sheet link */}
        {step === 4 && (
          <div className="space-y-5 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Big price number input (Display size) */}
              <div className="bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 flex items-center justify-between">
                <span className="font-heading font-extrabold text-[40px] text-[#B5541E] leading-none">
                  ₹
                </span>
                <input
                  type="number"
                  min={50}
                  step={25}
                  value={offeredPrice || ''}
                  onChange={(e) => setOfferedPrice(Number(e.target.value))}
                  className="w-full bg-transparent text-right font-heading font-extrabold text-[40px] text-[#B5541E] leading-none focus:outline-none"
                  aria-label="Your offered price"
                />
              </div>

              {/* Simplified PriceBandGauge */}
              <Card>
                <PriceBandGauge
                  band={band}
                  value={offeredPrice}
                  perspective="customer"
                  onChange={(p) => setOfferedPrice(p)}
                />
              </Card>

              {/* One text button: "Use the typical price" */}
              {band && (
                <div className="flex items-center justify-between pt-1">
                  <TextLink
                    onClick={() => setOfferedPrice(band.typical)}
                    className="font-medium"
                  >
                    Use the typical price (₹{band.typical})
                  </TextLink>
                  <TextLink
                    onClick={() => setIsCalculatedSheetOpen(true)}
                    className="font-medium"
                  >
                    How is this calculated?
                  </TextLink>
                </div>
              )}

              {/* Caption */}
              <p className="text-[12px] leading-[16px] text-[#6B5B4E]">
                Based on 14 completed jobs (demo data)
              </p>

              {/* Hint line */}
              <p className="text-[14px] leading-[20px] text-[#6B5B4E]">
                You can agree a price in up to 3 rounds.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar above nav: Back (text link) and Next (primary pill) */}
      <div className="pt-4 border-t border-[#EADFC9] flex items-center justify-between shrink-0">
        <TextLink onClick={handleBack} className="text-[16px]">
          Back
        </TextLink>

        <PrimaryButton
          onClick={handleNext}
          loading={searching}
          className="min-w-[140px]"
        >
          {step === 4 ? 'Find workers' : 'Next'}
        </PrimaryButton>
      </div>

      {/* "How is this calculated?" Bottom Sheet */}
      <Sheet
        isOpen={isCalculatedSheetOpen}
        onClose={() => setIsCalculatedSheetOpen(false)}
        title="How fair prices work"
      >
        <div className="space-y-4 text-[14px] leading-[22px] text-[#2A1B12]">
          <p>
            FairFix computes live price bands directly from completed local repair jobs in your neighborhood.
          </p>
          <div className="bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 space-y-2">
            <div className="font-heading font-bold text-[16px] text-[#B5541E]">
              Price calculations:
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-[#6B5B4E] text-[14px]">
              <li><strong>Typical price:</strong> The middle rate paid on recently finished repairs.</li>
              <li><strong>Fair band:</strong> The central 50% of completed repairs near you.</li>
              <li><strong>Unusual prices removed:</strong> Extremely high and low quotes are filtered out so benchmarks remain fair.</li>
            </ul>
          </div>
          <p className="text-[12px] leading-[16px] text-[#6B5B4E]">
            All benchmark numbers are calculated live from real completed repair records.
          </p>
        </div>
      </Sheet>

      {/* Matching Workers Results Bottom Sheet */}
      <Sheet
        isOpen={showWorkersSheet}
        onClose={() => setShowWorkersSheet(false)}
        title="Nearby workers"
      >
        <div className="space-y-4">
          <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
            {matchingWorkers.length === 0 ? (
              <p className="text-sm text-[#6B5B4E] py-4 text-center">
                Scanning for nearby tradespeople...
              </p>
            ) : (
              matchingWorkers.map((w) => {
                const isVerified = w.verification_status === 'verified';
                const isAboveTypical = band && w.base_rate > band.high;

                return (
                  <div
                    key={w.id}
                    className="p-4 rounded-[20px] bg-[#FFFBF3] border border-[#EADFC9] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-[#F4EBDA] text-[#B5541E] font-heading font-bold flex items-center justify-center shrink-0 text-sm">
                        {w.name.charAt(0)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-[16px] text-[#2A1B12] truncate">
                            {w.name}
                          </span>
                          {isVerified && (
                            <span className="text-[12px] text-[#059669] font-medium">
                              Verified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-[#6B5B4E] mt-0.5">
                          <span>~{w.eta_minutes || 12} min (estimate)</span>
                          <span>&bull;</span>
                          <span className="font-medium text-[#2A1B12]">₹{w.base_rate}</span>
                          {isAboveTypical && (
                            <span className="text-[#B45309] font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#B45309]" />
                              Above typical
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectWorkerAndSubmit(w.id)}
                      disabled={submittingJob}
                      className="h-[36px] px-4 rounded-full bg-[#B5541E] hover:bg-[#9E4717] text-white text-[14px] font-medium shrink-0 cursor-pointer transition-colors"
                    >
                      Request
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <PrimaryButton
            fullWidth
            onClick={() => handleSelectWorkerAndSubmit()}
            loading={submittingJob}
          >
            Request anyone nearby
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  );
};
