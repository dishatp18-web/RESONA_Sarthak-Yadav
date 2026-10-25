import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Zap, 
  Sparkles, 
  Fan, 
  Hammer, 
  Utensils, 
  ChevronRight 
} from 'lucide-react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { SERVICE_CATEGORIES, NEIGHBORHOODS } from '../config.js';
import { PriceBandResult } from '../types.js';
import { PrimaryButton, StatRow, Card, TextLink } from './ui/index.js';

interface CustomerHomeProps {
  onSelectCategoryAndBook: (catId: string) => void;
  onOpenBook: () => void;
  onNavigate: (route: string) => void;
}

const CATEGORY_ITEMS = [
  { id: 'plumbing', name: 'Plumber', icon: Wrench },
  { id: 'electrician', name: 'Electrician', icon: Zap },
  { id: 'cleaning', name: 'Cleaning', icon: Sparkles },
  { id: 'appliance', name: 'Appliances', icon: Fan },
  { id: 'carpentry', name: 'Carpentry', icon: Hammer },
  { id: 'cook_maid', name: 'Cook & Maid', icon: Utensils },
];

export const CustomerHome: React.FC<CustomerHomeProps> = ({
  onSelectCategoryAndBook,
  onOpenBook,
  onNavigate,
}) => {
  const { currentUser } = useDemoUser();

  const [selectedCategory, setSelectedCategory] = useState<string>('plumbing');
  const [band, setBand] = useState<PriceBandResult | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [workersNearbyCount, setWorkersNearbyCount] = useState<number>(8);
  const [verifiedCount, setVerifiedCount] = useState<number>(14);

  const firstName = currentUser?.name?.split(' ')[0] || 'Arvind';
  const lat = currentUser?.lat || NEIGHBORHOODS[0].lat;
  const lng = currentUser?.lng || NEIGHBORHOODS[0].lng;

  // 1. Fetch live price band for selected category
  useEffect(() => {
    let isCancelled = false;
    const fetchBand = async () => {
      try {
        const res = await fetch(`/api/price-band?category=${selectedCategory}&lat=${lat}&lng=${lng}&price=450&perspective=customer`);
        if (!res.ok) return;
        const data = await res.json();
        if (!isCancelled && data.band) {
          setBand(data.band);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchBand();
    return () => { isCancelled = true; };
  }, [selectedCategory, lat, lng]);

  // 2. Fetch live workers (within 5 km & total verified)
  useEffect(() => {
    let isCancelled = false;
    const fetchWorkers = async () => {
      try {
        // Use matching endpoint
        const matchRes = await fetch(`/api/matching?lat=${lat}&lng=${lng}&category=${selectedCategory}&radius_km=5`);
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          if (!isCancelled && Array.isArray(matchData.workers)) {
            setWorkersNearbyCount(matchData.workers.length);
          }
        }
        // Fetch all users to count verified workers
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const users = await usersRes.json();
          const verified = users.filter((u: any) => u.role === 'worker' && u.verified).length;
          if (!isCancelled && verified > 0) {
            setVerifiedCount(verified);
          }
        }
      } catch (err) {
        // Fallback
      }
    };
    fetchWorkers();
    return () => { isCancelled = true; };
  }, [lat, lng, selectedCategory]);

  // 3. Fetch active job (if relevant)
  useEffect(() => {
    let isCancelled = false;
    const fetchActiveJob = async () => {
      if (!currentUser) return;
      try {
        const res = await fetch(`/api/jobs?customerId=${currentUser.id}`);
        if (!res.ok) return;
        const jobs = await res.json();
        const active = jobs.find((j: any) => 
          ['requested', 'negotiating', 'accepted', 'in_progress', 'completed'].includes(j.status)
        );
        if (!isCancelled) {
          setActiveJob(active || null);
        }
      } catch (err) {
        // Fallback
      }
    };

    fetchActiveJob();
    const interval = setInterval(fetchActiveJob, 4000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [currentUser]);

  // Determine active job phrasing & action
  const getActiveJobInfo = () => {
    if (!activeJob) return null;
    const workerName = activeJob.worker_name ? activeJob.worker_name.split(' ')[0] : 'Worker';

    if (activeJob.status === 'in_progress' || activeJob.status === 'accepted') {
      return {
        text: `${workerName} is on the way`,
        actionText: 'View status',
        onClick: () => onNavigate(`#/jobs/${activeJob.id}`),
      };
    }
    if (activeJob.status === 'requested' || activeJob.status === 'negotiating') {
      const latestOffer = activeJob.latest_offer || (activeJob.offers && activeJob.offers[activeJob.offers.length - 1]);
      if (latestOffer?.from_role === 'worker') {
        return {
          text: `New offer from ${workerName}`,
          actionText: 'Reply',
          onClick: () => onNavigate(`#/jobs/${activeJob.id}`),
        };
      }
      return {
        text: 'Waiting for a reply',
        actionText: 'View request',
        onClick: () => onNavigate(`#/jobs/${activeJob.id}`),
      };
    }
    if (activeJob.status === 'completed') {
      const catName = CATEGORY_ITEMS.find(c => c.id === activeJob.category)?.name.toLowerCase() || 'tradesperson';
      return {
        text: `Rate your ${catName}`,
        actionText: 'Rate',
        onClick: () => onNavigate(`#/jobs/${activeJob.id}`),
      };
    }
    return null;
  };

  const jobInfo = getActiveJobInfo();
  const selectedCatLabel = CATEGORY_ITEMS.find(c => c.id === selectedCategory)?.name || 'service';

  return (
    <div className="w-full max-w-lg mx-auto px-6 py-6 space-y-8 select-none">
      {/* 1. Greeting Row */}
      <div className="flex items-center justify-between">
        <span className="text-[16px] leading-[24px] text-[#6B5B4E]">
          Hello, {firstName}
        </span>
        <button
          type="button"
          onClick={() => onNavigate('#/more')}
          className="w-10 h-10 rounded-full bg-[#F4EBDA] hover:bg-[#EADFC9] text-[#2A1B12] flex items-center justify-center font-heading font-bold text-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2A1B12]"
          aria-label="Open profile and menu"
        >
          {firstName.charAt(0)}
        </button>
      </div>

      {/* 2 & 3 & 4. Display Headline, Sentence, and Primary Pill */}
      <div className="space-y-4">
        <h1 className="text-display">
          What needs fixing today?
        </h1>
        <p className="text-[16px] leading-[24px] text-[#6B5B4E]">
          Book a nearby tradesperson, and see what a fair price looks like first.
        </p>
        <div className="pt-2">
          <PrimaryButton fullWidth onClick={onOpenBook}>
            Book a service
          </PrimaryButton>
        </div>
      </div>

      {/* 5. Horizontal Scroll Row of Six Category Chips */}
      <div className="space-y-2">
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-6 px-6">
          {CATEGORY_ITEMS.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  onSelectCategoryAndBook(cat.id);
                }}
                className={`h-[36px] min-h-[36px] px-4 rounded-full text-[14px] font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors duration-180 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-[#2A1B12] ${
                  isSelected
                    ? 'bg-[#B5541E] text-white'
                    : 'bg-[#F4EBDA] text-[#2A1B12] hover:bg-[#EADFC9]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. StatRow with Three Live Numbers & Demo Data Caption */}
      <div className="pt-2">
        <StatRow
          stats={[
            {
              value: workersNearbyCount,
              label: 'workers within 5 km',
            },
            {
              value: band ? `₹${band.typical}` : '₹450',
              label: `typical ${selectedCatLabel.toLowerCase()} price`,
              onClick: () => onNavigate('#/prices'),
            },
            {
              value: verifiedCount,
              label: 'verified workers',
            },
          ]}
        />
        <div className="text-[12px] leading-[16px] text-[#6B5B4E] pt-1">
          Demo data
        </div>
      </div>

      {/* 7. Single Status Card (ONLY if relevant, otherwise nothing) */}
      {jobInfo && (
        <Card className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#059669] shrink-0" />
            <span className="font-heading font-medium text-[16px] leading-[22px] text-[#2A1B12] truncate">
              {jobInfo.text}
            </span>
          </div>
          <TextLink onClick={jobInfo.onClick} className="shrink-0 flex items-center gap-1 font-semibold">
            <span>{jobInfo.actionText}</span>
            <ChevronRight className="w-4 h-4" />
          </TextLink>
        </Card>
      )}
    </div>
  );
};
