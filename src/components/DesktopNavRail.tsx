import React from 'react';
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

interface DesktopNavRailProps {
  currentPath: string;
  onNavigate: (route: string) => void;
  onOpenMore: () => void;
}

export const DesktopNavRail: React.FC<DesktopNavRailProps> = ({
  currentPath,
  onNavigate,
  onOpenMore,
}) => {
  const { currentRole } = useDemoUser();

  // Navigation Items per Role
  let navItems: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    route?: string;
    onClick?: () => void;
  }[] = [];

  if (currentRole === 'customer') {
    navItems = [
      { id: 'home', label: 'Home', icon: Home, route: '#/home' },
      { id: 'jobs', label: 'Jobs', icon: Briefcase, route: '#/jobs' },
      { id: 'book', label: 'Book', icon: Plus, route: '#/book/1' },
      { id: 'prices', label: 'Prices', icon: TrendingUp, route: '#/prices' },
    ];
  } else if (currentRole === 'worker') {
    navItems = [
      { id: 'worker-requests', label: 'Requests', icon: Inbox, route: '#/worker/requests' },
      { id: 'worker-jobs', label: 'Jobs', icon: Briefcase, route: '#/worker/jobs' },
      { id: 'worker-rate', label: 'Rate', icon: Sliders, route: '#/worker/rate' },
      { id: 'worker-prices', label: 'Prices', icon: TrendingUp, route: '#/worker/prices' },
    ];
  } else {
    navItems = [
      { id: 'admin-queue', label: 'Queue', icon: ShieldCheck, route: '#/admin/queue' },
      { id: 'admin-reports', label: 'Reports', icon: Flag, route: '#/admin/reports' },
      { id: 'admin-bands', label: 'Bands', icon: Activity, route: '#/admin/bands' },
      { id: 'admin-dispatch', label: 'Dispatch', icon: Cpu, route: '#/admin/dispatch' },
    ];
  }

  return (
    <aside 
      aria-label="Desktop Navigation Rail"
      className="hidden lg:flex flex-col items-center justify-between w-[72px] h-screen fixed left-0 top-0 bottom-0 z-40 bg-[#FFFBF3] border-r border-[#EADFC9] py-4 select-none"
    >
      {/* Brand Icon */}
      <button
        type="button"
        onClick={() => onNavigate('#/home')}
        className="w-11 h-11 rounded-2xl bg-[#B5541E] text-white flex items-center justify-center font-heading font-extrabold text-lg shadow-sm hover:opacity-90 transition-opacity cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2A1B12]"
        title="FairFix Home"
        aria-label="FairFix Home"
      >
        <span>F</span>
      </button>

      {/* Navigation Buttons Stack */}
      <nav className="flex flex-col items-center gap-3 w-full px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.route 
            ? currentPath === item.route.replace(/^#\/?/, '').split('/')[0] || 
              (currentPath === 'book' && item.id === 'book') ||
              (currentPath.startsWith('worker') && item.id.includes(currentPath.split('/')[1] || 'requests')) ||
              (currentPath.startsWith('admin') && item.id.includes(currentPath.split('/')[1] || 'queue'))
            : false;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.route) onNavigate(item.route);
                else if (item.onClick) item.onClick();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-14 py-2.5 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2A1B12] ${
                isActive
                  ? 'bg-[#B5541E] text-white font-medium shadow-xs'
                  : 'text-[#6B5B4E] hover:text-[#2A1B12] hover:bg-[#F4EBDA]'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[12px] font-heading mt-1 leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom More Button */}
      <button
        type="button"
        onClick={onOpenMore}
        className="w-12 h-12 rounded-2xl text-[#6B5B4E] hover:text-[#2A1B12] hover:bg-[#F4EBDA] flex flex-col items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2A1B12]"
        title="More Options"
        aria-label="More Options"
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[12px] font-heading mt-0.5">More</span>
      </button>
    </aside>
  );
};
