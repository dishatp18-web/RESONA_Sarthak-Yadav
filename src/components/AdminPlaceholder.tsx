/**
 * FairFix Operations Console - "Mark III Forge" Edition
 * Comprehensive Trust, Safety, Verification & Anti-Gaming Audit Command Center
 * Features:
 * - Real-time stat cards with count-up animations
 * - Highest-priority Safety Incident queue with coordinates and resolve action
 * - Worker Document Verification Queue with document preview modal, Approve, and Reject with mandatory reason
 * - Flagged Workers Moderation Queue with Clear and Suspend actions
 * - Customer Service Reports Queue with distinct customer threshold tracking
 * - Price Band Snapshots Monitor (by category and neighborhood area)
 * - Price Band Audit Log (showing excluded jobs for outliers, pair frequency cap, and 10% weekly shift bound)
 */
import React, { useState, useEffect } from 'react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { getCategoryLabel } from '../config.js';
import { 
  HudPanel, 
  Badge, 
  StatCard, 
  ForgeButton, 
  useToast, 
  formatINR,
  EmptyState 
} from './ui/index.js';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  Lock,
  UserCheck,
  AlertOctagon,
  Check,
  ShieldAlert,
  Flag,
  Eye,
  TrendingUp,
  Activity,
  Layers,
  Info,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { ReportItem, IncidentItem, BandAuditItem } from '../types.js';

