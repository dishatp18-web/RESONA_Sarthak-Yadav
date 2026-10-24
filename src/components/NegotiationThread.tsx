/**
 * FairFix Negotiation & Job Tracker Component - "Mark III Forge" Edition
 * Full Job State Machine:
 *   requested -> negotiating -> accepted -> in_progress -> completed -> rated
 *   plus cancelled and disputed.
 * Features:
 * - Animated Timeline tracker showing exact progress & timestamps
 * - Offer history bubbles with role badges & market band tags
 * - Live PriceBandGauge embedded in counter-offer composer
 * - Direct contact unmasking upon acceptance with "Cash on completion" note
 * - Worker "Start Job" & "Complete Job" status action buttons
 * - Customer "Report Issue / Dispute" and "Cancel Request" buttons
 * - 1-5 Star interactive rating selector with tags, comment, and live market band recompute
 * - Dual-tab 3-second live sync
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDemoUser } from '../context/DemoUserContext.js';
import { PriceBandResult } from '../types.js';
import { PriceBandGauge } from './PriceBandGauge.js';
import { TrackingMap } from './TrackingMap.js';
import { getCategoryLabel } from '../config.js';
import { 
  HudPanel, 
  ForgeButton, 
  Badge, 
  Timeline, 
  TimelineStep, 
  useToast, 
  formatINR 
} from './ui/index.js';
import { 
  Handshake, 
  Phone, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Send, 
  ShieldCheck, 
  CreditCard, 
  UserCheck, 
  Star,
  Play,
  CheckSquare,
  AlertOctagon,
  Sparkles,
  TrendingUp,
  MessageSquare,
  ShieldAlert,
  Share2,
  Flag,
  Copy,
  ExternalLink,
  Navigation,
  Radio,
  Check,
} from 'lucide-react';

export interface Offer {
  id: string;
  job_id: string;
  from_role: 'customer' | 'worker';
  amount: number;
  round: number;
  status: 'pending' | 'accepted' | 'declined' | 'countered';
  created_at: string;
}

export interface NegotiationJob {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  worker_id?: string | null;
  worker_name?: string;
  worker_phone?: string;
  worker_verification_status?: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  offered_price: number;
  agreed_price?: number | null;
  status: 'requested' | 'negotiating' | 'accepted' | 'in_progress' | 'completed' | 'rated' | 'cancelled' | 'disputed';
  created_at: string;
  accepted_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  offers?: Offer[];
  latest_offer?: Offer | null;
}

interface NegotiationThreadProps {
  jobId: string;
  onJobUpdated?: () => void;
  onClose?: () => void;
}

export const NegotiationThread: React.FC<NegotiationThreadProps> = ({
  jobId,
  onJobUpdated,
  onClose,
}) => {
  const { currentUser } = useDemoUser();
  const { showToast } = useToast();

  const [job, setJob] = useState<NegotiationJob | null>(null);
  const [band, setBand] = useState<PriceBandResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Counter offer state
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterAmount, setCounterAmount] = useState<number>(450);
  const [submitting, setSubmitting] = useState(false);

  // Rating state
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState<string>('Punctual, professional, and fair pricing.');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [savedRating, setSavedRating] = useState<any | null>(null);

  // Dispute & Cancel state
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Step B: Report, Safety, and Share Trip States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<'no-show' | 'overcharged' | 'unsafe behaviour' | 'poor work' | 'other'>('overcharged');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [safetyDetails, setSafetyDetails] = useState('');
  const [submittingSafety, setSubmittingSafety] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const handleSubmitReport = async () => {
    if (!currentUser || !job) return;
    setSubmittingReport(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          reporter_id: currentUser.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');
      showToast({
        title: 'Report Submitted',
        message: data.message,
        type: 'caution',
      });
      setShowReportModal(false);
      setReportDetails('');
    } catch (err) {
      showToast({ title: 'Report Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleTriggerSafety = async () => {
    if (!currentUser || !job) return;
    setSubmittingSafety(true);
    try {
      const res = await fetch('/api/safety/incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          reported_by: currentUser.id,
          lat: job.lat,
          lng: job.lng,
          details: safetyDetails || 'Emergency safety alert triggered from cockpit.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger safety alert');
      showToast({
        title: 'Safety Incident Alerted',
        message: 'Platform operations alerted at highest priority. In an emergency dial 112.',
        type: 'danger',
      });
      setShowSafetyModal(false);
      setSafetyDetails('');
    } catch (err) {
      showToast({ title: 'Safety Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmittingSafety(false);
    }
  };

  const handleGenerateShareTrip = async () => {
    if (!job) return;
    try {
      const res = await fetch(`/api/jobs/${job.id}/share-trip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate share link');
      setShareToken(data.token);
      setShowShareModal(true);
    } catch (err) {
      showToast({ title: 'Share Error', message: (err as Error).message, type: 'danger' });
    }
  };

  // Step C: Live Location Tracking States
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [locationConsentGiven, setLocationConsentGiven] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // Worker Geolocation Broadcast with alpha=0.4 smoothing and max 5s throttle
  useEffect(() => {
    if (currentUser?.role !== 'worker' || !locationConsentGiven || !['accepted', 'in_progress'].includes(job?.status || '')) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    let lastSent = 0;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setGeoError(null);
        const { latitude, longitude, accuracy, speed } = pos.coords;

        // Discard fixes with accuracy over 100m
        if (accuracy > 100) return;

        // Exponential smoothing: alpha = 0.4
        let smoothedLat = latitude;
        let smoothedLng = longitude;
        if (prevCoordsRef.current) {
          const alpha = 0.4;
          smoothedLat = alpha * latitude + (1 - alpha) * prevCoordsRef.current.lat;
          smoothedLng = alpha * longitude + (1 - alpha) * prevCoordsRef.current.lng;
        }
        prevCoordsRef.current = { lat: smoothedLat, lng: smoothedLng };

        // Throttle sending to at most every 5s
        const now = Date.now();
        if (now - lastSent >= 5000) {
          lastSent = now;
          try {
            await fetch(`/api/tracking/${job!.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                lat: smoothedLat,
                lng: smoothedLng,
                accuracy,
                speed: speed ? Math.round(speed * 3.6) : 20,
                timestamp: new Date().toISOString(),
                is_simulated: false,
              }),
            });
          } catch (err) {
            console.error('Error broadcasting tracking fix:', err);
          }
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Location permission blocked by browser or iframe sandbox. Activate "Simulated GPS" in Demo Controls or use "I\'m on my way" fallback.');
        } else if (err.code === err.TIMEOUT) {
          setGeoError('GPS acquisition timed out. Re-attempting...');
        } else {
          setGeoError('GPS fix unavailable on device.');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [currentUser?.role, locationConsentGiven, job?.status, job?.id]);

  const handleManualOnMyWay = async () => {
    if (!job || !currentUser) return;
    try {
      const workerStartLat = currentUser.lat || job.lat - 0.015;
      const workerStartLng = currentUser.lng || job.lng - 0.015;
      await fetch(`/api/tracking/${job.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: workerStartLat,
          lng: workerStartLng,
          accuracy: 20,
          speed: 25,
          timestamp: new Date().toISOString(),
          is_simulated: false,
        }),
      });
      showToast({
        title: "Dispatched: I'm on my way",
        message: 'Dispatch fix broadcast to customer tracking radar.',
        type: 'fair',
      });
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    }
  };

  const quickRatingTags = [
    'Punctual',
    'Fair Price',
    'Clean Workmanship',
    'Polite & Respectful',
    'Highly Skilled',
  ];

  const fetchJobDetails = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load job');
      const data: NegotiationJob = await res.json();
      setJob(data);

      // Fetch band for this job's category and location
      const bandRes = await fetch(
        `/api/price-band?category=${data.category}&lat=${data.lat}&lng=${data.lng}&price=${data.offered_price}`
      );
      if (bandRes.ok) {
        const bandData = await bandRes.json();
        setBand(bandData.band);
        if (counterAmount === 450 && bandData.band) {
          setCounterAmount(bandData.band.typical);
        }
      }

      // If rated, fetch existing rating
      if (data.status === 'rated') {
        const ratRes = await fetch(`/api/jobs/${jobId}/rating`);
        if (ratRes.ok) {
          const ratData = await ratRes.json();
          setSavedRating(ratData);
        }
      }
    } catch (err) {
      console.error('Error fetching job details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetails();
    const interval = setInterval(fetchJobDetails, 3000); // 3s polling for live state sync
    return () => clearInterval(interval);
  }, [jobId]);

  if (loading || !job) {
    return (
      <HudPanel className="p-6 text-center text-xs text-[#A7A29A]">
        Loading job tracking &amp; negotiation data...
      </HudPanel>
    );
  }

  const latestOffer = job.latest_offer || (job.offers && job.offers[job.offers.length - 1]);
  const currentRound = latestOffer ? latestOffer.round : 1;
  const isMyRole = currentUser?.role;

  const isMyTurn =
    job.status === 'requested' || job.status === 'negotiating'
      ? latestOffer?.from_role !== isMyRole
      : false;

  const isAccepted = ['accepted', 'in_progress', 'completed', 'rated'].includes(job.status);
  const isCancelled = job.status === 'cancelled';
  const isDisputed = job.status === 'disputed';

  // Handlers for negotiation
  const handleAccept = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept offer');

      showToast({
        title: 'Offer Accepted!',
        message: `Agreed at ${formatINR(data.agreed_price)}. Direct contact unmasked.`,
        type: 'fair',
      });

      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({
        title: 'Acceptance Error',
        message: (err as Error).message,
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentUser) return;
    if (!window.confirm('Are you sure you want to decline this request?')) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline offer');

      showToast({
        title: 'Request Declined',
        message: 'The job was declined and marked as closed.',
        type: 'caution',
      });

      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({
        title: 'Decline Error',
        message: (err as Error).message,
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCounter = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          amount: counterAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit counter-offer');

      showToast({
        title: 'Counter-Offer Dispatched',
        message: `Offered ${formatINR(counterAmount)} in Round ${data.round}.`,
        type: 'fair',
      });

      setShowCounterInput(false);
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({
        title: 'Negotiation Error',
        message: (err as Error).message,
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // State Machine Handlers (Start / Complete / Cancel / Dispute)
  const handleStartJob = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start job');

      showToast({
        title: 'Job Started!',
        message: 'Job is now marked In Progress. Customer notified.',
        type: 'fair',
      });

      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error Starting Job', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete job');

      showToast({
        title: 'Job Completed!',
        message: `Work completed. Settled at ${formatINR(job.agreed_price || job.offered_price)} in cash.`,
        type: 'fair',
      });

      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error Completing Job', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, reason: cancelReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel job');

      showToast({
        title: 'Job Cancelled',
        message: 'This service request was cancelled.',
        type: 'caution',
      });

      setShowCancelInput(false);
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error Cancelling Job', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisputeJob = async () => {
    if (!currentUser) return;
    if (!disputeReason.trim()) {
      showToast({ title: 'Dispute Reason Required', message: 'Please provide details about the issue.', type: 'caution' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, reason: disputeReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to raise dispute');

      showToast({
        title: 'Dispute Registered',
        message: 'Admin notified. Case will be reviewed under platform safety guidelines.',
        type: 'danger',
      });

      setShowDisputeInput(false);
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Dispute Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!currentUser) return;
    setSubmittingRating(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          rating: ratingStars,
          comment: ratingComment,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit rating');

      showToast({
        title: 'Rating Submitted!',
        message: `Rated ${ratingStars} Stars! Live fair-price band for ${getCategoryLabel(job.category)} recomputed & updated.`,
        type: 'fair',
      });

      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Rating Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmittingRating(false);
    }
  };

  // Build timeline steps
  const timelineSteps: TimelineStep[] = [
    {
      id: 'requested',
      title: 'Service Requested',
      time: job.created_at,
      description: `Initial offer: ${formatINR(job.offered_price)} (Round 1)`,
      isCompleted: true,
      isCurrent: job.status === 'requested' || job.status === 'negotiating',
    },
    {
      id: 'agreed',
      title: 'Price Agreed',
      time: job.accepted_at,
      description: job.agreed_price ? `Agreed at ${formatINR(job.agreed_price)}` : 'In negotiation (max 3 rounds)',
      isCompleted: ['accepted', 'in_progress', 'completed', 'rated'].includes(job.status),
      isCurrent: job.status === 'accepted',
      isFailed: isCancelled && !job.accepted_at,
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      time: job.started_at,
      description: job.started_at ? 'Worker on site performing service' : 'Pending worker arrival',
      isCompleted: ['in_progress', 'completed', 'rated'].includes(job.status),
      isCurrent: job.status === 'in_progress',
      isFailed: isDisputed,
    },
    {
      id: 'completed',
      title: 'Completed & Settled',
      time: job.completed_at,
      description: job.completed_at ? 'Work verified; cash payment settled' : 'Pending service completion',
      isCompleted: ['completed', 'rated'].includes(job.status),
      isCurrent: job.status === 'completed',
    },
    {
      id: 'rated',
      title: 'Customer Rated',
      time: savedRating?.created_at,
      description: job.status === 'rated' ? 'Review logged; market band updated' : 'Customer rating pending',
      isCompleted: job.status === 'rated',
      isCurrent: job.status === 'rated',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Job Meta Header Strip */}
      <HudPanel variant="default" className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-[#A7A29A]">Job {job.id.replace(/^job_/, '')}</span>
              <span className="text-xs font-heading font-black text-white uppercase tracking-wider">
                {getCategoryLabel(job.category)}
              </span>
              <Badge 
                variant={
                  isAccepted ? 'fair' : isDisputed || isCancelled ? 'danger' : 'caution'
                } 
                size="sm"
              >
                {job.status.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-[#F4F1EC] font-sans mt-1 leading-relaxed">
              {job.description}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-mono text-[#A7A29A] block">
              {job.agreed_price ? 'Agreed Price' : 'Offered Price'}
            </span>
            <span className="font-heading text-xl font-black text-white tabular-nums">
              {formatINR(job.agreed_price || job.offered_price)}
            </span>
          </div>
        </div>

        {/* Counterparty Identity */}
        <div className="flex items-center justify-between text-[11px] text-[#A7A29A] pt-2 border-t border-[#2A2E3A]">
          <span className="flex items-center gap-1.5 font-sans">
            <UserCheck className="w-3.5 h-3.5 text-[#5EE6FF]" />
            {currentUser?.role === 'customer' ? (
              <span>Worker: <strong className="text-white">{job.worker_name || 'Nearby Broadcast'}</strong></span>
            ) : (
              <span>Customer: <strong className="text-white">{job.customer_name || 'Customer'}</strong></span>
            )}
          </span>
          <span className="font-mono text-[10px]">
            Created: {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </HudPanel>

      {/* Animated Step Tracker Timeline */}
      <HudPanel variant="default" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-[#FFB81C]">
            Live Service Progress
          </span>
          <span className="text-[10px] font-mono text-[#5EE6FF]">
            3s Real-Time Sync
          </span>
        </div>
        <Timeline steps={timelineSteps} />
      </HudPanel>

      {/* Disputed State Notice */}
      {isDisputed && (
        <HudPanel variant="default" className="p-4 bg-[#FF5C6C]/10 border-[#FF5C6C]/50 space-y-2">
          <div className="flex items-center gap-2 text-[#FF5C6C]">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <span className="font-heading font-black text-sm uppercase tracking-wider">
              Dispute Filed &bull; Under Admin Review
            </span>
          </div>
          <p className="text-xs text-[#F4F1EC] font-sans">
            A customer dispute has been logged for this job. Platform administration will verify job logs and contact both parties.
          </p>
        </HudPanel>
      )}

      {/* Cancelled State Notice */}
      {isCancelled && (
        <div className="p-4 bg-[#FF5C6C]/10 border border-[#FF5C6C]/40 rounded-xl flex items-center gap-3 text-xs text-[#FF5C6C]">
          <XCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-heading font-bold text-white uppercase tracking-wider">
              Request Cancelled or Declined
            </p>
            <p className="text-[11px] text-[#A7A29A] font-sans mt-0.5">
              This request was closed without completing service.
            </p>
          </div>
        </div>
      )}

      {/* Direct Contact Unmasked Strip (when accepted or in_progress, re-masked once rated) */}
      {isAccepted && !isCancelled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-[#5EE6FF]/10 border border-[#5EE6FF]/40 rounded-xl space-y-3 hud-panel-brackets"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#5EE6FF]" />
              <div>
                <p className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                  Agreed &bull; {formatINR(job.agreed_price || job.offered_price)}
                </p>
                <p className="text-xs text-[#A7A29A] font-sans">
                  {job.status === 'rated'
                    ? 'Service rated & completed. Direct phone number re-masked for privacy.'
                    : 'Direct phone communication unmasked for active service.'}
                </p>
              </div>
            </div>
            <Badge variant={job.status === 'rated' ? 'neutral' : 'verified'} size="sm">
              {job.status === 'rated' ? 'Contact Masked' : 'Live Contact'}
            </Badge>
          </div>

          <div className="p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-[#FFD65A] block">
                {job.status === 'rated' ? 'Direct Line (Privacy Masked):' : 'Direct Unmasked Line:'}
              </span>
              <div className="flex items-center gap-3 font-mono text-sm text-white font-bold">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#5EE6FF]" />
                  {currentUser?.role === 'customer'
                    ? job.worker_name || 'Assigned Worker'
                    : job.customer_name || 'Customer'}
                </span>
                <span className="text-[#A7A29A]">&bull;</span>
                {job.status === 'rated' ? (
                  <span className="text-[#A7A29A] font-mono">
                    +91 98••• ••••• (Masked after rating)
                  </span>
                ) : (
                  <span className="text-[#5EE6FF]">
                    {currentUser?.role === 'customer' ? job.worker_phone : job.customer_phone}
                  </span>
                )}
              </div>
            </div>

            {job.status !== 'rated' && (
              <a
                href={`tel:${currentUser?.role === 'customer' ? job.worker_phone : job.customer_phone}`}
                className="px-3 py-1.5 rounded-lg bg-[#5EE6FF]/20 hover:bg-[#5EE6FF]/30 text-[#5EE6FF] border border-[#5EE6FF]/40 font-heading font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 self-start sm:self-auto min-h-[36px]"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Now</span>
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#A7A29A] pt-2 border-t border-[#2A2E3A]">
            <span className="flex items-center gap-1.5 text-white font-medium">
              <CreditCard className="w-3.5 h-3.5 text-[#FFB81C]" />
              <strong>Payment Policy:</strong> Cash on completion only.
            </span>
            <span className="text-[#A7A29A] italic">
              Payments are not integrated in this prototype.
            </span>
          </div>
        </motion.div>
      )}

      {/* STEP C: LIVE TRACKING MAP & WORKER LOCATION RADAR (Active jobs only) */}
      {isAccepted && !isCancelled && !['completed', 'rated'].includes(job.status) && (
        <HudPanel variant="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2E3A] pb-3">
            <div>
              <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#5EE6FF] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#5EE6FF] animate-pulse" />
                Live Dispatch Telemetry
              </span>
              <h3 className="font-heading text-sm font-black text-white uppercase tracking-wider mt-0.5">
                Hyperlocal Transit Radar
              </h3>
            </div>

            {/* Worker Location Broadcast Toggle */}
            {currentUser?.role === 'worker' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!locationConsentGiven) {
                      setShowConsentModal(true);
                    } else {
                      setLocationConsentGiven(false);
                      showToast({ title: 'Location Sharing Paused', message: 'Live GPS broadcast stopped.', type: 'info' });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-heading text-xs uppercase font-bold tracking-wider cursor-pointer border transition flex items-center gap-1.5 ${
                    locationConsentGiven
                      ? 'bg-[#5EE6FF] text-black border-[#5EE6FF] shadow-[0_0_12px_#5EE6FF]'
                      : 'bg-white/5 text-[#A7A29A] border-white/20 hover:text-white'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{locationConsentGiven ? 'Broadcasting Live GPS' : 'Share Live Location'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Worker Geolocation Warning / Fallback */}
          {currentUser?.role === 'worker' && geoError && (
            <div className="p-3 bg-[#FFB81C]/15 border border-[#FFB81C]/40 rounded-xl text-xs space-y-2 text-[#FFB81C]">
              <div className="flex items-center gap-2 font-bold font-heading uppercase">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Geolocation Notice</span>
              </div>
              <p className="text-[11px] text-[#A7A29A] font-sans">{geoError}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleManualOnMyWay}
                  className="px-3 py-1 rounded bg-[#FFB81C] text-black font-heading font-bold uppercase text-[11px] hover:bg-[#FFD65A] cursor-pointer"
                >
                  Fallback: I&apos;m On My Way
                </button>
              </div>
            </div>
          )}

          {/* Embedded TrackingMap */}
          <TrackingMap
            jobId={job.id}
            customerLat={job.lat}
            customerLng={job.lng}
            workerName={job.worker_name}
            isWorkerRole={currentUser?.role === 'worker'}
          />
        </HudPanel>
      )}

      {/* WORKER LOCATION SHARING CONSENT MODAL */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 bg-[#07070A]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1016] border border-[#5EE6FF]/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#5EE6FF]">
              <Navigation className="w-5 h-5 shrink-0" />
              <h3 className="font-heading font-bold uppercase tracking-wider text-white">
                Share Live Location Consent
              </h3>
            </div>

            <div className="p-3.5 bg-[#07070A] rounded-xl border border-[#2A2E3A] text-xs space-y-2 text-slate-200">
              <p className="font-sans font-medium text-white">
                &ldquo;Your location is shared with this customer until the job ends. It is deleted when the job completes or is cancelled.&rdquo;
              </p>
              <p className="text-[11px] text-[#A7A29A] font-sans">
                Uses continuous high-accuracy fixes with exponential smoothing (alpha 0.4). Any fix with accuracy worse than 100 meters is automatically discarded.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-3 py-1.5 text-xs text-[#A7A29A] hover:text-white"
              >
                Decline
              </button>
              <ForgeButton
                variant="primary"
                size="sm"
                onClick={() => {
                  setLocationConsentGiven(true);
                  setShowConsentModal(false);
                  showToast({
                    title: 'Live Location Sharing Active',
                    message: 'Broadcasting smoothed location fixes to customer tracking radar.',
                    type: 'fair',
                  });
                }}
              >
                I Consent &bull; Start Broadcast
              </ForgeButton>
            </div>
          </div>
        </div>
      )}

      {/* WORKER ACTIONS: Start Job / Complete Job */}
      {currentUser?.role === 'worker' && !isCancelled && !isDisputed && (
        <HudPanel variant="default" className="p-4 space-y-3">
          <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-[#FFB81C] block">
            Worker Job Execution Controls
          </span>

          {job.status === 'accepted' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A]">
              <div>
                <p className="font-heading font-bold text-xs uppercase text-white">Arrived at Location?</p>
                <p className="text-[11px] text-[#A7A29A]">Click to transition job to &ldquo;In Progress&rdquo; and notify customer.</p>
              </div>
              <ForgeButton
                variant="primary"
                size="md"
                icon={Play}
                disabled={submitting}
                loading={submitting}
                onClick={handleStartJob}
              >
                Start Job (On Site)
              </ForgeButton>
            </div>
          )}

          {job.status === 'in_progress' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A]">
              <div>
                <p className="font-heading font-bold text-xs uppercase text-[#5EE6FF]">Work Finished &amp; Inspected?</p>
                <p className="text-[11px] text-[#A7A29A]">Confirm completion and direct cash settlement of {formatINR(job.agreed_price || job.offered_price)}.</p>
              </div>
              <ForgeButton
                variant="primary"
                size="md"
                icon={CheckSquare}
                disabled={submitting}
                loading={submitting}
                onClick={handleCompleteJob}
              >
                Complete Job
              </ForgeButton>
            </div>
          )}

          {['completed', 'rated'].includes(job.status) && (
            <div className="p-3 bg-[#5EE6FF]/10 rounded-xl border border-[#5EE6FF]/30 text-xs text-[#5EE6FF] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Job successfully concluded. Completed count credited to your profile.</span>
            </div>
          )}
        </HudPanel>
      )}

      {/* CUSTOMER RATING FORM (When status === 'completed') */}
      {currentUser?.role === 'customer' && job.status === 'completed' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-[#0E1016] border border-[#FFB81C] rounded-xl space-y-4 shadow-[0_0_25px_rgba(255,184,28,0.2)] hud-panel-brackets"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-[#FFD65A] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FFB81C]" />
                Job Completed &bull; Rate Service Quality
              </span>
              <h4 className="font-heading text-lg font-black text-white uppercase tracking-wider mt-0.5">
                Verify Quality &amp; Update Market Band
              </h4>
            </div>
            <Badge variant="caution" size="sm">
              Action Required
            </Badge>
          </div>

          <p className="text-xs text-[#A7A29A] font-sans leading-relaxed">
            Your rating updates worker reputation and feeds the <strong>Live Fair-Price Band</strong> for completed jobs in your neighborhood.
          </p>

          {/* 1-5 Star Interactive Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#A7A29A]">
              Star Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverStars !== null ? hoverStars : ratingStars) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverStars(star)}
                    onMouseLeave={() => setHoverStars(null)}
                    onClick={() => setRatingStars(star)}
                    className="p-1 cursor-pointer transition transform hover:scale-110"
                    title={`${star} Stars`}
                  >
                    <Star
                      className={`w-7 h-7 ${
                        active
                          ? 'fill-[#FFB81C] text-[#FFB81C] drop-shadow-[0_0_8px_rgba(255,184,28,0.7)]'
                          : 'fill-transparent text-[#3B4150]'
                      }`}
                    />
                  </button>
                );
              })}
              <span className="ml-2 font-heading font-black text-white text-base">
                {ratingStars} / 5 Stars
              </span>
            </div>
          </div>

          {/* Quick Preset Review Tags */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#A7A29A]">
              Quick Feedback Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {quickRatingTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (!ratingComment.includes(tag)) {
                      setRatingComment(ratingComment ? `${ratingComment}, ${tag}` : tag);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#151821] hover:bg-[#1C202B] text-xs text-[#F4F1EC] border border-[#2A2E3A] font-sans cursor-pointer"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Review Comment Text */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#A7A29A]">
              Review Comments
            </label>
            <textarea
              rows={2}
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Describe work quality, punctuality, and pricing..."
              className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl px-3.5 py-2 text-xs text-[#F4F1EC] placeholder-[#6F6B65] focus:outline-none focus:border-[#FFB81C] font-sans"
            />
          </div>

          {/* Submit Rating Button */}
          <ForgeButton
            variant="primary"
            size="md"
            fullWidth
            icon={TrendingUp}
            disabled={submittingRating}
            loading={submittingRating}
            onClick={handleSubmitRating}
          >
            Submit Review &amp; Recompute Market Band
          </ForgeButton>
        </motion.div>
      )}

      {/* RATED STATUS VIEW (When already rated) */}
      {job.status === 'rated' && (
        <HudPanel variant="highlight" className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-[#FFB81C] text-[#FFB81C]" />
              <span className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                Customer Rated &bull; {savedRating?.rating || 5} Stars
              </span>
            </div>
            <Badge variant="fair" size="sm">
              Band Recomputed
            </Badge>
          </div>

          {savedRating?.comment && (
            <p className="text-xs text-[#F4F1EC] font-sans italic bg-[#07070A] p-3 rounded-lg border border-[#2A2E3A]">
              &ldquo;{savedRating.comment}&rdquo;
            </p>
          )}

          <div className="flex items-center gap-2 text-[11px] text-[#5EE6FF] pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>This completed job was incorporated into the live fair-price band.</span>
          </div>
        </HudPanel>
      )}

      {/* TRUST, SAFETY, REPORT, AND TRIP SHARING BAR */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 text-xs border-t border-[#2A2E3A]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Safety Button: on active jobs (accepted or in_progress) */}
          {['accepted', 'in_progress'].includes(job.status) && (
            <button
              type="button"
              onClick={() => setShowSafetyModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-[#FF5C6C]/15 hover:bg-[#FF5C6C]/25 text-[#FF5C6C] border border-[#FF5C6C]/40 font-heading text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Safety</span>
            </button>
          )}

          {/* Share Trip: on active jobs */}
          {['accepted', 'in_progress'].includes(job.status) && (
            <button
              type="button"
              onClick={handleGenerateShareTrip}
              className="px-2.5 py-1.5 rounded-lg bg-[#5EE6FF]/15 hover:bg-[#5EE6FF]/25 text-[#5EE6FF] border border-[#5EE6FF]/40 font-heading text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Trip</span>
            </button>
          )}

          {/* Report Button: on every job with an assigned worker */}
          {job.worker_id && (
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/15 font-heading text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5 text-[#FFB81C]" />
              <span>Report</span>
            </button>
          )}
        </div>

        {/* Customer Cancellation / Dispute options */}
        {currentUser?.role === 'customer' && !isCancelled && !isDisputed && (
          <div className="flex items-center gap-3">
            {['requested', 'negotiating', 'accepted'].includes(job.status) && (
              <button
                type="button"
                onClick={() => setShowCancelInput(!showCancelInput)}
                className="text-[#A7A29A] hover:text-white hover:underline cursor-pointer flex items-center gap-1 font-heading text-[11px] uppercase tracking-wider"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Request</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* MODAL: REPORT WORKER */}
      {showReportModal && (
        <div className="p-4 bg-[#07070A] border border-[#FFB81C]/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#FFB81C]">
              <Flag className="w-4 h-4" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                Submit Report on Service
              </span>
            </div>
            <button onClick={() => setShowReportModal(false)} className="text-xs text-[#A7A29A] hover:text-white">
              Cancel
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#A7A29A]">
              Reason for Report
            </label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value as any)}
              className="w-full bg-[#151821] border border-[#2A2E3A] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB81C]"
            >
              <option value="overcharged">Overcharged / Demanded Cash Above Agreed Band</option>
              <option value="no-show">No-Show / Did Not Arrive</option>
              <option value="unsafe behaviour">Unsafe or Aggressive Behaviour</option>
              <option value="poor work">Substandard Work / Damaged Property</option>
              <option value="other">Other Violation</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-heading font-bold uppercase tracking-wider text-[#A7A29A]">
              Additional Details (Optional)
            </label>
            <textarea
              rows={2}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="Briefly describe what happened..."
              className="w-full bg-[#151821] border border-[#2A2E3A] rounded-lg px-3 py-2 text-xs text-white placeholder-[#6F6B65] focus:outline-none focus:border-[#FFB81C]"
            />
          </div>

          <div className="p-2.5 bg-[#FFB81C]/10 rounded-lg text-[10px] text-[#A7A29A] font-mono leading-relaxed">
            Policy: Workers are auto-flagged for admin intervention after 3 reports from 3 DISTINCT customers. One customer cannot report twice toward the threshold.
          </div>

          <ForgeButton
            variant="primary"
            size="sm"
            disabled={submittingReport}
            loading={submittingReport}
            onClick={handleSubmitReport}
          >
            Submit Report to Operations
          </ForgeButton>
        </div>
      )}

      {/* MODAL: SAFETY EMERGENCY INCIDENT */}
      {showSafetyModal && (
        <div className="p-4 bg-[#FF5C6C]/15 border border-[#FF5C6C]/50 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#FF5C6C]">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                Platform Safety Alert
              </span>
            </div>
            <button onClick={() => setShowSafetyModal(false)} className="text-xs text-[#A7A29A] hover:text-white">
              Cancel
            </button>
          </div>

          <div className="p-3 bg-[#07070A] rounded-lg border border-[#FF5C6C]/40 text-xs text-[#FF5C6C] font-bold leading-relaxed">
            This does not contact emergency services. In an emergency dial 112.
          </div>

          <p className="text-xs text-[#A7A29A] font-sans">
            Triggering safety creates a real-time high priority incident in the Admin Operations Queue with your live location coordinates.
          </p>

          <input
            type="text"
            value={safetyDetails}
            onChange={(e) => setSafetyDetails(e.target.value)}
            placeholder="Emergency note (optional)..."
            className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-lg px-3 py-2 text-xs text-white placeholder-[#6F6B65] focus:outline-none focus:border-[#FF5C6C]"
          />

          <ForgeButton
            variant="danger"
            size="sm"
            disabled={submittingSafety}
            loading={submittingSafety}
            onClick={handleTriggerSafety}
          >
            Confirm Safety Alert (Top Priority Queue)
          </ForgeButton>
        </div>
      )}

      {/* MODAL: SHARE TRIP LINK */}
      {showShareModal && shareToken && (
        <div className="p-4 bg-[#07070A] border border-[#5EE6FF]/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[#5EE6FF]">
              <Share2 className="w-4 h-4" />
              <span className="font-heading font-bold text-xs uppercase tracking-wider text-white">
                Share Live Trip Status
              </span>
            </div>
            <button onClick={() => setShowShareModal(false)} className="text-xs text-[#A7A29A] hover:text-white">
              Close
            </button>
          </div>

          <p className="text-xs text-[#A7A29A] font-sans">
            Share this read-only tracking link with family or colleagues to view live worker dispatch status. It expires when the job completes or is cancelled.
          </p>

          <div className="flex items-center gap-2 p-2 bg-[#151821] rounded-lg border border-[#2A2E3A] font-mono text-xs">
            <span className="text-[#5EE6FF] truncate flex-1">
              {window.location.origin}/track/{shareToken}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/track/${shareToken}`);
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2000);
              }}
              className="px-2.5 py-1 rounded bg-[#5EE6FF]/20 text-[#5EE6FF] text-[11px] font-heading font-bold uppercase hover:bg-[#5EE6FF]/30 cursor-pointer flex items-center gap-1"
            >
              {copiedShare ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              <span>{copiedShare ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <a
            href={`/track/${shareToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#5EE6FF] hover:underline font-heading uppercase font-bold"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Tracking View in New Tab</span>
          </a>
        </div>
      )}

      {/* Dispute Drawer Input */}
      {showDisputeInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-[#FF5C6C]/10 border border-[#FF5C6C]/40 rounded-xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#FF5C6C]">
              File Service Dispute
            </span>
            <button onClick={() => setShowDisputeInput(false)} className="text-xs text-[#A7A29A] hover:text-white">
              Cancel
            </button>
          </div>
          <textarea
            rows={2}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Explain the safety, quality, or pricing issue..."
            className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl px-3 py-2 text-xs text-white placeholder-[#6F6B65] focus:outline-none focus:border-[#FF5C6C]"
          />
          <ForgeButton
            variant="danger"
            size="sm"
            disabled={submitting}
            loading={submitting}
            onClick={handleDisputeJob}
          >
            Submit Dispute to Admin
          </ForgeButton>
        </motion.div>
      )}

      {/* Cancel Input */}
      {showCancelInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-[#151821] border border-[#2A2E3A] rounded-xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-white">
              Cancel Service Request
            </span>
            <button onClick={() => setShowCancelInput(false)} className="text-xs text-[#A7A29A] hover:text-white">
              Dismiss
            </button>
          </div>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)..."
            className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl px-3 py-2 text-xs text-white placeholder-[#6F6B65] focus:outline-none focus:border-[#FFB81C]"
          />
          <ForgeButton
            variant="ghost"
            size="sm"
            disabled={submitting}
            loading={submitting}
            onClick={handleCancelJob}
          >
            Confirm Cancellation
          </ForgeButton>
        </motion.div>
      )}

      {/* Chat-Style Negotiation Thread Bubbles */}
      <HudPanel variant="default" className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2A2E3A] pb-2">
          <span className="text-xs font-heading font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-[#5EE6FF]" />
            Negotiation History
          </span>
          <span className="text-[10px] font-mono text-[#A7A29A]">
            Round {currentRound} of 3
          </span>
        </div>

        <div className="space-y-3 py-1 max-h-[320px] overflow-y-auto px-1">
          {job.offers && job.offers.map((offer, idx) => {
            const isSender = offer.from_role === isMyRole;
            const isAcceptedOffer = offer.status === 'accepted';
            const isDeclinedOffer = offer.status === 'declined';

            let bandLabel = 'Within band';
            let bandVariant: 'fair' | 'caution' = 'fair';
            if (band) {
              if (offer.amount < band.low) {
                bandLabel = 'Below band';
                bandVariant = 'caution';
              } else if (offer.amount > band.high) {
                bandLabel = 'Above band';
                bandVariant = 'caution';
              }
            }

            return (
              <motion.div
                key={offer.id || idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-xl border space-y-1.5 ${
                    isAcceptedOffer
                      ? 'bg-[#5EE6FF]/15 border-[#5EE6FF]/50 text-white'
                      : isDeclinedOffer
                      ? 'bg-[#FF5C6C]/15 border-[#FF5C6C]/40 text-[#A7A29A]'
                      : isSender
                      ? 'bg-[#151821] border-[#FFB81C]/40 text-white'
                      : 'bg-[#0E1016] border-[#2A2E3A] text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] uppercase font-heading font-bold tracking-wider">
                    <span className={isSender ? 'text-[#FFD65A]' : 'text-[#5EE6FF]'}>
                      {isSender ? 'You' : offer.from_role === 'worker' ? 'Worker Offer' : 'Customer Offer'}
                    </span>
                    <span className="text-[#A7A29A] font-mono">
                      Round {offer.round} &bull; {new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-heading text-xl font-black text-white tabular-nums">
                      {formatINR(offer.amount)}
                    </span>
                    <Badge variant={bandVariant} size="sm">
                      {bandLabel}
                    </Badge>
                  </div>

                  <div className="text-[10px] font-mono flex items-center gap-1.5 pt-1 border-t border-white/5">
                    <span className="text-[#A7A29A]">Status:</span>
                    <span className={`font-bold uppercase ${
                      offer.status === 'accepted' ? 'text-[#5EE6FF]' : offer.status === 'countered' ? 'text-[#FFB81C]' : 'text-slate-400'
                    }`}>
                      {offer.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Action Controls for Active Negotiation */}
        {!isAccepted && !isCancelled && !isDisputed && (
          <div className="pt-3 border-t border-[#2A2E3A] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-heading uppercase tracking-wider font-bold text-slate-300">
                {isMyTurn ? 'Your Turn to Respond' : 'Waiting on Counterparty'}
              </span>
              <span className="text-[11px] font-mono text-[#A7A29A]">
                {isMyTurn
                  ? `Accept ${formatINR(latestOffer?.amount || 0)} or submit counter`
                  : `Waiting for ${isMyRole === 'customer' ? 'worker' : 'customer'}`}
              </span>
            </div>

            {isMyTurn ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <ForgeButton
                    variant="primary"
                    size="md"
                    icon={CheckCircle2}
                    disabled={submitting}
                    onClick={handleAccept}
                  >
                    Accept {formatINR(latestOffer?.amount || 0)}
                  </ForgeButton>

                  <ForgeButton
                    variant="ghost"
                    size="md"
                    icon={Handshake}
                    disabled={submitting}
                    onClick={() => setShowCounterInput(!showCounterInput)}
                  >
                    {showCounterInput ? 'Cancel Counter' : 'Counter-Offer'}
                  </ForgeButton>

                  {currentUser?.role === 'worker' && (
                    <ForgeButton
                      variant="danger"
                      size="md"
                      icon={XCircle}
                      disabled={submitting}
                      onClick={handleDecline}
                    >
                      Decline
                    </ForgeButton>
                  )}
                </div>

                <AnimatePresence>
                  {showCounterInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 p-4 bg-[#07070A] rounded-xl border border-[#2A2E3A] overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#FFD65A]">
                          Counter-Offer (Round {currentRound} of 3)
                        </span>
                        <span className="text-xs text-[#A7A29A] font-mono">
                          Current: {formatINR(latestOffer?.amount || 0)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-heading font-bold text-[#A7A29A] text-base">
                            ₹
                          </span>
                          <input
                            type="number"
                            step={25}
                            value={counterAmount || ''}
                            onChange={(e) => setCounterAmount(Number(e.target.value))}
                            className="w-full bg-[#0E1016] border border-[#2A2E3A] rounded-xl pl-8 pr-4 py-2.5 font-heading text-lg font-black text-white focus:outline-none focus:border-[#FFB81C] tabular-nums"
                          />
                        </div>

                        <ForgeButton
                          variant="primary"
                          size="md"
                          icon={Send}
                          disabled={submitting}
                          loading={submitting}
                          onClick={handleSendCounter}
                        >
                          Send Counter
                        </ForgeButton>
                      </div>

                      <div className="pt-2">
                        <PriceBandGauge
                          band={band}
                          currentPrice={counterAmount}
                          perspective={currentUser?.role === 'worker' ? 'worker' : 'customer'}
                          onPriceChange={(newPrice) => setCounterAmount(newPrice)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="p-3 bg-[#151821] rounded-xl border border-[#2A2E3A] flex items-center justify-between text-xs text-[#A7A29A]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#FFB81C] animate-spin" />
                  <span>
                    Waiting for {isMyRole === 'customer' ? 'worker' : 'customer'} to respond to {formatINR(latestOffer?.amount || 0)}.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#5EE6FF]">
                  Live sync
                </span>
              </div>
            )}
          </div>
        )}
      </HudPanel>
    </div>
  );
};
