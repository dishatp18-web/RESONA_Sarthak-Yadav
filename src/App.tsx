/**
 * FairFix - Hyperlocal On-Demand Blue-Collar Services
 * Layer 1 App Shell: Tap-driven, bottom navigation, no long page scrolling.
 * 100dvh 3-row grid: Header (48px) | Content (1fr) | Bottom Nav (64px + env(safe-area-inset-bottom))
 */
import React, { useState, useEffect } from 'react';
import { DemoUserProvider, useDemoUser } from './context/DemoUserContext.js';
import { ToastProvider, ArcLoader } from './components/ui/index.js';
import { useHashRouter } from './hooks/useHashRouter.js';
import { BottomNav } from './components/BottomNav.js';
import { DesktopNavRail } from './components/DesktopNavRail.js';
import { MoreSheet } from './components/MoreSheet.js';
import { CustomerHome } from './components/CustomerHome.js';
import { BookWizard } from './components/BookWizard.js';
import { JobsView } from './components/JobsView.js';
import { FairPriceExplorer } from './components/FairPriceExplorer.js';
import { WorkerView } from './components/WorkerView.js';
import { AdminPlaceholder } from './components/AdminPlaceholder.js';
import { BatchDispatch } from './components/BatchDispatch.js';
import { ConceptLab } from './components/ConceptLab.js';
import { PublicTracker } from './components/PublicTracker.js';
import { ArrowLeft, User } from 'lucide-react';

// Lazy-load 3D Welcome Landing Page
const WelcomeLanding3D = React.lazy(() =>
  import('./components/WelcomeLanding3D.js').then((m) => ({ default: m.WelcomeLanding3D }))
);

