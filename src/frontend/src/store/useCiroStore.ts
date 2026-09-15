import { create } from 'zustand'
import { apiClient } from '../api/client'
import { saveAlerts, getAlerts } from '../lib/storage'
import { v4 as uuidv4 } from 'uuid'

export interface CrisisObject {
  crisis_id: string;
  crisis_type: string;
  confidence_score: number;
  location: any;
  status: string;
}

export interface Alert {
  id: string;
  audience: string;
  channel: string;
  language: string;
  subject: string;
  body: string;
  urgency_level: string;
  sent_at: string;
}

interface CiroState {
  activeCrisis: CrisisObject | null;
  allActiveCrises: CrisisObject[];
  publicAlerts: Alert[];
  allAlerts: Alert[];
  isLoading: boolean;
  agentStatus: string;
  userLocation: { lat: number; lng: number } | null;
  
  // Dashboard States
  isDarkMode: boolean;
  newsFeeds: string[];
  resourceAllocation: any | null;
  simulationResult: any | null;
  
  // Map Layer Toggles
  showCrisisZones: boolean;
  showResources: boolean;
  showWeatherRadar: boolean;
  showShelters: boolean;
  showVulnerabilities: boolean;
  showSignals: boolean;
  
  // Actions
  loadLocalAlerts: () => Promise<void>;
  triggerPipelineRun: (endpoint?: string) => Promise<void>;
  setLocation: (lat: number, lng: number) => void;
  setAgentStatus: (status: string) => void;
  addNewsFeed: (url: string) => void;
  removeNewsFeed: (index: number) => void;
  toggleLayer: (layerName: 'showCrisisZones' | 'showResources' | 'showWeatherRadar' | 'showShelters' | 'showVulnerabilities' | 'showSignals') => void;
}

const DEFAULT_LOCATION = { lat: 33.6844, lng: 73.0479 }; // Islamabad
const GEO_NEWS_URL = "https://www.youtube.com/embed/_FwympjOSNE?autoplay=1&mute=1";
const ARY_NEWS_URL = "https://www.youtube.com/embed/K77zGtR_X58?autoplay=1&mute=1";

const getCityFromCoordinates = (lat: number, lng: number): string => {
  if (lat >= 24.0 && lat <= 26.0 && lng >= 66.0 && lng <= 68.0) return "Karachi";
  if (lat >= 31.0 && lat <= 32.0 && lng >= 74.0 && lng <= 75.0) return "Lahore";
  return "Islamabad";
};

const STATUS_MESSAGES = [
  "Ingesting local signals from weather and traffic...",
  "Classifying crisis type and severity...",
  "Predicting impact and cascade risks...",
  "Allocating emergency resources...",
  "Generating stakeholder comms...",
  "Finalizing response simulation..."
];

