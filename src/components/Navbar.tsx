/**
 * FairFix Top Navigation Bar - "Mark III Forge"
 * Metallic cockpit bar, segmented control with sliding gold pill,
 * active user selector, and overflow demo controls.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDemoUser } from '../context/DemoUserContext.js';
import { 
  ShieldCheck, 
  User as UserIcon, 
  Wrench, 
  TrendingUp, 
  CheckCircle2,
  Clock,
  RotateCcw,
  MoreVertical,
  Activity,
  Eye,
  EyeOff,
  Cpu,
  FlaskConical,
} from 'lucide-react';
import { Badge } from './ui/index.js';

export type TabType = 'customer' | 'worker' | 'admin' | 'explorer' | 'dispatch' | 'lab';

interface NavbarProps {
  currentTab: TabType;
  setCurrentTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { 
    users, 
    currentUser, 
    currentRole, 
    switchRole, 
    selectUser, 
    resetDatabase, 
    loading,
    hideDemoControls,
    toggleHideDemoControls
  } = useDemoUser();
  const [showOverflow, setShowOverflow] = useState(false);

  const handleRoleTabChange = (role: 'customer' | 'worker' | 'admin') => {
    switchRole(role);
    setCurrentTab(role);
  };

  const filteredUsers = users.filter((u) => u.role === currentRole);

  const navItems = [
    { id: 'customer', label: 'Customer', icon: UserIcon, onClick: () => handleRoleTabChange('customer') },
    { id: 'worker', label: 'Worker', icon: Wrench, onClick: () => handleRoleTabChange('worker') },
    { id: 'explorer', label: 'Fair Band', icon: TrendingUp, onClick: () => setCurrentTab('explorer') },
    { id: 'dispatch', label: 'Dispatch', icon: Cpu, onClick: () => setCurrentTab('dispatch') },
    { id: 'lab', label: 'Concept Lab', icon: FlaskConical, onClick: () => setCurrentTab('lab') },
    { id: 'admin', label: 'Admin', icon: ShieldCheck, onClick: () => { switchRole('admin'); setCurrentTab('admin'); } },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#07070A]/95 border-b border-[rgba(255,184,28,0.2)] text-white backdrop-blur-md">
      {/* Top Micro Strip */}
      <div className="bg-[#0E1016] border-b border-[#2A2E3A] px-3 sm:px-6 py-1 text-xs flex items-center justify-between text-[#A7A29A]">
        <div className="flex items-center gap-2">
          <Badge variant="fair" size="sm">
            Demo Mode
          </Badge>
          <span className="hidden sm:inline font-sans text-[#A7A29A]">
            Fair-price band from completed jobs &bull; Straight-line 20 km/h ETA estimation
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#A7A29A]">
            Payments: Cash on completion only
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer shrink-0" 
          onClick={() => setCurrentTab('customer')}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#8E0B16] via-[#D7261E] to-[#FFB81C] flex items-center justify-center font-heading font-black text-white shadow-[0_0_15px_rgba(215,38,30,0.5)] border border-[rgba(255,184,28,0.4)] text-base">
            F
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-base tracking-wider text-[#F4F1EC]">FAIRFIX</span>
              <span className="text-xs uppercase font-mono font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#5EE6FF]/15 text-[#5EE6FF] border border-[#5EE6FF]/30">
                Live Band
              </span>
            </div>
            <p className="text-xs text-[#A7A29A] -mt-0.5 hidden xs:block font-sans">Hyperlocal Blue-Collar Platform</p>
          </div>
        </div>

        {/* Center: Segmented Control with animated sliding pill */}
        <nav aria-label="Main Navigation" className="flex items-center p-1 bg-[#0E1016] border border-[#2A2E3A] rounded-xl overflow-x-auto max-w-full">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`relative px-3 py-2 rounded-lg text-xs font-heading uppercase tracking-wider font-bold transition-colors duration-200 flex items-center gap-1.5 cursor-pointer z-10 min-h-[44px] shrink-0 ${
                  isActive ? 'text-white' : 'text-[#A7A29A] hover:text-[#F4F1EC]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeRolePillForge"
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#8E0B16] via-[#D7261E] to-[#FFB81C] shadow-[0_0_14px_rgba(215,38,30,0.5)] border-t border-[rgba(255,184,28,0.7)] -z-10"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Active Demo User Picker + Overflow Dropdown */}
        <div className="flex items-center gap-2">
          {/* User Profile Card */}
          <div className="flex items-center gap-2 bg-[#0E1016] border border-[#2A2E3A] rounded-xl px-2.5 py-1 text-xs">
            {/* Avatar Initials */}
            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#8E0B16] to-[#D7261E] border border-[rgba(255,184,28,0.3)] flex items-center justify-center font-heading font-bold text-xs text-white shrink-0">
              {currentUser?.name.charAt(0)}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <select
                  aria-label="Select active demo user"
                  value={currentUser?.id || ''}
                  onChange={(e) => selectUser(e.target.value)}
                  className="bg-transparent font-heading font-bold text-[#F4F1EC] outline-none cursor-pointer text-xs pr-1 max-w-28 sm:max-w-36 truncate"
                >
                  {filteredUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#07070A] text-white">
                      {u.name} {u.role === 'worker' ? `(${u.categories?.[0] || 'Worker'})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Worker Verification status if worker */}
            {currentUser?.role === 'worker' && (
              <span className="hidden lg:inline">
                {currentUser.verification_status === 'verified' ? (
                  <Badge variant="verified" size="sm">
                    Verified
                  </Badge>
                ) : currentUser.verification_status === 'pending' ? (
                  <Badge variant="caution" size="sm" icon={Clock}>
                    Pending
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    {currentUser.verification_status}
                  </Badge>
                )}
              </span>
            )}
          </div>

          {/* Overflow Menu Button */}
          <div className="relative">
            <button
              onClick={() => setShowOverflow(!showOverflow)}
              className="p-2 rounded-xl bg-[#0E1016] hover:bg-[#151821] border border-[#2A2E3A] text-[#A7A29A] hover:text-[#F4F1EC] transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="More demo options"
              aria-label="More demo options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <AnimatePresence>
              {showOverflow && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  className="absolute right-0 mt-2 w-52 bg-[#0E1016] border border-[rgba(255,184,28,0.3)] rounded-xl p-2 shadow-2xl z-50 text-xs hud-panel-brackets"
                >
                  <button
                    onClick={() => {
                      setShowOverflow(false);
                      if (window.confirm('Reset database to clean 12 workers, 8 customers, and 64 completed jobs?')) {
                        resetDatabase();
                      }
                    }}
                    disabled={loading}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[#F4F1EC] hover:bg-[#151821] transition cursor-pointer font-heading uppercase tracking-wider font-semibold"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#5EE6FF]" />
                    <span>Reset Seed Data</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowOverflow(false);
                      setCurrentTab('explorer');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[#F4F1EC] hover:bg-[#151821] transition cursor-pointer font-heading uppercase tracking-wider font-semibold"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-[#FFB81C]" />
                    <span>Fair-Price Monitor</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowOverflow(false);
                      toggleHideDemoControls();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-[#F4F1EC] hover:bg-[#151821] transition cursor-pointer font-heading uppercase tracking-wider font-semibold border-t border-[#2A2E3A] mt-1 pt-2"
                  >
                    {hideDemoControls ? (
                      <>
                        <Eye className="w-3.5 h-3.5 text-[#5EE6FF]" />
                        <span>Exit Recording Mode</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-[#A7A29A]" />
                        <span>Recording Mode (Hide Demo Controls)</span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};
