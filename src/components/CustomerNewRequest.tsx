/**
 * FairFix Customer View - "Mark III Forge" Edition
 * 4-step progress flow, category tiles with gold rings, CartoDB dark map,
 * PriceBandGauge hero, and staggered worker radar cards.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDemoUser } from '../context/DemoUserContext.js';
import { SERVICE_CATEGORIES, NEIGHBORHOODS, getCategoryLabel } from '../config.js';
import { PriceBandResult, MatchedWorker } from '../types.js';
import { MapPicker } from './MapPicker.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { 
  HudPanel, 
  ForgeButton, 
  Badge, 
  Drawer,
  EmptyState,
  formatINR 
} from './ui/index.js';
import { NegotiationThread } from './NegotiationThread.js';
import { 
  Wrench, 
  Zap, 
  Sparkles, 
  Fan, 
  Hammer, 
  Utensils, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Star, 
  Phone, 
  Search,
  ShieldCheck,
  Send,
  MessageSquare,
  Handshake,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  plumbing: <Wrench className="w-5 h-5" />,
  electrician: <Zap className="w-5 h-5" />,
  cleaning: <Sparkles className="w-5 h-5" />,
  appliance: <Fan className="w-5 h-5" />,
  carpentry: <Hammer className="w-5 h-5" />,
  cook_maid: <Utensils className="w-5 h-5" />,
};

const sampleDescriptions: Record<string, string[]> = {
  plumbing: [
    'Kitchen sink faucet dripping constantly and pipe joint loose',
    'Bathroom flush tank leaking water onto the floor',
    'Main bathroom shower mixer pressure very low',
  ],
  electrician: [
    'Ceiling fan making vibrating rattling noise and wobbling',
    'Living room MCB tripping whenever inverter turns on',
    'Install 2 new modular switchboards and geyser point',
  ],
  cleaning: [
    'Full deep cleaning of 2BHK flat including balcony & kitchen tiles',
    'Bathroom tile descaling and disinfectant scrubbing',
    'Sofa and fabric upholstery shampooing',
  ],
  appliance: [
    '1.5 Ton Split AC not cooling, blowing normal room air',
    'Front-load washing machine giving spin drain error',
    'Refrigerator freezer over-icing and lower cabin warm',
  ],
  carpentry: [
    'Fix wardrobe sliding door track and align bedroom hinges',
    'Wooden main door latch loose and scraping floor',
    'Living room wall shelf mounting and TV unit bracket fix',
  ],
  cook_maid: [
    'Daily North/South Indian dinner cooking for family of 4',
    'Morning meal preparation and kitchen dusting assistance',
  ],
};

export const CustomerNewRequest: React.FC = () => {
  const { currentUser } = useDemoUser();

  const [customerSubTab, setCustomerSubTab] = useState<'create' | 'active'>('create');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [category, setCategory] = useState<string>('plumbing');
  const [description, setDescription] = useState<string>('Kitchen sink faucet dripping constantly and pipe joint loose');
  const [lat, setLat] = useState<number>(currentUser?.lat || NEIGHBORHOODS[0].lat);
  const [lng, setLng] = useState<number>(currentUser?.lng || NEIGHBORHOODS[0].lng);
  const [offeredPrice, setOfferedPrice] = useState<number>(450);

  // Price band states
  const [band, setBand] = useState<PriceBandResult | null>(null);

  // Matching results states
  const [matchingWorkers, setMatchingWorkers] = useState<MatchedWorker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<MatchedWorker | null>(null);
  const [matchedFetched, setMatchedFetched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [jobCreatedSuccess, setJobCreatedSuccess] = useState<string | null>(null);

  // Active customer jobs for negotiation
  const [customerJobs, setCustomerJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const fetchCustomerJobs = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/jobs?customerId=${currentUser.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCustomerJobs(data);
    } catch (err) {
      console.error('Error fetching customer jobs:', err);
    }
  };

  useEffect(() => {
    fetchCustomerJobs();
    const interval = setInterval(fetchCustomerJobs, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Sync coords when active customer changes
  useEffect(() => {
    if (currentUser) {
      setLat(currentUser.lat);
      setLng(currentUser.lng);
    }
  }, [currentUser]);

  // Fetch Live Fair-Price Band
  useEffect(() => {
    let isCancelled = false;
    const fetchBand = async () => {
      try {
        const url = `/api/price-band?category=${category}&lat=${lat}&lng=${lng}&price=${offeredPrice}&perspective=customer`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch band');
        const data = await res.json();
        if (!isCancelled) {
          setBand(data.band);
          if (data.band && offeredPrice === 450 && category !== 'plumbing') {
            setOfferedPrice(data.band.typical);
          }
        }
      } catch (err) {
        console.error('Error fetching price band:', err);
      }
    };

    fetchBand();
    return () => {
      isCancelled = true;
    };
  }, [category, lat, lng, offeredPrice]);

  // Handle Find Matching Workers
  const handleFindWorkers = async () => {
    setSearching(true);
    setJobCreatedSuccess(null);
    try {
      const res = await fetch(`/api/matching?category=${category}&lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error('Matching query failed');
      const workers: MatchedWorker[] = await res.json();
      setMatchingWorkers(workers);
      setMatchedFetched(true);
      if (workers.length > 0) {
        setSelectedWorker(workers[0]);
      }
    } catch (err) {
      console.error('Error matching workers:', err);
    } finally {
      setSearching(false);
    }
  };

  // Submit Job Request
  const handleCreateJob = async (workerId?: string) => {
    if (!currentUser) return;
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
          worker_id: workerId || selectedWorker?.id || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create job');
      const job = await res.json();
      setJobCreatedSuccess(`Job ${job.id.replace(/^job_/, '')} posted at ${formatINR(offeredPrice)}! Nearby worker notified.`);
      await fetchCustomerJobs();
      setSelectedJobId(job.id);
    } catch (err) {
      alert('Error creating job: ' + (err as Error).message);
    }
  };

  const steps = [
    { num: 1, label: 'Category' },
    { num: 2, label: 'Location' },
    { num: 3, label: 'Details' },
    { num: 4, label: 'Price Band' },
  ];

  const activeNegotiationsCount = customerJobs.filter((j) =>
    ['requested', 'negotiating'].includes(j.status)
  ).length;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Customer Mode Tabs: New Request vs Active Requests & Negotiations */}
      <div className="flex items-center justify-between gap-3 border-b border-[#2A2E3A] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCustomerSubTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-heading font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 min-h-[38px] ${
              customerSubTab === 'create'
                ? 'bg-gradient-to-r from-[#8E0B16] to-[#D7261E] text-white shadow-[0_0_15px_rgba(215,38,30,0.5)] border-t border-[rgba(255,184,28,0.5)]'
                : 'bg-[#0E1016] text-[#A7A29A] hover:text-white border border-[#2A2E3A]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Request New Service</span>
          </button>

          <button
            onClick={() => setCustomerSubTab('active')}
            className={`px-4 py-2 rounded-xl text-xs font-heading font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-2 min-h-[38px] ${
              customerSubTab === 'active'
                ? 'bg-gradient-to-r from-[#8E0B16] to-[#D7261E] text-white shadow-[0_0_15px_rgba(215,38,30,0.5)] border-t border-[rgba(255,184,28,0.5)]'
                : 'bg-[#0E1016] text-[#A7A29A] hover:text-white border border-[#2A2E3A]'
            }`}
          >
            <Handshake className="w-3.5 h-3.5" />
            <span>Active Requests &amp; Negotiations</span>
            {activeNegotiationsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#5EE6FF] text-[#07070A] font-mono text-xs font-bold flex items-center justify-center">
                {activeNegotiationsCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-xs text-[#A7A29A] font-mono">
            Customer: <strong className="text-white">{currentUser?.name}</strong>
          </span>
        </div>
      </div>

      {jobCreatedSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-[#5EE6FF]/10 border border-[#5EE6FF]/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#5EE6FF] shadow-lg hud-panel-brackets"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#5EE6FF] shrink-0" />
            <div>
              <p className="font-heading font-bold text-white uppercase tracking-wider">{jobCreatedSuccess}</p>
              <p className="text-xs text-[#A7A29A] mt-0.5 font-sans">
                Awaiting worker response. You can open the Negotiation Console now or switch to the Worker portal to test counter-offering.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ForgeButton
              size="sm"
              icon={Handshake}
              onClick={() => {
                setCustomerSubTab('active');
                setJobCreatedSuccess(null);
              }}
            >
              Negotiation Hub
            </ForgeButton>
            <button
              onClick={() => setJobCreatedSuccess(null)}
              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-heading uppercase tracking-wider font-bold min-h-[36px]"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}

      {customerSubTab === 'active' ? (
        <div className="space-y-4">
          <HudPanel variant="default" className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-heading font-bold tracking-wider text-[#5EE6FF]">
                Live Negotiation Hub
              </span>
              <h2 className="font-heading text-xl font-black text-white tracking-wider uppercase mt-0.5">
                Active Requests &amp; Negotiated Jobs
              </h2>
              <p className="text-xs text-[#A7A29A] mt-1 font-sans">
                Review counter-offers from nearby workers, accept agreed rates, or propose counter-offers (max 3 rounds).
              </p>
            </div>
            <ForgeButton
              size="sm"
              icon={Send}
              onClick={() => setCustomerSubTab('create')}
            >
              Request New Service
            </ForgeButton>
          </HudPanel>

          {customerJobs.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No service requests placed yet"
              description="Pick a service category and post a request to receive and negotiate quotes with nearby workers (verified trades receive matching priority)."
              action={{
                label: 'Create First Request',
                onClick: () => setCustomerSubTab('create'),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {customerJobs.map((j) => {
                const latest = j.latest_offer || (j.offers && j.offers[j.offers.length - 1]);
                const isAccepted = ['accepted', 'in_progress', 'completed', 'rated'].includes(j.status);
                const isMyTurn = ['requested', 'negotiating'].includes(j.status) && latest?.from_role === 'worker';

                let statusBadgeVariant: 'fair' | 'caution' | 'danger' | 'neutral' = 'neutral';
                if (isAccepted) statusBadgeVariant = 'fair';
                else if (j.status === 'negotiating') statusBadgeVariant = 'caution';
                else if (j.status === 'cancelled') statusBadgeVariant = 'danger';

                return (
                  <HudPanel
                    key={j.id}
                    variant={isMyTurn ? 'highlight' : 'default'}
                    className={`p-4 transition cursor-pointer hover:border-[rgba(255,184,28,0.5)] ${
                      isMyTurn ? 'ring-1 ring-[#FFB81C]' : ''
                    }`}
                    onClick={() => setSelectedJobId(j.id)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Job Meta & Category */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-[#A7A29A]">Job {j.id.replace(/^job_/, '')}</span>
                          <span className="text-xs font-heading font-black text-white uppercase tracking-wider">
                            {getCategoryLabel(j.category)}
                          </span>
                          <Badge variant={statusBadgeVariant} size="sm">
                            {j.status.toUpperCase()}
                          </Badge>
                          {isMyTurn && (
                            <span className="px-2 py-0.5 rounded text-xs font-heading font-bold uppercase tracking-wider bg-[#FFB81C] text-black animate-pulse">
                              Action Required: Worker Countered
                            </span>
                          )}
                          {j.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-heading font-bold uppercase tracking-wider bg-[#FFB81C]/15 text-[#FFB81C] border border-[#FFB81C]/40 animate-pulse">
                              <Sparkles className="w-3.5 h-3.5 text-[#FFB81C]" />
                              Action Required: Rate Service
                            </span>
                          )}
                          {latest && (
                            <span className="text-xs font-mono text-[#A7A29A]">
                              Round {latest.round}/3
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#F4F1EC] font-sans line-clamp-2">
                          {j.description}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-[#A7A29A] font-sans">
                          <span>
                            Worker: <strong className="text-white">{j.worker_name || 'Broadcasting to nearby'}</strong>
                          </span>
                          <span>&bull;</span>
                          <span className="font-mono">
                            {new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {j.customer_phone && isAccepted && j.status !== 'rated' && (
                            <>
                              <span>&bull;</span>
                              <span className="text-[#5EE6FF] font-mono flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {j.worker_phone || 'Direct line'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: Pricing & CTA */}
                      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#2A2E3A]">
                        <div className="text-right">
                          <div className="text-xs uppercase font-mono text-[#A7A29A]">
                            {isAccepted ? 'Agreed Price' : 'Latest Offer'}
                          </div>
                          <div className="font-heading text-lg font-black text-white tabular-nums">
                            {formatINR(j.agreed_price || latest?.amount || j.offered_price)}
                          </div>
                        </div>

                        <ForgeButton
                          variant={isMyTurn || j.status === 'completed' ? 'primary' : 'ghost'}
                          size="sm"
                          icon={MessageSquare}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedJobId(j.id);
                          }}
                        >
                          {j.status === 'completed'
                            ? 'Rate Worker'
                            : j.status === 'rated'
                            ? 'View Rating'
                            : j.status === 'in_progress'
                            ? 'Track Service'
                            : isMyTurn
                            ? 'Respond & Negotiate'
                            : isAccepted
                            ? 'View Contact'
                            : 'View Negotiation'}
                        </ForgeButton>
                      </div>
                    </div>
                  </HudPanel>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 4-Step Progress Header */}
          <HudPanel variant="default" className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-heading font-bold tracking-wider text-[#FFB81C]">
                    Hyperlocal Service Dispatch
                  </span>
                  <Badge variant="neutral" size="sm">
                    Demo data
                  </Badge>
                </div>
                <h1 className="font-heading text-xl sm:text-2xl font-black text-white tracking-wider uppercase mt-0.5">
                  Request On-Demand Service
                </h1>
                <p className="text-xs text-[#A7A29A] mt-1 font-sans">
                  Fair-price band from completed jobs &bull; ETA estimated from straight-line distance at 20 km/h.
                </p>
              </div>

              {/* Stepper tracker */}
              <div className="flex items-center gap-2 bg-[#07070A] border border-[#2A2E3A] p-1.5 rounded-xl">
                {steps.map((s, idx) => {
                  const isCompleted = activeStep > s.num;
                  const isCurrent = activeStep === s.num;
                  return (
                    <div key={s.num} className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setActiveStep(s.num)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-heading font-bold uppercase tracking-wider transition cursor-pointer min-h-[36px] ${
                          isCurrent
                            ? 'bg-gradient-to-r from-[#8E0B16] to-[#D7261E] text-white shadow-[0_0_10px_rgba(215,38,30,0.5)] border-t border-[rgba(255,184,28,0.5)]'
                            : isCompleted
                            ? 'text-[#5EE6FF] hover:text-white bg-[#5EE6FF]/10 border border-[#5EE6FF]/20'
                            : 'text-[#A7A29A] hover:text-[#A7A29A]'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                          isCompleted ? 'bg-[#5EE6FF]/20 text-[#5EE6FF]' : 'bg-black/40'
                        }`}>
                          {isCompleted ? <Check className="w-3 h-3 text-[#5EE6FF]" /> : s.num}
                        </span>
                        <span className="hidden sm:inline">{s.label}</span>
                      </button>
                      {idx < steps.length - 1 && (
                        <div className={`w-3 h-0.5 mx-1 ${isCompleted ? 'bg-[#5EE6FF]/40' : 'bg-[#2A2E3A]'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </HudPanel>

      {/* Main Grid: Form Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form driven strictly by activeStep */}
        <div className="lg:col-span-7 space-y-5">
          {/* STEP 1: Category Selection Tiles */}
          {activeStep === 1 && (
            <HudPanel variant="default" className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A]">
                  Step 1: Select Category
                </label>
                <span className="text-xs text-[#5EE6FF] font-heading uppercase font-bold">
                  {getCategoryLabel(category)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {SERVICE_CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.id);
                        const presets = sampleDescriptions[cat.id];
                        if (presets && presets[0]) setDescription(presets[0]);
                      }}
                      className={`relative p-3 rounded-xl text-left transition duration-200 cursor-pointer flex flex-col justify-between min-h-[96px] ${
                        isSelected
                          ? 'bg-[#151821] border border-[#FFB81C] ring-2 ring-[#FFB81C] shadow-[0_0_20px_rgba(255,184,28,0.3)] text-white'
                          : 'bg-[#0E1016] hover:bg-[#151821] border border-[#2A2E3A] hover:border-[#3B4150] text-[#A7A29A]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-gradient-to-tr from-[#8E0B16] to-[#D7261E] text-white shadow'
                              : 'bg-[#151821] text-[#A7A29A]'
                          }`}
                        >
                          {iconMap[cat.id]}
                        </div>
                        {cat.id === 'cook_maid' && (
                          <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFB81C] bg-[#FFB81C]/15 px-1.5 py-0.2 rounded border border-[#FFB81C]/30">
                            Low Conf
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-heading font-bold text-xs uppercase tracking-wider mt-2">{cat.name}</p>
                        <p className="text-xs text-[#A7A29A] font-mono mt-0.5">Base: ~{formatINR(cat.baselinePrice)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <ForgeButton
                  type="button"
                  variant="primary"
                  size="md"
                  icon={ArrowRight}
                  onClick={() => setActiveStep(2)}
                >
                  Next: Location
                </ForgeButton>
              </div>
            </HudPanel>
          )}

          {/* STEP 2: Interactive Map with CartoDB Dark Tiles */}
          {activeStep === 2 && (
            <HudPanel variant="default" className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FFB81C]" />
                  Step 2: Location &amp; Radius
                </label>
                <div className="flex items-center gap-1 flex-wrap text-xs">
                  <span className="text-[#A7A29A] hidden sm:inline">Presets:</span>
                  {NEIGHBORHOODS.slice(0, 3).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setLat(n.lat);
                        setLng(n.lng);
                      }}
                      className="px-2 py-1 rounded bg-[#151821] hover:bg-[#1C202B] text-[#FFD65A] border border-[#2A2E3A] font-heading text-xs uppercase cursor-pointer min-h-[32px]"
                    >
                      {n.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <MapPicker
                lat={lat}
                lng={lng}
                onLocationChange={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                }}
                interactivePin={true}
                radiusKm={5}
                heightClass="h-64 sm:h-72"
              />
              <div className="flex items-center justify-between text-xs text-[#A7A29A] font-mono">
                <span>Pin: {lat.toFixed(4)}, {lng.toFixed(4)}</span>
                <span className="text-[#5EE6FF]">Search radius: 5.0 km</span>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <ForgeButton
                  type="button"
                  variant="ghost"
                  size="md"
                  icon={ArrowLeft}
                  onClick={() => setActiveStep(1)}
                >
                  Back: Category
                </ForgeButton>
                <ForgeButton
                  type="button"
                  variant="primary"
                  size="md"
                  icon={ArrowRight}
                  onClick={() => setActiveStep(3)}
                >
                  Next: Details
                </ForgeButton>
              </div>
            </HudPanel>
          )}

          {/* STEP 3: Description */}
          {activeStep === 3 && (
            <HudPanel variant="default" className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A]">
                  Step 3: Describe Issue
                </label>
                <span className="text-xs text-[#A7A29A]">Click preset to fill:</span>
              </div>

              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Leaking kitchen tap joint..."
                className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl px-3.5 py-2.5 text-xs text-[#F4F1EC] placeholder-[#8E8A82] focus:outline-none focus:border-[#FFB81C] transition font-sans"
              />

              {sampleDescriptions[category] && (
                <div className="flex flex-wrap gap-1.5">
                  {sampleDescriptions[category].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDescription(preset)}
                      className="text-xs bg-[#151821] hover:bg-[#1C202B] text-[#A7A29A] hover:text-[#F4F1EC] px-2.5 py-1.5 rounded-lg border border-[#2A2E3A] transition text-left cursor-pointer font-sans"
                    >
                      &ldquo;{preset.slice(0, 36)}...&rdquo;
                    </button>
                  ))}
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <ForgeButton
                  type="button"
                  variant="ghost"
                  size="md"
                  icon={ArrowLeft}
                  onClick={() => setActiveStep(2)}
                >
                  Back: Location
                </ForgeButton>
                <ForgeButton
                  type="button"
                  variant="primary"
                  size="md"
                  icon={ArrowRight}
                  onClick={() => setActiveStep(4)}
                >
                  Next: Price Band
                </ForgeButton>
              </div>
            </HudPanel>
          )}

          {/* STEP 4: Starting Offered Price & Scan */}
          {activeStep === 4 && (
            <HudPanel variant="default" className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A]">
                  Step 4: Starting Offered Price
                </label>
                {band && (
                  <span className="text-xs text-[#5EE6FF] font-mono font-bold">
                    Typical: {formatINR(band.typical)}
                  </span>
                )}
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-heading font-bold text-[#A7A29A] text-lg">
                  ₹
                </span>
                <input
                  type="number"
                  min={50}
                  step={25}
                  value={offeredPrice || ''}
                  onChange={(e) => setOfferedPrice(Number(e.target.value))}
                  className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl pl-9 pr-4 py-3 font-heading text-xl font-black text-white focus:outline-none focus:border-[#FFB81C] tabular-nums"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <ForgeButton
                  type="button"
                  variant="ghost"
                  size="md"
                  icon={ArrowLeft}
                  onClick={() => setActiveStep(3)}
                >
                  Back: Details
                </ForgeButton>
                <ForgeButton
                  size="md"
                  fullWidth
                  onClick={handleFindWorkers}
                  disabled={searching}
                  loading={searching}
                  icon={Search}
                >
                  {searching ? 'Scanning Nearby Workers...' : 'Find Nearby Workers'}
                </ForgeButton>
              </div>
            </HudPanel>
          )}
        </div>

        {/* Right Column: Hero PriceBandGauge */}
        <div className="lg:col-span-5 space-y-5">
          <PriceBandGauge
            band={band}
            currentPrice={offeredPrice}
            perspective="customer"
            onPriceChange={(newPrice) => setOfferedPrice(newPrice)}
          />

          {/* Platform Standards Card */}
          <HudPanel variant="default" className="space-y-3 text-xs text-[#A7A29A]">
            <h5 className="font-heading font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#5EE6FF]" />
              Fair-Price Standards
            </h5>
            <ul className="space-y-2 text-xs leading-relaxed font-sans">
              <li className="flex items-start gap-2">
                <span className="text-[#FFB81C] font-bold">&bull;</span>
                <span><strong>No Price Gouging:</strong> Fair bands are calculated from real completed jobs within 10 km. Outliers removed via IQR rule.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB81C] font-bold">&bull;</span>
                <span><strong>Anti-Gaming:</strong> Maximum 2 jobs per customer-worker pair per 7-day period to prevent synthetic price rigging.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB81C] font-bold">&bull;</span>
                <span><strong>Travel Estimation:</strong> ETA estimated from straight-line distance at 20 km/h city travel speed.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#FFB81C] font-bold">&bull;</span>
                <span><strong>Phone Masking:</strong> Numbers remain masked until accepted, and are masked again once the job is rated.</span>
              </li>
            </ul>
          </HudPanel>
        </div>
      </div>

      {/* Matching Results Radar Section */}
      {matchedFetched && (
        <div className="space-y-4 pt-6 border-t border-[#2A2E3A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs uppercase font-heading font-bold tracking-wider text-[#5EE6FF]">
                Matching Radar
              </span>
              <h2 className="font-heading text-xl font-black text-white tracking-wider uppercase flex items-center gap-2">
                <span>{matchingWorkers.length} Available Worker{matchingWorkers.length === 1 ? '' : 's'} Nearby</span>
                <span className="text-xs font-normal text-[#A7A29A] font-sans">(Verified first, then shortest ETA)</span>
              </h2>
            </div>
            <span className="text-xs text-[#A7A29A] font-mono">
              Phone numbers masked until accepted
            </span>
          </div>

          {matchingWorkers.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No available workers found within radius"
              description="Try switching active neighbourhood or expanding the service category. You can also toggle worker availability in the Worker Portal."
              action={{
                label: 'Expand Category',
                onClick: () => setActiveStep(1),
              }}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Workers List with 40ms Staggered Animation */}
              <div className="lg:col-span-7 space-y-3">
                {matchingWorkers.map((w, index) => {
                  const isVerified = w.verification_status === 'verified';
                  const isSelected = selectedWorker?.id === w.id;

                  // Price chip relative to band
                  let bandChipVariant: 'fair' | 'caution' = 'fair';
                  let bandChipText = 'Within band';
                  if (band) {
                    if (w.base_rate < band.low) {
                      bandChipVariant = 'caution';
                      bandChipText = 'Below band';
                    } else if (w.base_rate > band.high) {
                      bandChipVariant = 'caution';
                      bandChipText = 'Above band';
                    }
                  }

                  const displayName = w.name.length > 24 ? `${w.name.slice(0, 24)}...` : w.name;

                  return (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.25 }}
                      onClick={() => setSelectedWorker(w)}
                      className={`hud-panel p-4 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'border-[#FFB81C] ring-2 ring-[#FFB81C] shadow-[0_0_24px_rgba(255,184,28,0.35)] bg-[#151821]'
                          : 'border-[#2A2E3A] hover:border-[rgba(255,184,28,0.4)] bg-[#0E1016]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {/* Worker Identity */}
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#8E0B16] to-[#D7261E] border border-[rgba(255,184,28,0.3)] flex items-center justify-center font-heading font-black text-white text-sm shrink-0">
                            {w.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider truncate max-w-[200px]" title={w.name}>
                                {displayName}
                              </h3>
                              {isVerified ? (
                                <Badge variant="verified" size="sm">
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="neutral" size="sm">
                                  {w.verification_status}
                                </Badge>
                              )}
                              {index === 0 && (
                                <span className="text-xs font-heading font-bold uppercase tracking-wider bg-[#FFB81C]/20 text-[#FFD65A] px-1.5 py-0.2 rounded border border-[#FFB81C]/30">
                                  Best Match
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A7A29A] mt-1 font-sans">
                              <span className="flex items-center gap-1 text-[#FFD65A] font-semibold">
                                <Star className="w-3.5 h-3.5 fill-current" />
                                {w.rating_avg}
                                <span className="text-[#A7A29A] font-normal">({w.rating_count} reviews)</span>
                              </span>
                              <span>&bull;</span>
                              <span className="text-[#F4F1EC] font-medium">{w.jobs_completed} jobs</span>
                              <span>&bull;</span>
                              <span className="text-[#A7A29A] font-mono">{w.distance_km} km away</span>
                            </div>
                          </div>
                        </div>

                        {/* Rate and ETA */}
                        <div className="text-right shrink-0">
                          <div className="font-heading text-sm font-black text-white tabular-nums">
                            {formatINR(w.base_rate)}
                            <span className="text-xs text-[#A7A29A] font-normal font-sans"> / job</span>
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#5EE6FF] mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{w.eta_label}</span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Bar: Masked Phone & Direct Action */}
                      <div className="mt-3 pt-3 border-t border-[#2A2E3A] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-[#A7A29A] font-mono text-xs">
                            <Phone className="w-3.5 h-3.5 text-[#A7A29A]" />
                            <span>{w.phone}</span>
                          </div>
                          <Badge variant={bandChipVariant} size="sm">
                            {bandChipText}
                          </Badge>
                        </div>

                        <ForgeButton
                          size="sm"
                          icon={Send}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCreateJob(w.id);
                          }}
                        >
                          Request at {formatINR(offeredPrice)}
                        </ForgeButton>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Map View of Results */}
              <div className="lg:col-span-5 space-y-3">
                <HudPanel variant="default" className="p-3">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-heading font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FFB81C]" />
                      Radar Map
                    </span>
                    <span className="text-xs font-mono text-[#A7A29A]">
                      5 km search radius
                    </span>
                  </div>
                  <MapPicker
                    lat={lat}
                    lng={lng}
                    workers={matchingWorkers}
                    selectedWorkerId={selectedWorker?.id}
                    onSelectWorker={(w) => setSelectedWorker(w)}
                    radiusKm={5}
                    heightClass="h-80 sm:h-96"
                  />
                </HudPanel>

                {selectedWorker && (
                  <HudPanel variant="highlight" className="p-3 text-xs space-y-1">
                    <p className="font-heading font-bold text-white uppercase tracking-wider">
                      Selected: {selectedWorker.name} ({selectedWorker.eta_label})
                    </p>
                    <p className="text-[#A7A29A] text-xs font-mono">
                      Base rate: {formatINR(selectedWorker.base_rate)} &bull; Radius: {selectedWorker.radius_km} km
                    </p>
                  </HudPanel>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {/* Negotiation Thread Drawer for Customer */}
      <Drawer
        isOpen={Boolean(selectedJobId)}
        onClose={() => setSelectedJobId(null)}
        title="Job Negotiation Console"
      >
        {selectedJobId && (
          <NegotiationThread
            jobId={selectedJobId}
            onJobUpdated={fetchCustomerJobs}
            onClose={() => setSelectedJobId(null)}
          />
        )}
      </Drawer>
    </div>
  );
};
