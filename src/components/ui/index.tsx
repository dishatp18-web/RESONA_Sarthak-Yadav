/**
 * FairFix "Mark III Forge" Component Suite
 * Dark metallic cockpit styling, red & gold armor, and cyan arc-reactor status accents.
 */
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon, CheckCircle2, AlertTriangle, AlertOctagon, Info, ShieldCheck, X } from 'lucide-react';

/**
 * Format numbers using standard Indian currency grouping (e.g. ₹1,25,000)
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/* 1. ArcLoader: Concentric rotating rings in cyan */
export const ArcLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const dims = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';

  return (
    <div className={`relative inline-flex items-center justify-center ${dims} ${className}`}>
      <div className="absolute inset-0 rounded-full border-2 border-[#5EE6FF]/20" />
      <div className="absolute inset-0 rounded-full border-2 border-t-[#5EE6FF] border-r-[#5EE6FF] border-b-transparent border-l-transparent animate-spin" />
      <div className="w-1.5 h-1.5 rounded-full bg-[#5EE6FF] shadow-[0_0_6px_#5EE6FF]" />
    </div>
  );
};

/* 2. ForgeButton */
export interface ForgeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const ForgeButton: React.FC<ForgeButtonProps> = ({
  children,
  variant = 'primary',
  icon: Icon,
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'py-1.5 px-3.5 text-xs rounded-lg gap-1.5 min-h-[36px]',
    md: 'py-2.5 px-5 text-sm rounded-xl gap-2 min-h-[44px]',
    lg: 'py-3.5 px-7 text-base rounded-xl gap-2.5 min-h-[48px]',
  }[size];

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-[#8E0B16] via-[#D7261E] to-[#8E0B16] text-white border-t border-[rgba(255,184,28,0.6)] border-b border-black shadow-[0_4px_16px_rgba(215,38,30,0.35)] hover:shadow-[0_6px_22px_rgba(255,184,28,0.4)] hover:brightness-110 active:scale-[0.98]',
    ghost:
      'bg-[#151821] text-[#F4F1EC] border border-[#2A2E3A] hover:border-[rgba(255,184,28,0.4)] hover:bg-[#1C202B] active:scale-[0.98]',
    danger:
      'bg-[rgba(255,92,108,0.15)] text-[#FF5C6C] border border-[rgba(255,92,108,0.4)] hover:bg-[rgba(255,92,108,0.25)] hover:shadow-[0_0_16px_rgba(255,92,108,0.3)] active:scale-[0.98]',
  }[variant];

  return (
    <button
      disabled={disabled || loading}
      className={`relative inline-flex items-center justify-center font-heading uppercase tracking-wider font-bold transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${
        fullWidth ? 'w-full' : ''
      } ${sizeClasses} ${variantStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <ArcLoader size="sm" />
      ) : (
        <>
          {Icon && <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

/* 3. HudPanel (Metallic Cockpit with Gold Corner Brackets) */
export interface HudPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'flat';
  selected?: boolean;
  className?: string;
}

export const HudPanel: React.FC<HudPanelProps> = ({
  children,
  variant = 'default',
  selected = false,
  className = '',
  ...props
}) => {
  const hasBrackets = variant !== 'flat';
  const highlightBorder = variant === 'highlight' ? 'border-[rgba(255,184,28,0.45)]' : 'border-[rgba(255,184,28,0.18)]';
  const selectedRing = selected ? 'ring-2 ring-[#FFB81C] shadow-[0_0_24px_rgba(255,184,28,0.35)]' : '';

  return (
    <div
      className={`hud-panel ${hasBrackets ? 'hud-panel-brackets' : ''} ${highlightBorder} ${selectedRing} p-4 sm:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

/* 4. Badge / Chip (The ONLY status colors: fair #5EE6FF, caution #FFB81C, danger #FF5C6C) */
export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'fair' | 'caution' | 'danger' | 'info' | 'neutral' | 'verified';
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  icon: Icon,
  size = 'sm',
  className = '',
}) => {
  // Always 12% tinted fill, 1px matching border, plus icon & text. Never color alone!
  const styles = {
    fair: 'bg-[#5EE6FF]/12 text-[#5EE6FF] border-[#5EE6FF]/30',
    caution: 'bg-[#FFB81C]/12 text-[#FFB81C] border-[#FFB81C]/30',
    danger: 'bg-[#FF5C6C]/12 text-[#FF5C6C] border-[#FF5C6C]/30',
    info: 'bg-[#5EE6FF]/12 text-[#5EE6FF] border-[#5EE6FF]/30',
    neutral: 'bg-white/5 text-[#A7A29A] border-white/10',
    verified: 'bg-[#5EE6FF]/15 text-[#5EE6FF] border-[#5EE6FF]/40 shadow-[0_0_10px_rgba(94,230,255,0.25)]',
  }[variant];

  const defaultIcons = {
    fair: CheckCircle2,
    caution: AlertTriangle,
    danger: AlertOctagon,
    info: Info,
    neutral: undefined,
    verified: ShieldCheck,
  };

  const DisplayIcon = Icon || defaultIcons[variant];
  const sizeStyles = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-heading font-bold uppercase tracking-wider rounded-md border ${styles} ${sizeStyles} ${className}`}
    >
      {DisplayIcon && <DisplayIcon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />}
      <span>{children}</span>
    </span>
  );
};

/* 5. Tabs / SegmentedControl with Sliding Pill & Arrow Keys */
export interface TabOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string | number;
}

export interface TabsProps {
  options: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  options,
  activeId,
  onChange,
  className = '',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % options.length;
      onChange(options[nextIndex].id);
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + options.length) % options.length;
      onChange(options[prevIndex].id);
    }
  };

  return (
    <div
      role="tablist"
      className={`inline-flex p-1 bg-[#0E1016] border border-[#2A2E3A] rounded-xl relative ${className}`}
    >
      {options.map((opt, idx) => {
        const isActive = activeId === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`relative px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-heading uppercase tracking-wider font-bold transition-colors duration-200 flex items-center gap-1.5 cursor-pointer z-10 ${
              isActive ? 'text-white' : 'text-[#A7A29A] hover:text-[#F4F1EC]'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabPillForge"
                className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#8E0B16] via-[#D7261E] to-[#FFB81C] shadow-[0_0_14px_rgba(215,38,30,0.5)] border-t border-[rgba(255,184,28,0.7)] -z-10"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ml-1 ${
                isActive ? 'bg-black/40 text-[#FFD65A]' : 'bg-white/10 text-slate-300'
              }`}>
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* 6. Skeleton Loader in Steel Tones */
export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`animate-pulse bg-[#151821] border border-[#2A2E3A] rounded-lg ${className}`} />
  );
};

/* 7. Toast System with aria-live="polite" */
export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type?: 'fair' | 'caution' | 'danger' | 'info';
}

interface ToastContextType {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (t: Omit<ToastMessage, 'id'>) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...t, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-3"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const borderColors = {
              fair: 'border-[#5EE6FF]/50 bg-[#0E1016]/95 text-[#5EE6FF]',
              caution: 'border-[#FFB81C]/50 bg-[#0E1016]/95 text-[#FFB81C]',
              danger: 'border-[#FF5C6C]/50 bg-[#0E1016]/95 text-[#FF5C6C]',
              info: 'border-[#5EE6FF]/50 bg-[#0E1016]/95 text-[#5EE6FF]',
            }[toast.type || 'info'];

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto p-4 rounded-xl border hud-panel-brackets shadow-2xl flex flex-col gap-0.5 ${borderColors}`}
              >
                <div className="font-heading font-bold text-xs text-white flex items-center justify-between">
                  <span>{toast.title}</span>
                </div>
                {toast.message && (
                  <p className="text-xs text-[#A7A29A] font-sans leading-relaxed">{toast.message}</p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/* 8. EmptyState */
export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="hud-panel p-8 sm:p-12 text-center rounded-xl border border-[#2A2E3A] flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-xl bg-[#151821] border border-[#2A2E3A] flex items-center justify-center text-[#FFB81C] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="font-heading font-bold text-sm text-[#F4F1EC] mb-1 uppercase tracking-wider">{title}</h4>
      <p className="text-xs text-[#A7A29A] max-w-sm mb-4 leading-relaxed font-sans">{description}</p>
      {action && (
        <ForgeButton variant="ghost" size="sm" onClick={action.onClick}>
          {action.label}
        </ForgeButton>
      )}
    </div>
  );
};

/* 9. StatCard with Count-Up */
export interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon?: LucideIcon;
  change?: string;
  subtext?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  change,
  subtext,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const start = prevValue.current;
    const end = value;
    if (start === end) return;

    const duration = 650;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        prevValue.current = end;
      }
    };

    requestAnimationFrame(step);
  }, [value]);

  return (
    <HudPanel variant="default" className="flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-[#A7A29A] mb-2">
        <span className="font-heading uppercase tracking-wider font-bold">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-[#FFB81C]" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-2xl sm:text-3xl font-black text-grad-forge tabular-nums tracking-tight">
          {prefix}{displayValue.toLocaleString('en-IN')}{suffix}
        </span>
        {change && (
          <span className="text-[11px] font-heading font-bold text-[#5EE6FF]">{change}</span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-[#A7A29A] mt-1 font-sans">{subtext}</p>}
    </HudPanel>
  );
};

/* 10. Drawer (Bottom on mobile <768px, Right on desktop >768px, with Focus Trap & Esc) */
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children }) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            ref={drawerRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative w-full md:max-w-md bg-[#0E1016] border-t md:border-t-0 md:border-l border-[rgba(255,184,28,0.3)] p-5 sm:p-6 shadow-[0_0_40px_rgba(0,0,0,0.8)] z-10 max-h-[85vh] md:max-h-full overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2E3A]">
              <h3 className="font-heading font-bold text-base uppercase tracking-wider text-[#F4F1EC] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#5EE6FF] shadow-[0_0_6px_#5EE6FF]" />
                {title}
              </h3>
              <button
                onClick={onClose}
                className="text-[#A7A29A] hover:text-[#F4F1EC] p-1.5 rounded-lg hover:bg-[#151821] cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* 11. Timeline: Vertical, Pending / Current (pulsing arc ring) / Done (filled gold line) */
export interface TimelineStep {
  id: string;
  title: string;
  time?: string | null;
  description?: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isFailed?: boolean;
}

export const Timeline: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#2A2E3A]">
      {steps.map((step) => {
        return (
          <div key={step.id} className="relative group">
            {/* Step Marker */}
            <div
              className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                step.isFailed
                  ? 'border-[#FF5C6C] bg-[#FF5C6C]/20 text-[#FF5C6C]'
                  : step.isCompleted
                  ? 'border-[#FFB81C] bg-[#FFB81C] text-black shadow-[0_0_8px_rgba(255,184,28,0.5)]'
                  : step.isCurrent
                  ? 'border-[#5EE6FF] bg-[#5EE6FF]/20 text-[#5EE6FF] ring-4 ring-[#5EE6FF]/20 animate-pulse'
                  : 'border-[#3B4150] bg-[#07070A] text-[#6F6B65]'
              }`}
            >
              {step.isCompleted ? (
                <span className="text-[10px] font-black">✓</span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </div>

            {/* Content */}
            <div className="flex items-baseline justify-between gap-2">
              <h5
                className={`font-heading text-xs font-bold uppercase tracking-wider ${
                  step.isCompleted || step.isCurrent ? 'text-[#F4F1EC]' : 'text-[#6F6B65]'
                }`}
              >
                {step.title}
              </h5>
              {step.time && (
                <span className="text-[10px] text-[#A7A29A] font-mono">
                  {new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {step.description && (
              <p className="text-[11px] text-[#A7A29A] mt-0.5 font-sans leading-relaxed">{step.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
};
