/**
 * FairFix Public Read-Only Trip Tracker: Calm Edition
 * Served at /track/:token
 * Shows live dispatch status and worker location trail.
 * Expires immediately when the job is completed or cancelled.
 */
import React, { useState, useEffect } from 'react';
import { Card, ArcLoader, PrimaryButton, formatINR } from './ui/index.js';
import { getCategoryLabel } from '../config.js';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Navigation,
  ArrowLeft
} from 'lucide-react';

interface PublicTrackerProps {
  token: string;
  onBackToApp?: () => void;
}

export const PublicTracker: React.FC<PublicTrackerProps> = ({ token, onBackToApp }) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackStatus = async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Tracking link not found or expired.');
        throw new Error('Failed to load tracking data.');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackStatus();
    const interval = setInterval(fetchTrackStatus, 3000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FCF5E8] flex flex-col items-center justify-center p-6 text-[#2A1B12]">
        <ArcLoader size="lg" className="mb-4" />
        <p className="font-heading font-bold text-base text-[#2A1B12]">
          Loading tracking data...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FCF5E8] flex flex-col items-center justify-center p-6 text-[#2A1B12]">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#B45309] mx-auto" />
          <h2 className="font-heading font-bold text-[20px] text-[#2A1B12]">
            Link Expired or Invalid
          </h2>
          <p className="text-[14px] text-[#6B5B4E]">
            {error || 'This live link has concluded and its location telemetry has been deleted.'}
          </p>
          {onBackToApp && (
            <PrimaryButton fullWidth onClick={onBackToApp}>
              Return to FairFix
            </PrimaryButton>
          )}
        </Card>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="min-h-screen bg-[#FCF5E8] flex flex-col items-center justify-center p-6 text-[#2A1B12]">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-[#059669] mx-auto" />
          <h2 className="font-heading font-bold text-[20px] text-[#2A1B12]">
            Trip Concluded
          </h2>
          <p className="text-[14px] text-[#6B5B4E]">
            This repair has reached completion. For privacy, worker location fixes are permanently removed upon job completion.
          </p>
          {onBackToApp && (
            <PrimaryButton fullWidth onClick={onBackToApp}>
              Open FairFix
            </PrimaryButton>
          )}
        </Card>
      </div>
    );
  }

  const { job, tracking_points } = data;
  const latestPoint = tracking_points?.[tracking_points.length - 1];

  return (
    <div className="min-h-screen bg-[#FCF5E8] text-[#2A1B12] p-6 sm:p-12 flex flex-col justify-between select-none">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EADFC9] pb-4">
          <div>
            <span className="text-[12px] text-[#6B5B4E]">
              Job {job.id.replace(/^job_/, '')}
            </span>
            <h1 className="text-h2">
              {getCategoryLabel(job.category)}
            </h1>
          </div>
          <span className="text-[14px] font-medium text-[#059669] capitalize">
            {job.status}
          </span>
        </div>

        {/* Live Trip Card */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[12px] text-[#6B5B4E]">Worker</span>
              <p className="font-heading font-bold text-[16px] text-[#2A1B12]">
                {job.worker_name || 'Assigned Worker'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[12px] text-[#6B5B4E]">Agreed Price</span>
              <p className="font-heading font-bold text-[16px] text-[#2A1B12]">
                ₹{job.agreed_price || job.offered_price}
              </p>
            </div>
          </div>

          {/* Location Status */}
          <div className="p-4 bg-[#FCF5E8] rounded-[16px] border border-[#EADFC9] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#B5541E] flex items-center gap-1.5">
                <Navigation className="w-4 h-4" />
                Live GPS
              </span>
              <span className="text-[12px] text-[#6B5B4E]">
                {latestPoint ? `Updated ${new Date(latestPoint.ts).toLocaleTimeString()}` : 'Fix pending...'}
              </span>
            </div>

            {latestPoint && (
              <div className="grid grid-cols-2 gap-2 text-[14px] text-[#2A1B12] pt-1">
                <div>Speed: <strong>{Math.round(latestPoint.speed || 0)} km/h</strong></div>
                <div>Accuracy: <strong>&plusmn;{Math.round(latestPoint.accuracy || 15)} m</strong></div>
              </div>
            )}
          </div>

          <div className="text-[12px] text-[#6B5B4E] flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
            <span>Raw GPS coordinates are permanently deleted upon job conclusion.</span>
          </div>
        </Card>
      </div>

      <div className="max-w-2xl mx-auto w-full pt-8 text-center text-[12px] text-[#6B5B4E]">
        FairFix Bengaluru &bull; Read-Only Demo Tracking Link
      </div>
    </div>
  );
};