function ShellApp() {
  const { currentUser, currentRole, loading } = useDemoUser();
  const { route, navigate, goBack } = useHashRouter();

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [recordingMode, setRecordingMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage?.getItem('fairfix_recording_mode') === 'true';
    }
    return false;
  });
  const [selectedCategoryForBooking, setSelectedCategoryForBooking] = useState<string>('plumbing');

  // Check public tracking route (/track/:token)
  const isTrackRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/track/');
  const trackToken = isTrackRoute ? window.location.pathname.replace(/^\/track\//, '').split('/')[0] : null;

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

  // Check welcome landing route (skip if recordingMode is true or ?app query present)
  const shouldSkipLanding = recordingMode || Boolean(route.query?.app);
  if (route.path === 'welcome') {
    if (shouldSkipLanding) {
      navigate('#/home');
    } else {
      return (
        <React.Suspense
          fallback={
            <div className="h-[100dvh] w-screen bg-[#FCF5E8] flex flex-col items-center justify-center text-[#2A1B12] select-none">
              <ArcLoader size="lg" className="mb-4" />
              <p className="font-heading font-bold text-base text-[#B5541E]">
                Loading FairFix...
              </p>
            </div>
          }
        >
          <WelcomeLanding3D
            onEnterApp={() => navigate('#/home')}
            onBookService={() => {
              setSelectedCategoryForBooking('plumbing');
              navigate('#/book/1');
            }}
            onExplorePrices={() => navigate('#/prices')}
            onOpenLab={() => navigate('#/lab')}
            onOpenDispatch={() => navigate('#/dispatch')}
          />
        </React.Suspense>
      );
    }
  }

  // Handle open more if route is #/more
  useEffect(() => {
    if (route.path === 'more') {
      setIsMoreOpen(true);
    }
  }, [route.path]);

  // Loading state
  if (loading) {
    return (
      <div className="h-[100dvh] w-screen bg-[#FCF5E8] flex flex-col items-center justify-center text-[#2A1B12] select-none">
        <ArcLoader size="lg" className="mb-4" />
        <p className="font-heading font-bold text-base text-[#2A1B12]">
          Loading FairFix...
        </p>
      </div>
    );
  }

  const isFullScreenRoute = Boolean(route.path === 'jobs' && route.subpath);
  const currentPath = route.path;

  // Compute screen title for header
  const getScreenTitle = () => {
    if (route.path === 'welcome') return 'Welcome';
    if (route.path === 'home') return 'FairFix';
    if (route.path === 'book') return 'Book a service';
    if (route.path === 'jobs') {
      return route.subpath ? `Job ${route.subpath.replace(/^job_/, '')}` : 'Jobs';
    }
    if (route.path === 'prices') return 'Prices';
    if (route.path === 'worker') {
      const sub = route.subpath || 'requests';
      if (sub === 'requests') return 'Requests';
      if (sub === 'jobs') return 'Jobs';
      if (sub === 'rate') return 'Rate';
      if (sub === 'prices') return 'Prices';
      return 'Worker';
    }
    if (route.path === 'admin') {
      const sub = route.subpath || 'queue';
      if (sub === 'queue') return 'Queue';
      if (sub === 'reports') return 'Reports';
      if (sub === 'bands') return 'Bands';
      if (sub === 'dispatch') return 'Batch Dispatch';
      return 'Admin';
    }
    if (route.path === 'dispatch') return 'Batch Dispatch';
    if (route.path === 'lab') return 'Concept Lab';
    return 'FairFix';
  };

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-[#FCF5E8] text-[#2A1B12] flex flex-col font-sans select-none relative">
      {/* Desktop Left Rail (>=1024px) */}
      <DesktopNavRail
        currentPath={currentPath}
        onNavigate={navigate}
        onOpenMore={() => setIsMoreOpen(true)}
      />

      {/* Main Grid Wrapper */}
      <div className="relative z-10 flex-1 grid grid-rows-[48px_1fr_calc(64px+env(safe-area-inset-bottom,0px))] lg:grid-rows-[48px_1fr] lg:pl-[72px] h-[100dvh] overflow-hidden">
        {/* ROW 1: HEADER (48px) */}
        <header className="h-12 bg-[#FFFBF3] border-b border-[#EADFC9] px-4 sm:px-6 flex items-center justify-between select-none shrink-0 z-30">
          <div className="flex items-center gap-2.5">
            {isFullScreenRoute ? (
              <button
                type="button"
                onClick={goBack}
                className="w-8 h-8 rounded-full bg-[#F4EBDA] hover:bg-[#EADFC9] flex items-center justify-center text-[#2A1B12] transition cursor-pointer"
                aria-label="Back to jobs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('#/home')}
                className="flex items-center gap-2 cursor-pointer focus:outline-none"
              >
                <div className="w-7 h-7 rounded-lg bg-[#B5541E] text-white flex items-center justify-center font-heading font-extrabold text-sm">
                  F
                </div>
                <span className="font-heading font-bold text-base tracking-tight text-[#2A1B12] hidden sm:inline">
                  FairFix
                </span>
              </button>
            )}

            <div className="h-4 w-px bg-[#EADFC9] hidden sm:block" />

            <h1 className="font-heading font-bold text-sm text-[#2A1B12] truncate max-w-[180px] sm:max-w-md">
              {getScreenTitle()}
            </h1>
          </div>

          {/* Right Header: User Chip (opens More Sheet) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMoreOpen(true)}
              className="flex items-center gap-1.5 py-1 px-3 rounded-full bg-[#F4EBDA] hover:bg-[#EADFC9] text-[#2A1B12] transition cursor-pointer"
              title="Open More"
              aria-label="Demo Persona"
            >
              <div className="w-5 h-5 rounded-full bg-[#B5541E] text-white flex items-center justify-center font-heading font-bold text-[11px]">
                {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <span className="text-[13px] font-medium text-[#2A1B12] max-w-[100px] truncate hidden sm:inline">
                {currentUser?.name || 'User'}
              </span>
              <span className="text-[11px] text-[#6B5B4E] uppercase font-medium">
                {currentRole}
              </span>
            </button>
          </div>
        </header>

        {/* ROW 2: CONTENT (1fr) */}
        <main className="relative flex-1 overflow-hidden h-full">
          {/* Welcome Screen */}
          <div
            className={`h-full w-full ${route.path === 'welcome' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'welcome'}
          >
            <div className="h-full overflow-y-auto overscroll-contain flex flex-col items-center justify-center p-6 text-center bg-[#FCF5E8]">
              <div className="max-w-md bg-[#FFFBF3] border border-[#EADFC9] rounded-[20px] p-8 shadow-sm space-y-5">
                <div className="w-14 h-14 rounded-full bg-[#B5541E] text-white flex items-center justify-center font-heading font-extrabold text-2xl mx-auto">
                  F
                </div>
                <div>
                  <h2 className="font-heading text-2xl font-bold text-[#B5541E]">
                    What needs fixing today?
                  </h2>
                  <p className="text-sm text-[#6B5B4E] mt-2 leading-relaxed">
                    Book a nearby tradesperson, and see what a fair price looks like first.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('#/home')}
                    className="w-full h-[52px] rounded-full bg-[#B5541E] hover:bg-[#9E4717] text-white font-heading font-semibold text-base flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                  >
                    <span>Book a service</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Home Screen */}
          <div
            className={`h-full w-full ${route.path === 'home' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'home'}
          >
            <CustomerHome
              onSelectCategoryAndBook={(cat) => {
                setSelectedCategoryForBooking(cat);
                navigate('#/book/2');
              }}
              onOpenBook={() => navigate('#/book/1')}
              onNavigate={navigate}
            />
          </div>

          {/* Book Wizard Screen */}
          <div
            className={`h-full w-full ${route.path === 'book' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'book'}
          >
            <BookWizard
              initialStep={route.subpath ? parseInt(route.subpath, 10) : 1}
              initialCategory={selectedCategoryForBooking}
              onNavigate={navigate}
            />
          </div>

          {/* Jobs & Negotiation Screen */}
          <div
            className={`h-full w-full ${route.path === 'jobs' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'jobs'}
          >
            <JobsView
              selectedJobId={route.subpath || null}
              onSelectJob={(id) => {
                if (id) navigate(`#/jobs/${id}`);
                else navigate('#/jobs');
              }}
              onNavigate={navigate}
            />
          </div>

          {/* FairPriceExplorer Screen */}
          <div
            className={`h-full w-full ${route.path === 'prices' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'prices'}
          >
            <FairPriceExplorer />
          </div>

          {/* Worker View Screen */}
          <div
            className={`h-full w-full ${route.path === 'worker' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'worker'}
          >
            <WorkerView
              initialSection={
                (route.subpath as 'requests' | 'jobs' | 'rate' | 'prices') || 'requests'
              }
              onNavigate={navigate}
            />
          </div>

          {/* Admin Placeholder Screen */}
          <div
            className={`h-full w-full ${route.path === 'admin' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'admin'}
          >
            <AdminPlaceholder
              initialSection={
                (route.subpath as 'queue' | 'reports' | 'bands' | 'dispatch') || 'queue'
              }
              onNavigate={navigate}
            />
          </div>

          {/* Batch Dispatch Screen */}
          <div
            className={`h-full w-full ${route.path === 'dispatch' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'dispatch'}
          >
            <BatchDispatch />
          </div>

          {/* Concept Lab Screen */}
          <div
            className={`h-full w-full ${route.path === 'lab' ? 'block' : 'hidden'}`}
            aria-hidden={route.path !== 'lab'}
          >
            <ConceptLab />
          </div>
        </main>

        {/* ROW 3: BOTTOM NAVIGATION (64px + env(safe-area-inset-bottom)) on mobile */}
        <BottomNav
          currentPath={currentPath}
          onNavigate={navigate}
          onOpenMore={() => setIsMoreOpen(true)}
          isFullScreenRoute={isFullScreenRoute}
        />
      </div>

      {/* More Bottom Sheet */}
      <MoreSheet
        isOpen={isMoreOpen}
        onClose={() => {
          setIsMoreOpen(false);
          if (route.path === 'more') {
            goBack();
          }
        }}
        onNavigate={navigate}
        recordingMode={recordingMode}
        setRecordingMode={setRecordingMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <DemoUserProvider>
      <ToastProvider>
        <ShellApp />
      </ToastProvider>
    </DemoUserProvider>
  );
}
