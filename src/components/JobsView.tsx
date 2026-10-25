import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ArrowLeft,
  Briefcase
} from 'lucide-react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { getCategoryLabel } from '../config.js';
import { NegotiationThread } from './NegotiationThread.js';
import { Card, TextLink } from './ui/index.js';

interface JobsViewProps {
  selectedJobId?: string | null;
  onSelectJob: (jobId: string | null) => void;
  onNavigate: (route: string) => void;
  forcedRole?: 'customer' | 'worker';
}

export const JobsView: React.FC<JobsViewProps> = ({
  selectedJobId,
  onSelectJob,
  onNavigate,
  forcedRole,
}) => {
  const { currentUser, currentRole } = useDemoUser();
  const effectiveRole = forcedRole || currentRole;

  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const url = effectiveRole === 'customer'
        ? `/api/jobs?customerId=${currentUser.id}`
        : `/api/jobs?workerId=${currentUser.id}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 3000);
    return () => clearInterval(interval);
  }, [currentUser, effectiveRole]);

  // If a job is selected, render the full-screen NegotiationThread with a back button
  if (selectedJobId) {
    return (
      <div className="h-full flex flex-col bg-[#FCF5E8] text-[#2A1B12]">
        <div className="px-6 py-3 bg-[#FFFBF3] border-b border-[#EADFC9] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => onSelectJob(null)}
            className="flex items-center gap-1.5 text-[14px] font-heading font-medium text-[#B5541E] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Jobs</span>
          </button>
          <span className="text-[14px] text-[#6B5B4E]">
            Job {selectedJobId.replace(/^job_/, '')}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <NegotiationThread
            jobId={selectedJobId}
            onClose={() => onSelectJob(null)}
            onJobUpdated={fetchJobs}
          />
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter((j) =>
    ['requested', 'negotiating', 'accepted', 'in_progress'].includes(j.status)
  );
  const pastJobs = jobs.filter((j) =>
    ['completed', 'rated', 'cancelled', 'disputed'].includes(j.status)
  );

  const displayedJobs = activeTab === 'active' ? activeJobs : pastJobs;

  return (
    <div className="w-full max-w-lg mx-auto h-full flex flex-col select-none overflow-hidden px-6 py-4 space-y-6">
      {/* Segmented Control: Active | Past */}
      <div className="flex bg-[#F4EBDA] p-1 rounded-full shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'active'
              ? 'bg-[#B5541E] text-white'
              : 'text-[#6B5B4E] hover:text-[#2A1B12]'
          }`}
        >
          <span>Active</span>
          {activeJobs.length > 0 && (
            <span className={`text-[12px] font-bold ${activeTab === 'active' ? 'text-white' : 'text-[#6B5B4E]'}`}>
              ({activeJobs.length})
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('past')}
          className={`flex-1 h-[36px] rounded-full text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'past'
              ? 'bg-[#B5541E] text-white'
              : 'text-[#6B5B4E] hover:text-[#2A1B12]'
          }`}
        >
          <span>Past</span>
          <span className={`text-[12px] font-bold ${activeTab === 'past' ? 'text-white' : 'text-[#6B5B4E]'}`}>
            ({pastJobs.length})
          </span>
        </button>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto overscroll-contain space-y-3 pr-0.5">
        {displayedJobs.length === 0 ? (
          <div className="p-8 text-center text-[#6B5B4E] space-y-2">
            <Briefcase className="w-8 h-8 mx-auto text-[#6B5B4E]" />
            <p className="font-heading font-bold text-[16px] text-[#2A1B12]">
              {activeTab === 'active' ? 'No active jobs' : 'No past jobs'}
            </p>
            <p className="text-[14px] text-[#6B5B4E]">
              {effectiveRole === 'customer'
                ? 'Your booked repairs will appear here.'
                : 'Assigned customer requests will appear here.'}
            </p>
          </div>
        ) : (
          displayedJobs.map((j) => {
            const latest = j.latest_offer || (j.offers && j.offers[j.offers.length - 1]);
            const isCustomerTurn = ['requested', 'negotiating'].includes(j.status) && latest?.from_role === 'worker';
            const isWorkerTurn = ['requested', 'negotiating'].includes(j.status) && latest?.from_role === 'customer';
            const needsAction = (effectiveRole === 'customer' && isCustomerTurn) || (effectiveRole === 'worker' && isWorkerTurn);
            const needsRating = j.status === 'completed';

            // Plain words status + dot color
            let statusText = 'Pending';
            let dotColor = 'bg-[#B45309]'; // caution
            if (j.status === 'accepted' || j.status === 'in_progress') {
              statusText = j.worker_name ? `${j.worker_name.split(' ')[0]} is on the way` : 'Accepted';
              dotColor = 'bg-[#059669]';
            } else if (j.status === 'negotiating' || j.status === 'requested') {
              statusText = needsAction ? 'Reply needed' : 'Waiting for reply';
              dotColor = 'bg-[#B45309]';
            } else if (j.status === 'completed') {
              statusText = 'Completed';
              dotColor = 'bg-[#059669]';
            } else if (j.status === 'cancelled') {
              statusText = 'Cancelled';
              dotColor = 'bg-[#DC2626]';
            }

            const price = j.agreed_price || latest?.amount || j.offered_price;

            return (
              <div
                key={j.id}
                onClick={() => onSelectJob(j.id)}
                className="p-4 rounded-[20px] bg-[#FFFBF3] border border-[#EADFC9] hover:bg-[#F4EBDA]/40 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {/* Row: "Plumbing, Job 102" (bold) */}
                  <div className="font-heading font-bold text-[16px] text-[#2A1B12] truncate">
                    {getCategoryLabel(j.category)}, Job {j.id.replace(/^job_/, '')}
                  </div>

                  {/* One-line status in plain words with a small status dot */}
                  <div className="flex items-center gap-2 text-[14px] text-[#6B5B4E]">
                    <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
                    <span className="truncate">{statusText}</span>
                  </div>
                </div>

                {/* Right: price, text action (if needed), chevron */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-heading font-bold text-[16px] text-[#2A1B12]">
                      ₹{price}
                    </span>
                    {needsRating && (
                      <div className="text-right">
                        <TextLink onClick={(e) => { e.stopPropagation(); onSelectJob(j.id); }} className="text-[12px] font-semibold">
                          Rate
                        </TextLink>
                      </div>
                    )}
                    {needsAction && (
                      <div className="text-right">
                        <TextLink onClick={(e) => { e.stopPropagation(); onSelectJob(j.id); }} className="text-[12px] font-semibold">
                          Reply
                        </TextLink>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#6B5B4E]" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
