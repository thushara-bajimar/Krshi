"use client";
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

export interface MapPoint { lat: number; lng: number; label?: string }

/**
 * OpenStreetMap via Leaflet. Shows points and (optionally) lets the user pick one by tapping.
 * Tiles come from tile.openstreetmap.org (OSM tile usage policy: light use, attribution required).
 */
export default function MapPicker({ value, onChange, points = [], height = 280, zoom = 14 }: { value?: MapPoint | null; onChange?: (p: MapPoint) => void; points?: MapPoint[]; height?: number; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const marker = useRef<Leaflet.CircleMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      const center = value ?? points[0] ?? { lat: 12.87, lng: 74.88 };
      const m = leaflet.map(el.current, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([center.lat, center.lng], value || points.length ? zoom : 9);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(m);
      for (const p of points) leaflet.circleMarker([p.lat, p.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#3b7036", fillOpacity: 1 }).addTo(m).bindTooltip(p.label ?? "");
      const pin = (lat: number, lng: number) => leaflet.circleMarker([lat, lng], { radius: 9, color: "#fff", weight: 2, fillColor: "#c0782f", fillOpacity: 1 }).addTo(m);
      if (value) marker.current = pin(value.lat, value.lng);
      if (onChange) {
        m.on("click", (e: Leaflet.LeafletMouseEvent) => {
          const p = { lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 };
          if (marker.current) marker.current.setLatLng([p.lat, p.lng]);
          else marker.current = pin(p.lat, p.lng);
          onChange(p);
        });
      }
      if (points.length > 1 && !value) m.fitBounds(leaflet.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [30, 30] });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value && marker.current) marker.current.setLatLng([value.lat, value.lng]);
  }, [value]);

  return <div ref={el} style={{ height }} className="relative z-0 w-full overflow-hidden rounded-xl border border-line bg-sand" aria-label="Map" />;
}
