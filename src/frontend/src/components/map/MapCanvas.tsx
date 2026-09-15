// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import { useCiroStore } from '../../store/useCiroStore';
import 'maplibre-gl/dist/maplibre-gl.css';
import LayersPanel from './LayersPanel';
import * as turf from '@turf/turf';

const DARK_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function MapCanvas() {
  const { userLocation, activeCrisis, allActiveCrises, resourceAllocation, showCrisisZones, showResources, showWeatherRadar, showShelters, showVulnerabilities, showSignals } = useCiroStore();
  const [viewState, setViewState] = useState({
    longitude: 73.0479,
    latitude: 33.6844,
    zoom: 12,
    pitch: 0,
    bearing: 0
  });

  const [hoveredShelter, setHoveredShelter] = useState<any>(null);
  const [selectedSector, setSelectedSector] = useState<any>(null);
  const [selectedCrisis, setSelectedCrisis] = useState<any>(null);

  // When userLocation updates, center the map
  useEffect(() => {
    if (userLocation) {
      setViewState(prev => ({
        ...prev,
        longitude: userLocation.lng,
        latitude: userLocation.lat,
        zoom: 13,
        transitionDuration: 1000
      }));
    }
  }, [userLocation]);

  // Fly to crisis epicenter when a scenario completes
  useEffect(() => {
    if (activeCrisis?.location) {
      const loc = activeCrisis.location;
      const lat = loc.lat || loc.latitude;
      const lng = loc.lng || loc.longitude;
      if (lat && lng) {
        setViewState(prev => ({
          ...prev,
          longitude: lng,
          latitude: lat,
          zoom: 14,
          transitionDuration: 2000
        }));
      }
    }
  }, [activeCrisis]);

  // Static Emergency Shelters
  const EMERGENCY_SHELTERS = [
    {
      name: "G-10 Markaz Community Center",
      capacity: 300,
      occupied: 45,
      lat: 33.7047,
      lng: 73.0079,
      address: "G-10 Markaz, Islamabad"
    },
    {
      name: "I-8 Government School",
      capacity: 200,
      occupied: 120,
      lat: 33.6923,
      lng: 73.0612,
      address: "I-8/2, Islamabad"
    },
    {
      name: "Rawalpindi Sports Complex",
      capacity: 500,
      occupied: 15,
      lat: 33.5651,
      lng: 73.0169,
      address: "Rawalpindi"
    }
  ];

  // Static Sector Vulnerabilities based on NDMA static database
  const SECTOR_VULNERABILITIES = [
    { name: "G-10", lat: 33.7047, lng: 73.0079, score: 0.85 },
    { name: "G-11", lat: 33.6844, lng: 72.9900, score: 0.80 },
    { name: "G-13", lat: 33.6550, lng: 72.9650, score: 0.78 },
    { name: "I-8",  lat: 33.6923, lng: 73.0612, score: 0.60 },
    { name: "I-10", lat: 33.6450, lng: 73.0350, score: 0.72 },
    { name: "F-6",  lat: 33.7294, lng: 73.0840, score: 0.30 },
    { name: "F-7",  lat: 33.7190, lng: 73.0550, score: 0.25 }
  ];

  // Tactical resource starting coordinates for base telemetry mapping
  const DISPATCH_STARTING_COORDS: Record<string, { lat: number, lng: number }> = {
    "AMB-01": { lat: 33.7215, lng: 73.0433 },
    "AMB-02": { lat: 33.6938, lng: 73.0651 },
    "AMB-03": { lat: 33.7394, lng: 73.0840 },
    "AMB-04": { lat: 33.6745, lng: 72.9836 },
    "BOAT-01": { lat: 33.7200, lng: 73.0500 },
    "BOAT-02": { lat: 33.6900, lng: 73.0700 },
    "TEAM-01": { lat: 33.7100, lng: 73.0600 },
    "TEAM-02": { lat: 33.7300, lng: 73.0400 },
    "TEAM-03": { lat: 33.6800, lng: 73.0900 }
  };

  // Detailed Sector Metadata Lookup
  const SECTOR_DETAILS: Record<string, any> = {
    "G-10": { vulnerability: 0.85, drainage: "12 mm/hr", density: "8,500 / km²", lowIncome: "No", historical: 7, area: "4.2 km²" },
    "G-11": { vulnerability: 0.80, drainage: "13 mm/hr", density: "7,800 / km²", lowIncome: "No", historical: 5, area: "4.5 km²" },
    "G-13": { vulnerability: 0.78, drainage: "14 mm/hr", density: "7,100 / km²", lowIncome: "No", historical: 5, area: "5.0 km²" },
    "I-8":  { vulnerability: 0.60, drainage: "18 mm/hr", density: "6,200 / km²", lowIncome: "Yes (Priority)", historical: 3, area: "3.8 km²" },
    "I-10": { vulnerability: 0.72, drainage: "15 mm/hr", density: "9,100 / km²", lowIncome: "Yes (Priority)", historical: 6, area: "4.1 km²" },
    "F-6":  { vulnerability: 0.30, drainage: "28 mm/hr", density: "3,200 / km²", lowIncome: "No", historical: 1, area: "6.0 km²" },
    "F-7":  { vulnerability: 0.25, drainage: "30 mm/hr", density: "2,800 / km²", lowIncome: "No", historical: 0, area: "5.5 km²" }
  };

  // Generate GeoJSON Circles for all Crisis Zones
  const crisisZonesGeoJSON = useMemo(() => {
    if (!allActiveCrises || allActiveCrises.length === 0) return null;
    const features = allActiveCrises.map(crisis => {
      if (!crisis.location) return null;
      const radius = crisis.location.radius_km || 2; 
      const center = [crisis.location.lng, crisis.location.lat];
      const options = { steps: 64, units: 'kilometers', properties: { crisis_type: crisis.crisis_type, status: crisis.status } };
      return turf.circle(center, radius, options);
    }).filter(Boolean);

    return {
      type: 'FeatureCollection',
      features: features
    };
  }, [allActiveCrises]);

  // Generate GeoJSON Polylines for Tactical Resource Dispatches
  const dispatchLinesGeoJSON = useMemo(() => {
    if (!showResources || !resourceAllocation || !resourceAllocation.crisis_allocations) return null;
    
    const features: any[] = [];
    
    resourceAllocation.crisis_allocations.forEach((alloc: any) => {
      const matchingCrisis = allActiveCrises?.find(c => c.crisis_id === alloc.crisis_id) || activeCrisis;
      if (!matchingCrisis || !matchingCrisis.location) return;
      
      const destLat = matchingCrisis.location.lat;
      const destLng = matchingCrisis.location.lng;
      
      const dispatchOrder = alloc.dispatch_order || [];
      dispatchOrder.forEach((order: any) => {
        const unitId = order.unit_id;
        const start = DISPATCH_STARTING_COORDS[unitId] || { lat: 33.6844, lng: 73.0479 }; // fallback to default station
        
        features.push({
          type: 'Feature',
          properties: {
            unit_id: unitId,
            priority: order.priority || 'high',
            crisis_type: matchingCrisis.crisis_type
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [start.lng, start.lat],
              [destLng, destLat]
            ]
          }
        });
      });
    });
    
    if (features.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: features
    };
  }, [resourceAllocation, allActiveCrises, activeCrisis, showResources]);

  // Generate simulated Weather Radar (precipitation) patterns for all active crises
  const weatherRadarGeoJSON = useMemo(() => {
    if (!allActiveCrises || allActiveCrises.length === 0) return null;
    
    const features = [];
    allActiveCrises.forEach(crisis => {
      if (!crisis.location || crisis.crisis_type !== 'urban_flood' || crisis.status === 'retracted') return;
      const center = [crisis.location.lng, crisis.location.lat];
      
      // Draw 3 layers of rain radar representing storm cells:
      // 1. Heavy rain center (1.2 km radius)
      const options1 = { steps: 32, units: 'kilometers', properties: { intensity: 'heavy' } };
      features.push(turf.circle(center, 1.2, options1));
      
      // 2. Moderate rain band (2.5 km radius)
      const options2 = { steps: 32, units: 'kilometers', properties: { intensity: 'moderate' } };
      features.push(turf.circle(center, 2.5, options2));
      
      // 3. Light rain band (4.5 km radius)
      const options3 = { steps: 32, units: 'kilometers', properties: { intensity: 'light' } };
      features.push(turf.circle(center, 4.5, options3));
    });
    
    if (features.length === 0) return null;
    return {
      type: 'FeatureCollection',
      features: features
    };
  }, [allActiveCrises]);

  // Generate Sector Vulnerabilities geojson circles
  const vulnerabilityGeoJSON = useMemo(() => {
    const features = SECTOR_VULNERABILITIES.map(sec => {
      const center = [sec.lng, sec.lat];
      const radius = 1.0; // 1 km radius for each sector risk bubble
      const options = { 
        steps: 32, 
        units: 'kilometers', 
        properties: { 
          name: sec.name,
          vulnerability: sec.score
        } 
      };
      return turf.circle(center, radius, options);
    });

    return {
      type: 'FeatureCollection',
      features: features
    };
  }, []);

  // Compute closest shelter evacuation route using Turf.js
  const evacuationRouteGeoJSON = useMemo(() => {
    if (!showShelters || !activeCrisis || !activeCrisis.location) return null;
    const crisisLat = activeCrisis.location.lat;
    const crisisLng = activeCrisis.location.lng;

    // Find closest shelter
    let closestShelter = EMERGENCY_SHELTERS[0];
    let minDistance = Infinity;
    EMERGENCY_SHELTERS.forEach(shelter => {
      const dist = Math.sqrt(Math.pow(shelter.lat - crisisLat, 2) + Math.pow(shelter.lng - crisisLng, 2));
      if (dist < minDistance) {
        minDistance = dist;
        closestShelter = shelter;
      }
    });

    if (!closestShelter) return null;

    // Create curved safe route via intermediate midpoint with perpendicular offset
    const midLng = (crisisLng + closestShelter.lng) / 2;
    const midLat = (crisisLat + closestShelter.lat) / 2;
    
    // Curved projection offset
    const offsetLat = midLat + (closestShelter.lng - crisisLng) * 0.15;
    const offsetLng = midLng - (closestShelter.lat - crisisLat) * 0.15;

    return {
      type: 'Feature',
      properties: {
        name: `Safe Passage to ${closestShelter.name}`,
        shelter_name: closestShelter.name,
        distance_approx: (minDistance * 111).toFixed(1) + " km"
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [crisisLng, crisisLat],
          [offsetLng, offsetLat],
          [closestShelter.lng, closestShelter.lat]
        ]
      }
    };
  }, [activeCrisis, showShelters]);

  // Dynamic field signal sensor readings surrounding active crisis sector
  const fieldSignals = useMemo(() => {
    const baseLat = activeCrisis?.location?.lat || 33.6844;
    const baseLng = activeCrisis?.location?.lng || 73.0479;

    return [
      {
        id: "sig-01",
        source: "Pakistan Met Dept (PMD)",
        type: "weather",
        icon: "🌧️",
        content: "82mm heavy monsoon rainfall recorded in past 3 hours",
        lat: baseLat + 0.004,
        lng: baseLng - 0.005,
        credibility: 0.92,
        timestamp: "10 mins ago",
        status: "verified"
      },
      {
        id: "sig-02",
        source: "Google Traffic API",
        type: "traffic",
        icon: "🚗",
        content: "Severe traffic gridlock & water clogging on major avenue segments",
        lat: baseLat - 0.003,
        lng: baseLng + 0.006,
        credibility: 0.87,
        timestamp: "5 mins ago",
        status: "verified"
      },
      {
        id: "sig-03",
        source: "GDELT Project News",
        type: "social",
        icon: "📰",
        content: "Multiple verified news bulletins reporting basement flooding in local sector residences",
        lat: baseLat + 0.007,
        lng: baseLng + 0.003,
        credibility: 0.75,
        timestamp: "35 mins ago",
        status: "verified"
      },
      {
        id: "sig-04",
        source: "Citizen App Field Report",
        type: "field_report",
        icon: "👥",
        content: "Water main pipe burst reported near street junction. Stale signal, checked by verification agent.",
        lat: baseLat - 0.005,
        lng: baseLng - 0.004,
        credibility: 0.40,
        timestamp: "4 hours ago (Stale)",
        status: "stale"
      }
    ];
  }, [activeCrisis]);

  return (
    <div className="relative w-full h-full bg-[#111]">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle={DARK_MAP_STYLE}
        dragPan={true}
        scrollZoom={{ ctrlToZoom: true }}
        doubleClickZoom={true}
        interactive={true}
        reuseMaps
      >
        <LayersPanel />

        {/* NDMA Sector Vulnerability Heat Layer */}
        {showVulnerabilities && vulnerabilityGeoJSON && (
          <Source type="geojson" data={vulnerabilityGeoJSON}>
            <Layer
              id="vulnerability-layer-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'vulnerability'],
                  0.25, '#10b981', // green for low risk
                  0.60, '#f59e0b', // amber for moderate
                  0.85, '#ef4444'  // red for critical
                ],
                'fill-opacity': 0.08
              }}
            />
            <Layer
              id="vulnerability-layer-stroke"
              type="line"
              paint={{
                'line-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'vulnerability'],
                  0.25, '#34d399',
                  0.60, '#fbbf24',
                  0.85, '#f87171'
                ],
                'line-width': 1,
                'line-opacity': 0.15
              }}
            />
          </Source>
        )}

        {/* Dynamic Doppler Weather Radar Layer */}
        {showWeatherRadar && weatherRadarGeoJSON && (
          <Source type="geojson" data={weatherRadarGeoJSON}>
            <Layer
              id="weather-radar-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'intensity'],
                  'heavy', '#ef4444',     // Red for heavy cell
                  'moderate', '#f59e0b',  // Orange for moderate rain
                  'light', '#10b981',     // Green for light rain
                  '#10b981'
                ],
                'fill-opacity': [
                  'match',
                  ['get', 'intensity'],
                  'heavy', 0.22,
                  'moderate', 0.15,
                  'light', 0.08,
                  0.12
                ]
              }}
            />
            <Layer
              id="weather-radar-line"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'intensity'],
                  'heavy', '#f87171',
                  'moderate', '#fbbf24',
                  'light', '#34d399',
                  '#34d399'
                ],
                'line-width': 1.5,
                'line-opacity': 0.3
              }}
            />
          </Source>
        )}

        {/* Crisis Zone Polygon (Blue/Red overlay) */}
        {showCrisisZones && crisisZonesGeoJSON && (
          <Source type="geojson" data={crisisZonesGeoJSON}>
            <Layer
              id="crisis-zone-fill"
              type="fill"
              paint={{
                'fill-color': [
                  'match',
                  ['get', 'crisis_type'],
                  'urban_flood', '#3b82f6',
                  'heatwave', '#f59e0b',
                  '#ef4444'
                ],
                'fill-opacity': [
                  'case',
                  ['==', ['get', 'status'], 'retracted'], 0.03,
                  0.15
                ]
              }}
            />
            <Layer
              id="crisis-zone-line"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'crisis_type'],
                  'urban_flood', '#60a5fa',
                  'heatwave', '#fbbf24',
                  '#f87171'
                ],
                'line-width': 2,
                'line-dasharray': [2, 4],
                'line-opacity': [
                  'case',
                  ['==', ['get', 'status'], 'retracted'], 0.15,
                  1.0
                ]
              }}
            />
          </Source>
        )}

        {/* Tactical Dispatch Polylines */}
        {showResources && dispatchLinesGeoJSON && (
          <Source type="geojson" data={dispatchLinesGeoJSON}>
            <Layer
              id="dispatch-lines-layer"
              type="line"
              paint={{
                'line-color': [
                  'match',
                  ['get', 'crisis_type'],
                  'urban_flood', '#3b82f6',
                  'heatwave', '#f59e0b',
                  '#ef4444'
                ],
                'line-width': 2,
                'line-dasharray': [3, 3],
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}

        {/* Civilian Evacuation Safe Routes */}
        {showShelters && evacuationRouteGeoJSON && (
          <Source type="geojson" data={evacuationRouteGeoJSON}>
            <Layer
              id="evacuation-route-layer-glow"
              type="line"
              paint={{
                'line-color': '#10b981',
                'line-width': 6,
                'line-opacity': 0.15
              }}
            />
            <Layer
              id="evacuation-route-layer"
              type="line"
              paint={{
                'line-color': '#34d399',
                'line-width': 2.5,
                'line-dasharray': [2, 3],
                'line-opacity': 0.95
              }}
            />
          </Source>
        )}

        {/* Interactive Sector Vulnerability Badges */}
        {showVulnerabilities && SECTOR_VULNERABILITIES.map((sec, idx) => {
          const scoreColor = sec.score >= 0.80 ? 'bg-red-500 shadow-red-500/50' : 
                             sec.score >= 0.60 ? 'bg-amber-500 shadow-amber-500/50' : 
                             'bg-emerald-500 shadow-emerald-500/50';
          return (
            <Marker key={`sector-pill-${idx}`} longitude={sec.lng} latitude={sec.lat} anchor="center">
              <div 
                onClick={() => {
                  setSelectedSector(sec);
                  setSelectedCrisis(null); // clear crisis detail
                }}
                className="bg-black/95 backdrop-blur border border-gray-800 hover:border-emerald-500/50 rounded px-1.5 py-0.5 text-[8px] font-mono text-gray-300 select-none cursor-pointer flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${scoreColor} shadow-[0_0_4px]`}></span>
                <span>{sec.name}</span>
                <span className="text-[7px] text-gray-500">{(sec.score * 100).toFixed(0)}%</span>
              </div>
            </Marker>
          );
        })}

        {/* Active Crisis Markers */}
        {allActiveCrises?.map((crisis: any, idx: number) => {
          if (!crisis.location) return null;
          const isRetracted = crisis.status === 'retracted';
          return (
            <Marker key={`crisis-mark-${idx}`} longitude={crisis.location.lng} latitude={crisis.location.lat} anchor="center">
              <div 
                onClick={() => {
                  setSelectedCrisis(crisis);
                  setSelectedSector(null); // clear sector detail
                }}
                className="relative flex items-center justify-center cursor-pointer group"
              >
                {!isRetracted && <div className="absolute w-24 h-24 bg-red-600/30 rounded-full animate-ping pointer-events-none"></div>}
                <div className={`w-4.5 h-4.5 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.8)] z-10 border-2 border-white/20 flex items-center justify-center text-[8px] ${isRetracted ? 'bg-gray-500 shadow-none' : 'bg-red-600 animate-pulse'}`}>
                  ⚠️
                </div>
                <div className={`absolute top-6 bg-black/90 backdrop-blur border px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap shadow-xl border-[#333] transition-all group-hover:scale-105 ${isRetracted ? 'text-gray-400' : 'text-red-400'}`}>
                  {crisis.crisis_type.replace('_', ' ').toUpperCase()} {isRetracted ? '(RETRACTED)' : ''}
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Static Emergency Shelters Layer (Active when shelters shown) */}
        {showShelters && EMERGENCY_SHELTERS.map((shelter, idx) => (
          <Marker 
            key={`shelter-${idx}`} 
            longitude={shelter.lng} 
            latitude={shelter.lat} 
            anchor="center"
          >
            <div className="relative flex items-center justify-center cursor-pointer group">
              <div className="w-5.5 h-5.5 bg-emerald-600 rounded-full border-2 border-white/40 shadow-[0_0_10px_rgba(16,185,129,0.8)] flex items-center justify-center text-[10px] font-bold text-white z-10 hover:scale-110 transition-transform">
                🏠
              </div>
              
              {/* Premium Hover Card */}
              <div className="absolute bottom-7 bg-[#0c0c0c]/95 backdrop-blur border border-emerald-500/40 px-3 py-2 rounded text-[10px] text-gray-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-2xl min-w-[180px] font-mono">
                <div className="font-bold text-emerald-400 border-b border-emerald-500/20 pb-1 mb-1 uppercase tracking-wide text-[8px]">
                  Emergency Shelter
                </div>
                <div className="font-bold text-white mb-0.5 truncate">{shelter.name}</div>
                <div className="text-gray-400 text-[8px] mb-1.5">{shelter.address}</div>
                <div className="flex justify-between items-center text-[9px] mb-0.5">
                  <span>CAPACITY:</span>
                  <span className="text-white font-bold">{shelter.capacity}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] mb-1.5">
                  <span>OCCUPIED:</span>
                  <span className="text-emerald-400 font-bold">{shelter.occupied} ({Math.round(shelter.occupied / shelter.capacity * 100)}%)</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden border border-gray-700/50">
                  <div 
                    className="bg-emerald-500 h-full rounded-full" 
                    style={{ width: `${(shelter.occupied / shelter.capacity) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {/* Interactive Field Signals */}
        {showSignals && fieldSignals.map((sig, idx) => {
          const isStale = sig.status === 'stale';
          const iconColor = isStale ? 'bg-gray-700 shadow-gray-500/20 animate-pulse' : 
                            sig.type === 'weather' ? 'bg-cyan-500 shadow-cyan-500/50 animate-pulse' :
                            sig.type === 'traffic' ? 'bg-amber-500 shadow-amber-500/50 animate-pulse' :
                            'bg-orange-500 shadow-orange-500/50 animate-pulse';
          
          return (
            <Marker 
              key={`field-sig-${idx}`} 
              longitude={sig.lng} 
              latitude={sig.lat} 
              anchor="center"
            >
              <div className="relative flex items-center justify-center cursor-pointer group">
                {!isStale && <div className="absolute w-5 h-5 bg-orange-500/30 rounded-full animate-ping pointer-events-none"></div>}
                <div className={`w-5.5 h-5.5 rounded-full border border-white/20 shadow-[0_0_8px] flex items-center justify-center text-[10px] z-10 transition-transform hover:scale-110 ${iconColor}`}>
                  {sig.icon}
                </div>

                {/* Premium Signal Hover Card */}
                <div className="absolute bottom-7 bg-[#0c0c0c]/95 backdrop-blur border border-orange-500/40 px-3 py-2 rounded text-[10px] text-gray-200 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 shadow-2xl min-w-[220px] font-mono">
                  <div className="font-bold text-orange-400 border-b border-orange-500/20 pb-1 mb-1 uppercase tracking-wide text-[8px] flex justify-between items-center">
                    <span>Field Signal Ingest</span>
                    <span className={`px-1 rounded text-[7px] uppercase ${isStale ? 'bg-gray-800 text-gray-400' : 'bg-orange-950 text-orange-400 border border-orange-500/20'}`}>
                      {sig.status}
                    </span>
                  </div>
                  <div className="font-bold text-white mb-0.5">{sig.source}</div>
                  <div className="text-gray-400 text-[8px] mb-1">{sig.timestamp}</div>
                  <p className="text-gray-300 text-[9px] leading-relaxed mb-1.5 border-t border-gray-800 pt-1">{sig.content}</p>
                  <div className="flex justify-between items-center text-[8px]">
                    <span className="text-gray-500">CREDIBILITY SCORE:</span>
                    <span className={`font-bold ${sig.credibility >= 0.8 ? 'text-emerald-400' : sig.credibility >= 0.6 ? 'text-amber-400' : 'text-red-400'}`}>
                      {(sig.credibility * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Resource Station Bases */}
        {showResources && Object.entries(DISPATCH_STARTING_COORDS).map(([unitId, coords], idx) => (
          <Marker key={`base-${idx}`} longitude={coords.lng} latitude={coords.lat} anchor="center">
            <div className="relative flex items-center justify-center cursor-pointer group">
              <div className="w-3.5 h-3.5 bg-gray-900 border border-gray-600 rounded-sm flex items-center justify-center text-[7px] text-gray-400 hover:border-blue-400 transition-colors">
                🏢
              </div>
              <div className="absolute top-4 bg-[#0a0a0a]/95 border border-[#333] px-1 py-0.5 rounded text-[7px] text-gray-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                STATION: {unitId}
              </div>
            </div>
          </Marker>
        ))}

        {/* Resource Allocation Markers (Precise matching coordinate dispatch) */}
        {showResources && resourceAllocation && resourceAllocation.crisis_allocations?.map((alloc: any, idx: number) => {
          // Resolve matching crisis coordinates to plot resources around their exact target
          const matchingCrisis = allActiveCrises?.find(c => c.crisis_id === alloc.crisis_id) || activeCrisis;
          const baseLat = matchingCrisis?.location?.lat || 33.6844;
          const baseLng = matchingCrisis?.location?.lng || 73.0479;
          
          return (
            <React.Fragment key={`res-grp-${idx}`}>
              {/* Plot Ambulance */}
              {alloc.resources_assigned?.ambulances > 0 && (
                <Marker longitude={baseLng + 0.003} latitude={baseLat - 0.002} anchor="center">
                  <div className="relative flex items-center justify-center hover:scale-110 transition-transform cursor-pointer group">
                    <div className="w-4 h-4 bg-red-500 rounded-full border border-white/30 shadow-[0_0_8px_rgba(239,68,68,0.8)] flex items-center justify-center text-[8px] font-bold text-white z-10">🚑</div>
                    <div className="absolute top-5 bg-[#0a0a0a]/95 border border-[#333] px-1.5 py-0.5 rounded text-[8px] text-gray-300 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      AMBULANCES x{alloc.resources_assigned.ambulances}
                    </div>
                  </div>
                </Marker>
              )}
              {/* Plot Rescue Team */}
              {alloc.resources_assigned?.rescue_teams > 0 && (
                <Marker longitude={baseLng - 0.003} latitude={baseLat + 0.003} anchor="center">
                  <div className="relative flex items-center justify-center hover:scale-110 transition-transform cursor-pointer group">
                    <div className="w-4 h-4 bg-blue-500 rounded-full border border-white/30 shadow-[0_0_8px_rgba(59,130,246,0.8)] flex items-center justify-center text-[8px] font-bold text-white z-10">⛵</div>
                    <div className="absolute top-5 bg-[#0a0a0a]/95 border border-[#333] px-1.5 py-0.5 rounded text-[8px] text-gray-300 font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      RESCUE TEAMS x{alloc.resources_assigned.rescue_teams}
                    </div>
                  </div>
                </Marker>
              )}
            </React.Fragment>
          )
        })}

        {/* User Location */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
            <div className="relative flex items-center justify-center pointer-events-none">
              <div className="absolute w-12 h-12 bg-orange-500/20 rounded-full animate-pulse"></div>
              <div className="w-3 h-3 bg-orange-500 rounded-full z-10 border border-white/40 shadow-lg"></div>
              <div className="absolute top-4 text-[9px] text-orange-400 font-bold whitespace-nowrap tracking-wider font-mono">USER LOC</div>
            </div>
          </Marker>
        )}
      </Map>

      {/* Floating Tactical Sector Profile HUD */}
      {selectedSector && (
        <div className="absolute bottom-4 left-4 z-20 bg-[#070707]/95 backdrop-blur-md border border-emerald-500/40 rounded p-3 w-64 shadow-[0_0_30px_rgba(0,0,0,0.95)] animate-fade-in-up font-mono border-t-2 border-t-emerald-500">
          <div className="flex justify-between items-center border-b border-emerald-500/20 pb-1.5 mb-2">
            <span className="text-[10px] font-bold text-emerald-400 tracking-wider">TACTICAL SECTOR PROFILE</span>
            <button 
              onClick={() => setSelectedSector(null)} 
              className="text-[10px] text-gray-500 hover:text-white transition-colors cursor-pointer select-none font-bold font-mono"
            >
              [X]
            </button>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">SECTOR:</span>
              <span className="text-white font-bold">{selectedSector.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">RISK INDEX:</span>
              <span className={`font-bold ${
                selectedSector.score >= 0.75 ? 'text-red-400 animate-pulse' :
                selectedSector.score >= 0.50 ? 'text-amber-400' :
                'text-emerald-400'
              }`}>
                {(selectedSector.score * 100).toFixed(0)}% VULNERABILITY
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">DRAINAGE CAPACITY:</span>
              <span className="text-gray-200">{SECTOR_DETAILS[selectedSector.name]?.drainage}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">POPULATION DENSITY:</span>
              <span className="text-gray-200">{SECTOR_DETAILS[selectedSector.name]?.density}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">LOW-INCOME ZONE:</span>
              <span className={SECTOR_DETAILS[selectedSector.name]?.lowIncome.includes("Yes") ? "text-amber-400 font-bold" : "text-gray-200"}>
                {SECTOR_DETAILS[selectedSector.name]?.lowIncome}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">HISTORICAL FLOODS:</span>
              <span className="text-gray-200">{SECTOR_DETAILS[selectedSector.name]?.historical} events</span>
            </div>
            <div className="flex justify-between border-t border-[#222] pt-1.5 mt-1.5">
              <span className="text-gray-500">AREA COVERAGE:</span>
              <span className="text-gray-200">{SECTOR_DETAILS[selectedSector.name]?.area}</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Crisis Telemetry Profile HUD */}
      {selectedCrisis && (
        <div className="absolute bottom-4 left-4 z-20 bg-[#070707]/95 backdrop-blur-md border border-red-500/40 rounded p-3 w-64 shadow-[0_0_30px_rgba(0,0,0,0.95)] animate-fade-in-up font-mono border-t-2 border-t-red-500">
          <div className="flex justify-between items-center border-b border-red-500/20 pb-1.5 mb-2">
            <span className="text-[10px] font-bold text-red-400 tracking-wider">CRISIS TELEMETRY LOG</span>
            <button 
              onClick={() => setSelectedCrisis(null)} 
              className="text-[10px] text-gray-500 hover:text-white transition-colors cursor-pointer select-none font-bold font-mono"
            >
              [X]
            </button>
          </div>
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">CRISIS TYPE:</span>
              <span className="text-white font-bold uppercase">{selectedCrisis.crisis_type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SUB-TYPE:</span>
              <span className="text-gray-300 font-bold uppercase">{selectedCrisis.sub_type?.replace('_', ' ') || 'GENERAL'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">CONFIDENCE:</span>
              <span className="text-emerald-400 font-bold">{(selectedCrisis.confidence_score * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">STATUS:</span>
              <span className={`font-bold ${
                selectedCrisis.status === 'active' ? 'text-red-400 animate-pulse' :
                selectedCrisis.status === 'retracted' ? 'text-gray-400' :
                'text-amber-400 font-bold animate-pulse'
              }`}>
                {selectedCrisis.status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">DOMINANT SIGNALS:</span>
              <span className="text-gray-200">{selectedCrisis.dominant_signals?.length || 0} verified</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">DISMISSED SIGNALS:</span>
              <span className="text-gray-400">{selectedCrisis.dismissed_signals?.length || 0} stale</span>
            </div>
            {selectedCrisis.contradictions_detected && (
              <div className="border-t border-red-500/20 pt-1.5 mt-1.5 text-[8px] text-amber-400 leading-normal">
                <span className="font-bold">CONTRADICTION ALERT:</span> {selectedCrisis.contradiction_detail}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Zoom Controls in Bottom Right */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-10">
        <button 
          onClick={() => setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom + 1, 18) }))}
          className="w-8 h-8 bg-[#0a0a0a]/90 backdrop-blur border border-[#333] hover:bg-[#222] text-gray-200 rounded shadow-md flex items-center justify-center font-bold text-sm transition-colors cursor-pointer select-none"
          title="Zoom In"
        >
          +
        </button>
        <button 
          onClick={() => setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom - 1, 4) }))}
          className="w-8 h-8 bg-[#0a0a0a]/90 backdrop-blur border border-[#333] hover:bg-[#222] text-gray-200 rounded shadow-md flex items-center justify-center font-bold text-sm transition-colors cursor-pointer select-none"
          title="Zoom Out"
        >
          -
        </button>
        <button 
          onClick={() => setViewState(prev => ({ ...prev, longitude: 73.0479, latitude: 33.6844, zoom: 12 }))}
          className="w-8 h-8 bg-[#0a0a0a]/90 backdrop-blur border border-[#333] hover:bg-[#222] text-emerald-400 rounded shadow-md flex items-center justify-center font-semibold text-[10px] transition-colors cursor-pointer select-none"
          title="Recenter"
        >
          RST
        </button>
      </div>
    </div>
  );
}
