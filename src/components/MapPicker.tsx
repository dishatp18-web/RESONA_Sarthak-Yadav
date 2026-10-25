/**
 * FairFix Interactive Map Component - ProFlow Edition
 * Powered by Leaflet + CartoDB Voyager Clean Tiles (No API keys required)
 * Terracotta service point pin, worker markers, and modern clean popups.
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

// Custom DivIcon for Terracotta Customer Pin
const createCustomerIcon = () =>
  L.divIcon({
    className: 'pro-customer-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: #E85A32;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 6px 18px rgba(232, 90, 50, 0.45);
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
    className: 'pro-worker-pin',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        background: ${isSelected ? '#B5541E' : '#2A1B12'};
        border: 2px solid ${isVerified ? '#059669' : isSelected ? '#B5541E' : '#FFFBF3'};
        border-radius: 50%;
        box-shadow: ${
          isSelected
            ? '0 0 16px rgba(181, 84, 30, 0.6), 0 4px 10px rgba(0,0,0,0.2)'
            : '0 4px 10px rgba(0,0,0,0.15)'
        };
        color: #FFFFFF;
        transition: transform 0.2s ease;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
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
                background: #059669;
                border: 1.5px solid white;
                border-radius: 50%;
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
    map.setView(coords, map.getZoom());
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(t);
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
  interactivePin = true,
  radiusKm = 5,
  heightClass = 'h-72',
}) => {
  return (
    <div className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-[#EBE5DB] shadow-xs bg-[#FAF7F0] z-0`}>
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
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* Animated Service Radius Ring */}
        {radiusKm > 0 && (
          <Circle
            center={[lat, lng]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#B5541E',
              fillColor: '#B5541E',
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
            <div className="text-xs font-sans text-[#141518] p-1">
              <p className="font-heading font-extrabold text-[#E85A32] mb-0.5">Service Location Point</p>
              <p className="text-[#646059] text-[11px]">
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
                <div className="text-xs font-sans text-[#141518] min-w-44 p-1">
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#EBE5DB]">
                    <span className="font-heading font-extrabold text-[#141518]">{w.name}</span>
                    {isVerified ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full font-medium capitalize">
                        {w.verification_status}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-[#6B5B4E] space-y-1">
                    <div>ETA: <strong className="text-[#059669] font-medium">{w.eta_label}</strong></div>
                    <div>Distance: {w.distance_km} km away</div>
                    <div>Rating: ★{w.rating_avg} ({w.rating_count} reviews)</div>
                    <div>Base Rate: <strong className="text-[#2A1B12] font-semibold">{formatINR(w.base_rate)}</strong></div>
                  </div>
                  {onSelectWorker && (
                    <button
                      onClick={() => onSelectWorker(w)}
                      className="mt-2.5 w-full h-[36px] text-center bg-[#B5541E] hover:bg-[#9E4717] text-white rounded-full font-heading font-medium text-xs transition cursor-pointer"
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
        <div className="absolute top-3 right-3 z-10 bg-white/95 border border-[#EBE5DB] text-[#141518] text-[11px] font-heading font-bold px-3 py-1 rounded-full pointer-events-none shadow-sm">
          <span>Click map or drag pin to relocate</span>
        </div>
      )}
    </div>
  );
};
