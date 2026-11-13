import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, ShieldCheck, Radio, CheckCircle2, User, Eye, Lock, ExternalLink, Loader2 } from 'lucide-react';
import { geoAPI } from '../../../api';

// Default fallback center (Ward 4, Adyar, Chennai) used only while a real
// address is still being geocoded, or if geocoding fails entirely.
const FALLBACK_CENTER = { lat: 13.0067, lng: 80.2568 };

const divIcon = (emoji, bg, size = 30) => L.divIcon({
  html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${size * 0.55}px;box-shadow:0 2px 6px rgba(0,0,0,0.35);border:2px solid white;">${emoji}</div>`,
  className: '',
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2]
});

const destinationIcon = divIcon('📍', '#D93025', 34);
const workerIcon = divIcon('🛵', '#FF6A00', 32);

// Deterministic pseudo-depot offset so the simulated "worker origin" point
// doesn't jump around between renders — real GPS hardware doesn't exist in
// this prototype, so the moving marker approximates travel from a nearby
// cooperative depot toward the real, geocoded customer address.
const depotOffsetFor = (lat, lng) => {
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453) % 1;
  const angle = seed * Math.PI * 2;
  const distanceDeg = 0.018 + seed * 0.01; // ~2-3km
  return { lat: lat + Math.sin(angle) * distanceDeg, lng: lng + Math.cos(angle) * distanceDeg };
};

const lerp = (a, b, t) => a + (b - a) * t;

