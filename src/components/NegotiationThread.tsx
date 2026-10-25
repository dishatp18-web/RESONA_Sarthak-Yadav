/**
 * NegotiationThread: Calm Edition
 * Simple chat bubbles with the amount in bold; one action bar;
 * one hint line under it ("₹520 is above the typical ₹450");
 * round indicator is plain text "Round 2 of 3";
 * phone masking behaves as before.
 */
import React, { useState, useEffect } from 'react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { PriceBandResult } from '../types.js';
import { getCategoryLabel } from '../config.js';
import { TrackingMap } from './TrackingMap.js';
import { 
  PrimaryButton, 
  SecondaryButton, 
  TextLink, 
  Card, 
  Sheet,
  useToast, 
  formatINR 
} from './ui/index.js';
import { 
  Phone, 
  Star, 
  CheckCircle2, 
  AlertTriangle, 
  Share2, 
  Flag,
  ShieldAlert
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
  const [ratingComment, setRatingComment] = useState<string>('Punctual and fair pricing.');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [savedRating, setSavedRating] = useState<any | null>(null);

  // Report & Safety modals
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportReason, setReportReason] = useState<'no-show' | 'overcharged' | 'unsafe behaviour' | 'poor work' | 'other'>('overcharged');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);

  const fetchJobDetails = async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) return;
      const data: NegotiationJob = await res.json();
      setJob(data);

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
    const interval = setInterval(fetchJobDetails, 3000);
    return () => clearInterval(interval);
  }, [jobId]);

  if (loading || !job) {
    return (
      <div className="p-8 text-center text-sm text-[#6B5B4E]">
        Loading job details...
      </div>
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

  // Handlers
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
        title: 'Offer Accepted',
        message: `Agreed at ₹${data.agreed_price}. Direct phone unmasked.`,
        type: 'fair',
      });
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to decline');
      showToast({ title: 'Declined', message: 'The request was declined.', type: 'caution' });
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
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
        body: JSON.stringify({ user_id: currentUser.id, amount: counterAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to counter');
      showToast({
        title: 'Counter Sent',
        message: `Counter-offer of ₹${counterAmount} sent in Round ${data.round}.`,
        type: 'fair',
      });
      setShowCounterInput(false);
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartJob = async () => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      if (!res.ok) throw new Error('Failed to start job');
      showToast({ title: 'Job Started', message: 'Job is now In Progress.', type: 'fair' });
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
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
      if (!res.ok) throw new Error('Failed to complete job');
      showToast({ title: 'Job Completed', message: 'Work marked completed.', type: 'fair' });
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
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
      if (!res.ok) throw new Error('Failed to submit rating');
      showToast({ title: 'Thank you!', message: 'Rating logged.', type: 'fair' });
      await fetchJobDetails();
      if (onJobUpdated) onJobUpdated();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleGenerateShareTrip = async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/share-trip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setShareToken(data.token);
      setShowShareModal(true);
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    }
  };

  // Hint line calculation
  const latestAmount = latestOffer?.amount || job.offered_price;
  const getHintLine = () => {
    if (!band) return null;
    if (latestAmount > band.high) {
      return `₹${latestAmount} is above the typical ₹${band.typical}.`;
    }
    if (latestAmount < band.low) {
      return `₹${latestAmount} is below the typical ₹${band.typical}.`;
    }
    return `₹${latestAmount} is within the typical range of ₹${band.low} to ₹${band.high}.`;
  };

  const hintLine = getHintLine();

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6 select-none">
      {/* Job Title & Round Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-h2">
            {getCategoryLabel(job.category)}
          </h2>
          <span className="text-[14px] text-[#6B5B4E]">
            Round {currentRound} of 3
          </span>
        </div>
        <p className="text-[14px] text-[#6B5B4E]">
          {job.description}
        </p>
      </div>

      {/* Direct Contact strip (Phone masking: live only when accepted/in_progress, re-masked when rated) */}
      {isAccepted && !isCancelled && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-heading font-semibold text-[14px] text-[#2A1B12]">
              {currentUser?.role === 'customer'
                ? job.worker_name || 'Tradesperson'
                : job.customer_name || 'Customer'}
            </span>
            {job.status === 'rated' ? (
              <span className="text-[12px] text-[#6B5B4E]">
                Contact masked
              </span>
            ) : (
              <span className="text-[12px] text-[#059669] font-medium">
                Live contact
              </span>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[14px] text-[#2A1B12] font-medium">
              {job.status === 'rated'
                ? '+91 98••• •••••'
                : (currentUser?.role === 'customer' ? job.worker_phone : job.customer_phone) || '+91 98450 12345'}
            </span>
            {job.status !== 'rated' && (
              <a
                href={`tel:${currentUser?.role === 'customer' ? job.worker_phone : job.customer_phone}`}
                className="h-[36px] px-4 rounded-full bg-[#B5541E] text-white text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            )}
          </div>

          <p className="text-[12px] text-[#6B5B4E] pt-1">
            Cash on completion only.
          </p>
        </Card>
      )}

      {/* Offer History: Simple chat bubbles with the amount in bold */}
      <div className="space-y-3 py-2">
        {(job.offers && job.offers.length > 0 ? job.offers : [
          {
            id: 'init',
            job_id: job.id,
            from_role: 'customer',
            amount: job.offered_price,
            round: 1,
            status: 'pending',
            created_at: job.created_at,
          } as Offer
        ]).map((offer, idx) => {
          const isFromMe = offer.from_role === currentUser?.role;

          return (
            <div
              key={offer.id || idx}
              className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`p-4 rounded-[20px] max-w-[85%] space-y-1 ${
                  isFromMe
                    ? 'bg-[#B5541E] text-white rounded-br-[4px]'
                    : 'bg-[#FFFBF3] border border-[#EADFC9] text-[#2A1B12] rounded-bl-[4px]'
                }`}
              >
                <div className="text-[12px] opacity-80">
                  {offer.from_role === 'customer' ? 'Customer offer' : 'Worker quote'} &bull; Round {offer.round}
                </div>
                <div className="font-heading font-extrabold text-[24px] leading-tight">
                  ₹{offer.amount}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Bar & Hint Line */}
      <div className="space-y-3 pt-2">
        {/* If user's turn to act in negotiation */}
        {isMyTurn && !isAccepted && !isCancelled && (
          <div className="space-y-3">
            {!showCounterInput ? (
              <div className="space-y-2">
                <PrimaryButton
                  fullWidth
                  onClick={handleAccept}
                  loading={submitting}
                >
                  Accept ₹{latestAmount}
                </PrimaryButton>

                {currentRound < 3 && (
                  <SecondaryButton
                    fullWidth
                    onClick={() => setShowCounterInput(true)}
                    disabled={submitting}
                  >
                    Counter with new price
                  </SecondaryButton>
                )}

                <div className="text-center pt-1">
                  <TextLink onClick={handleDecline} className="text-[14px]">
                    Decline offer
                  </TextLink>
                </div>
              </div>
            ) : (
              <Card className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-[16px] text-[#2A1B12]">
                    Your counter-offer
                  </span>
                  <TextLink onClick={() => setShowCounterInput(false)}>
                    Cancel
                  </TextLink>
                </div>

                <div className="flex items-center justify-between bg-[#FCF5E8] rounded-full px-4 py-2">
                  <span className="font-heading font-bold text-xl text-[#B5541E]">₹</span>
                  <input
                    type="number"
                    step={25}
                    value={counterAmount}
                    onChange={(e) => setCounterAmount(Number(e.target.value))}
                    className="w-full bg-transparent text-right font-heading font-extrabold text-2xl text-[#2A1B12] focus:outline-none"
                  />
                </div>

                <PrimaryButton
                  fullWidth
                  onClick={handleSendCounter}
                  loading={submitting}
                >
                  Send counter (Round {currentRound + 1} of 3)
                </PrimaryButton>
              </Card>
            )}

            {/* ONE hint line under the action bar */}
            {hintLine && (
              <p className="text-[14px] leading-[20px] text-[#6B5B4E] text-center">
                {hintLine}
              </p>
            )}
          </div>
        )}

        {/* Worker Actions for In-Progress Job */}
        {currentUser?.role === 'worker' && isAccepted && !['completed', 'rated'].includes(job.status) && (
          <div className="space-y-2">
            {job.status === 'accepted' && (
              <PrimaryButton fullWidth onClick={handleStartJob} loading={submitting}>
                Start job (on site)
              </PrimaryButton>
            )}
            {job.status === 'in_progress' && (
              <PrimaryButton fullWidth onClick={handleCompleteJob} loading={submitting}>
                Complete job
              </PrimaryButton>
            )}
          </div>
        )}

        {/* Customer Rating Form (when completed) */}
        {currentUser?.role === 'customer' && job.status === 'completed' && (
          <Card className="space-y-4">
            <h3 className="font-heading font-bold text-[18px] text-[#2A1B12]">
              Rate your service
            </h3>

            {/* Star selector */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className="p-1 cursor-pointer focus:outline-none"
                  aria-label={`${star} Stars`}
                >
                  <Star
                    className={`w-7 h-7 ${
                      ratingStars >= star
                        ? 'fill-[#B5541E] text-[#B5541E]'
                        : 'text-[#EADFC9]'
                    }`}
                  />
                </button>
              ))}
              <span className="font-heading font-bold text-[16px] text-[#2A1B12] ml-2">
                {ratingStars} of 5
              </span>
            </div>

            <input
              type="text"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full bg-[#FCF5E8] border border-[#EADFC9] rounded-full px-4 py-2.5 text-[14px] text-[#2A1B12] focus:outline-none"
            />

            <PrimaryButton fullWidth onClick={handleSubmitRating} loading={submittingRating}>
              Submit rating
            </PrimaryButton>
          </Card>
        )}

        {/* Customer already rated notice */}
        {job.status === 'rated' && (
          <Card className="flex items-center gap-2 text-[#059669]">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-[14px] font-medium">
              Service rated {savedRating?.rating || 5} stars. Thank you!
            </span>
          </Card>
        )}

        {/* Live Tracking Map when accepted/in_progress */}
        {isAccepted && !isCancelled && !['completed', 'rated'].includes(job.status) && (
          <div className="rounded-[20px] overflow-hidden border border-[#EADFC9] h-48">
            <TrackingMap
              jobId={job.id}
              customerLat={job.lat}
              customerLng={job.lng}
              workerName={job.worker_name || 'Worker'}
              isWorkerRole={currentUser?.role === 'worker'}
              heightClass="h-full"
            />
          </div>
        )}

        {/* Safety & Share Links */}
        {isAccepted && !['completed', 'rated'].includes(job.status) && (
          <div className="flex items-center justify-between text-xs pt-2">
            <TextLink onClick={handleGenerateShareTrip} className="flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5" />
              <span>Share trip</span>
            </TextLink>
            <TextLink onClick={() => setShowReportSheet(true)} className="flex items-center gap-1 text-[#6B5B4E]">
              <Flag className="w-3.5 h-3.5" />
              <span>Report issue</span>
            </TextLink>
          </div>
        )}
      </div>

      {/* Share Trip Sheet */}
      <Sheet
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Live Trip"
      >
        <div className="space-y-4">
          <p className="text-[14px] text-[#2A1B12]">
            Anyone with this link can view the live repair progress and worker location.
          </p>
          <div className="p-3 bg-[#FCF5E8] border border-[#EADFC9] rounded-[16px] text-xs break-all font-sans font-medium text-[#2A1B12]">
            {typeof window !== 'undefined' ? `${window.location.origin}/track/${shareToken}` : ''}
          </div>
          <PrimaryButton fullWidth onClick={() => {
            navigator.clipboard?.writeText(`${window.location.origin}/track/${shareToken}`);
            showToast({ title: 'Copied', message: 'Tracking link copied to clipboard.', type: 'fair' });
            setShowShareModal(false);
          }}>
            Copy Link
          </PrimaryButton>
        </div>
      </Sheet>

      {/* Report Sheet */}
      <Sheet
        isOpen={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        title="Report an issue"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-[12px] text-[#6B5B4E]">Reason</span>
            <div className="grid grid-cols-2 gap-2">
              {(['overcharged', 'no-show', 'poor work', 'unsafe behaviour'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReportReason(r)}
                  className={`h-[36px] px-3 rounded-full text-[12px] font-medium capitalize cursor-pointer ${
                    reportReason === r
                      ? 'bg-[#B5541E] text-white'
                      : 'bg-[#F4EBDA] text-[#2A1B12]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={3}
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            placeholder="Details..."
            className="w-full bg-[#FCF5E8] border border-[#EADFC9] rounded-[16px] p-3 text-xs text-[#2A1B12] focus:outline-none"
          />
          <PrimaryButton fullWidth onClick={() => {
            showToast({ title: 'Report Filed', message: 'We will inspect this report.', type: 'caution' });
            setShowReportSheet(false);
          }}>
            Submit report
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  );
};