export const AdminPlaceholder: React.FC = () => {
  const { users, refreshUsers } = useDemoUser();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'verification' | 'incidents' | 'flagged' | 'reports' | 'band_monitor' | 'audit_log'>('verification');

  // Operation queues
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [auditLog, setAuditLog] = useState<BandAuditItem[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loadingQueues, setLoadingQueues] = useState(false);

  // Action modals
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rejectingWorkerId, setRejectingWorkerId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  const workers = users.filter((u) => u.role === 'worker');
  const verifiedCount = workers.filter((w) => w.verification_status === 'verified').length;
  const pendingCount = workers.filter((w) => w.verification_status === 'pending').length;
  const unverifiedCount = workers.filter((w) => w.verification_status === 'unverified').length;
  const rejectedCount = workers.filter((w) => w.verification_status === 'rejected').length;
  const flaggedWorkers = workers.filter((w) => w.is_flagged);
  const activeIncidents = incidents.filter((i) => i.status === 'active');

  const fetchQueues = async () => {
    try {
      setLoadingQueues(true);
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
      console.error('Error fetching admin queues:', err);
    } finally {
      setLoadingQueues(false);
    }
  };

  useEffect(() => {
    fetchQueues();
    const interval = setInterval(fetchQueues, 4000);
    return () => clearInterval(interval);
  }, []);

  // Worker Verification: Approve or Reject
  const handleUpdateStatus = async (workerId: string, status: 'verified' | 'rejected', reason?: string) => {
    if (status === 'rejected' && (!reason || !reason.trim())) {
      showToast({ title: 'Rejection Reason Required', message: 'Please specify the rejection reason for the worker.', type: 'danger' });
      return;
    }

    setUpdatingId(workerId);
    try {
      const res = await fetch(`/api/workers/${workerId}/verification`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update verification status');

      await refreshUsers();
      setRejectingWorkerId(null);
      setRejectReason('');
      showToast({
        title: `Worker ${status === 'verified' ? 'Approved' : 'Rejected'}`,
        message: status === 'verified' 
          ? 'Worker verification badge granted and ranking boost applied.' 
          : `Worker rejected: "${reason}". Status and explanation sent to worker.`,
        type: status === 'verified' ? 'fair' : 'caution',
      });
    } catch (err) {
      showToast({ title: 'Verification Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setUpdatingId(null);
    }
  };

  // Flag Action: Clear or Suspend
  const handleFlagAction = async (workerId: string, action: 'clear' | 'suspend') => {
    try {
      const res = await fetch(`/api/admin/workers/${workerId}/flag-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to perform flag action');

      await refreshUsers();
      showToast({
        title: `Worker ${action === 'clear' ? 'Cleared' : 'Suspended'}`,
        message: data.message,
        type: action === 'clear' ? 'fair' : 'danger',
      });
    } catch (err) {
      showToast({ title: 'Moderation Error', message: (err as Error).message, type: 'danger' });
    }
  };

  // Resolve Safety Incident
  const handleResolveIncident = async (incidentId: string) => {
    try {
      const res = await fetch(`/api/admin/incidents/${incidentId}/resolve`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to resolve incident');
      showToast({ title: 'Incident Resolved', message: 'Safety incident closed.', type: 'fair' });
      fetchQueues();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Admin Header */}
      <HudPanel variant="default" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="fair" size="sm">
              Operations Console
            </Badge>
            <Badge variant="neutral" size="sm">
              Demo data
            </Badge>
            <span className="text-[10px] text-[#5EE6FF] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5EE6FF] animate-pulse" />
              Live 4s Polling
            </span>
          </div>
          <h1 className="font-heading text-xl sm:text-2xl font-black text-white tracking-wider uppercase mt-1">
            Platform Trust &amp; Verification Command Center
          </h1>
          <p className="text-xs sm:text-sm text-[#A7A29A] mt-1 font-sans">
            Worker document verification, incident safety arbitration, anti-gaming audit, and market price band stability.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-[#07070A] p-2.5 rounded-xl border border-[#2A2E3A] font-mono">
          <Lock className="w-4 h-4 text-[#5EE6FF]" />
          <span className="text-[#F4F1EC]">Vikram Sen (Operations Administrator)</span>
        </div>
      </HudPanel>

      {/* TOP PRIORITY SAFETY INCIDENTS ALERT (When active incidents exist) */}
      {activeIncidents.length > 0 && (
        <div className="p-4 bg-[#FF5C6C]/15 border-2 border-[#FF5C6C] rounded-xl space-y-3 shadow-[0_0_25px_rgba(255,92,108,0.3)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-[#FF5C6C]">
              <ShieldAlert className="w-6 h-6 shrink-0 animate-bounce" />
              <div>
                <h3 className="font-heading font-black text-sm uppercase tracking-wider text-white">
                  URGENT: Active Safety Incidents Requiring Dispatch ({activeIncidents.length})
                </h3>
                <p className="text-[11px] text-[#FF5C6C] font-mono">
                  This does not contact emergency services. In an emergency dial 112.
                </p>
              </div>
            </div>
            <Badge variant="danger" size="sm">
              TOP PRIORITY
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {activeIncidents.map((inc) => (
              <div key={inc.id} className="p-3 bg-[#07070A] rounded-xl border border-[#FF5C6C]/50 text-xs space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-white font-bold">{inc.id} &bull; Job {inc.job_id.replace(/^job_/, '')}</span>
                  <span className="text-[#FF5C6C] font-bold text-[10px] uppercase">Active Alert</span>
                </div>
                <p className="text-[#F4F1EC] font-sans">{inc.details || 'Emergency alert raised by customer on site.'}</p>
                <div className="p-2 bg-[#151821] rounded font-mono text-[11px] text-[#A7A29A] flex items-center justify-between">
                  <span>GPS: {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}</span>
                  <span>Reported by: <strong>{inc.reporter_name || inc.reported_by}</strong></span>
                </div>
                <div className="flex justify-end pt-1">
                  <ForgeButton
                    variant="primary"
                    size="sm"
                    icon={Check}
                    onClick={() => handleResolveIncident(inc.id)}
                  >
                    Mark Incident Resolved
                  </ForgeButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real Count Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          label="Verified Workers"
          value={verifiedCount}
          icon={CheckCircle2}
          subtext="Priority match ranking"
        />
        <StatCard
          label="Pending Review"
          value={pendingCount}
          icon={Clock}
          subtext="Awaiting manual audit"
        />
        <StatCard
          label="Flagged Under Review"
          value={flaggedWorkers.length}
          icon={AlertTriangle}
          subtext="3+ customer reports"
        />
        <StatCard
          label="Active Safety Alerts"
          value={activeIncidents.length}
          icon={ShieldAlert}
          subtext="Top priority incidents"
        />
        <StatCard
          label="Reports Logged"
          value={reports.length}
          icon={Flag}
          subtext="Customer dispute log"
        />
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#2A2E3A] pb-2 font-heading text-xs uppercase tracking-wider font-bold">
        <button
          onClick={() => setActiveTab('verification')}
          className={`px-3 py-2 rounded-lg cursor-pointer transition ${
            activeTab === 'verification'
              ? 'bg-[#FFB81C] text-black shadow-[0_0_12px_rgba(255,184,28,0.4)]'
              : 'text-[#A7A29A] hover:text-white bg-[#07070A]'
          }`}
        >
          Document Verification ({pendingCount} Pending)
        </button>
        <button
          onClick={() => setActiveTab('flagged')}
          className={`px-3 py-2 rounded-lg cursor-pointer transition ${
            activeTab === 'flagged'
              ? 'bg-[#FFB81C] text-black shadow-[0_0_12px_rgba(255,184,28,0.4)]'
              : 'text-[#A7A29A] hover:text-white bg-[#07070A]'
          }`}
        >
          Flagged Workers ({flaggedWorkers.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-2 rounded-lg cursor-pointer transition ${
            activeTab === 'reports'
              ? 'bg-[#FFB81C] text-black shadow-[0_0_12px_rgba(255,184,28,0.4)]'
              : 'text-[#A7A29A] hover:text-white bg-[#07070A]'
          }`}
        >
          Reports Queue ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-3 py-2 rounded-lg cursor-pointer transition ${
            activeTab === 'incidents'
              ? 'bg-[#FFB81C] text-black shadow-[0_0_12px_rgba(255,184,28,0.4)]'
              : 'text-[#A7A29A] hover:text-white bg-[#07070A]'
          }`}
        >
          Safety Incidents ({incidents.length})
        </button>
        <button
          onClick={() => setActiveTab('band_monitor')}
          className={`px-3 py-2 rounded-lg cursor-pointer transition ${
            activeTab === 'band_monitor'
              ? 'bg-[#FFB81C] text-black shadow-[0_0_12px_rgba(255,184,28,0.4)]'
              : 'text-[#A7A29A] hover:text-white bg-[#07070A]'
          }`}
        >
          Price Band Snapshots ({snapshots.length})
        </button>
        <button
          onClick={() => setActiveTab('audit_log')}
          className={`px-3 py-2 rounded-lg cursor-pointer transition ${
            activeTab === 'audit_log'
              ? 'bg-[#FFB81C] text-black shadow-[0_0_12px_rgba(255,184,28,0.4)]'
              : 'text-[#A7A29A] hover:text-white bg-[#07070A]'
          }`}
        >
          Anti-Gaming Audit Log ({auditLog.length})
        </button>
      </div>

      {/* 1. DOCUMENT VERIFICATION QUEUE */}
      {activeTab === 'verification' && (
        <HudPanel variant="default" className="p-0 overflow-hidden space-y-0">
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2E3A]">
            <div>
              <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                Worker Trust &amp; Document Registry
              </h3>
              <p className="text-[11px] text-[#FFB81C] mt-0.5 font-sans font-medium">
                Documents are reviewed manually by an admin. No automated ID check or government API is integrated.
              </p>
            </div>
            <Badge variant="info" size="sm">
              {workers.length} Workers Registered
            </Badge>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#07070A] text-[#A7A29A] font-heading font-bold uppercase tracking-wider border-b border-[#2A2E3A] z-10">
                <tr>
                  <th className="py-3 px-4">Worker Name</th>
                  <th className="py-3 px-4">Trade</th>
                  <th className="py-3 px-4">Base Rate</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Document on File</th>
                  <th className="py-3 px-4 text-right">Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2E3A] text-slate-300 font-sans">
                {workers.map((w) => (
                  <tr key={w.id} className="hover:bg-[#151821] transition">
                    <td className="py-3.5 px-4 font-heading font-bold text-white uppercase tracking-wider">
                      {w.name}
                      {w.is_flagged && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#FFB81C]/20 text-[#FFB81C] font-heading uppercase font-bold border border-[#FFB81C]/30">
                          Under review
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {(w.categories || []).map((c) => getCategoryLabel(c)).join(', ')}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white tabular-nums">
                      {formatINR(w.base_rate || 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      {w.verification_status === 'verified' ? (
                        <Badge variant="verified" size="sm">
                          Verified
                        </Badge>
                      ) : w.verification_status === 'pending' ? (
                        <Badge variant="caution" size="sm" icon={Clock}>
                          Pending Review
                        </Badge>
                      ) : w.verification_status === 'rejected' ? (
                        <Badge variant="danger" size="sm" icon={XCircle}>
                          Rejected
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Unverified
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {w.verification_doc_path ? (
                        <button
                          onClick={() => setPreviewDocUrl(w.verification_doc_path || null)}
                          className="flex items-center gap-1 text-[#5EE6FF] hover:underline cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{w.verification_doc_path.split('/').pop()}</span>
                          <Eye className="w-3 h-3 ml-1" />
                        </button>
                      ) : (
                        <span className="text-[#6F6B65] italic">No document uploaded</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {w.verification_status !== 'verified' && (
                          <button
                            onClick={() => handleUpdateStatus(w.id, 'verified')}
                            disabled={updatingId === w.id}
                            className="px-2 py-1 rounded bg-[#5EE6FF]/15 hover:bg-[#5EE6FF]/25 text-[#5EE6FF] border border-[#5EE6FF]/30 font-heading text-[10px] uppercase font-bold cursor-pointer"
                          >
                            Approve
                          </button>
                        )}
                        {w.verification_status !== 'rejected' && (
                          <button
                            onClick={() => {
                              setRejectingWorkerId(w.id);
                              setRejectReason('Trade credentials did not meet Bangalore district verification guidelines.');
                            }}
                            disabled={updatingId === w.id}
                            className="px-2 py-1 rounded bg-[#FF5C6C]/15 hover:bg-[#FF5C6C]/25 text-[#FF5C6C] border border-[#FF5C6C]/30 font-heading text-[10px] uppercase font-bold cursor-pointer"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HudPanel>
      )}

      {/* 2. FLAGGED WORKERS QUEUE */}
      {activeTab === 'flagged' && (
        <HudPanel variant="default" className="space-y-4">
          <div>
            <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
              Flagged Workers Moderation Queue ({flaggedWorkers.length})
            </h3>
            <p className="text-[11px] text-[#A7A29A] mt-0.5 font-sans">
              Workers are auto-flagged after 3 reports from 3 DISTINCT customers. Flagged workers show an &ldquo;Under review&rdquo; chip and rank last in customer matching.
            </p>
          </div>

          {flaggedWorkers.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Flagged Workers"
              description="No workers currently exceed the 3-distinct-customer report threshold."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {flaggedWorkers.map((w) => (
                <div key={w.id} className="p-4 bg-[#07070A] rounded-xl border border-[#FFB81C]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-white uppercase tracking-wider">{w.name}</h4>
                      <p className="text-xs text-[#A7A29A]">Trade: {(w.categories || []).map(getCategoryLabel).join(', ')}</p>
                    </div>
                    <Badge variant="caution" size="sm">
                      Under review
                    </Badge>
                  </div>

                  <div className="p-2.5 bg-[#151821] rounded font-mono text-[11px] text-[#A7A29A] space-y-1">
                    <div>Status: <strong>Ranks Last in Matching Radar</strong></div>
                    <div>Rating: {w.rating_avg || 0} ★ &bull; Jobs Completed: {w.jobs_completed || 0}</div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#2A2E3A]">
                    <ForgeButton
                      variant="ghost"
                      size="sm"
                      onClick={() => handleFlagAction(w.id, 'clear')}
                    >
                      Clear Flag
                    </ForgeButton>
                    <ForgeButton
                      variant="danger"
                      size="sm"
                      onClick={() => handleFlagAction(w.id, 'suspend')}
                    >
                      Suspend Worker
                    </ForgeButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HudPanel>
      )}

      {/* 3. REPORTS QUEUE */}
      {activeTab === 'reports' && (
        <HudPanel variant="default" className="space-y-4">
          <div>
            <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
              Customer Reports &amp; Grievance Queue ({reports.length})
            </h3>
            <p className="text-[11px] text-[#A7A29A] mt-0.5 font-sans">
              Reports filed by customers across completed or active jobs.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#07070A] text-[#A7A29A] font-heading font-bold uppercase tracking-wider border-b border-[#2A2E3A]">
                <tr>
                  <th className="py-3 px-3">Report ID</th>
                  <th className="py-3 px-3">Job</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Worker Reported</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3">Details</th>
                  <th className="py-3 px-3">Logged At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2E3A] text-slate-300 font-sans">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-[#151821]">
                    <td className="py-3 px-3 font-mono font-bold text-white">{r.id}</td>
                    <td className="py-3 px-3 font-mono text-[#5EE6FF]">Job {r.job_id.replace(/^job_/, '')}</td>
                    <td className="py-3 px-3">{r.reporter_name || r.reporter_id}</td>
                    <td className="py-3 px-3 font-heading font-bold text-white uppercase">{r.worker_name || r.worker_id}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-[#FF5C6C]/15 text-[#FF5C6C] font-heading text-[10px] uppercase font-bold border border-[#FF5C6C]/30">
                        {r.reason}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#A7A29A] max-w-xs truncate">{r.details || '—'}</td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#6F6B65]">
                      {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HudPanel>
      )}

      {/* 4. SAFETY INCIDENTS QUEUE */}
      {activeTab === 'incidents' && (
        <HudPanel variant="default" className="space-y-4">
          <div>
            <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
              Safety Alerts &amp; Emergency Queue ({incidents.length})
            </h3>
            <p className="text-[11px] text-[#A7A29A] mt-0.5 font-sans">
              Notice: Platform safety alerts do not contact emergency services. In an emergency dial 112.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`p-4 rounded-xl border text-xs space-y-2 ${
                  inc.status === 'active'
                    ? 'bg-[#FF5C6C]/15 border-[#FF5C6C]/50'
                    : 'bg-[#07070A] border-[#2A2E3A] opacity-75'
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="text-white font-bold">{inc.id}</span>
                  <Badge variant={inc.status === 'active' ? 'danger' : 'neutral'} size="sm">
                    {inc.status === 'active' ? 'ACTIVE' : 'RESOLVED'}
                  </Badge>
                </div>
                <p className="text-white font-sans">{inc.details}</p>
                <div className="p-2 bg-[#07070A] rounded font-mono text-[11px] text-[#A7A29A] space-y-0.5">
                  <div>GPS: {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}</div>
                  <div>Reported By: {inc.reporter_name || inc.reported_by}</div>
                </div>
                {inc.status === 'active' && (
                  <div className="flex justify-end pt-1">
                    <ForgeButton
                      variant="primary"
                      size="sm"
                      onClick={() => handleResolveIncident(inc.id)}
                    >
                      Mark Resolved
                    </ForgeButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </HudPanel>
      )}

      {/* 5. PRICE BAND SNAPSHOTS MONITOR */}
      {activeTab === 'band_monitor' && (
        <HudPanel variant="default" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
                Price Band Telemetry Monitor
              </h3>
              <p className="text-[11px] text-[#A7A29A] mt-0.5 font-sans">
                Real-time snapshots computed from completed historical jobs by category and micro-market area.
              </p>
            </div>
            <Badge variant="fair" size="sm">
              Live IQR Band
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#07070A] text-[#A7A29A] font-heading font-bold uppercase tracking-wider border-b border-[#2A2E3A]">
                <tr>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Area Key</th>
                  <th className="py-3 px-3">Low (25th)</th>
                  <th className="py-3 px-3 text-[#FFB81C]">Typical (Median)</th>
                  <th className="py-3 px-3">High (75th)</th>
                  <th className="py-3 px-3">Jobs Sampled</th>
                  <th className="py-3 px-3">Confidence</th>
                  <th className="py-3 px-3">Snapshot Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2E3A] text-slate-300 font-sans">
                {snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-[#151821]">
                    <td className="py-3 px-3 font-heading font-bold text-white uppercase">{getCategoryLabel(s.category)}</td>
                    <td className="py-3 px-3 font-mono text-[#5EE6FF] text-[11px]">{s.area_key}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-white">{formatINR(s.low)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-[#FFB81C] tabular-nums">{formatINR(s.typical)}</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-white">{formatINR(s.high)}</td>
                    <td className="py-3 px-3 font-mono">{s.job_count} completed</td>
                    <td className="py-3 px-3">
                      <Badge variant={s.confidence === 'high' ? 'fair' : 'caution'} size="sm">
                        {s.confidence}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-[#6F6B65]">
                      {new Date(s.computed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HudPanel>
      )}

      {/* 6. ANTI-GAMING AUDIT LOG */}
      {activeTab === 'audit_log' && (
        <HudPanel variant="default" className="space-y-4">
          <div>
            <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
              Anti-Gaming &amp; Statistical Exclusion Audit Log ({auditLog.length})
            </h3>
            <p className="text-[11px] text-[#A7A29A] mt-0.5 font-sans">
              Full algorithmic audit log showing which seed or real completed jobs were excluded from fair price band calculations and why.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#07070A] text-[#A7A29A] font-heading font-bold uppercase tracking-wider border-b border-[#2A2E3A]">
                <tr>
                  <th className="py-3 px-3">Job ID</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Agreed Price</th>
                  <th className="py-3 px-3">Exclusion Rule</th>
                  <th className="py-3 px-3">Algorithmic Justification</th>
                  <th className="py-3 px-3">Data Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2E3A] text-slate-300 font-sans">
                {auditLog.map((item, idx) => (
                  <tr key={`${item.job_id}_${idx}`} className="hover:bg-[#151821]">
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      Job {item.job_id.replace(/^job_/, '')}
                    </td>
                    <td className="py-3 px-3 font-heading uppercase text-white font-bold">
                      {getCategoryLabel(item.category)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#FFB81C] tabular-nums">
                      {formatINR(item.agreed_price)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-heading text-[10px] uppercase font-bold border ${
                        item.reason === 'outlier'
                          ? 'bg-[#FF5C6C]/15 text-[#FF5C6C] border-[#FF5C6C]/30'
                          : item.reason === 'pair_cap'
                          ? 'bg-[#FFB81C]/15 text-[#FFB81C] border-[#FFB81C]/30'
                          : 'bg-[#5EE6FF]/15 text-[#5EE6FF] border-[#5EE6FF]/30'
                      }`}>
                        {item.reason === 'outlier' ? 'IQR Outlier' : item.reason === 'pair_cap' ? 'Pair Cap' : 'Weekly 10% Bound'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#A7A29A] font-sans text-[11px] leading-relaxed max-w-md">
                      {item.details}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="neutral" size="sm">
                        {item.is_seed ? 'Demo seed job' : 'Real job'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </HudPanel>
      )}

      {/* REJECTION REASON MODAL */}
      {rejectingWorkerId && (
        <div className="fixed inset-0 z-50 bg-[#07070A]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1016] border border-[#FF5C6C] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#FF5C6C]">
                <XCircle className="w-5 h-5" />
                <h3 className="font-heading font-bold uppercase tracking-wider text-white">
                  Reject Worker Verification
                </h3>
              </div>
              <button onClick={() => setRejectingWorkerId(null)} className="text-[#A7A29A] hover:text-white text-xs">
                Cancel
              </button>
            </div>

            <p className="text-xs text-[#A7A29A] font-sans">
              Provide a specific rejection reason. The worker will see this reason in their portal so they can upload a corrected credential.
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document image blurred; ID address does not match Bengaluru district..."
              className="w-full bg-[#07070A] border border-[#2A2E3A] rounded-xl p-3 text-xs text-white placeholder-[#6F6B65] focus:outline-none focus:border-[#FF5C6C]"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingWorkerId(null)}
                className="px-3 py-1.5 text-xs text-[#A7A29A] hover:text-white"
              >
                Dismiss
              </button>
              <ForgeButton
                variant="danger"
                size="sm"
                disabled={updatingId === rejectingWorkerId || !rejectReason.trim()}
                loading={updatingId === rejectingWorkerId}
                onClick={() => handleUpdateStatus(rejectingWorkerId, 'rejected', rejectReason)}
              >
                Confirm Rejection
              </ForgeButton>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-[#07070A]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1016] border border-[#5EE6FF]/50 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#5EE6FF]">
                <FileText className="w-5 h-5" />
                <h3 className="font-heading font-bold uppercase tracking-wider text-white">
                  Document Preview (Manual Admin Inspection)
                </h3>
              </div>
              <button onClick={() => setPreviewDocUrl(null)} className="text-[#A7A29A] hover:text-white text-xs">
                Close
              </button>
            </div>

            <div className="p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A] font-mono text-xs text-slate-300 space-y-1">
              <div>File: <strong className="text-white">{previewDocUrl.split('/').pop()}</strong></div>
              <div className="text-[11px] text-[#A7A29A]">Access: Role-restricted to Admin and Document Owner</div>
            </div>

            <div className="h-64 bg-[#07070A] rounded-xl border border-[#2A2E3A] flex flex-col items-center justify-center p-4 text-center space-y-3">
              <FileText className="w-12 h-12 text-[#5EE6FF]/60" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-white uppercase font-heading">
                  Document Stored in /uploads
                </p>
                <p className="text-[11px] text-[#A7A29A] font-sans">
                  Masked credential verified for compliance.
                </p>
              </div>
              <a
                href={`${previewDocUrl}?role=admin&userId=admin_1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5EE6FF]/20 hover:bg-[#5EE6FF]/30 text-[#5EE6FF] border border-[#5EE6FF]/40 text-xs font-heading font-bold uppercase"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Raw Document File</span>
              </a>
            </div>

            <div className="text-[11px] text-[#6F6B65] font-sans italic">
              Notice: Documents are reviewed manually by an admin. No automated ID check or government API is integrated. Demo role switcher is not real authentication.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
