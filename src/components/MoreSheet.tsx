import React, { useState } from 'react';
import { 
  ChevronRight, 
  ArrowLeft,
  X 
} from 'lucide-react';
import { useDemoUser } from '../context/DemoUserContext.js';
import { Sheet, PrimaryButton, SecondaryButton, useToast } from './ui/index.js';

interface MoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (route: string) => void;
  recordingMode: boolean;
  setRecordingMode: (val: boolean) => void;
}

export const MoreSheet: React.FC<MoreSheetProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { 
    users, 
    currentUser, 
    currentRole, 
    switchRole, 
    selectUser, 
    resetDatabase 
  } = useDemoUser();
  const { showToast } = useToast();

  const [activeSubView, setActiveSubView] = useState<'menu' | 'users' | 'about' | 'controls'>('menu');
  const [runningAction, setRunningAction] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResetSeed = async () => {
    if (!window.confirm('Reset demo data back to default?')) return;
    setRunningAction('reset');
    try {
      await resetDatabase();
      showToast({
        title: 'Demo Data Reset',
        message: 'Default jobs and workers restored.',
        type: 'fair',
      });
      onClose();
      window.location.reload();
    } catch (err) {
      showToast({
        title: 'Reset Failed',
        message: (err as Error).message,
        type: 'danger',
      });
    } finally {
      setRunningAction(null);
    }
  };

  const handleFastForward = async () => {
    setRunningAction('fast_forward');
    try {
      const res = await fetch('/api/demo/fast-forward', { method: 'POST' });
      if (!res.ok) throw new Error('Fast-forward failed');
      const data = await res.json();
      showToast({
        title: 'Fast-forwarded',
        message: `Job agreed at ₹${data.agreed_price} and rated!`,
        type: 'fair',
      });
      onClose();
      window.location.reload();
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setRunningAction(null);
    }
  };

  const handleSimulateCounter = async () => {
    setRunningAction('counter');
    try {
      const res = await fetch('/api/demo/simulate-counter', { method: 'POST' });
      if (!res.ok) throw new Error('Simulation failed');
      const data = await res.json();
      showToast({
        title: 'Counter Received',
        message: `Worker proposed ₹${data.amount}.`,
        type: 'fair',
      });
      onClose();
      onNavigate('#/jobs');
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setRunningAction(null);
    }
  };

  const handleInjectOutlier = async () => {
    setRunningAction('outlier');
    try {
      const res = await fetch('/api/demo/inject-outlier', { method: 'POST' });
      if (!res.ok) throw new Error('Action failed');
      const data = await res.json();
      showToast({
        title: 'Unusual Price Filtered',
        message: `₹${data.injectedPrice} unusual price was excluded from fair band.`,
        type: 'caution',
      });
      onClose();
      onNavigate('#/prices');
    } catch (err) {
      showToast({ title: 'Error', message: (err as Error).message, type: 'danger' });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => { setActiveSubView('menu'); onClose(); }}>
      {/* 1. Main Menu: Exactly 6 plain text rows per Simplicity Budget */}
      {activeSubView === 'menu' && (
        <div className="space-y-1 py-1">
          {/* Row 1: Switch user */}
          <button
            type="button"
            onClick={() => setActiveSubView('users')}
            className="w-full py-4 flex items-center justify-between text-left text-[16px] text-[#2A1B12] hover:text-[#B5541E] border-b border-[#EADFC9] transition-colors cursor-pointer"
          >
            <span>Switch user ({currentUser?.name})</span>
            <ChevronRight className="w-5 h-5 text-[#6B5B4E]" />
          </button>

          {/* Row 2: How fair prices work (About) */}
          <button
            type="button"
            onClick={() => setActiveSubView('about')}
            className="w-full py-4 flex items-center justify-between text-left text-[16px] text-[#2A1B12] hover:text-[#B5541E] border-b border-[#EADFC9] transition-colors cursor-pointer"
          >
            <span>How fair prices work (About)</span>
            <ChevronRight className="w-5 h-5 text-[#6B5B4E]" />
          </button>

          {/* Row 3: Concept Lab */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('#/lab');
            }}
            className="w-full py-4 flex items-center justify-between text-left text-[16px] text-[#2A1B12] hover:text-[#B5541E] border-b border-[#EADFC9] transition-colors cursor-pointer"
          >
            <span>Concept Lab</span>
            <ChevronRight className="w-5 h-5 text-[#6B5B4E]" />
          </button>

          {/* Row 4: Batch Dispatch */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('#/dispatch');
            }}
            className="w-full py-4 flex items-center justify-between text-left text-[16px] text-[#2A1B12] hover:text-[#B5541E] border-b border-[#EADFC9] transition-colors cursor-pointer"
          >
            <span>Batch Dispatch</span>
            <ChevronRight className="w-5 h-5 text-[#6B5B4E]" />
          </button>

          {/* Row 5: Demo controls */}
          <button
            type="button"
            onClick={() => setActiveSubView('controls')}
            className="w-full py-4 flex items-center justify-between text-left text-[16px] text-[#2A1B12] hover:text-[#B5541E] border-b border-[#EADFC9] transition-colors cursor-pointer"
          >
            <span>Demo controls</span>
            <ChevronRight className="w-5 h-5 text-[#6B5B4E]" />
          </button>

          {/* Row 6: Reset demo data */}
          <button
            type="button"
            onClick={handleResetSeed}
            disabled={runningAction === 'reset'}
            className="w-full py-4 flex items-center justify-between text-left text-[16px] text-[#DC2626] hover:underline transition-colors cursor-pointer"
          >
            <span>{runningAction === 'reset' ? 'Resetting...' : 'Reset demo data'}</span>
          </button>
        </div>
      )}

      {/* Subview: Switch User */}
      {activeSubView === 'users' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setActiveSubView('menu')}
            className="flex items-center gap-1.5 text-[14px] text-[#B5541E] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to menu</span>
          </button>

          <h3 className="font-heading font-bold text-[20px] text-[#2A1B12]">
            Select Persona
          </h3>

          <div className="space-y-2">
            {users.map((u) => {
              const isCurrent = currentUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    selectUser(u.id);
                    onClose();
                  }}
                  className={`w-full p-4 rounded-[20px] text-left flex items-center justify-between border cursor-pointer transition-colors ${
                    isCurrent
                      ? 'bg-[#B5541E] text-white border-[#B5541E]'
                      : 'bg-[#FFFBF3] text-[#2A1B12] border-[#EADFC9] hover:bg-[#F4EBDA]'
                  }`}
                >
                  <div>
                    <div className="font-heading font-bold text-[16px]">
                      {u.name}
                    </div>
                    <div className={`text-[12px] uppercase ${isCurrent ? 'text-white/80' : 'text-[#6B5B4E]'}`}>
                      {u.role} &bull; {(u.categories && u.categories[0]) || (u.role === 'customer' ? 'Customer' : 'Staff')}
                    </div>
                  </div>
                  {isCurrent && <span className="text-[12px] font-bold">Active</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Subview: About */}
      {activeSubView === 'about' && (
        <div className="space-y-4 text-[14px] leading-[22px] text-[#2A1B12]">
          <button
            type="button"
            onClick={() => setActiveSubView('menu')}
            className="flex items-center gap-1.5 text-[14px] text-[#B5541E] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to menu</span>
          </button>

          <h3 className="font-heading font-bold text-[20px] text-[#2A1B12]">
            How fair prices work
          </h3>

          <p>
            FairFix computes live price bands directly from completed local repair jobs in your neighborhood.
          </p>

          <div className="bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-4 space-y-2">
            <ul className="list-disc list-inside space-y-2 text-[#6B5B4E] text-[14px]">
              <li><strong>Typical price:</strong> The middle price paid for recently finished repairs.</li>
              <li><strong>Fair band:</strong> The central 50% range of completed jobs.</li>
              <li><strong>Unusual prices removed:</strong> High or low outliers are discarded automatically.</li>
              <li><strong>Demo data honesty:</strong> All initial benchmark numbers come from seed completed repair records.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Subview: Demo Controls */}
      {activeSubView === 'controls' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setActiveSubView('menu')}
            className="flex items-center gap-1.5 text-[14px] text-[#B5541E] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to menu</span>
          </button>

          <h3 className="font-heading font-bold text-[20px] text-[#2A1B12]">
            Demo Controls
          </h3>

          <div className="space-y-2">
            <SecondaryButton fullWidth onClick={handleFastForward} loading={runningAction === 'fast_forward'}>
              Fast forward negotiation to completion
            </SecondaryButton>

            <SecondaryButton fullWidth onClick={handleSimulateCounter} loading={runningAction === 'counter'}>
              Simulate worker counter-offer
            </SecondaryButton>

            <SecondaryButton fullWidth onClick={handleInjectOutlier} loading={runningAction === 'outlier'}>
              Test unusual price rejection
            </SecondaryButton>
          </div>
        </div>
      )}
    </Sheet>
  );
};