export const useCiroStore = create<CiroState>((set, get) => ({
  activeCrisis: null,
  allActiveCrises: [],
  publicAlerts: [],
  allAlerts: [],
  isLoading: false,
  agentStatus: "System Ready",
  userLocation: null,
  
  isDarkMode: true,
  newsFeeds: [GEO_NEWS_URL, ARY_NEWS_URL],
  resourceAllocation: null,
  simulationResult: null,

  showCrisisZones: true,
  showResources: true,
  showWeatherRadar: true,
  showShelters: true,
  showVulnerabilities: true,
  showSignals: true,

  setLocation: (lat, lng) => set({ userLocation: { lat, lng } }),
  setAgentStatus: (status) => set({ agentStatus: status }),
  
  addNewsFeed: (url) => set((state) => ({ newsFeeds: [...state.newsFeeds, url] })),
  removeNewsFeed: (index) => set((state) => ({ 
    newsFeeds: state.newsFeeds.filter((_, i) => i !== index) 
  })),

  toggleLayer: (layerName) => set((state: any) => ({ [layerName]: !state[layerName] })),

  loadLocalAlerts: async () => {
    const alerts = await getAlerts();
    set({ publicAlerts: alerts });
  },

  triggerPipelineRun: async (endpoint = '/demo/scenario-a-v2') => {
    set({ isLoading: true, agentStatus: "Acquiring location..." });
    
    // 1. Get Location
    let loc = get().userLocation;
    if (!loc) {
      try {
        loc = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(err),
            { timeout: 5000, enableHighAccuracy: true }
          );
        });
        set({ userLocation: loc });
      } catch (err) {
        console.warn("Location denied or failed. Falling back to Islamabad.", err);
        loc = DEFAULT_LOCATION;
        set({ userLocation: loc });
      }
    }

    // 2. Start dynamic agent status cycling
    let statusIndex = 0;
    set({ agentStatus: STATUS_MESSAGES[0] });
    const intervalId = setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUS_MESSAGES.length;
      set({ agentStatus: STATUS_MESSAGES[statusIndex] });
    }, 2500);

    // 3. Trigger Backend Pipeline
    try {
      const latitude = loc?.lat || 33.6844;
      const longitude = loc?.lng || 73.0479;
      const city = getCityFromCoordinates(latitude, longitude);

      const payload = endpoint === '/pipeline/run' ? {
        location: { 
          lat: latitude, 
          lng: longitude, 
          city: city,
          sector: city === "Karachi" ? "Clifton" : city === "Lahore" ? "Johar Town" : "G-10"
        },
        radius_km: 10.0,
        time_window_hours: 2
      } : undefined;

      const response = await apiClient.post(endpoint, payload);
      const data = response.data;
      const finalOutput = data.final_output || data;

      // Extract all alerts and normalize audiences
      const allMessages = finalOutput.comms?.messages || [];
      const formattedAlerts = allMessages.map((msg: any) => {
        const rawAudience = msg.audience || 'public';
        const aud = rawAudience.trim().toLowerCase();
        const subject = (msg.subject || '').toLowerCase();
        let normalizedAudience = 'public';
        
        if (
          aud.includes('hospital') || 
          aud.includes('medical') || 
          aud.includes('health') || 
          aud.includes('pims') || 
          subject.includes('hospital') || 
          subject.includes('triage') || 
          aud.includes('clinic')
        ) {
          normalizedAudience = 'hospitals';
        } else if (
          aud.includes('emergency') || 
          aud.includes('rescue') || 
          aud.includes('1122') || 
          aud.includes('police') || 
          aud.includes('dispatch') || 
          subject.includes('dispatch') || 
          subject.includes('rescue 1122') || 
          aud.includes('responder')
        ) {
          normalizedAudience = 'emergency_services';
        } else if (
          aud.includes('ndma') || 
          aud.includes('command') || 
          aud.includes('control') || 
          aud.includes('briefing') || 
          subject.includes('briefing') || 
          subject.includes('command core') || 
          aud.includes('center')
        ) {
          normalizedAudience = 'ndma';
        } else if (
          aud.includes('media') || 
          aud.includes('press') || 
          aud.includes('news') || 
          aud.includes('utility') || 
          aud.includes('power') || 
          aud.includes('iesco') || 
          subject.includes('press release') || 
          subject.includes('statement') || 
          subject.includes('infrastructure')
        ) {
          normalizedAudience = 'media';
        } else {
          normalizedAudience = 'public';
        }

        return {
          ...msg,
          id: uuidv4(),
          audience: normalizedAudience,
          sent_at: msg.sent_at || new Date().toISOString()
        };
      });

      const newPublicAlerts = formattedAlerts.filter((msg: any) => msg.audience === 'public');

      // Save to IndexedDB (public only for history)
      if (newPublicAlerts.length > 0) {
        await saveAlerts(newPublicAlerts);
        await get().loadLocalAlerts();
      }

      const activeCrisisObj = finalOutput.crisis || (data.crises ? data.crises[0] : null);
      const crises = data.crises || (finalOutput.crisis ? [finalOutput.crisis] : []);

      set({
        activeCrisis: activeCrisisObj,
        allActiveCrises: crises,
        resourceAllocation: finalOutput.allocation || data.allocation || null,
        simulationResult: finalOutput.simulation || data.severities || null,
        allAlerts: formattedAlerts,
        agentStatus: "Analysis Complete",
      });
    } catch (error) {
      console.error("Pipeline failed", error);
      set({ agentStatus: "System Error. Check connection." });
    } finally {
      clearInterval(intervalId);
      set({ isLoading: false });
      setTimeout(() => {
        if (!get().isLoading) set({ agentStatus: "System Ready" });
      }, 3000);
    }
  }
}));