export const TrackingMap = ({
  workerName = 'Cooperative Worker',
  workerCategory = 'Service',
  statusIndex = 0, // 0: Pending, 1: Accepted, 2: On the way, 3: Arrived, 4: Working, 5: Completed
  isSharingLocation = true,
  customerZone = '',
  destination = null, // { lat, lng, formattedAddress } from the booking record, if already geocoded
  isPending = false
}) => {
  const [progress, setProgress] = useState(0.15);
  const [coords, setCoords] = useState(destination && destination.lat ? destination : null);
  const [geocodeFailed, setGeocodeFailed] = useState(false);

  const isPendingState = isPending || statusIndex === 0;
  const isEnRoute = statusIndex === 2;
  const isArrivedOrPast = statusIndex >= 3;

  // Prefer server-resolved coordinates already stored on the booking; only
  // fall back to a client-side geocode call if the booking hasn't been
  // geocoded yet (e.g. it was just created and the background job is running).
  useEffect(() => {
    if (destination && destination.lat && destination.lng) {
      setCoords(destination);
      return;
    }
    if (!customerZone) return;

    let cancelled = false;
    geoAPI.geocode(customerZone)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setCoords(res.data);
        } else {
          setGeocodeFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setGeocodeFailed(true);
      });

    return () => { cancelled = true; };
  }, [customerZone, destination?.lat, destination?.lng]);

  const resolvedCenter = coords || FALLBACK_CENTER;
  const origin = useMemo(() => depotOffsetFor(resolvedCenter.lat, resolvedCenter.lng), [resolvedCenter.lat, resolvedCenter.lng]);

  useEffect(() => {
    if (isEnRoute && isSharingLocation) {
      const interval = setInterval(() => {
        setProgress((prev) => (prev >= 0.97 ? 0.15 : prev + 0.035));
      }, 400);
      return () => clearInterval(interval);
    }
    if (isArrivedOrPast) setProgress(1);
    else setProgress(0.05);
  }, [isEnRoute, isArrivedOrPast, isSharingLocation]);

  const currentPos = {
    lat: lerp(origin.lat, resolvedCenter.lat, progress),
    lng: lerp(origin.lng, resolvedCenter.lng, progress)
  };

  const googleMapsRouteUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customerZone)}&travelmode=driving`;
  const isMapReady = Boolean(coords) || geocodeFailed;

  return (
    <div style={{
      border: '1.5px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'white'
    }}>

      {/* 1. TOP LIVE SHARING STATUS BANNER WITH TRANSPARENT PRIVACY LABEL */}
      <div style={{
        background: isPendingState
          ? '#FFFBEB'
          : isSharingLocation && !isArrivedOrPast
          ? '#F0FDF4'
          : 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isPendingState ? (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.3)', display: 'inline-block' }} />
          ) : isSharingLocation && !isArrivedOrPast ? (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#00E676', boxShadow: '0 0 0 3px rgba(0, 230, 118, 0.3)', display: 'inline-block' }} />
          ) : (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-text-secondary)', display: 'inline-block' }} />
          )}

          <div>
            <div style={{
              fontSize: '13px',
              fontWeight: 'bold',
              color: isPendingState ? '#92400E' : isSharingLocation && !isArrivedOrPast ? '#15803D' : 'var(--color-black)'
            }}>
              {isPendingState
                ? '⏳ Dispatch Sent • Waiting for Worker Acceptance'
                : isArrivedOrPast
                ? `${workerName} has arrived at destination`
                : isEnRoute
                ? `${workerName} is en route via GPS`
                : `${workerName} accepted • Preparing tools`}
            </div>
            <div className="text-secondary" style={{ fontSize: '11px', marginTop: 1 }}>
              {isPendingState
                ? `📍 Pinned Location: ${customerZone}`
                : isArrivedOrPast
                ? '🔒 Location sharing ended automatically upon arrival'
                : isSharingLocation
                ? '🔒 Sharing live GPS route • Stops automatically upon arrival'
                : 'GPS sharing activates when helper departs depot'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. REAL INTERACTIVE MAP (OpenStreetMap tiles via Leaflet — free, no API key) */}
      <div style={{ position: 'relative', width: '100%', height: '240px', background: '#E5E7EB' }}>
        {!isMapReady ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} color="var(--color-accent)" />
            <span className="text-secondary" style={{ fontSize: '12px' }}>Locating {customerZone}...</span>
          </div>
        ) : (
          <MapContainer
            center={[resolvedCenter.lat, resolvedCenter.lng]}
            zoom={14}
            scrollWheelZoom={false}
            style={{ width: '100%', height: '100%' }}
            key={`${resolvedCenter.lat}-${resolvedCenter.lng}`}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[resolvedCenter.lat, resolvedCenter.lng]} icon={destinationIcon}>
              <Popup>{coords?.formattedAddress || customerZone}</Popup>
            </Marker>

            {!isPendingState && isSharingLocation && !isArrivedOrPast && (
              <>
                <Polyline
                  positions={[[origin.lat, origin.lng], [resolvedCenter.lat, resolvedCenter.lng]]}
                  pathOptions={{ color: '#CBD5E1', dashArray: '6 6', weight: 3 }}
                />
                <Marker position={[currentPos.lat, currentPos.lng]} icon={workerIcon}>
                  <Popup>{workerName} • {workerCategory}</Popup>
                </Marker>
              </>
            )}
          </MapContainer>
        )}

        {/* Floating ETA & Destination Pill */}
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          right: 12,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(4px)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          zIndex: 1000,
          pointerEvents: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={14} color="#D93025" />
            <span style={{ fontWeight: 600 }}>
              {isPendingState ? '📍 Your Pinned Service Location' : isArrivedOrPast ? 'Arrived at your location' : isEnRoute ? 'En route' : 'Booking accepted • Preparing departure'}
            </span>
          </div>
          <span style={{ fontWeight: 'bold', color: isPendingState ? '#D97706' : 'var(--color-accent)' }}>
            {isPendingState ? '⏳ Pending Acceptance' : isArrivedOrPast ? '✓ Arrived' : isEnRoute ? 'ETA ~12 min' : 'Accepted ✓'}
          </span>
        </div>
      </div>

      {/* 3. DIRECT GOOGLE MAPS ROUTE LINK */}
      <div style={{
        padding: '8px 14px',
        background: '#F8FAFC',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span className="text-secondary" style={{ fontSize: '11px' }}>
          📍 Destination: <strong>{customerZone}</strong>
        </span>
        <a
          href={googleMapsRouteUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', fontWeight: 700, color: '#1A73E8', textDecoration: 'none' }}
        >
          <span>Open Google Maps</span>
          <ExternalLink size={13} />
        </a>
      </div>

    </div>
  );
};

export default TrackingMap;
