/**
 * FairFix Interactive Map Component - "Mark III Forge" Edition
 * Powered by Leaflet + CartoDB Dark Matter Tiles (No API keys required)
 * Features glowing gold pin, animated radius ring, and metallic HUD popups.
 */
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MatchedWorker } from '../types.js';
import { formatINR } from './ui/index.js';

interface MapPickerProps {
  lat: number;
  lng: number;
  onLocationChange?: (lat: number, lng: number) => void;
  workers?: MatchedWorker[];
  selectedWorkerId?: string | null;
  onSelectWorker?: (worker: MatchedWorker) => void;
  interactivePin?: boolean;
  radiusKm?: number;
  heightClass?: string;
}

// Custom DivIcon for Glowing Gold Customer Pin
const createCustomerIcon = () =>
  L.divIcon({
    className: 'forge-customer-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #8E0B16 0%, #D7261E 40%, #FFB81C 100%);
        border: 2px solid #FFD65A;
        border-radius: 50%;
        box-shadow: 0 0 16px rgba(255, 184, 28, 0.7), 0 4px 12px rgba(0,0,0,0.6);
        color: white;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });

// Custom DivIcon for Workers
const createWorkerIcon = (isVerified: boolean, isSelected: boolean) =>
  L.divIcon({
    className: 'forge-worker-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        background: ${isSelected ? '#FFB81C' : '#151821'};
        border: 2px solid ${isVerified ? '#5EE6FF' : isSelected ? '#FFD65A' : '#3B4150'};
        border-radius: 50%;
        box-shadow: ${
          isSelected
            ? '0 0 20px rgba(255, 184, 28, 0.8), 0 4px 12px rgba(0,0,0,0.7)'
            : isVerified
            ? '0 0 12px rgba(94, 230, 255, 0.5), 0 4px 8px rgba(0,0,0,0.5)'
            : '0 4px 8px rgba(0,0,0,0.5)'
        };
        color: ${isSelected ? '#07070A' : '#F4F1EC'};
        transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
        </svg>
        ${
          isVerified
            ? `<div style="
                position: absolute;
                top: -2px;
                right: -2px;
                width: 10px;
                height: 10px;
                background: #5EE6FF;
                border: 1.5px solid #07070A;
                border-radius: 50%;
                box-shadow: 0 0 6px #5EE6FF;
              "></div>`
            : ''
        }
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });

function ChangeMapView({ coords }: { coords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(coords, map.getZoom(), { duration: 0.8 });
  }, [coords, map]);
  return null;
}

function MapEvents({
  onLocationChange,
  interactive,
}: {
  onLocationChange?: (lat: number, lng: number) => void;
  interactive?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (interactive && onLocationChange) {
        onLocationChange(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
      }
    },
  });
  return null;
}

export const MapPicker: React.FC<MapPickerProps> = ({
  lat,
  lng,
  onLocationChange,
  workers = [],
  selectedWorkerId,
  onSelectWorker,
  interactivePin = false,
  radiusKm = 5,
  heightClass = 'h-72 sm:h-80',
}) => {
  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-[rgba(255,184,28,0.25)] shadow-2xl bg-[#07070A] z-0`}>
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
      >
        <ChangeMapView coords={[lat, lng]} />
        <MapEvents onLocationChange={onLocationChange} interactive={interactivePin} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Animated Service Radius Ring (Gold outline with faint red-gold fill) */}
        {radiusKm > 0 && (
          <Circle
            center={[lat, lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#FFB81C',
              fillColor: '#D7261E',
              fillOpacity: 0.08,
              weight: 1.5,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* Customer Location Pin */}
        <Marker
          position={[lat, lng]}
          icon={createCustomerIcon()}
          draggable={interactivePin}
          eventHandlers={{
            dragend: (e) => {
              if (interactivePin && onLocationChange) {
                const marker = e.target;
                const position = marker.getLatLng();
                onLocationChange(Number(position.lat.toFixed(5)), Number(position.lng.toFixed(5)));
              }
            },
          }}
        >
          <Popup>
            <div className="text-xs font-sans text-slate-100 p-1">
              <p className="font-heading font-bold text-[#FFD65A] mb-0.5 uppercase tracking-wider">Service Point</p>
              <p className="text-[#A7A29A] text-[11px]">
                {interactivePin ? 'Click map or drag pin to relocate' : 'Job request point'}
              </p>
            </div>
          </Popup>
        </Marker>

        {/* Worker Markers */}
        {workers.map((w) => {
          const isSelected = selectedWorkerId === w.id;
          const isVerified = w.verification_status === 'verified';
          return (
            <Marker
              key={w.id}
              position={[w.lat, w.lng]}
              icon={createWorkerIcon(isVerified, isSelected)}
              eventHandlers={{
                click: () => onSelectWorker && onSelectWorker(w),
              }}
            >
              <Popup>
                <div className="text-xs font-sans text-slate-200 min-w-44 p-1">
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#2A2E3A]">
                    <span className="font-heading font-bold text-white">{w.name}</span>
                    {isVerified ? (
                      <span className="text-[10px] bg-[#5EE6FF]/15 text-[#5EE6FF] px-1.5 py-0.2 rounded font-bold border border-[#5EE6FF]/30">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[10px] bg-white/10 text-[#A7A29A] px-1.5 py-0.2 rounded font-medium capitalize">
                        {w.verification_status}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-300 space-y-1">
                    <div>ETA: <strong className="text-[#5EE6FF] font-mono">{w.eta_label}</strong></div>
                    <div>Distance: {w.distance_km} km away</div>
                    <div>Rating: ★{w.rating_avg} ({w.rating_count} reviews)</div>
                    <div>Base Rate: <strong className="font-mono text-white">{formatINR(w.base_rate)}</strong></div>
                  </div>
                  {onSelectWorker && (
                    <button
                      onClick={() => onSelectWorker(w)}
                      className="mt-2.5 w-full py-1.5 text-center bg-gradient-to-r from-[#8E0B16] to-[#D7261E] text-white rounded-lg font-heading font-bold text-[11px] uppercase tracking-wider transition cursor-pointer hover:brightness-110"
                    >
                      Select Worker
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Helper overlay badge */}
      {interactivePin && (
        <div className="absolute top-3 right-3 z-10 bg-[#0E1016]/95 border border-[rgba(255,184,28,0.3)] text-[#F4F1EC] text-[11px] font-heading uppercase tracking-wider px-3 py-1 rounded-lg pointer-events-none shadow-lg">
          <span>Click map or drag pin to relocate</span>
        </div>
      )}
    </div>
  );
};
