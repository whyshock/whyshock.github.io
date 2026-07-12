/**
 * ActivityMap — Renders a GPS route on a Leaflet map.
 *
 * Features:
 * - Renders GPS route polyline on an interactive map (OpenStreetMap tiles)
 * - Auto-fits the map bounds to the route
 * - Supports zoom, pan, and click-on-route to show pace/elevation at the nearest point
 * - Returns null if gpsRoute is empty or undefined
 * - Shows a single marker for routes with only 1 point
 *
 * Requirements: 4.4, 4.7
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GPSPoint } from '@/types/garmin';

export interface ActivityMapProps {
  /** GPS route points for the activity */
  gpsRoute?: GPSPoint[];
}

/**
 * Formats pace (seconds per km) into a human-readable string like "5:30 /km".
 */
function formatPace(pace: number): string {
  const minutes = Math.floor(pace / 60);
  const seconds = Math.floor(pace % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}

/**
 * Formats elevation in meters.
 */
function formatElevation(elevation: number): string {
  return `${Math.round(elevation)} m`;
}

/**
 * Finds the nearest GPSPoint to a given lat/lng.
 */
function findNearestPoint(latlng: L.LatLng, points: GPSPoint[]): GPSPoint | null {
  if (points.length === 0) return null;

  let nearest = points[0];
  let minDist = Infinity;

  for (const point of points) {
    const dist = latlng.distanceTo(L.latLng(point.lat, point.lon));
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }

  return nearest;
}

/**
 * Builds popup HTML content for a clicked GPS point.
 */
function buildPopupContent(point: GPSPoint): string {
  const parts: string[] = [];

  if (point.pace !== undefined) {
    parts.push(`<strong>Pace:</strong> ${formatPace(point.pace)}`);
  }

  if (point.elevation !== undefined) {
    parts.push(`<strong>Elevation:</strong> ${formatElevation(point.elevation)}`);
  }

  if (point.heartRate !== undefined) {
    parts.push(`<strong>Heart Rate:</strong> ${point.heartRate} bpm`);
  }

  if (parts.length === 0) {
    parts.push(`<strong>Position:</strong> ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}`);
  }

  return parts.join('<br/>');
}

export function ActivityMap({ gpsRoute }: ActivityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !gpsRoute || gpsRoute.length === 0) {
      return;
    }

    // Destroy existing map instance if present (handles re-renders)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create the Leaflet map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    });

    mapInstanceRef.current = map;

    // Add OpenStreetMap tile layer (free, no API key needed)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Single point case: show a marker instead of polyline
    if (gpsRoute.length === 1) {
      const point = gpsRoute[0];
      const marker = L.marker([point.lat, point.lon]).addTo(map);
      marker.bindPopup(buildPopupContent(point));
      map.setView([point.lat, point.lon], 15);
      return;
    }

    // Build the polyline from GPS points
    const latLngs: L.LatLngExpression[] = gpsRoute.map((p) => [p.lat, p.lon]);

    const polyline = L.polyline(latLngs, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.8,
    }).addTo(map);

    // Auto-fit map bounds to the route with padding
    const bounds = polyline.getBounds();
    map.fitBounds(bounds, { padding: [30, 30] });

    // Click on polyline to show pace/elevation at nearest point
    polyline.on('click', (e: L.LeafletMouseEvent) => {
      const nearestPoint = findNearestPoint(e.latlng, gpsRoute);
      if (nearestPoint) {
        L.popup()
          .setLatLng(e.latlng)
          .setContent(buildPopupContent(nearestPoint))
          .openOn(map);
      }
    });

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [gpsRoute]);

  // Don't render if no GPS data
  if (!gpsRoute || gpsRoute.length === 0) {
    return null;
  }

  return (
    <div
      ref={mapContainerRef}
      className="h-80 w-full rounded-lg border border-border"
      aria-label="GPS route map"
      role="img"
      data-testid="activity-map"
    />
  );
}

export default ActivityMap;
