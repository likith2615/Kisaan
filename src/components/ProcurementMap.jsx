import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default leaflet icons path issue in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom DivIcons for visual elegance
const createCustomPin = (color, iconText, pulse = false) => {
  return L.divIcon({
    className: 'custom-mandi-pin',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        ${pulse ? `<div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: ${color}40; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
        <div style="width: 32px; height: 32px; border-radius: 12px; background-color: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white; z-index: 10;">
          ${iconText}
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20]
  });
};

export default function ProcurementMap({
  centres = [],
  requests = [],
  userLocation = null,
  isPickerMode = false,
  pickedCoordinates = null,
  onSelectCoordinates = null,
  onSelectCentre = null,
  height = '420px',
  lang = 'te'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const pickerMarkerRef = useRef(null);

  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'centres', 'requests'

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center: Central India / AP & Punjab span
      const initialLat = Number(userLocation?.lat || centres[0]?.lat || centres[0]?.location_lat || 15.8281);
      const initialLng = Number(userLocation?.lng || centres[0]?.lng || centres[0]?.location_lng || 78.0373);

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 7,
        zoomControl: false,
        attributionControl: false
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add custom positioned zoom controls
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;

      // Handle Map Click in Picker Mode
      map.on('click', (e) => {
        if (isPickerMode && onSelectCoordinates) {
          const { lat, lng } = e.latlng;
          onSelectCoordinates({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) });
        }
      });

      // Force size invalidation so tiles and markers render immediately without grey areas
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 500);
    }

    // Resize observer to adapt to container changes (e.g. tabs or layout switches)
    let resizeObserver;
    if (window.ResizeObserver && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when data or filter changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds = [];

    // 1. Plot Active Centres
    if (activeFilter === 'all' || activeFilter === 'centres') {
      centres.forEach((centre) => {
        const lat = Number(centre.lat ?? centre.location_lat);
        const lng = Number(centre.lng ?? centre.location_lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        const latLng = [lat, lng];
        bounds.push(latLng);

        const pin = createCustomPin('#059669', '🏛️'); // Emerald
        const marker = L.marker(latLng, { icon: pin });

        const popupContent = document.createElement('div');
        popupContent.className = 'p-1 text-xs font-sans max-w-[220px]';
        popupContent.innerHTML = `
          <div style="font-weight: 800; font-size: 13px; color: #065f46; margin-bottom: 2px;">
            ${centre.name}
          </div>
          <div style="color: #4b5563; font-weight: 600; margin-bottom: 4px;">
            📍 ${centre.district}, ${centre.mandal || ''}
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 6px;">
            <span style="background: #ecfdf5; color: #047857; font-weight: 700; padding: 2px 6px; border-radius: 9999px; border: 1px solid #a7f3d0;">
              Cap: ${centre.daily_capacity_quintals || 500} Q/day
            </span>
            <span style="background: #eff6ff; color: #1d4ed8; font-weight: 700; padding: 2px 6px; border-radius: 9999px; border: 1px solid #bfdbfe;">
              Active Mandi
            </span>
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">
            📞 Helpline: ${centre.contact_phone || '1800-180-1551'}
          </div>
          ${onSelectCentre ? `<button id="btn-select-${centre.id}" style="width: 100%; background: #059669; color: white; font-weight: 700; padding: 6px; border-radius: 8px; border: none; cursor: pointer;">Select Mandi for Slot</button>` : ''}
        `;

        if (onSelectCentre) {
          setTimeout(() => {
            const btn = popupContent.querySelector(`#btn-select-${centre.id}`);
            if (btn) btn.onclick = () => onSelectCentre(centre);
          }, 50);
        }

        marker.bindPopup(popupContent);
        group.addLayer(marker);
      });
    }

    // 2. Plot Farmer Requested Centres
    if (activeFilter === 'all' || activeFilter === 'requests') {
      requests.forEach((req) => {
        const lat = Number(req.lat ?? req.location_lat);
        const lng = Number(req.lng ?? req.location_lng);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
        const latLng = [lat, lng];
        bounds.push(latLng);

        const isApproved = req.status === 'Approved' || req.status === 'active';
        const pinColor = isApproved ? '#2563eb' : '#d97706'; // Blue or Amber
        const pin = createCustomPin(pinColor, isApproved ? '✅' : '⏳');
        const marker = L.marker(latLng, { icon: pin });

        const popupContent = document.createElement('div');
        popupContent.className = 'p-1 text-xs font-sans max-w-[240px]';
        popupContent.innerHTML = `
          <div style="font-weight: 800; font-size: 13px; color: ${pinColor}; margin-bottom: 2px;">
            🌾 ${req.proposed_name || req.name || 'Requested Procurement Point'}
          </div>
          <div style="color: #4b5563; font-weight: 600; margin-bottom: 4px;">
            📍 ${req.village || req.address || ''}, ${req.district}
          </div>
          <div style="margin-bottom: 4px;">
            <span style="background: ${isApproved ? '#eff6ff' : '#fffbeb'}; color: ${pinColor}; font-weight: 800; padding: 2px 6px; border-radius: 9999px; border: 1px solid ${isApproved ? '#bfdbfe' : '#fde68a'};">
              Status: ${req.status || 'Pending'}
            </span>
          </div>
          <div style="font-size: 11px; color: #374151; margin-bottom: 4px;">
            <strong>Expected:</strong> ${req.estimated_harvest_quintals || '2500'} Quintals (${req.crops_grown || 'Paddy'})
          </div>
          <div style="font-size: 10px; color: #6b7280; font-style: italic;">
            "${req.reason || req.address || 'High transit distance to nearest mandi'}"
          </div>
        `;

        marker.bindPopup(popupContent);
        group.addLayer(marker);
      });
    }

    // 3. Plot User Location if available
    if (userLocation?.lat && userLocation?.lng) {
      const userLatLng = [userLocation.lat, userLocation.lng];
      bounds.push(userLatLng);

      const userPin = createCustomPin('#7c3aed', '🧑‍🌾', true);
      const userMarker = L.marker(userLatLng, { icon: userPin }).bindPopup(`
        <div style="font-weight: bold; color: #6d28d9; padding: 4px;">
          📍 Your Registered Farm Location<br/>
          <span style="font-size: 11px; color: #4b5563;">${userLocation.label || 'Kisan Location'}</span>
        </div>
      `);
      group.addLayer(userMarker);

      // Add radius circle around farmer (e.g. 25km radius)
      const circle = L.circle(userLatLng, {
        color: '#7c3aed',
        fillColor: '#8b5cf6',
        fillOpacity: 0.1,
        radius: 25000
      });
      group.addLayer(circle);
    }

    // 4. Plot Picker Marker if in Picker Mode
    if (pickedCoordinates?.lat && pickedCoordinates?.lng) {
      const pickLatLng = [pickedCoordinates.lat, pickedCoordinates.lng];
      const pickPin = createCustomPin('#ef4444', '📍', true);
      
      if (pickerMarkerRef.current) {
        group.removeLayer(pickerMarkerRef.current);
      }
      
      const pMarker = L.marker(pickLatLng, { icon: pickPin, draggable: true });
      pMarker.bindPopup('<b style="color: #b91c1c;">Selected Proposed Center Site</b>').openPopup();
      
      pMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (onSelectCoordinates) {
          onSelectCoordinates({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) });
        }
      });

      group.addLayer(pMarker);
      pickerMarkerRef.current = pMarker;
      map.setView(pickLatLng, 10);
    }

    // Fit bounds if points exist
    if (bounds.length > 1 && !pickedCoordinates) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    } else if (bounds.length === 1 && !pickedCoordinates) {
      map.setView(bounds[0], 11);
    }

    // Invalidate size on each data change to guarantee crisp rendering
    map.invalidateSize();
  }, [centres, requests, userLocation, activeFilter, pickedCoordinates, isPickerMode]);

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const lat = Number(userLocation?.lat || centres[0]?.lat || centres[0]?.location_lat || 15.8281);
    const lng = Number(userLocation?.lng || centres[0]?.lng || centres[0]?.location_lng || 78.0373);
    mapInstanceRef.current.setView([lat, lng], 8);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-white">
      {/* Top Map Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-gray-200 shadow-md pointer-events-auto text-xs font-bold">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg transition-all ${activeFilter === 'all' ? 'bg-amber-800 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            All Locations
          </button>
          <button
            onClick={() => setActiveFilter('centres')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${activeFilter === 'centres' ? 'bg-emerald-700 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Mandis ({centres.length})
          </button>
          <button
            onClick={() => setActiveFilter('requests')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${activeFilter === 'requests' ? 'bg-blue-700 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Farmer Requests ({requests.length})
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {isPickerMode && (
            <div className="bg-amber-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1 animate-pulse">
              <span className="material-symbols-outlined text-sm">touch_app</span>
              Tap map to pin location
            </div>
          )}

          <button
            onClick={handleRecenter}
            className="bg-white/95 hover:bg-white text-gray-700 p-2 rounded-xl border border-gray-200 shadow-md transition-all active:scale-95"
            title="Recenter Map"
          >
            <span className="material-symbols-outlined text-lg">my_location</span>
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ height, width: '100%' }} className="z-0" />

      {/* Bottom Map Legend */}
      <div className="bg-white px-4 py-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600 font-semibold">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block shadow-xs"></span>
            <span>Active Mandi Hub</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500 inline-block shadow-xs"></span>
            <span>Requested Center (Under Review)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-blue-600 inline-block shadow-xs"></span>
            <span>Sanctioned / Approved</span>
          </div>
        </div>

        <div className="text-gray-400 text-[10px]">
          OpenStreetMap • Kisan Saathi GeoSpatial Network
        </div>
      </div>
    </div>
  );
}
