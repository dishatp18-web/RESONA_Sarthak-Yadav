/**
 * FairFix Live Tracking Map - Calm Edition
 * Voyager clean tiles, terracotta destination pin, worker location marker,
 * honesty rule preserved (SIMULATED chip shown if simulated).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Card, DemoDataPill } from './ui/index.js';
import { haversineDistanceKm } from '../utils/geo.js';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface TrackingMapProps {
  jobId: string;
  customerLat: number;
  customerLng: number;
  workerName?: string;
  isWorkerRole?: boolean;
  onWorkerArrived?: () => void;
  heightClass?: string;
}

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
    className: 'calm-customer-dest-pin',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        background: #B5541E;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(42, 27, 18, 0.2);
        color: white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });

// Custom DivIcon for Worker
const createWorkerTrackingIcon = () =>
  L.divIcon({
    className: 'calm-worker-tracking-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(181, 84, 30, 0.2);
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        "></div>
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #2A1B12;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 10px rgba(42, 27, 18, 0.2);
          color: white;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });

export const TrackingMap: React.FC<TrackingMapProps> = ({
  jobId,
  customerLat,
  customerLng,
  workerName,
  isWorkerRole = false,
  onWorkerArrived,
  heightClass = 'h-[300px]',
}) => {
  const [points, setPoints] = useState<any[]>([]);
  const [isCoarse, setIsCoarse] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);

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
            if (latest.accuracy === 10 || latest.is_simulated) {
              setIsSimulated(true);
            }
          }
        }
      } catch (err) {
        // Fallback
      }
    };

    fetchPoints();
    const interval = setInterval(fetchPoints, 3500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [jobId]);

  const latestPoint = points[points.length - 1];

  const { distanceMeters, straightLineEtaMinutes } = useMemo(() => {
    if (!latestPoint) {
      return { distanceMeters: 0, straightLineEtaMinutes: 10 };
    }
    const dKm = haversineDistanceKm(latestPoint.lat, latestPoint.lng, customerLat, customerLng);
    const dM = Math.round(dKm * 1000);
    const speed = Math.min(40, Math.max(10, latestPoint.speed || 20));
    const etaMin = Math.max(1, Math.round((dKm / speed) * 60));
    return { distanceMeters: dM, straightLineEtaMinutes: etaMin };
  }, [latestPoint, customerLat, customerLng]);

  useEffect(() => {
    if (distanceMeters > 0 && distanceMeters <= 100 && !hasArrived) {
      setHasArrived(true);
      if (onWorkerArrived) onWorkerArrived();
    }
  }, [distanceMeters, hasArrived, onWorkerArrived]);

  const customerPos: [number, number] = [customerLat, customerLng];
  const polylineCoords: [number, number][] = points.map((p) => [p.lat, p.lng]);

  return (
    <div className="space-y-3">
      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-[#6B5B4E]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#B5541E]" />
          <span className="font-heading font-bold text-[#2A1B12]">
            ~{straightLineEtaMinutes} min (estimate)
          </span>
          <span>&bull;</span>
          <span>{(distanceMeters / 1000).toFixed(1)} km away</span>
        </div>

        {isSimulated && (
          <span className="px-2 py-0.5 rounded-full bg-[#F4EBDA] text-[#6B5B4E] font-medium text-[11px]">
            SIMULATED
          </span>
        )}
      </div>

      {/* Arrival notification */}
      {hasArrived && (
        <Card className="flex items-center gap-2 text-[#059669] text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Worker has arrived within 100m.</span>
        </Card>
      )}

      {/* Leaflet Map */}
      <div className={`relative w-full ${heightClass} rounded-[20px] overflow-hidden border border-[#EADFC9] shadow-sm`}>
        <MapContainer
          center={latestPoint ? [latestPoint.lat, latestPoint.lng] : customerPos}
          zoom={15}
          scrollWheelZoom={false}
          className="w-full h-full z-0 bg-[#FCF5E8]"
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
          />

          <RecenterOnPoints points={polylineCoords} customerPos={customerPos} />

          <Marker position={customerPos} icon={createCustomerIcon()}>
            <Popup>
              <div className="text-xs font-sans">Customer Location</div>
            </Popup>
          </Marker>

          {latestPoint && (
            <>
              <Circle
                center={[latestPoint.lat, latestPoint.lng]}
                radius={isCoarse ? 500 : Math.max(15, latestPoint.accuracy || 20)}
                pathOptions={{
                  color: '#B5541E',
                  fillColor: '#B5541E',
                  fillOpacity: 0.1,
                  weight: 1,
                  dashArray: '4, 4',
                }}
              />

              <Marker
                position={[latestPoint.lat, latestPoint.lng]}
                icon={createWorkerTrackingIcon()}
              >
                <Popup>
                  <div className="text-xs font-sans">
                    {workerName || 'Worker'} (~{Math.round(latestPoint.speed || 20)} km/h)
                  </div>
                </Popup>
              </Marker>

              {polylineCoords.length > 1 && (
                <Polyline
                  positions={polylineCoords}
                  pathOptions={{
                    color: '#B5541E',
                    weight: 2.5,
                    opacity: 0.6,
                    dashArray: '6, 6',
                  }}
                />
              )}
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
};
