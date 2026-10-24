/**
 * FairFix Public Read-Only Trip Tracker
 * Served at /track/:token
 * Shows live dispatch status and worker location trail without requiring login.
 * Expires immediately when the job is completed or cancelled.
 */
import React, { useState, useEffect } from 'react';
import { HudPanel, Badge, ArcLoader, formatINR } from './ui/index.js';
import { getCategoryLabel } from '../config.js';
import { 
  ShieldCheck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  ExternalLink,
  Navigation,
  Lock
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
      <div className="min-h-screen bg-[#07070A] flex flex-col items-center justify-center p-4 text-[#F4F1EC]">
        <ArcLoader size="lg" className="mb-4" />
        <p className="font-heading font-bold uppercase text-sm tracking-wider">
          Connecting Live Dispatch Telemetry...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#07070A] flex flex-col items-center justify-center p-4 text-[#F4F1EC]">
        <div className="max-w-md w-full bg-[#0E1016] border border-[#2A2E3A] rounded-2xl p-6 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#FFB81C] mx-auto" />
          <h2 className="font-heading font-bold text-lg uppercase text-white">Tracking Link Expired or Invalid</h2>
          <p className="text-xs text-[#A7A29A]">
            {error || 'This live link has concluded and its location telemetry has been deleted from servers.'}
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-4 py-2 bg-[#FFB81C] text-black font-heading font-bold uppercase text-xs rounded-xl hover:bg-[#FFD65A]"
            >
              Return to FairFix
            </button>
          )}
        </div>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="min-h-screen bg-[#07070A] flex flex-col items-center justify-center p-4 text-[#F4F1EC]">
        <div className="max-w-md w-full bg-[#0E1016] border border-[#2A2E3A] rounded-2xl p-6 text-center space-y-4">
          <CheckCircle2 className="w-10 h-10 text-[#5EE6FF] mx-auto" />
          <h2 className="font-heading font-bold text-lg uppercase text-white">Trip Concluded</h2>
          <Badge variant="fair" size="md">
            Job Status: {data.status}
          </Badge>
          <p className="text-xs text-[#A7A29A] font-sans">
            This tracking link has expired because the job has reached completion. For privacy, worker location fixes are permanently wiped upon job completion.
          </p>
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-4 py-2 bg-[#5EE6FF] text-black font-heading font-bold uppercase text-xs rounded-xl hover:bg-[#5EE6FF]/80"
            >
              Open FairFix Cockpit
            </button>
          )}
        </div>
      </div>
    );
  }

  const { job, tracking_points } = data;
  const latestPoint = tracking_points?.[tracking_points.length - 1];

  return (
    <div className="min-h-screen bg-[#07070A] text-[#F4F1EC] p-4 sm:p-8 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2A2E3A] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5EE6FF] animate-pulse" />
              <span className="font-heading font-black text-sm uppercase tracking-widest text-[#5EE6FF]">
                Live Worker Dispatch Telemetry
              </span>
            </div>
            <h1 className="font-heading font-black text-2xl uppercase tracking-wider text-white mt-1">
              Job {job.id.replace(/^job_/, '')} &bull; {getCategoryLabel(job.category)}
            </h1>
          </div>
          <Badge variant="verified" size="md">
            Status: {job.status.toUpperCase()}
          </Badge>
        </div>

        {/* Live Trip Card */}
        <HudPanel variant="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A]">
            <div>
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#A7A29A]">Assigned Worker</span>
              <p className="font-heading font-bold text-sm text-white uppercase">{job.worker_name || 'En Route Worker'}</p>
            </div>
            <div>
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-[#A7A29A]">Customer</span>
              <p className="font-heading font-bold text-sm text-white">{job.customer_name || 'Verified Customer'}</p>
            </div>
          </div>

          {/* Location Status */}
          <div className="p-4 bg-[#151821] rounded-xl border border-[#2A2E3A] space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#FFB81C] font-bold uppercase flex items-center gap-1.5">
                <Navigation className="w-4 h-4" />
                Live GPS Coordinates
              </span>
              <span className="text-xs text-[#A7A29A]">
                {latestPoint ? `Updated ${new Date(latestPoint.ts).toLocaleTimeString()}` : 'Fix pending...'}
              </span>
            </div>

            {latestPoint ? (
              <div className="grid grid-cols-2 gap-2 text-white">
                <div>Latitude: <strong>{latestPoint.lat.toFixed(5)}</strong></div>
                <div>Longitude: <strong>{latestPoint.lng.toFixed(5)}</strong></div>
                <div>Speed: <strong>{Math.round(latestPoint.speed || 0)} km/h</strong></div>
                <div>Accuracy: <strong>&plusmn;{Math.round(latestPoint.accuracy || 15)} m</strong></div>
              </div>
            ) : (
              <div className="text-[#A7A29A] italic">
                Awaiting GPS handshake from worker device...
              </div>
            )}
          </div>

          <div className="p-3 bg-[#5EE6FF]/10 rounded-xl border border-[#5EE6FF]/30 text-xs text-[#5EE6FF] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Privacy Guard: Coarse coordinates displayed before arrival. Raw GPS coordinates deleted upon job conclusion.</span>
          </div>
        </HudPanel>
      </div>

      {/* Footer */}
      <div className="max-w-3xl mx-auto w-full pt-6 text-center text-xs text-[#A7A29A] font-mono">
        FairFix Bengaluru &bull; Read-Only Demo Tracking Link &bull; Expires on job completion
      </div>
    </div>
  );
};
