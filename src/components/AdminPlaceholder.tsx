/**
 * FairFix Admin Console: Calm Edition
 * Three or four big numbers at top (StatRow),
 * stacked cards on mobile / sticky headers on desktop,
 * one "Demo data" pill per screen,
 * no yellow, no monospace font, no jargon.
 */
import React, { useState, useEffect } from 'react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { getCategoryLabel } from '../config.js';
import { 
  Card, 
  PrimaryButton, 
  SecondaryButton, 
  TextLink, 
  DemoDataPill, 
  Sheet,
  useToast, 
  formatINR 
} from './ui/index.js';
import { 
  ShieldCheck, 
  Flag, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import { ReportItem, IncidentItem, BandAuditItem } from '../types.js';
import { BatchDispatch } from './BatchDispatch.js';

export interface AdminPlaceholderProps {
  initialSection?: 'queue' | 'reports' | 'bands' | 'dispatch';
  onNavigate?: (route: string) => void;
}

export const AdminPlaceholder: React.FC<AdminPlaceholderProps> = ({ initialSection = 'queue' }) => {
  const { users, refreshUsers } = useDemoUser();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'queue' | 'reports' | 'bands'>(
    initialSection === 'reports' ? 'reports' : initialSection === 'bands' ? 'bands' : 'queue'
  );

  useEffect(() => {
    if (initialSection === 'reports') setActiveTab('reports');
    else if (initialSection === 'bands') setActiveTab('bands');
    else if (initialSection === 'queue') setActiveTab('queue');
  }, [initialSection]);

  if (initialSection === 'dispatch') {
    return <BatchDispatch />;
  }

  // Queues
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditLog, setAuditLog] = useState<BandAuditItem[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);

  // Action states
  const [rejectingWorkerId, setRejectingWorkerId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const workers = users.filter((u) => u.role === 'worker');
  const verifiedCount = workers.filter((w) => w.verification_status === 'verified').length;
  const pendingCount = workers.filter((w) => w.verification_status === 'pending').length;
  const activeReportsCount = reports.filter((r) => r.status === 'pending').length;
  const activeIncidentsCount = incidents.filter((i) => i.status === 'active').length;

  const fetchQueues = async () => {
    try {
      const [incRes, repRes, snapRes, auditRes] = await Promise.all([
        fetch('/api/admin/incidents'),
        fetch('/api/admin/reports'),
        fetch('/api/admin/snapshots'),
        fetch('/api/admin/price-band-audit'),
      ]);

      if (incRes.ok) setIncidents(await incRes.json());
      if (repRes.ok) setReports(await repRes.json());
      if (snapRes.ok) setSnapshots(await snapRes.json());
      if (auditRes.ok) setAuditLog(await auditRes.json());
    } catch (err) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchQueues();
    const interval = setInterval(fetchQueues, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (workerId: string, status: 'verified' | 'rejected', reason?: string) => {
    if (status === 'rejected' && !reason?.trim()) {
      showToast({ title: 'Reason required', message: 'Please specify the rejection reason.', type: 'danger' });
      return;
    }

    try {
      const res = await fetch(`/api/workers/${workerId}/verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      await refreshUsers();
      setRejectingWorkerId(null);
      setRejectReason('');
      showToast({
        title: `Worker ${status === 'verified' ? 'Verified' : 'Rejected'}`,
        message: status === 'verified' ? 'Worker verification badge granted.' : 'Worker status set to rejected.',
        type: status === 'verified' ? 'fair' : 'caution',
      });
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col justify-between overflow-hidden select-none px-6 py-4 space-y-6">
      {/* Header + Demo Data Pill */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-h2">
            Operations Console
          </h1>
          <DemoDataPill />
        </div>
        <p className="text-[14px] text-[#6B5B4E]">
          Worker verification, customer reports, and price band audit.
        </p>
      </div>

      {/* Top 4 Big Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2 border-y border-[#EADFC9]">
        <div>
          <div className="font-heading font-extrabold text-[28px] text-[#B5541E]">
            {verifiedCount}
          </div>
          <div className="text-[12px] text-[#6B5B4E]">
            Verified workers
          </div>
        </div>

        <div>
          <div className="font-heading font-extrabold text-[28px] text-[#B5541E]">
            {pendingCount}
          </div>
          <div className="text-[12px] text-[#6B5B4E]">
            Pending verifications
          </div>
        </div>

        <div>
          <div className="font-heading font-extrabold text-[28px] text-[#B5541E]">
            {activeReportsCount}
          </div>
          <div className="text-[12px] text-[#6B5B4E]">
            Safety reports
          </div>
        </div>

        <div>
          <div className="font-heading font-extrabold text-[28px] text-[#B5541E]">
            {activeIncidentsCount}
          </div>
          <div className="text-[12px] text-[#6B5B4E]">
            Active alerts
          </div>
        </div>
      </div>

      {/* Sub-nav tabs */}
      <div className="flex bg-[#F4EBDA] p-1 rounded-full shrink-0 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('queue')}
          className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-[#B5541E] text-white'
              : 'text-[#6B5B4E] hover:text-[#2A1B12]'
          }`}
        >
          Queue
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-[#B5541E] text-white'
              : 'text-[#6B5B4E] hover:text-[#2A1B12]'
          }`}
        >
          Reports
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bands')}
          className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
            activeTab === 'bands'
              ? 'bg-[#B5541E] text-white'
              : 'text-[#6B5B4E] hover:text-[#2A1B12]'
          }`}
        >
          Bands
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* 1. Queue: Worker Verifications & Safety Alerts */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-[18px] text-[#2A1B12]">
              Worker verifications
            </h3>

            {workers.map((w) => {
              const isVerified = w.verification_status === 'verified';
              const isPending = w.verification_status === 'pending';

              return (
                <div
                  key={w.id}
                  className="p-4 rounded-[20px] bg-[#FFFBF3] border border-[#EADFC9] space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-heading font-bold text-[16px] text-[#2A1B12]">
                        {w.name}
                      </div>
                      <div className="text-[12px] text-[#6B5B4E]">
                        {(w.categories && w.categories[0]) || 'Tradesperson'} &bull; Base rate: ₹{w.base_rate}
                      </div>
                    </div>

                    <span className={`text-[12px] font-medium px-2.5 py-0.5 rounded-full ${
                      isVerified
                        ? 'bg-[rgba(5,150,105,0.1)] text-[#059669]'
                        : isPending
                        ? 'bg-[rgba(180,83,9,0.1)] text-[#B45309]'
                        : 'bg-[#F4EBDA] text-[#6B5B4E]'
                    }`}>
                      {w.verification_status || 'unverified'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#EADFC9]">
                    {!isVerified ? (
                      <PrimaryButton
                        className="!h-[36px] !text-[12px] px-4"
                        onClick={() => handleUpdateStatus(w.id, 'verified')}
                      >
                        Verify worker
                      </PrimaryButton>
                    ) : (
                      <SecondaryButton
                        className="!h-[36px] !text-[12px] px-4 text-[#DC2626] border-[#DC2626]"
                        onClick={() => handleUpdateStatus(w.id, 'rejected', 'Verification revoked by admin')}
                      >
                        Revoke status
                      </SecondaryButton>
                    )}

                    <TextLink
                      onClick={() => setRejectingWorkerId(w.id)}
                      className="text-[12px] text-[#6B5B4E]"
                    >
                      Reject with note
                    </TextLink>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 2. Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-[18px] text-[#2A1B12]">
              Customer reports
            </h3>

            {reports.length === 0 ? (
              <p className="text-[14px] text-[#6B5B4E] py-4">
                No customer safety reports filed.
              </p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-[20px] bg-[#FFFBF3] border border-[#EADFC9] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-[14px] text-[#DC2626] capitalize">
                      {r.reason}
                    </span>
                    <span className="text-[12px] text-[#6B5B4E]">
                      Job {r.job_id.replace(/^job_/, '')}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#2A1B12]">
                    {r.details || 'No details provided'}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Bands */}
        {activeTab === 'bands' && (
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-[18px] text-[#2A1B12]">
              Price band audit
            </h3>

            <div className="space-y-3">
              {auditLog.map((log, idx) => (
                <div
                  key={`${log.job_id}-${idx}`}
                  className="p-4 rounded-[20px] bg-[#FFFBF3] border border-[#EADFC9] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-[14px] text-[#2A1B12]">
                      {getCategoryLabel(log.category)}
                    </span>
                    <span className="text-[12px] text-[#B45309]">
                      Unusual price excluded
                    </span>
                  </div>
                  <p className="text-[12px] text-[#6B5B4E]">
                    {log.reason}: {log.details} &bull; Amount: ₹{log.agreed_price}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject Sheet */}
      <Sheet
        isOpen={Boolean(rejectingWorkerId)}
        onClose={() => setRejectingWorkerId(null)}
        title="Reject verification"
      >
        <div className="space-y-4">
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejecting verification..."
            className="w-full bg-[#FCF5E8] border border-[#EADFC9] rounded-[16px] p-3 text-xs text-[#2A1B12] focus:outline-none"
          />
          <PrimaryButton
            fullWidth
            onClick={() => rejectingWorkerId && handleUpdateStatus(rejectingWorkerId, 'rejected', rejectReason)}
          >
            Confirm rejection
          </PrimaryButton>
        </div>
      </Sheet>
    </div>
  );
};
