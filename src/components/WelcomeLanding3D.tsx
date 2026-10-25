/**
 * FairFix - 3D Scroll Landing Page (#/welcome)
 * Calm Edition: Cream world (#FCF5E8), terracotta (#B5541E) geometry,
 * soft shadows, no neon, no dark graphite.
 * 4 scenes:
 * (1) hero + 3-number StatRow
 * (2) request and match
 * (3) the fair-price band (hero scene)
 * (4) trust and call to action
 * Each scene has ONE headline (Display), ONE sentence, and at most one pill.
 */
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { StatRow, PrimaryButton, SecondaryButton, Card, TextLink } from './ui/index.js';

interface WelcomeLanding3DProps {
  onEnterApp: () => void;
  onBookService: () => void;
  onExplorePrices: () => void;
  onOpenLab?: () => void;
  onOpenDispatch?: () => void;
}

interface BandData {
  category: string;
  low: number;
  typical: number;
  high: number;
  jobCount: number;
  outliersRemoved: number;
}

interface WorkerMatch {
  id: string;
  name: string;
  distanceKm: number;
  etaMinutes: number;
  baseRate: number;
}

interface LiveStats {
  completedJobs: number;
  verifiedWorkers: number;
  averageRating: number;
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext && 
      (canvas.getContext('webgl2') || canvas.getContext('webgl') || (canvas as any).getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function WelcomeLanding3D({
  onEnterApp,
  onBookService,
  onExplorePrices,
}: WelcomeLanding3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [useCssFallback, setUseCssFallback] = useState(false);
  const [activeSection, setActiveSection] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  const [selectedCategory, setSelectedCategory] = useState<string>('plumbing');
  const [bandData, setBandData] = useState<BandData>({
    category: 'plumbing',
    low: 420,
    typical: 450,
    high: 500,
    jobCount: 14,
    outliersRemoved: 1,
  });
  const [matchingWorkers, setMatchingWorkers] = useState<WorkerMatch[]>([]);
  const [stats, setStats] = useState<LiveStats>({
    completedJobs: 66,
    verifiedWorkers: 8,
    averageRating: 4.8,
  });

  // Check user preference for reduced motion
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !isWebGLAvailable()) {
      setUseCssFallback(true);
    }
  }, []);

  // Fetch live API data
  useEffect(() => {
    let mounted = true;
    async function fetchLiveData() {
      try {
        const bandRes = await fetch(`/api/price-band?category=${selectedCategory}`);
        if (bandRes.ok) {
          const bandJson = await bandRes.json();
          if (mounted && bandJson.band) {
            setBandData(bandJson.band);
          }
        }

        const matchRes = await fetch(`/api/matching?category=${selectedCategory}&lat=12.9352&lng=77.6245`);
        if (matchRes.ok) {
          const matchJson = await matchRes.json();
          if (mounted && Array.isArray(matchJson)) {
            setMatchingWorkers(matchJson);
          }
        }

        const [statsRes, usersRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/users'),
        ]);

        if (statsRes.ok && usersRes.ok) {
          const sJson = await statsRes.json();
          const uJson = await usersRes.json();
          if (mounted && Array.isArray(uJson)) {
            const workers = uJson.filter((u: any) => u.role === 'worker');
            const verified = workers.filter((w: any) => w.verification_status === 'verified').length;
            setStats({
              completedJobs: sJson.completedJobs || 66,
              verifiedWorkers: verified || 8,
              averageRating: 4.8,
            });
          }
        }
      } catch (err) {
        // Fallback to seed defaults
      }
    }
    fetchLiveData();
    return () => { mounted = false; };
  }, [selectedCategory]);

  // Handle scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
      setScrollProgress(progress);

      const sectionIndex = Math.min(3, Math.floor(progress * 4 + 0.1));
      setActiveSection(sectionIndex);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Three.js Procedural Canvas Lifecycle with Calm Cream and Terracotta Theme
  useEffect(() => {
    if (useCssFallback) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFCF5E8); // Cream #FCF5E8 world
    scene.fog = new THREE.FogExp2(0xFCF5E8, 0.03);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.replaceChildren(renderer.domElement);

    // Warm Ambient and Directional Lights
    const ambientLight = new THREE.AmbientLight(0xFFFBF3, 1.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFE8D6, 1.8);
    dirLight.position.set(12, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Ground Plane
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xFCF5E8,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Terracotta (#B5541E) extruded sculptural blocks
    const terracottaMat = new THREE.MeshStandardMaterial({
      color: 0xB5541E,
      roughness: 0.5,
      metalness: 0.05,
    });
    const creamMat = new THREE.MeshStandardMaterial({
      color: 0xFFFBF3,
      roughness: 0.6,
      metalness: 0.0,
    });

    const blockGroup = new THREE.Group();
    const positions = [
      { x: -3.5, y: 0.5, z: -2, sx: 2, sy: 3, sz: 2, mat: terracottaMat },
      { x: 3.5, y: -0.2, z: -3, sx: 2.2, sy: 2, sz: 2.2, mat: creamMat },
      { x: -1, y: 1.2, z: -6, sx: 2.5, sy: 4.5, sz: 2.5, mat: terracottaMat },
      { x: 2, y: 0.8, z: -7, sx: 3, sy: 3.8, sz: 3, mat: creamMat },
      { x: -4, y: 0, z: -10, sx: 2, sy: 2.5, sz: 2, mat: terracottaMat },
      { x: 4, y: 0.5, z: -11, sx: 2.5, sy: 3.2, sz: 2.5, mat: creamMat },
    ];

    positions.forEach((p) => {
      const geo = new THREE.BoxGeometry(p.sx, p.sy, p.sz);
      const mesh = new THREE.Mesh(geo, p.mat);
      mesh.position.set(p.x, p.y, p.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      blockGroup.add(mesh);
    });
    scene.add(blockGroup);

    // Camera track
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 3, 6),
      new THREE.Vector3(-1.5, 2.5, 1),
      new THREE.Vector3(1.5, 3.2, -4),
      new THREE.Vector3(0, 4, -8),
    ]);

    let animId: number;
    const render = () => {
      const targetPoint = curve.getPointAt(Math.max(0, Math.min(1, scrollProgress)));
      camera.position.lerp(targetPoint, 0.08);
      camera.lookAt(0, 0.5, camera.position.z - 5);

      blockGroup.rotation.y = scrollProgress * 0.2;
      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };
    render();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
    };
  }, [useCssFallback, scrollProgress]);

  const scrollToSection = (index: number) => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;
    const targetScrollTop = (scrollContainer.scrollHeight - scrollContainer.clientHeight) * (index / 3);
    scrollContainer.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
  };

  return (
    <div ref={containerRef} className="relative w-screen h-[100dvh] bg-[#FCF5E8] text-[#2A1B12] overflow-hidden select-none font-sans">
      {/* Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 px-6 sm:px-12 flex items-center justify-between z-50 pointer-events-auto bg-[#FCF5E8]/85 backdrop-blur-md border-b border-[#EADFC9]/60">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#B5541E] text-white flex items-center justify-center font-heading font-extrabold text-base">
            F
          </div>
          <span className="font-heading font-bold text-lg text-[#2A1B12] tracking-tight">
            FairFix
          </span>
        </div>

        {/* Center: Three links (hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#6B5B4E]">
          <button type="button" onClick={() => scrollToSection(1)} className="hover:text-[#B5541E] cursor-pointer">
            How it works
          </button>
          <button type="button" onClick={() => scrollToSection(2)} className="hover:text-[#B5541E] cursor-pointer">
            Fair prices
          </button>
          <button type="button" onClick={() => scrollToSection(3)} className="hover:text-[#B5541E] cursor-pointer">
            Safety
          </button>
        </nav>

        {/* Right: Open app pill & Skip to app */}
        <div className="flex items-center gap-4">
          <TextLink onClick={onEnterApp} className="text-[14px]">
            Skip to app
          </TextLink>
          <PrimaryButton onClick={onEnterApp} className="!h-[40px] !text-[14px] !px-5">
            Open app
          </PrimaryButton>
        </div>
      </header>

      {/* Background 3D Canvas */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full pointer-events-none z-0" aria-hidden="true" />

      {/* Progress Dots on Right Rail */}
      <nav aria-label="Section Navigation" className="fixed right-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 pointer-events-auto">
        {['Hero', 'Match', 'Prices', 'Trust'].map((sec, idx) => (
          <button
            key={sec}
            type="button"
            onClick={() => scrollToSection(idx)}
            className="group flex items-center justify-end gap-2 p-1.5 focus:outline-none cursor-pointer"
            aria-label={`Go to section ${idx + 1}`}
          >
            <div
              className={`rounded-full transition-all duration-200 ${
                activeSection === idx
                  ? 'w-6 h-2 bg-[#B5541E]'
                  : 'w-2 h-2 bg-[#EADFC9] group-hover:bg-[#6B5B4E]'
              }`}
            />
          </button>
        ))}
      </nav>

      {/* Native Vertical Scroll Container (4 Scenes) */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 w-full h-[100dvh] overflow-y-auto overscroll-contain snap-y snap-mandatory scroll-smooth"
      >
        {/* ========================================================= */}
        {/* SCENE 1: HERO                                             */}
        {/* ========================================================= */}
        <section className="min-h-[100dvh] w-full flex flex-col justify-between p-6 sm:p-16 snap-start pt-24 max-w-4xl mx-auto">
          <div className="space-y-6 mt-8 sm:mt-16">
            <h1 className="text-display">
              WHAT NEEDS FIXING TODAY?
            </h1>

            <p className="text-[16px] leading-[26px] text-[#6B5B4E] max-w-xl">
              Book a nearby tradesperson, and see what a fair price looks like first.
            </p>

            <div>
              <PrimaryButton onClick={onBookService} className="min-w-[180px]">
                Book a service
              </PrimaryButton>
            </div>
          </div>

          {/* 3-number StatRow using live API values */}
          <div className="pt-8 border-t border-[#EADFC9]/80 max-w-xl">
            <StatRow
              stats={[
                { value: stats.completedJobs, label: 'completed jobs (demo data)' },
                { value: stats.verifiedWorkers, label: 'verified workers' },
                { value: `${stats.averageRating}★`, label: 'average rating' },
              ]}
            />
          </div>
        </section>

        {/* ========================================================= */}
        {/* SCENE 2: REQUEST AND MATCH                                */}
        {/* ========================================================= */}
        <section className="min-h-[100dvh] w-full flex flex-col justify-center p-6 sm:p-16 snap-start max-w-2xl mx-auto">
          <Card className="space-y-6 !p-8">
            <h2 className="text-display !text-[36px] sm:!text-[44px]">
              Nearby Tradespeople
            </h2>

            <p className="text-[16px] leading-[24px] text-[#6B5B4E]">
              Workers within 5 km receive your request directly without arbitrary platform markups.
            </p>

            <div className="space-y-3">
              {(matchingWorkers.slice(0, 3)).map((worker) => (
                <div
                  key={worker.id}
                  className="p-3.5 rounded-[16px] bg-[#FCF5E8] border border-[#EADFC9] flex items-center justify-between text-[14px]"
                >
                  <div className="font-heading font-bold text-[#2A1B12]">
                    {worker.name}
                  </div>
                  <div className="text-[#6B5B4E]">
                    ~{worker.etaMinutes || 12} min (estimate) &bull; Base ₹{worker.baseRate}
                  </div>
                </div>
              ))}
            </div>

            <PrimaryButton fullWidth onClick={onBookService}>
              Find nearby workers
            </PrimaryButton>
          </Card>
        </section>

        {/* ========================================================= */}
        {/* SCENE 3: THE FAIR-PRICE BAND (HERO SCENE)                 */}
        {/* ========================================================= */}
        <section className="min-h-[100dvh] w-full flex flex-col justify-center p-6 sm:p-16 snap-start max-w-2xl mx-auto">
          <Card className="space-y-6 !p-8">
            <h2 className="text-display !text-[36px] sm:!text-[44px]">
              The Live Fair-Price Band
            </h2>

            <p className="text-[16px] leading-[24px] text-[#6B5B4E]">
              Completed repairs set the neighborhood price range, with unusual prices removed automatically.
            </p>

            {/* Price band track */}
            <div className="p-4 rounded-[20px] bg-[#FCF5E8] border border-[#EADFC9] space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[12px] text-[#6B5B4E]">Typical range</div>
                  <div className="font-heading font-extrabold text-[24px] text-[#2A1B12]">
                    ₹{bandData.low} &ndash; ₹{bandData.high}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] text-[#6B5B4E]">Typical price</div>
                  <div className="font-heading font-extrabold text-[24px] text-[#B5541E]">
                    ₹{bandData.typical}
                  </div>
                </div>
              </div>

              <div className="h-2 w-full bg-[#EADFC9] rounded-full overflow-hidden relative flex">
                <div className="w-[20%] h-full bg-[#EADFC9]" />
                <div className="w-[60%] h-full bg-[#059669] rounded-full" />
                <div className="w-[20%] h-full bg-[#EADFC9]" />
              </div>
            </div>

            <PrimaryButton fullWidth onClick={onExplorePrices}>
              Explore prices
            </PrimaryButton>
          </Card>
        </section>

        {/* ========================================================= */}
        {/* SCENE 4: TRUST AND CALL TO ACTION                         */}
        {/* ========================================================= */}
        <section className="min-h-[100dvh] w-full flex flex-col justify-center p-6 sm:p-16 snap-start max-w-2xl mx-auto">
          <Card className="space-y-6 !p-8 text-center">
            <h2 className="text-display !text-[36px] sm:!text-[44px]">
              Fair Prices for Bengaluru
            </h2>

            <p className="text-[16px] leading-[24px] text-[#6B5B4E] max-w-md mx-auto">
              Direct communication, transparent negotiation in up to 3 rounds, and zero hidden commissions.
            </p>

            <div className="pt-2">
              <PrimaryButton fullWidth onClick={onEnterApp}>
                Open app
              </PrimaryButton>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
