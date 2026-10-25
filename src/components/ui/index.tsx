/**
 * FairFix Calm Component Suite
 * Strictly adheres to Calm design tokens:
 * --bg #FCF5E8, --surface #FFFBF3, --line #EADFC9, --chip #F4EBDA,
 * --ink #2A1B12, --muted #6B5B4E, --accent #B5541E, --on-accent #FFFFFF.
 * 52px pill primary button, 36px chip, 20px radius cards, bottom sheets, stat rows.
 */
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideIcon, CheckCircle2, AlertTriangle, AlertOctagon, Info, X } from 'lucide-react';

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

/* 1. ArcLoader: Smooth modern spinner */
export const ArcLoader: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = '',
}) => {
  const dims = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';

  return (
    <div className={`relative inline-flex items-center justify-center ${dims} ${className}`}>
      <div className="absolute inset-0 rounded-full border-2 border-[#EADFC9]" />
      <div className="absolute inset-0 rounded-full border-2 border-t-[#B5541E] border-r-[#B5541E] border-b-transparent border-l-transparent animate-spin" />
    </div>
  );
};

/* 2. PrimaryButton: 52px high pill, accent fill, white 16/600 text; press scale 0.98; loading ring; disabled 40% */
export interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  icon: Icon,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`h-[52px] min-h-[52px] px-6 rounded-full bg-[#B5541E] hover:bg-[#9E4717] active:scale-[0.98] text-white font-heading font-semibold text-[16px] leading-[24px] inline-flex items-center justify-center gap-2 transition-all duration-180 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[#2A1B12] focus:ring-offset-2 ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5 shrink-0" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

/* 3. SecondaryButton: 52px high, 1px accent outline pill */
export interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  icon: Icon,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || loading}
      className={`h-[52px] min-h-[52px] px-6 rounded-full border border-[#B5541E] text-[#B5541E] bg-transparent hover:bg-[#B5541E]/5 active:scale-[0.98] font-heading font-semibold text-[16px] leading-[24px] inline-flex items-center justify-center gap-2 transition-all duration-180 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[#2A1B12] focus:ring-offset-2 ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 rounded-full border-2 border-[#B5541E]/30 border-t-[#B5541E] animate-spin" />
      ) : (
        <>
          {Icon && <Icon className="w-5 h-5 shrink-0" />}
          <span>{children}</span>
        </>
      )}
    </button>
  );
};

/* 4. TextLink: accent, underlined on focus */
export interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}

export const TextLink: React.FC<TextLinkProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <a
      className={`text-[#B5541E] hover:underline focus:underline cursor-pointer font-medium text-[14px] leading-[20px] transition-colors focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </a>
  );
};

/* 5. Chip: 36px, pill, --chip fill, ink text; selected = accent fill with white text */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  selected?: boolean;
  icon?: LucideIcon;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  selected = false,
  icon: Icon,
  className = '',
  ...props
}) => {
  return (
    <button
      type="button"
      className={`h-[36px] min-h-[36px] px-4 rounded-full text-[14px] font-medium inline-flex items-center gap-2 transition-colors duration-180 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#2A1B12] focus:ring-offset-2 select-none ${
        selected
          ? 'bg-[#B5541E] text-white'
          : 'bg-[#F4EBDA] text-[#2A1B12] hover:bg-[#EADFC9]'
      } ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
};

/* 6. Card: radius 20, 16px inside, 1px border OR shadow, never both */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'border' | 'shadow';
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'border',
  className = '',
  ...props
}) => {
  const cardStyle =
    variant === 'shadow'
      ? 'bg-[#FFFBF3] rounded-[20px] p-4 shadow-[0_8px_24px_rgba(42,27,18,0.06)] text-[#2A1B12]'
      : 'bg-[#FFFBF3] rounded-[20px] p-4 border border-[#EADFC9] text-[#2A1B12]';

  return (
    <div className={`${cardStyle} ${className}`} {...props}>
      {children}
    </div>
  );
};

/* 7. SectionTitle: H2 24/30 Plus Jakarta Sans */
export const SectionTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  return (
    <h2 className={`font-heading font-bold text-[24px] leading-[30px] text-[#2A1B12] tracking-[-0.02em] ${className}`}>
      {children}
    </h2>
  );
};

/* 8. StatRow: three numbers (value in Display-small 28 accent, caption below) */
export interface StatItem {
  value: string | number;
  label: string;
  onClick?: () => void;
}

