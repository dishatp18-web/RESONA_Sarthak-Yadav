/**
 * FairFix Live Tracking Map - "Mark III Forge" Edition
 * Features:
 * - Leaflet CartoDB Dark Matter tiles
 * - Worker marker with pulsing radar ping and accuracy circle
 * - Gold destination pin for customer job site
 * - Trail polyline connecting the last 20 tracking points
 * - Real-time ETA recomputed from straight-line distance and recent speed (clamped 10 - 40 km/h)
 * - OSRM Road ETA probe with 2s timeout fallback to straight-line
 * - "Last updated X s ago" text with caution "Stale location" chip after 30 s
 * - 100 m Geofence detection with "Worker has arrived" banner & prompt to Start Job (never auto-start)
 * - "SIMULATED GPS" chip whenever simulated telemetry is fed
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Badge, HudPanel, formatINR } from './ui/index.js';
import { haversineDistanceKm } from '../utils/geo.js';
import { 
  Navigation, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Radio, 
  Zap,
  Play
} from 'lucide-react';

interface TrackingMapProps {
  jobId: string;
  customerLat: number;
  customerLng: number;
  workerName?: string;
  isWorkerRole?: boolean;
  onWorkerArrived?: () => void;
  heightClass?: string;
}

// Map center adjuster
function RecenterOnPoints({ points, customerPos }: { points: [number, number][]; customerPos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds([customerPos, ...points]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [points.length]);
  return null;
}

// Custom DivIcon for Customer Destination
const createCustomerIcon = () =>
  L.divIcon({
    className: 'forge-customer-dest-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #8E0B16 0%, #D7261E 40%, #FFB81C 100%);
        border: 2px solid #FFD65A;
        border-radius: 50%;
        box-shadow: 0 0 18px rgba(255, 184, 28, 0.8), 0 4px 10px rgba(0,0,0,0.7);
        color: white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  });

// Custom DivIcon for Worker with animated cyan radar pulse
const createWorkerTrackingIcon = (isSimulated: boolean) =>
  L.divIcon({
    className: 'forge-worker-tracking-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${isSimulated ? 'rgba(255, 184, 28, 0.25)' : 'rgba(94, 230, 255, 0.25)'};
          border: 1.5px solid ${isSimulated ? '#FFB81C' : '#5EE6FF'};
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: #07070A;
          border: 2.5px solid ${isSimulated ? '#FFB81C' : '#5EE6FF'};
          border-radius: 50%;
          box-shadow: 0 0 16px ${isSimulated ? 'rgba(255, 184, 28, 0.8)' : 'rgba(94, 230, 255, 0.8)'};
          color: ${isSimulated ? '#FFB81C' : '#5EE6FF'};
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });

export const TrackingMap: React.FC<TrackingMapProps> = ({
  jobId,
  customerLat,
  customerLng,
  workerName,
  isWorkerRole = false,
  onWorkerArrived,
  heightClass = 'h-[360px] sm:h-[420px]',
}) => {
  const [points, setPoints] = useState<any[]>([]);
  const [isCoarse, setIsCoarse] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [lastUpdateTs, setLastUpdateTs] = useState<number>(Date.now());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [roadEtaMinutes, setRoadEtaMinutes] = useState<number | null>(null);
  const [roadEtaFailed, setRoadEtaFailed] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);

  // Poll server tracking points every 3.5 seconds
  useEffect(() => {
    let mounted = true;
    const fetchPoints = async () => {
      try {
        const res = await fetch(`/api/tracking/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;

        if (data.points && Array.isArray(data.points)) {
          setPoints(data.points);
          setIsCoarse(Boolean(data.is_coarse));

          if (data.points.length > 0) {
            const latest = data.points[data.points.length - 1];
            setLastUpdateTs(new Date(latest.ts).getTime());
            // Check if simulated
            if (latest.accuracy === 10 || latest.is_simulated) {
              setIsSimulated(true);
            }
          }
        }
      } catch (err) {
        console.error('Error polling tracking fixes:', err);
      }
    };

    fetchPoints();
    const interval = setInterval(fetchPoints, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [jobId]);

  // Update "Last updated X s ago" ticker
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((Date.now() - lastUpdateTs) / 1000));
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [lastUpdateTs]);

  const latestPoint = points[points.length - 1];

  // Geofence & straight-line calculation
  const { distanceKm, distanceMeters, straightLineEtaMinutes } = useMemo(() => {
    if (!latestPoint) {
      return { distanceKm: 0, distanceMeters: 0, straightLineEtaMinutes: 10 };
    }
    const dKm = haversineDistanceKm(latestPoint.lat, latestPoint.lng, customerLat, customerLng);
    const dM = Math.round(dKm * 1000);

    // Speed clamped between 10 km/h and 40 km/h
    const currentSpeed = Math.min(40, Math.max(10, latestPoint.speed || 20));
    const etaMin = Math.max(1, Math.round((dKm / currentSpeed) * 60));

    return { distanceKm: dKm, distanceMeters: dM, straightLineEtaMinutes: etaMin };
  }, [latestPoint, customerLat, customerLng]);

  // Check 100m geofence
  useEffect(() => {
    if (latestPoint && distanceMeters <= 100) {
      if (!hasArrived) {
        setHasArrived(true);
        if (onWorkerArrived) onWorkerArrived();
      }
    } else {
      setHasArrived(false);
    }
  }, [distanceMeters, latestPoint]);

  // Optional OSRM Road ETA Probe (2s timeout, falls back to straight-line)
  useEffect(() => {
    if (!latestPoint) return;
    let aborted = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const probeOsrm = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${latestPoint.lng},${latestPoint.lat};${customerLng},${customerLat}?overview=false`;
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error('OSRM error');
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const durationSeconds = data.routes[0].duration;
          const minutes = Math.max(1, Math.round(durationSeconds / 60));
          if (!aborted) {
            setRoadEtaMinutes(minutes);
            setRoadEtaFailed(false);
          }
        }
      } catch {
        if (!aborted) {
          setRoadEtaFailed(true);
        }
      }
    };

    probeOsrm();
    return () => {
      aborted = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [latestPoint?.lat, latestPoint?.lng, customerLat, customerLng]);

  const polylineCoords = useMemo<[number, number][]>(() => {
    return points.map((p) => [p.lat, p.lng]);
  }, [points]);

  const customerPos: [number, number] = [customerLat, customerLng];
  const isStale = secondsAgo >= 30;

  return (
    <div className="space-y-3">
      {/* Telemetry Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 bg-[#07070A] rounded-xl border border-[#2A2E3A] text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-white font-mono font-bold">
            <Radio className="w-4 h-4 text-[#5EE6FF] animate-pulse" />
            <span>ETA: {roadEtaMinutes && !roadEtaFailed ? `${roadEtaMinutes} min` : `~${straightLineEtaMinutes} min`}</span>
          </div>

          <Badge variant={roadEtaMinutes && !roadEtaFailed ? 'verified' : 'neutral'} size="sm">
            {roadEtaMinutes && !roadEtaFailed ? 'Road ETA' : 'ETA estimate (straight-line)'}
          </Badge>

          {isSimulated && (
            <Badge variant="caution" size="sm">
              SIMULATED GPS
            </Badge>
          )}

          {isCoarse && (
            <Badge variant="neutral" size="sm">
              Coarse 500m Grid (Pre-Accept)
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          {isStale ? (
            <span className="px-2 py-0.5 rounded bg-[#FFB81C]/20 text-[#FFB81C] font-bold border border-[#FFB81C]/40 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Stale location ({secondsAgo}s ago)
            </span>
          ) : (
            <span className="text-[#A7A29A]">
              Last updated {secondsAgo}s ago
            </span>
          )}
          <span className="text-slate-500">&bull;</span>
          <span className="text-white font-bold">{distanceKm < 1 ? `${distanceMeters} m` : `${distanceKm} km`} away</span>
        </div>
      </div>

      {/* Geofence Arrival Banner */}
      {hasArrived && (
        <div className="p-3.5 bg-[#5EE6FF]/15 border-2 border-[#5EE6FF] rounded-xl flex items-center justify-between text-xs text-[#5EE6FF] animate-pulse shadow-[0_0_20px_rgba(94,230,255,0.3)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#5EE6FF]" />
            <div>
              <p className="font-heading font-black uppercase tracking-wider text-white">
                Worker Has Arrived Within 100m Geofence
              </p>
              <p className="text-xs text-[#A7A29A] font-sans">
                {isWorkerRole
                  ? 'You are at the customer location. Press "Start Job" below when ready to begin work.'
                  : `${workerName || 'The worker'} has arrived at your address.`}
              </p>
            </div>
          </div>
          <Badge variant="fair" size="sm">
            On Site
          </Badge>
        </div>
      )}

      {/* Interactive Leaflet Tracking Map */}
      <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-[#2A2E3A] shadow-2xl`}>
        <MapContainer
          center={latestPoint ? [latestPoint.lat, latestPoint.lng] : customerPos}
          zoom={15}
          scrollWheelZoom={false}
          className="w-full h-full z-0 bg-[#07070A]"
        >
          {/* CartoDB Dark Matter Tiles */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />

          {/* Auto-recenter helper */}
          <RecenterOnPoints points={polylineCoords} customerPos={customerPos} />

          {/* Customer Job Site Destination Pin */}
          <Marker position={customerPos} icon={createCustomerIcon()}>
            <Popup className="forge-map-popup">
              <div className="p-1 font-sans text-xs space-y-1">
                <p className="font-heading font-bold uppercase text-[#FFB81C]">Job Site Destination</p>
                <p className="text-[#A7A29A]">Customer service location</p>
              </div>
            </Popup>
          </Marker>

          {/* Worker Live Marker */}
          {latestPoint && (
            <>
              {/* Accuracy Circle */}
              <Circle
                center={[latestPoint.lat, latestPoint.lng]}
                radius={isCoarse ? 500 : Math.max(15, latestPoint.accuracy || 20)}
                pathOptions={{
                  color: isSimulated ? '#FFB81C' : '#5EE6FF',
                  fillColor: isSimulated ? '#FFB81C' : '#5EE6FF',
                  fillOpacity: 0.12,
                  weight: 1,
                  dashArray: '4, 4',
                }}
              />

              {/* Worker Marker */}
              <Marker
                position={[latestPoint.lat, latestPoint.lng]}
                icon={createWorkerTrackingIcon(isSimulated)}
              >
                <Popup className="forge-map-popup">
                  <div className="p-1 font-sans text-xs space-y-1 text-white">
                    <p className="font-heading font-bold uppercase text-[#5EE6FF]">
                      {workerName || 'Assigned Worker'}
                    </p>
                    <p className="text-[#A7A29A] font-mono text-xs">
                      Speed: {Math.round(latestPoint.speed || 20)} km/h &bull; Accuracy: &plusmn;{Math.round(latestPoint.accuracy || 15)}m
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Breadcrumb Trail of last 20 points */}
              {polylineCoords.length > 1 && (
                <Polyline
                  positions={polylineCoords}
                  pathOptions={{
                    color: isSimulated ? '#FFB81C' : '#5EE6FF',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '6, 6',
                  }}
                />
              )}
            </>
          )}
        </MapContainer>

        {/* Map Floating HUD Overlay */}
        <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-1.5 pointer-events-none">
          <div className="bg-[#07070A]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2A2E3A] font-mono text-xs text-[#A7A29A] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#5EE6FF] animate-pulse" />
            <span className="text-white font-bold">CartoDB Dark Tiles</span>
            <span>&bull;</span>
            <span>{points.length}/20 Fixes Cached</span>
          </div>
        </div>

        {/* Map Floating Bottom Right Controls */}
        <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-2 pointer-events-auto">
          {hasArrived && isWorkerRole && (
            <div className="bg-[#07070A]/95 p-2 rounded-xl border border-[#5EE6FF] shadow-lg flex items-center gap-2 text-xs">
              <span className="text-white font-heading font-bold">Within 100m:</span>
              <span className="text-[#5EE6FF] font-sans">Press Start Job below</span>
            </div>
          )}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center gap-2 text-xs text-[#A7A29A] font-sans">
        <ShieldCheck className="w-3.5 h-3.5 text-[#5EE6FF] shrink-0" />
        <span>Location privacy: Exact GPS trail is deleted immediately upon job completion or cancellation.</span>
      </div>
    </div>
  );
};
