/**
 * Unit tests for ActivityMap component.
 *
 * Since Leaflet requires a full DOM with layout capabilities (which jsdom lacks),
 * we mock the Leaflet library and verify that:
 * - The component renders nothing when no GPS data is provided
 * - The component renders a map container when GPS data is available
 * - Single-point routes get a marker
 * - Multi-point routes get a polyline
 * - The map auto-fits bounds to the route
 *
 * Requirements: 4.4, 4.7
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GPSPoint } from '@/types/garmin';

// ─── Mock Leaflet (using vi.hoisted to avoid TDZ issues) ──────────────────────

const mocks = vi.hoisted(() => {
  const setView = vi.fn();
  const fitBounds = vi.fn();
  const remove = vi.fn();
  const addTo = vi.fn().mockReturnThis();
  const bindPopup = vi.fn().mockReturnThis();
  const on = vi.fn().mockReturnThis();
  const getBounds = vi.fn().mockReturnValue({
    getNorth: () => 40.0,
    getSouth: () => 39.0,
    getEast: () => -74.0,
    getWest: () => -75.0,
  });

  return { setView, fitBounds, remove, addTo, bindPopup, on, getBounds };
});

vi.mock('leaflet', () => {
  const mapFn = vi.fn().mockReturnValue({
    setView: mocks.setView,
    fitBounds: mocks.fitBounds,
    remove: mocks.remove,
  });

  const tileLayerFn = vi.fn().mockReturnValue({ addTo: mocks.addTo });
  const markerFn = vi.fn().mockReturnValue({ addTo: mocks.addTo, bindPopup: mocks.bindPopup });
  const polylineFn = vi.fn().mockReturnValue({
    addTo: mocks.addTo,
    getBounds: mocks.getBounds,
    on: mocks.on,
  });
  const latLngFn = vi.fn((lat: number, lon: number) => ({
    lat,
    lng: lon,
    distanceTo: vi.fn().mockReturnValue(100),
  }));
  const popupFn = vi.fn().mockReturnValue({
    setLatLng: vi.fn().mockReturnThis(),
    setContent: vi.fn().mockReturnThis(),
    openOn: vi.fn().mockReturnThis(),
  });

  return {
    default: {
      map: mapFn,
      tileLayer: tileLayerFn,
      marker: markerFn,
      polyline: polylineFn,
      latLng: latLngFn,
      popup: popupFn,
    },
    map: mapFn,
    tileLayer: tileLayerFn,
    marker: markerFn,
    polyline: polylineFn,
    latLng: latLngFn,
    popup: popupFn,
  };
});

vi.mock('leaflet/dist/leaflet.css', () => ({}));

import L from 'leaflet';
import { ActivityMap } from './ActivityMap';

// ─── Test data ────────────────────────────────────────────────────────────────

function createGPSPoint(overrides: Partial<GPSPoint> = {}): GPSPoint {
  return {
    lat: 40.7128,
    lon: -74.006,
    elevation: 10,
    timestamp: '2024-06-15T07:30:00Z',
    heartRate: 145,
    pace: 330,
    ...overrides,
  };
}

function createRoute(count: number): GPSPoint[] {
  return Array.from({ length: count }, (_, i) =>
    createGPSPoint({
      lat: 40.7128 + i * 0.001,
      lon: -74.006 + i * 0.001,
      elevation: 10 + i * 2,
      pace: 300 + i * 5,
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ActivityMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when gpsRoute is undefined', () => {
    const { container } = render(<ActivityMap gpsRoute={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when gpsRoute is an empty array', () => {
    const { container } = render(<ActivityMap gpsRoute={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a map container when GPS route has data', () => {
    const route = createRoute(5);
    render(<ActivityMap gpsRoute={route} />);

    const mapContainer = screen.getByTestId('activity-map');
    expect(mapContainer).toBeInTheDocument();
    expect(mapContainer).toHaveAttribute('aria-label', 'GPS route map');
    expect(mapContainer).toHaveAttribute('role', 'img');
  });

  it('renders a map container for a single-point route', () => {
    const route = createRoute(1);
    render(<ActivityMap gpsRoute={route} />);

    const mapContainer = screen.getByTestId('activity-map');
    expect(mapContainer).toBeInTheDocument();
  });

  it('initializes Leaflet map with the container element', () => {
    const route = createRoute(5);
    render(<ActivityMap gpsRoute={route} />);

    expect(L.map).toHaveBeenCalledTimes(1);
  });

  it('adds OpenStreetMap tile layer', () => {
    const route = createRoute(5);
    render(<ActivityMap gpsRoute={route} />);

    expect(L.tileLayer).toHaveBeenCalledWith(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      expect.objectContaining({
        attribution: expect.stringContaining('OpenStreetMap'),
      }),
    );
  });

  it('creates a polyline for multi-point routes', () => {
    const route = createRoute(10);
    render(<ActivityMap gpsRoute={route} />);

    expect(L.polyline).toHaveBeenCalledTimes(1);
    const latLngs = vi.mocked(L.polyline).mock.calls[0][0];
    expect(latLngs).toHaveLength(10);
  });

  it('creates a marker for single-point routes', () => {
    const route = createRoute(1);
    render(<ActivityMap gpsRoute={route} />);

    expect(L.marker).toHaveBeenCalledTimes(1);
    expect(L.marker).toHaveBeenCalledWith([route[0].lat, route[0].lon]);
  });

  it('fits map bounds to polyline for multi-point routes', () => {
    const route = createRoute(5);
    render(<ActivityMap gpsRoute={route} />);

    expect(mocks.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('sets map view for single-point routes', () => {
    const route = createRoute(1);
    render(<ActivityMap gpsRoute={route} />);

    expect(mocks.setView).toHaveBeenCalledWith([route[0].lat, route[0].lon], 15);
  });

  it('attaches a click handler to the polyline', () => {
    const route = createRoute(5);
    render(<ActivityMap gpsRoute={route} />);

    expect(mocks.on).toHaveBeenCalledWith('click', expect.any(Function));
  });

  it('has proper CSS class for sizing', () => {
    const route = createRoute(5);
    render(<ActivityMap gpsRoute={route} />);

    const mapContainer = screen.getByTestId('activity-map');
    expect(mapContainer.className).toContain('h-80');
    expect(mapContainer.className).toContain('w-full');
  });
});
