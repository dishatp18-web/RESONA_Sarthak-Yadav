/**
 * FairFix - Hyperlocal On-Demand Blue-Collar Services
 * Design System "Mark III Forge" Implementation
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemoUserProvider, useDemoUser } from './context/DemoUserContext.js';
import { ToastProvider, ArcLoader } from './components/ui/index.js';
import { Navbar } from './components/Navbar.js';
import { CustomerNewRequest } from './components/CustomerNewRequest.js';
import { WorkerView } from './components/WorkerView.js';
import { FairPriceExplorer } from './components/FairPriceExplorer.js';
import { AdminPlaceholder } from './components/AdminPlaceholder.js';
import { DemoControls } from './components/DemoControls.js';
import { PublicTracker } from './components/PublicTracker.js';
import { BatchDispatch } from './components/BatchDispatch.js';
import { ConceptLab } from './components/ConceptLab.js';
import type { TabType } from './components/Navbar.js';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<TabType>('customer');
  const { loading } = useDemoUser();

  // Check if public tracking route is accessed (/track/:token)
  const isTrackRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/track/');
  const trackToken = isTrackRoute ? window.location.pathname.replace(/^\/track\//, '').split('/')[0] : null;

  // Boot sequence: runs once per session, skippable on click
  const [booting, setBooting] = useState<boolean>(() => {
    if (isTrackRoute) return false;
    return !sessionStorage.getItem('fairfix_booted');
  });

  useEffect(() => {
    if (booting) {
      const timer = setTimeout(() => {
        sessionStorage.setItem('fairfix_booted', 'true');
        setBooting(false);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [booting]);

  const handleSkipBoot = () => {
    sessionStorage.setItem('fairfix_booted', 'true');
    setBooting(false);
  };

  if (isTrackRoute && trackToken) {
    return (
      <PublicTracker
        token={trackToken}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07070A] flex flex-col items-center justify-center text-[#F4F1EC] relative z-10">
        <ArcLoader size="lg" className="mb-4" />
        <p className="font-heading font-bold text-sm tracking-wider uppercase text-white">
          Initializing FairFix Hyperlocal Engine...
        </p>
        <p className="text-xs text-[#A7A29A] mt-1 font-mono">Connecting SQLite &amp; loading Bengaluru seed market data</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070A] text-[#F4F1EC] flex flex-col font-sans selection:bg-[#FFB81C] selection:text-black relative">
      {/* Background Atmosphere: Hex-Grid + Radial Glows + Scanlines */}
      <div className="forge-bg">
        <div className="forge-hex-grid" />
        <div className="forge-glow-red" />
        <div className="forge-glow-gold" />
        <div className="forge-scanlines" />
      </div>

      {/* Boot Sequence Overlay (Once per session, skippable on click) */}
      <AnimatePresence>
        {booting && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleSkipBoot}
            className="fixed inset-0 z-50 bg-[#07070A] flex flex-col items-center justify-center cursor-pointer p-4"
          >
            <motion.div
              initial={{ scaleY: 0.96, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-3"
            >
              <ArcLoader size="lg" />
              <div className="space-y-1">
                <p className="font-heading font-bold text-lg tracking-widest uppercase text-white">
                  FAIRFIX COCKPIT ONLINE
                </p>
                <p className="text-xs font-mono text-[#5EE6FF]">
                  &gt; LIVE BAND TELEMETRY ACTIVE &bull; SYSTEM ONLINE
                </p>
              </div>
              <p className="text-[10px] text-[#A7A29A] font-mono mt-4">
                Click anywhere to skip
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main className="flex-1 pb-16">
          {currentTab === 'customer' && <CustomerNewRequest />}
          {currentTab === 'worker' && <WorkerView />}
          {currentTab === 'explorer' && <FairPriceExplorer />}
          {currentTab === 'dispatch' && <BatchDispatch />}
          {currentTab === 'lab' && <ConceptLab />}
          {currentTab === 'admin' && <AdminPlaceholder />}
        </main>

        {/* Persistent Bottom Status Strip */}
        <footer className="bg-[#07070A]/95 border-t border-[#2A2E3A] text-[11px] text-[#A7A29A] py-3 px-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-heading uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5EE6FF] shadow-[0_0_6px_#5EE6FF] animate-pulse" />
              <span className="text-[#F4F1EC] font-bold">FairFix &bull; Mark III Forge Architecture</span>
            </div>
            <div className="flex items-center gap-3 text-[#A7A29A] font-mono text-[10px]">
              <span>CartoDB Dark Tiles</span>
              <span>&bull;</span>
              <span>SQLite</span>
              <span>&bull;</span>
              <span className="text-[#FFB81C] font-bold">Live IQR Price Band Active</span>
            </div>
          </div>
        </footer>

        {/* Floating Demo Simulator Controls */}
        <DemoControls />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <DemoUserProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </DemoUserProvider>
  );
}