export const StatRow: React.FC<{ stats: StatItem[]; className?: string }> = ({
  stats,
  className = '',
}) => {
  return (
    <div className={`grid grid-cols-3 gap-3 py-2 ${className}`}>
      {stats.map((s, idx) => (
        <div
          key={idx}
          onClick={s.onClick}
          className={`flex flex-col text-left ${s.onClick ? 'cursor-pointer hover:opacity-85' : ''}`}
        >
          <div className="font-heading font-extrabold text-[28px] leading-[32px] text-[#B5541E] tracking-tight">
            {s.value}
          </div>
          <div className="text-[12px] leading-[16px] text-[#6B5B4E] mt-1 line-clamp-2">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
};

/* 9. Sheet: bottom sheet with drag handle and Esc, 180ms fade / 240ms slide */
export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ isOpen, onClose, title, children }) => {
  const sheetRef = useRef<HTMLDivElement>(null);

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
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop with 180ms fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#2A1B12]/40 backdrop-blur-xs"
          />

          {/* Sheet panel with 240ms slide */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-lg bg-[#FFFBF3] border-t border-[#EADFC9] rounded-t-[24px] p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto text-[#2A1B12]"
          >
            {/* Drag Handle */}
            <div className="w-12 h-1.5 rounded-full bg-[#EADFC9] mx-auto mb-4" />

            {title && (
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#EADFC9]">
                <h3 className="font-heading font-bold text-[20px] leading-[26px] text-[#2A1B12]">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5B4E] hover:text-[#2A1B12] hover:bg-[#F4EBDA] cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* 10. ProgressBar: 4 thin segments, no labels */
export const ProgressBar: React.FC<{ step: number; total?: number; className?: string }> = ({
  step,
  total = 4,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-1.5 w-full ${className}`}>
      {Array.from({ length: total }).map((_, idx) => {
        const isCompletedOrActive = idx < step;
        return (
          <div
            key={idx}
            className={`h-1 flex-1 rounded-full transition-colors duration-180 ${
              isCompletedOrActive ? 'bg-[#B5541E]' : 'bg-[#EADFC9]'
            }`}
          />
        );
      })}
    </div>
  );
};

/* 11. DemoDataPill: honest unobtrusive demo data indicator */
export const DemoDataPill: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full bg-[#F4EBDA] text-[#6B5B4E] text-[12px] leading-[16px] font-medium ${className}`}
    >
      Demo data
    </span>
  );
};

/* 12. StatusChip: only for actual status (fair, caution, danger) */
export interface StatusChipProps {
  status: 'fair' | 'caution' | 'danger';
  label: string;
  icon?: LucideIcon;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  icon: Icon,
  className = '',
}) => {
  const styles = {
    fair: 'bg-[rgba(5,150,105,0.1)] text-[#059669]',
    caution: 'bg-[rgba(180,83,9,0.1)] text-[#B45309]',
    danger: 'bg-[rgba(220,38,38,0.1)] text-[#DC2626]',
  }[status];

  const defaultIcons = {
    fair: CheckCircle2,
    caution: AlertTriangle,
    danger: AlertOctagon,
  };

  const DisplayIcon = Icon || defaultIcons[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] leading-[16px] font-medium ${styles} ${className}`}
    >
      {DisplayIcon && <DisplayIcon className="w-3.5 h-3.5 shrink-0" />}
      <span>{label}</span>
    </span>
  );
};

/* Compatibility wrappers for legacy usages */
export const ForgeButton: React.FC<any> = ({
  children,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  if (variant === 'ghost' || variant === 'dark') {
    return (
      <SecondaryButton
        icon={icon}
        loading={loading}
        fullWidth={fullWidth}
        className={className}
        {...props}
      >
        {children}
      </SecondaryButton>
    );
  }
  return (
    <PrimaryButton
      icon={icon}
      loading={loading}
      fullWidth={fullWidth}
      className={className}
      {...props}
    >
      {children}
    </PrimaryButton>
  );
};

export const HudPanel: React.FC<any> = ({ children, className = '', ...props }) => {
  return (
    <Card className={className} {...props}>
      {children}
    </Card>
  );
};

export const Badge: React.FC<any> = ({
  children,
  variant = 'neutral',
  icon,
  className = '',
}) => {
  if (variant === 'fair' || variant === 'verified') {
    return <StatusChip status="fair" label={children} icon={icon} className={className} />;
  }
  if (variant === 'caution') {
    return <StatusChip status="caution" label={children} icon={icon} className={className} />;
  }
  if (variant === 'danger') {
    return <StatusChip status="danger" label={children} icon={icon} className={className} />;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F4EBDA] text-[#6B5B4E] text-[12px] font-medium ${className}`}>
      {children}
    </span>
  );
};

export const Tabs: React.FC<any> = ({ options, activeId, onChange, className = '' }) => {
  return (
    <div className={`inline-flex p-1 bg-[#F4EBDA] rounded-full gap-1 ${className}`}>
      {options.map((opt: any) => {
        const isActive = activeId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`px-4 py-1.5 rounded-full text-[14px] font-medium transition-colors cursor-pointer ${
              isActive
                ? 'bg-[#B5541E] text-white'
                : 'text-[#6B5B4E] hover:text-[#2A1B12]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export const Drawer: React.FC<any> = ({ isOpen, onClose, title, children }) => {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title={title}>
      {children}
    </Sheet>
  );
};

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return <div className={`animate-pulse bg-[#EADFC9]/60 rounded-xl ${className}`} />;
};

/* Toast System */
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
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto p-4 rounded-[16px] bg-[#FFFBF3] border border-[#EADFC9] shadow-lg text-[#2A1B12]"
            >
              <div className="font-heading font-bold text-[14px]">{toast.title}</div>
              {toast.message && (
                <p className="text-[12px] text-[#6B5B4E] mt-0.5 leading-relaxed">{toast.message}</p>
              )}
            </motion.div>
          ))}
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
