/**
 * FairFix Worker Portal - "Mark III Forge" Edition
 * Rate setup, PriceBandGauge (worker perspective), availability toggle,
 * and live Incoming Service Requests & Negotiation console.
 */
import React, { useState, useEffect } from 'react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { PriceBandResult } from '../types.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { NegotiationThread } from './NegotiationThread.js';
import { getCategoryLabel } from '../config.js';
import { 
  HudPanel, 
  ForgeButton, 
  Badge, 
  StatCard, 
  Drawer,
  EmptyState,
  formatINR 
} from './ui/index.js';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Power, 
  Save, 
  Star, 
  Briefcase, 
  Info,
  MapPin,
  FileText,
  Handshake,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

export const WorkerView: React.FC = () => {
  const { currentUser, refreshUsers } = useDemoUser();

  const [available, setAvailable] = useState<boolean>(currentUser?.available ?? true);
  const [baseRate, setBaseRate] = useState<number>(currentUser?.base_rate ?? 450);
  const [savingRate, setSavingRate] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Price band states for worker's primary category
  const [band, setBand] = useState<PriceBandResult | null>(null);

  // Incoming Requests & Active Jobs
  const [incomingJobs, setIncomingJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const primaryCategory = currentUser?.categories?.[0] || 'plumbing';

  useEffect(() => {
    if (currentUser) {
      setAvailable(currentUser.available ?? true);
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
        if (!res.ok) throw new Error('Failed to load band');
        const data = await res.json();
        setBand(data.band);
      } catch (err) {
        console.error('Error fetching worker band:', err);
      }
    };

    fetchBand();
  }, [primaryCategory, currentUser, baseRate]);

  // Fetch incoming & active jobs for this worker (with 3s polling)
  const fetchWorkerJobs = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/jobs?workerId=${currentUser.id}&incoming=true`);
      if (!res.ok) return;
      const data = await res.json();
      setIncomingJobs(data);
    } catch (err) {
      console.error('Error fetching worker jobs:', err);
    }
  };

  useEffect(() => {
    fetchWorkerJobs();
    const interval = setInterval(fetchWorkerJobs, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Handle Availability Toggle
  const handleToggleAvailability = async () => {
    if (!currentUser) return;
    const newStatus = !available;
    setAvailable(newStatus);

    try {
      const res = await fetch(`/api/workers/${currentUser.id}/availability`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle availability');
      await refreshUsers();
    } catch (err) {
      alert('Error updating availability: ' + (err as Error).message);
      setAvailable(!newStatus);
    }
  };

  // Handle Save Base Rate
  const handleSaveRate = async () => {
    if (!currentUser) return;
    setSavingRate(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/workers/${currentUser.id}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_rate: baseRate }),
      });
      if (!res.ok) throw new Error('Failed to save rate');
      setSaveMessage('Base rate saved! Market band comparison updated.');
      await refreshUsers();
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      alert('Error saving rate: ' + (err as Error).message);
    } finally {
      setSavingRate(false);
    }
  };

  // Document Upload State
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadError(null);
    setUploadSuccess(null);

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Document exceeds maximum size of 5 MB.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setUploadError('Only JPG, PNG, and PDF formats are accepted.');
      return;
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      const res = await fetch(`/api/workers/${currentUser.id}/verification-document`, {
        method: 'POST',
        headers: {
          'x-demo-role': 'worker',
          'x-demo-user-id': currentUser.id,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload document');
      setUploadSuccess('Document submitted! Awaiting manual admin review.');
      setShowUploadForm(false);
      await refreshUsers();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const verificationBadge = () => {
    const status = currentUser?.verification_status || 'unverified';

    return (
      <div className="space-y-3">
        {/* Moderation Warnings */}
        {currentUser?.is_suspended && (
          <div className="p-3 bg-[#FF5C6C]/15 border border-[#FF5C6C]/40 rounded-xl text-xs space-y-1 text-[#FF5C6C]">
            <div className="flex items-center gap-2 font-heading font-bold uppercase tracking-wider">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>Account Suspended by Operations</span>
            </div>
            <p className="text-xs text-[#A7A29A] font-sans">
              Your profile has been suspended by administration. You are temporarily hidden from customer searches.
            </p>
          </div>
        )}

        {currentUser?.is_flagged && !currentUser?.is_suspended && (
          <div className="p-3 bg-[#FFB81C]/15 border border-[#FFB81C]/40 rounded-xl text-xs space-y-1 text-[#FFB81C]">
            <div className="flex items-center gap-2 font-heading font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Under Review Chip Active</span>
            </div>
            <p className="text-xs text-[#A7A29A] font-sans">
              Account auto-flagged following 3 distinct customer reports. Your profile ranks last in matching until reviewed by an administrator.
            </p>
          </div>
        )}

        {/* Verification Status Card */}
        {status === 'verified' && (
          <div className="flex items-center justify-between p-3.5 bg-[#5EE6FF]/10 border border-[#5EE6FF]/30 rounded-xl text-[#5EE6FF] text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-heading font-bold text-white uppercase tracking-wider">Verified Worker Badge Active</p>
                <p className="text-xs text-[#A7A29A] font-sans">
                  Approved credential. You receive top priority matching radar boost in customer searches.
                </p>
              </div>
            </div>
            <Badge variant="verified" size="sm">
              Verified
            </Badge>
          </div>
        )}

        {status === 'pending' && (
          <div className="p-3.5 bg-[#FFB81C]/10 border border-[#FFB81C]/30 rounded-xl text-[#FFB81C] text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 shrink-0" />
                <p className="font-heading font-bold text-white uppercase tracking-wider">Verification In Review</p>
              </div>
              <Badge variant="caution" size="sm">
                Pending Review
              </Badge>
            </div>
            <p className="text-xs text-[#A7A29A] font-sans">
              Trade document submitted and securely stored. Awaiting manual admin review.
            </p>
            <div className="text-xs text-[#A7A29A] font-mono italic">
              Notice: Documents are reviewed manually by an admin. No automated ID check or government API is integrated.
            </div>
          </div>
        )}

        {status === 'rejected' && (
          <div className="p-3.5 bg-[#FF5C6C]/10 border border-[#FF5C6C]/30 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between text-[#FF5C6C]">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 shrink-0" />
                <p className="font-heading font-bold text-white uppercase tracking-wider">Verification Rejected</p>
              </div>
              <Badge variant="danger" size="sm">
                Action Required
              </Badge>
            </div>
            {currentUser?.verification_reject_reason && (
              <div className="p-2.5 bg-[#07070A] rounded-lg border border-[#FF5C6C]/30 text-xs text-[#F4F1EC]">
                <strong className="text-[#FF5C6C]">Admin Reason:</strong> {currentUser.verification_reject_reason}
              </div>
            )}
            <button
              onClick={() => setShowUploadForm(true)}
              className="px-3 py-1.5 rounded-lg bg-[#FFB81C] text-black font-heading font-bold uppercase text-xs hover:bg-[#FFD65A] cursor-pointer"
            >
              Upload Corrected Document
            </button>
          </div>
        )}

        {status === 'unverified' && (
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl text-slate-300 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />
                <p className="font-heading font-bold text-white uppercase tracking-wider">Unverified Profile</p>
              </div>
              <Badge variant="neutral" size="sm">
                Unverified
              </Badge>
            </div>
            <p className="text-xs text-[#A7A29A] font-sans">
              Upload your trade certificate or government ID to earn the Verified badge and unlock priority customer matching.
            </p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="px-3 py-1.5 rounded-lg bg-[#5EE6FF]/15 hover:bg-[#5EE6FF]/25 text-[#5EE6FF] border border-[#5EE6FF]/40 font-heading font-bold uppercase text-xs cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Upload Verification Document</span>
            </button>
          </div>
        )}

        {/* Upload Document Modal / Box */}
        {showUploadForm && (
          <div className="p-4 bg-[#07070A] border border-[#2A2E3A] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#5EE6FF]" />
                Upload Trade Credential or ID
              </span>
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-xs text-[#A7A29A] hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="p-3 bg-[#FFB81C]/10 border border-[#FFB81C]/30 rounded-lg text-xs space-y-1">
              <p className="font-bold text-[#FFB81C]">
                Security Notice: Mask the first 8 digits of any ID number before uploading.
              </p>
              <p className="text-xs text-[#A7A29A]">
                Never upload raw full ID numbers. Allowed formats: JPG, PNG, or PDF (max 5 MB).
              </p>
            </div>

            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={handleDocumentUpload}
              disabled={uploadingDoc}
              className="block w-full text-xs text-[#A7A29A] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-heading file:font-bold file:uppercase file:bg-[#FFB81C] file:text-black hover:file:bg-[#FFD65A] file:cursor-pointer cursor-pointer"
            />

            {uploadingDoc && (
              <p className="text-xs text-[#5EE6FF] animate-pulse font-mono">
                Uploading document &amp; verifying mime-type...
              </p>
            )}

            {uploadError && (
              <p className="text-xs text-[#FF5C6C] font-mono">{uploadError}</p>
            )}

            {uploadSuccess && (
              <p className="text-xs text-[#5EE6FF] font-mono">{uploadSuccess}</p>
            )}

            <div className="text-xs text-[#A7A29A] font-sans italic pt-1 border-t border-[#2A2E3A]">
              Documents are reviewed manually by an admin. No automated ID check or government API is integrated.
            </div>
          </div>
        )}
      </div>
    );
  };

  const activeNegotiations = incomingJobs.filter((j) =>
    ['requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'rated'].includes(j.status)
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Header Card */}
      <HudPanel variant="default" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-[#8E0B16] to-[#D7261E] border border-[rgba(255,184,28,0.4)] flex items-center justify-center font-heading font-black text-2xl text-white shrink-0 shadow-[0_0_15px_rgba(215,38,30,0.5)]">
            {currentUser?.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl sm:text-2xl font-black text-white tracking-wider uppercase">
                {currentUser?.name}
              </h1>
              <Badge variant="fair" size="sm">
                Worker Portal
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#A7A29A] mt-1 font-sans">
              <span className="flex items-center gap-1 text-[#FFD65A] font-semibold">
                <Star className="w-3.5 h-3.5 fill-current" />
                {currentUser?.rating_avg || 0}
                <span className="text-[#A7A29A] font-normal">({currentUser?.rating_count || 0} ratings)</span>
              </span>
              <span>&bull;</span>
              <span className="text-[#F4F1EC] font-medium">{currentUser?.jobs_completed || 0} jobs completed</span>
              <Badge variant="neutral" size="sm">
                Demo data
              </Badge>
            </div>
          </div>
        </div>

        {/* Availability Toggle with Cyan Arc Glow */}
        <div className="flex items-center gap-3 bg-[#07070A] p-2.5 rounded-xl border border-[#2A2E3A]">
          <div className="text-right">
            <span className="text-xs font-heading uppercase tracking-wider font-bold block text-white">
              {available ? 'Online (Accepting Jobs)' : 'Offline (Paused)'}
            </span>
            <span className="text-xs text-[#A7A29A] font-sans">
              {available ? 'Visible in radar' : 'Hidden from searches'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleAvailability}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md cursor-pointer ${
              available
                ? 'bg-[#5EE6FF] text-[#07070A] shadow-[0_0_16px_#5EE6FF]'
                : 'bg-[#151821] text-[#A7A29A] hover:bg-[#1C202B]'
            }`}
            title="Toggle Availability"
            aria-label="Toggle Availability"
          >
            <Power className="w-5 h-5 font-bold" />
          </button>
        </div>
      </HudPanel>

      {/* INCOMING SERVICE REQUESTS & NEGOTIATION CONSOLE */}
      <HudPanel variant="default" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Handshake className="w-5 h-5 text-[#FFB81C]" />
            <h2 className="font-heading text-lg font-black text-white uppercase tracking-wider">
              Incoming Service Requests &amp; Negotiations ({activeNegotiations.length})
            </h2>
          </div>
          <span className="text-xs font-mono text-[#5EE6FF]">
            3s Real-Time Polling Active
          </span>
        </div>

        {activeNegotiations.length === 0 ? (
          <EmptyState
            icon={Handshake}
            title="No pending requests in your area"
            description="When customers submit requests matching your trade within your radius, they will appear here with live negotiation controls."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeNegotiations.map((job) => {
              const latestOffer = job.latest_offer;
              const isAccepted = ['accepted', 'in_progress', 'completed', 'rated'].includes(job.status);
              const isWaitingWorker = latestOffer?.from_role === 'customer';

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-xl border hud-panel-brackets transition ${
                    isAccepted
                      ? 'bg-[#5EE6FF]/10 border-[#5EE6FF]/40'
                      : isWaitingWorker
                      ? 'bg-[#151821] border-[#FFB81C] shadow-[0_0_15px_rgba(255,184,28,0.2)]'
                      : 'bg-[#0E1016] border-[#2A2E3A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                          Job {job.id.replace(/^job_/, '')}
                        </span>
                        <Badge
                          variant={isAccepted ? 'fair' : isWaitingWorker ? 'caution' : 'neutral'}
                          size="sm"
                        >
                          {job.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#F4F1EC] mt-1 font-sans">{job.description}</p>
                      <p className="text-xs text-[#A7A29A] mt-0.5">
                        Customer: <strong className="text-white">{job.customer_name}</strong> &bull; {getCategoryLabel(job.category)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs uppercase font-heading font-bold text-[#A7A29A] block">
                        {isAccepted ? 'Agreed Price' : 'Offered Price'}
                      </span>
                      <span className="font-heading font-black text-lg text-white tabular-nums">
                        {formatINR(job.agreed_price || latestOffer?.amount || job.offered_price)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-[#2A2E3A] flex items-center justify-between text-xs">
                    <span className="font-mono text-xs text-[#FFD65A]">
                      {job.status === 'in_progress'
                        ? 'Service in progress'
                        : job.status === 'completed' || job.status === 'rated'
                        ? 'Job concluded'
                        : isAccepted
                        ? 'Contact unmasked'
                        : isWaitingWorker
                        ? 'Your turn to respond'
                        : 'Waiting for customer'}
                    </span>

                    <ForgeButton
                      variant={isWaitingWorker || job.status === 'accepted' || job.status === 'in_progress' ? 'primary' : 'ghost'}
                      size="sm"
                      icon={MessageSquare}
                      onClick={() => setSelectedJobId(job.id)}
                    >
                      {job.status === 'accepted'
                        ? 'Start Job'
                        : job.status === 'in_progress'
                        ? 'Complete Job'
                        : job.status === 'completed' || job.status === 'rated'
                        ? 'View Summary'
                        : isWaitingWorker
                        ? 'Respond'
                        : 'View Negotiation'}
                    </ForgeButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HudPanel>

      {/* Main Grid: Rate Setup & Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Rate Setup */}
        <div className="lg:col-span-7 space-y-5">
          <HudPanel variant="default" className="space-y-4">
            <div>
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFB81C]">
                Rate Self-Determination
              </span>
              <h2 className="font-heading text-lg font-black text-white tracking-wider uppercase mt-0.5">
                Set Your Operational Base Rate
              </h2>
              <p className="text-xs text-[#A7A29A] mt-1 leading-relaxed font-sans">
                You freely set your own rates. The live band provides market transparency against real completed jobs in your area.
              </p>
            </div>

            {verificationBadge()}

            {/* Rate Input */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A]">
                Base Rate (₹ INR per job)
              </label>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-heading font-bold text-[#A7A29A] text-base">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={100}
                    step={25}
                    value={baseRate}
                    onChange={(e) => setBaseRate(Number(e.target.value))}
                    className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl pl-8 pr-4 py-2.5 font-heading text-lg font-black text-white focus:outline-none focus:border-[#FFB81C] tabular-nums"
                  />
                </div>

                <ForgeButton
                  size="md"
                  onClick={handleSaveRate}
                  disabled={savingRate}
                  loading={savingRate}
                  icon={Save}
                >
                  {savingRate ? 'Saving...' : 'Update Rate'}
                </ForgeButton>
              </div>

              {saveMessage && (
                <p className="text-xs text-[#5EE6FF] font-heading font-bold uppercase tracking-wider">{saveMessage}</p>
              )}
            </div>

            {/* Operational Profile Details */}
            <div className="pt-4 border-t border-[#2A2E3A] space-y-2 text-xs">
              <h4 className="font-heading font-bold text-white uppercase tracking-wider">Operational Profile</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                  <span className="block text-[#A7A29A] font-medium font-sans">Primary Trade</span>
                  <span className="text-white font-heading font-bold uppercase">{getCategoryLabel(primaryCategory)}</span>
                </div>
                <div className="p-2.5 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                  <span className="block text-[#A7A29A] font-medium font-sans">Service Radius</span>
                  <span className="text-white font-bold font-mono">{currentUser?.radius_km || 5} km</span>
                </div>
                <div className="p-2.5 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                  <span className="block text-[#A7A29A] font-medium font-sans">Home Location</span>
                  <span className="text-white font-bold font-mono">
                    {currentUser?.lat.toFixed(3)}, {currentUser?.lng.toFixed(3)}
                  </span>
                </div>
                <div className="p-2.5 bg-[#07070A] rounded-lg border border-[#2A2E3A]">
                  <span className="block text-[#A7A29A] font-medium font-sans">Phone Number</span>
                  <span className="text-white font-mono">{currentUser?.phone}</span>
                </div>
              </div>
            </div>
          </HudPanel>
        </div>

        {/* Right Column: PriceBandGauge with Worker Perspective */}
        <div className="lg:col-span-5 space-y-5">
          <PriceBandGauge
            band={band}
            currentPrice={baseRate}
            perspective="worker"
            onPriceChange={(newPrice) => setBaseRate(newPrice)}
          />

          <HudPanel variant="default" className="space-y-3 text-xs text-[#A7A29A]">
            <h4 className="font-heading font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#5EE6FF]" />
              Fair-Price Principles for Workers
            </h4>
            <p className="text-xs leading-relaxed font-sans">
              FairFix does not impose artificial rate caps on workers. If your rate falls outside the fair band, customers receive a non-blocking informational chip and can counter-offer freely during negotiation.
            </p>
          </HudPanel>
        </div>
      </div>

      {/* Negotiation Thread Drawer */}
      <Drawer
        isOpen={Boolean(selectedJobId)}
        onClose={() => setSelectedJobId(null)}
        title="Job Negotiation Console"
      >
        {selectedJobId && (
          <NegotiationThread
            jobId={selectedJobId}
            onJobUpdated={fetchWorkerJobs}
            onClose={() => setSelectedJobId(null)}
          />
        )}
      </Drawer>
    </div>
  );
};
