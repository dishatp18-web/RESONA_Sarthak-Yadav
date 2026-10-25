import React, { useEffect, useState } from 'react';
import { 
  Home, 
  Briefcase, 
  Plus, 
  TrendingUp, 
  MoreHorizontal, 
  Inbox, 
  Sliders, 
  ShieldCheck, 
  Flag, 
  Activity, 
  Cpu 
} from 'lucide-react';
import { useDemoUser } from '../context/DemoUserContext.js';

interface BottomNavProps {
  currentPath: string;
  onNavigate: (route: string) => void;
  onOpenMore: () => void;
  isFullScreenRoute?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentPath,
  onNavigate,
  onOpenMore,
  isFullScreenRoute = false,
}) => {
  const { currentRole, currentUser } = useDemoUser();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [actionCount, setActionCount] = useState(0);

  // Detect mobile virtual keyboard
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const isSmaller = vv.height < window.innerHeight - 120;
      setIsKeyboardVisible(isSmaller);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, []);

  // Fetch pending action counts for badge (only items needing user's action)
  useEffect(() => {
    let isMounted = true;
    const fetchBadgeData = async () => {
      if (!currentUser) return;
      try {
        if (currentRole === 'customer') {
          const res = await fetch(`/api/jobs?customerId=${currentUser.id}`);
          if (!res.ok) return;
          const jobs = await res.json();
          // Action needed: worker countered or completed needing rating
          const count = jobs.filter((j: any) => {
            const latest = j.latest_offer || (j.offers && j.offers[j.offers.length - 1]);
            const isMyTurn = ['requested', 'negotiating'].includes(j.status) && latest?.from_role === 'worker';
            const needsRating = j.status === 'completed';
            return isMyTurn || needsRating;
          }).length;
          if (isMounted) setActionCount(count);
        } else if (currentRole === 'worker') {
          const res = await fetch(`/api/jobs`);
          if (!res.ok) return;
          const jobs = await res.json();
          const count = jobs.filter((j: any) => j.status === 'requested').length;
          if (isMounted) setActionCount(count);
        } else {
          if (isMounted) setActionCount(0);
        }
      } catch (err) {
        // Silent fallback
      }
    };

    fetchBadgeData();
    const timer = setInterval(fetchBadgeData, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [currentUser, currentRole]);

  if (isFullScreenRoute || isKeyboardVisible) {
    return null;
  }

  // Navigation Items per Role
  let navItems: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    route?: string;
    onClick?: () => void;
    isRaised?: boolean;
    badgeCount?: number;
  }[] = [];

  if (currentRole === 'customer') {
    navItems = [
      { id: 'home', label: 'Home', icon: Home, route: '#/home' },
      { id: 'jobs', label: 'Jobs', icon: Briefcase, route: '#/jobs', badgeCount: actionCount },
      { id: 'book', label: 'Book', icon: Plus, route: '#/book/1', isRaised: true },
      { id: 'prices', label: 'Prices', icon: TrendingUp, route: '#/prices' },
      { id: 'more', label: 'More', icon: MoreHorizontal, onClick: onOpenMore },
    ];
  } else if (currentRole === 'worker') {
    navItems = [
      { id: 'worker-requests', label: 'Requests', icon: Inbox, route: '#/worker/requests', badgeCount: actionCount },
      { id: 'worker-jobs', label: 'Jobs', icon: Briefcase, route: '#/worker/jobs' },
      { id: 'worker-rate', label: 'Rate', icon: Sliders, route: '#/worker/rate' },
      { id: 'worker-prices', label: 'Prices', icon: TrendingUp, route: '#/worker/prices' },
      { id: 'more', label: 'More', icon: MoreHorizontal, onClick: onOpenMore },
    ];
  } else {
    // Admin role
    navItems = [
      { id: 'admin-queue', label: 'Queue', icon: ShieldCheck, route: '#/admin/queue' },
      { id: 'admin-reports', label: 'Reports', icon: Flag, route: '#/admin/reports' },
      { id: 'admin-bands', label: 'Bands', icon: Activity, route: '#/admin/bands' },
      { id: 'admin-dispatch', label: 'Dispatch', icon: Cpu, route: '#/admin/dispatch' },
      { id: 'more', label: 'More', icon: MoreHorizontal, onClick: onOpenMore },
    ];
  }

  return (
    <nav 
      aria-label="Mobile Bottom Navigation" 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFBF3] border-t border-[#EADFC9] px-2 select-none"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="h-16 flex items-center justify-around relative max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.route 
            ? currentPath === item.route.replace(/^#\/?/, '').split('/')[0] || 
              (currentPath === 'book' && item.id === 'book') ||
              (currentPath.startsWith('worker') && item.id.includes(currentPath.split('/')[1] || 'requests')) ||
              (currentPath.startsWith('admin') && item.id.includes(currentPath.split('/')[1] || 'queue'))
            : false;

          if (item.isRaised) {
            return (
              <div key={item.id} className="relative -top-4 flex flex-col items-center">
                <button
                  type="button"
                  aria-label="Book a service"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => {
                    if (item.route) onNavigate(item.route);
                    else if (item.onClick) item.onClick();
                  }}
                  className="w-14 h-14 rounded-full bg-[#B5541E] hover:bg-[#9E4717] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(181,84,30,0.3)] transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#2A1B12] focus:ring-offset-2 cursor-pointer"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <Plus className="w-7 h-7 text-white stroke-[2.5]" />
                </button>
                <span className="text-[12px] font-heading font-medium text-[#2A1B12] mt-1">
                  {item.label}
                </span>
              </div>
            );
          }

          const badgeDisplay = item.badgeCount && item.badgeCount > 0 
            ? (item.badgeCount > 9 ? '9+' : item.badgeCount.toString()) 
            : null;

          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (item.route) onNavigate(item.route);
                else if (item.onClick) item.onClick();
              }}
              className={`flex-1 flex flex-col items-center justify-center h-full min-w-[44px] min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#2A1B12] focus:ring-offset-2 rounded-xl cursor-pointer ${
                isActive ? 'text-[#B5541E]' : 'text-[#6B5B4E] hover:text-[#2A1B12]'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 ${isActive ? 'text-[#B5541E] stroke-[2.5]' : 'text-[#6B5B4E] stroke-[1.8]'}`} />
                {badgeDisplay && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {badgeDisplay}
                  </span>
                )}
              </div>
              <span className={`text-[12px] mt-1 font-heading leading-tight ${isActive ? 'font-bold text-[#B5541E]' : 'font-medium text-[#6B5B4E]'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
