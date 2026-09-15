import { useEffect, useState } from 'react'
import MapCanvas from './components/map/MapCanvas'
import AgentStatusBanner from './components/ui/AgentStatusBanner'
import ChatOverlay from './components/chat/ChatOverlay'
import ChatPanel from './components/chat/ChatPanel'
import TopNavBar from './components/layout/TopNavBar'
import ArchEnginePanel from './components/layout/ArchEnginePanel'
import ArchMapPanel from './components/layout/ArchMapPanel'
import ArchChatPanel from './components/layout/ArchChatPanel'
import ArchLayoutPanel from './components/layout/ArchLayoutPanel'
import NewsIframe from './components/layout/NewsIframe'
import ResourcePanel from './components/layout/ResourcePanel'
import SimulationPanel from './components/layout/SimulationPanel'
import AlertsPanel from './components/layout/AlertsPanel'
import StreamDockPanel from './components/layout/StreamDockPanel'
import LiveStatusTicker from './components/layout/LiveStatusTicker'
import { useCiroStore } from './store/useCiroStore'
import {
  Navigation,
  LayoutGrid,
  Radio,
  ShieldAlert,
  Cpu,
  Tv,
  Map as MapIcon,
  Bell,
  MessageSquare,
  Settings,
  Wifi,
  WifiOff,
  Sliders,
  Play,
  Info,
  Activity,
  Flame,
  Award,
  CheckCircle
} from 'lucide-react'

function MobileTimeTicker() {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi'
  }).toUpperCase()

  const formattedTime = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Karachi'
  })

  return (
    <div className="bg-[#070707] border border-[#1f1f1f] rounded-lg px-4 py-2 flex items-center justify-between shadow-lg relative overflow-hidden select-none shrink-0">
      <div className="flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
        <span className="text-[10px] text-gray-400 font-bold tracking-wider">
          {formattedDate}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[12px] text-emerald-400 font-extrabold tracking-widest tabular-nums">
          {formattedTime}
        </span>
        <span className="text-[8px] text-gray-600 font-bold tracking-wider">
          PKT
        </span>
      </div>
    </div>
  )
}

function App() {
  const { newsFeeds, triggerPipelineRun, isLoading, allAlerts, agentStatus } = useCiroStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'map' | 'broadcasts' | 'alerts' | 'operations' | 'settings'>('overview')

  // Responsive Layout States
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  const [mobileTab, setMobileTab] = useState<'overview' | 'map' | 'alerts' | 'comms' | 'settings' | 'chat'>('overview')
  const [serverUrlInput, setServerUrlInput] = useState(localStorage.getItem('ciro_server_url') || '')
  const [isUrlSaved, setIsUrlSaved] = useState(false)
  const [commsAudience, setCommsAudience] = useState<'ndma' | 'emergency_services' | 'hospitals' | 'public' | 'media'>('ndma')
  const [isScenarioDropdownOpen, setIsScenarioDropdownOpen] = useState(false)

  // Unused scrolling refs and helper functions removed to satisfy TS compiler constraints

  // Handle screen resizing
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Force FullDark mode permanently
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
  }, []);

  const saveServerUrl = () => {
    const sanitizedUrl = serverUrlInput.trim();
    if (sanitizedUrl === '') {
      localStorage.removeItem('ciro_server_url');
    } else {
      localStorage.setItem('ciro_server_url', sanitizedUrl);
    }
    setIsUrlSaved(true);
    setTimeout(() => setIsUrlSaved(false), 3000);
  };

  // Get active server URL description
  const getActiveServer = () => {
    const saved = localStorage.getItem('ciro_server_url');
    if (saved && saved !== '') return saved;
    return 'Local/Auto Bridge Mode';
  };

  // Resolve Lucide icons for Comms bubbles
  const getAudienceIcon = (aud: string) => {
    switch (aud) {
      case 'ndma': return <Award className="w-5 h-5 text-emerald-400" />;
      case 'emergency_services': return <Flame className="w-5 h-5 text-red-400" />;
      case 'hospitals': return <Activity className="w-5 h-5 text-blue-400" />;
      case 'public': return <Radio className="w-5 h-5 text-amber-400" />;
      case 'media': return <Tv className="w-5 h-5 text-purple-400" />;
      default: return <Info className="w-5 h-5 text-gray-400" />;
    }
  };

  // Mobile Render Flow
  if (isMobile) {
    return (
      <div id="amaan-mobile-command-center" className="h-screen w-full flex flex-col bg-[#020202] text-gray-200 font-mono overflow-hidden">

        {/* MOBILE HEADER */}
        <header className="h-14 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-4 z-40 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-400 w-5 h-5 animate-pulse" />
            <h1 className="font-bold tracking-widest text-gray-100 text-xs uppercase flex flex-col">
              AMAAN <span className="text-[7px] text-gray-500 font-bold tracking-normal font-mono -mt-1">CIRO COMMAND</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div
              onClick={() => setMobileTab('settings')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[8px] font-bold cursor-pointer transition-all ${localStorage.getItem('ciro_server_url')
                  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/40'
                  : 'bg-[#111] text-gray-400 border-[#222]'
                }`}
            >
              {localStorage.getItem('ciro_server_url') ? (
                <>
                  <Wifi className="w-2.5 h-2.5" />
                  <span>CLOUD LINK</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                  <span>DEFAULT BRIDGE</span>
                </>
              )}
            </div>

            <button
              onClick={() => setMobileTab('settings')}
              className={`p-1.5 rounded border transition-all cursor-pointer ${mobileTab === 'settings'
                  ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/35 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                  : 'bg-[#111] text-gray-400 border-[#222] hover:text-gray-200'
                }`}
              title="System Control & Comms Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* PULSING MOBILE AGENT STATUS BANNER */}
        <div className="bg-[#050505] border-b border-[#1a1a1a] px-3 py-1 flex items-center gap-2 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">HUD:</span>
          <span className="text-[9px] text-emerald-400 font-bold truncate tracking-wide animate-pulse">
            {agentStatus}
          </span>
        </div>

        {/* MOBILE CONTENT CONTAINER (Strictly bounds the height to prevent scrolling outside layout) */}
        <main className="flex-1 w-full overflow-hidden relative">

          {/* TAB 1: SYSTEM OVERVIEW (PREMIUM LANDING PAGE) */}
          {mobileTab === 'overview' && (
            <div className="w-full h-full overflow-y-auto px-4 py-4 space-y-6 pb-24 custom-scrollbar bg-[#020202]">

              {/* Compact Mobile Time Ticker */}
              <MobileTimeTicker />

              {/* Brand Logo, Motto & Premium Header Banner */}
              <div className="bg-gradient-to-br from-[#0c0c0c] to-[#040404] border border-[#1f1f1f] rounded-lg p-5 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl"></div>
                <div className="relative mb-3 flex items-center justify-center">
                  <div className="absolute w-12 h-12 bg-emerald-500/10 rounded-full animate-ping"></div>
                  <div className="w-10 h-10 rounded-full bg-[#0e1f18] border border-emerald-500/35 flex items-center justify-center shadow-inner">
                    <Activity className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                  </div>
                </div>

                <h2 className="text-lg font-black tracking-widest text-white uppercase font-mono">AMAAN CIRO</h2>
                <p className="text-[8px] font-extrabold text-emerald-400 uppercase tracking-widest mt-1">Crisis Intelligence & Response Orchestrator</p>
                <div className="w-12 h-[1px] bg-emerald-800/60 my-2.5"></div>
                <span className="text-[10px] text-gray-300 leading-relaxed max-w-[280px]">
                  "Empowering emergency services, predicting cascading risks, and safeguarding lives autonomously."
                </span>
              </div>

              {/* Regional Map Preview on Mobile Overview */}
              <div className="space-y-3 shrink-0">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3.5 bg-emerald-500 rounded-sm"></span>
                  <h3 className="text-[10.5px] uppercase font-bold text-gray-200 tracking-wider">Regional Operations Map</h3>
                </div>
                <div className="h-64 w-full relative border border-[#1f1f1f] rounded overflow-hidden shadow-lg">
                  <MapCanvas />
                </div>
              </div>

              {/* Central Run Scenarios Quick Control */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-1.5 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3.5 bg-emerald-500 rounded-sm"></span>
                    <h3 className="text-[10.5px] uppercase font-bold text-gray-200 tracking-wider">Run System Scenarios</h3>
                  </div>
                  <span className="text-[7.5px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/30 border border-emerald-500/20 px-1.5 py-0.5 rounded animate-pulse">Ready</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">

                  {/* Option 1: Live Ingestion */}
                  <div className="bg-[#070707] border border-[#1f1f1f] hover:border-emerald-500/30 rounded p-3 flex justify-between items-center transition-all shadow-md">
                    <div className="space-y-0.5 max-w-[70%]">
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-wider font-bold">📡 Run Live Scenario</h4>
                      <p className="text-[8.5px] text-gray-400 leading-tight">Fetch real-time meteorological rainfall indexes, traffic sensors, and GDELT alerts.</p>
                    </div>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/pipeline/run');
                        setMobileTab('map');
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 rounded text-[8.5px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      TRIGGER
                    </button>
                  </div>

                  {/* Option 2: Scenario A (Flood) */}
                  <div className="bg-[#070707] border border-[#1f1f1f] hover:border-blue-500/30 rounded p-3 flex justify-between items-center transition-all shadow-md">
                    <div className="space-y-0.5 max-w-[70%]">
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-wider font-bold">🌊 Scripted Scenario A</h4>
                      <p className="text-[8.5px] text-gray-400 leading-tight">Islamabad flooding response: deploys 4 rescue teams and manages a concurrent heat emergency.</p>
                    </div>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-a-v2');
                        setMobileTab('map');
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-blue-950/20 hover:bg-blue-950/40 text-blue-400 border border-blue-500/30 rounded text-[8.5px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      TRIGGER
                    </button>
                  </div>

                  {/* Option 3: Scenario B (False Alarm) */}
                  <div className="bg-[#070707] border border-[#1f1f1f] hover:border-amber-500/30 rounded p-3 flex justify-between items-center transition-all shadow-md">
                    <div className="space-y-0.5 max-w-[70%]">
                      <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-wider font-bold">⚠️ Scripted Scenario B</h4>
                      <p className="text-[8.5px] text-gray-400 leading-tight">Low-confidence flood ping: verifies utility water main burst and automatically retracts incident logs.</p>
                    </div>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-b');
                        setMobileTab('map');
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-amber-950/20 hover:bg-amber-950/40 text-amber-400 border border-amber-500/30 rounded text-[8.5px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      TRIGGER
                    </button>
                  </div>

                  {/* Option 4: Scenario C (Dual Crisis) */}
                  <div className="bg-[#070707] border border-[#1f1f1f] hover:border-red-500/30 rounded p-3 flex justify-between items-center transition-all shadow-md">
                    <div className="space-y-0.5 max-w-[70%]">
                      <h4 className="text-[10px] font-black text-red-400 uppercase tracking-wider font-bold">💥 Scripted Scenario C</h4>
                      <p className="text-[8.5px] text-gray-400 leading-tight">Simultaneous G-10 flood and I-8 heatwave: triggers resource trade-offs and dynamic fleet allocations.</p>
                    </div>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-c');
                        setMobileTab('map');
                      }}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/30 rounded text-[8.5px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      TRIGGER
                    </button>
                  </div>

                </div>
              </div>

              {/* Geo Live News Feed */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3.5 bg-red-500 rounded-sm"></span>
                  <h3 className="text-[10.5px] uppercase font-bold text-gray-200 tracking-wider">📺 Geo Live News Feed</h3>
                </div>
                <div className="h-56 w-full relative border border-[#1f1f1f] rounded overflow-hidden shadow-lg bg-[#070707]">
                  <NewsIframe index={0} title="Geo Live Feed" />
                </div>
              </div>

              {/* Dynamic Telemetry & Available Resources Status */}
              <div className="bg-[#070707] border border-[#1f1f1f] rounded-lg p-4 shadow-md font-mono relative overflow-hidden">
                <div className="absolute top-3 right-3.5 flex items-center justify-center">
                  <div className="absolute w-6 h-6 bg-emerald-500/10 rounded-full animate-ping"></div>
                  <div className="w-5.5 h-5.5 rounded-full bg-[#0e1f18] border border-emerald-500/35 flex items-center justify-center shadow-inner">
                    <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-[#1f1f1f] pb-1 flex justify-between pr-8">
                  <span>Tactical Fleet Inventory</span>
                  <span className="text-emerald-500 text-[8px] font-extrabold uppercase animate-pulse">Active</span>
                </h3>

                <div className="grid grid-cols-1 gap-2.5 text-center text-[10px]">
                  <div className="bg-[#030303] border border-[#1f1f1f] p-3 rounded flex items-center justify-between px-4">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider block">AMBULANCES</span>
                    <strong className="text-white text-xs block">8 / 12 AVAIL</strong>
                  </div>
                  <div className="bg-[#030303] border border-[#1f1f1f] p-3 rounded flex items-center justify-between px-4">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider block">RESCUE BOATS</span>
                    <strong className="text-white text-xs block">4 / 6 AVAIL</strong>
                  </div>
                  <div className="bg-[#030303] border border-[#1f1f1f] p-3 rounded flex items-center justify-between px-4">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider block">RESCUE TEAMS</span>
                    <strong className="text-white text-xs block">6 / 8 AVAIL</strong>
                  </div>
                  <div className="bg-[#030303] border border-[#1f1f1f] p-3 rounded flex items-center justify-between px-4">
                    <span className="text-[8px] text-gray-500 uppercase tracking-wider block">TRAFFIC POLICE</span>
                    <strong className="text-white text-xs block">7 / 10 AVAIL</strong>
                  </div>
                </div>

                <div className="text-[8px] text-gray-500 mt-2.5 text-center">
                  *Assets dynamically routed on scenario initialization via live coordinate logic
                </div>
              </div>

              {/* Emotional Tragedy Story & Purpose */}
              <div className="bg-[#070707] border border-[#1a1a1a]/80 rounded-lg p-4 shadow-md font-mono relative overflow-hidden">
                <div className="absolute top-3 right-3.5 flex items-center justify-center">
                  <div className="absolute w-6 h-6 bg-emerald-500/10 rounded-full animate-ping"></div>
                  <div className="w-5.5 h-5.5 rounded-full bg-[#0e1f18] border border-emerald-500/35 flex items-center justify-center shadow-inner">
                    <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-[9.5px] font-bold text-amber-500 uppercase tracking-wider mb-2 border-b border-[#1f1f1f] pb-1 pr-8">Why Amaan Crisis Intelligence?</h3>
                <p className="text-[10px] text-gray-300 leading-relaxed mb-2.5">
                  Pakistan loses hundreds of innocent lives and billions in vital infrastructure annually to preventable crisis mismanagement. The devastating <strong>Karachi & Islamabad Monsoon Floods</strong> took massive tolls not because the storms were unpredictable, but because legacy operations rooms were <strong>blind, disjointed, and slow</strong>.
                </p>
                <p className="text-[10px] text-gray-300 leading-relaxed">
                  <strong>Amaan CIRO</strong> breaks this cycle by acting as Pakistan's first unified crisis detection engine. It merges weather sensors, traffic flows, and citizen reports, optimizing emergency resources dynamically to save lives when every second counts.
                </p>
              </div>

              {/* 4 Single Column Rows of blueprints */}
              <div className="space-y-3 pb-6">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-purple-500 rounded-sm"></span>
                  <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">System Core Blueprint</h2>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="scale-95 origin-top">
                    <ArchEnginePanel />
                  </div>
                  <div className="scale-95 origin-top">
                    <ArchMapPanel />
                  </div>
                  <div className="scale-95 origin-top">
                    <ArchChatPanel />
                  </div>
                  <div className="scale-95 origin-top">
                    <ArchLayoutPanel />
                  </div>
                </div>
              </div>

              {/* MOBILE FOOTER */}
              <div className="border-t border-[#1f1f1f] pt-4 pb-2 text-center text-[8px] text-gray-500 font-mono tracking-wider w-full select-none shrink-0">
                <p className="uppercase">AMAAN CIRO • Mobile Command</p>
                <p className="text-gray-600 mt-0.5">© {new Date().getFullYear()} Amaan emergency systems. Safeguarding lives autonomously.</p>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE MAP CANVAS */}
          {mobileTab === 'map' && (
            <div className="w-full h-full relative">
              <MapCanvas />

              {/* Floating Scenario Trigger overlay */}
              <div className="absolute top-4 right-4 z-10 flex flex-col items-end">
                <button
                  onClick={() => setIsScenarioDropdownOpen(!isScenarioDropdownOpen)}
                  className="px-3 py-2 bg-emerald-500/90 text-black border border-emerald-400 rounded-md text-[9px] font-extrabold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
                >
                  <Play className="w-3 h-3 fill-black text-black" />
                  RUN SCENARIOS
                </button>

                {isScenarioDropdownOpen && (
                  <div className="mt-2 bg-[#0a0a0a]/95 backdrop-blur border border-[#1f1f1f] rounded shadow-2xl p-2 w-48 flex flex-col gap-1.5 animate-fade-in-down font-mono z-50">
                    <button
                      onClick={() => {
                        triggerPipelineRun('/pipeline/run');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-2.5 py-1.5 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 rounded text-[8px] font-bold uppercase transition-colors disabled:opacity-50"
                    >
                      📡 RUN LIVE SCENARIO
                    </button>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-a-v2');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-2.5 py-1.5 bg-[#111] hover:bg-[#222] text-gray-300 border border-[#333] rounded text-[8px] font-bold uppercase transition-colors disabled:opacity-50"
                    >
                      🌊 SCRIPTED SCENARIO A
                    </button>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-b');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-2.5 py-1.5 bg-[#111] hover:bg-[#222] text-gray-300 border border-[#333] rounded text-[8px] font-bold uppercase transition-colors disabled:opacity-50"
                    >
                      ⚠️ SCRIPTED SCENARIO B
                    </button>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-c');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-2.5 py-1.5 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded text-[8px] font-bold uppercase transition-colors disabled:opacity-50"
                    >
                      💥 SCRIPTED SCENARIO C
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INGESTED ALERTS FEED */}
          {mobileTab === 'alerts' && (
            <div className="w-full h-full overflow-y-auto px-4 py-4 space-y-5 custom-scrollbar pb-24 bg-[#020202]">

              {/* News ticker */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-red-500 rounded-sm"></span>
                  <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">Geo News Live Feed</h2>
                </div>
                <div className="h-[200px] w-full rounded overflow-hidden">
                  <NewsIframe index={0} title="Geo Live feed" />
                </div>
              </div>

              {/* Signals */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-amber-500 rounded-sm"></span>
                  <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">Dynamic Ingestion Telemetry</h2>
                </div>
                <div className="space-y-3">
                  <ResourcePanel />
                  <SimulationPanel />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STAKEHOLDER CONVERSATION CHANNELS (LARGE GRAPHICS & MASSIVE READABILITY) */}
          {mobileTab === 'comms' && (
            <div className="w-full h-full flex flex-col overflow-hidden bg-[#020202]">

              {/* Agency Tabs Selectors */}
              <div className="flex bg-[#070707] border-b border-[#1a1a1a] overflow-x-auto shrink-0 select-none custom-scrollbar py-2.5 px-3 gap-1.5">
                <button
                  onClick={() => setCommsAudience('ndma')}
                  className={`px-3.5 py-1.5 border rounded-full text-[9px] uppercase tracking-wider font-bold transition-all shrink-0 cursor-pointer ${commsAudience === 'ndma'
                      ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/40 shadow-lg'
                      : 'bg-[#0f0f0f] text-gray-500 border-[#222]'
                    }`}
                >
                  NDMA
                </button>
                <button
                  onClick={() => setCommsAudience('emergency_services')}
                  className={`px-3.5 py-1.5 border rounded-full text-[9px] uppercase tracking-wider font-bold transition-all shrink-0 cursor-pointer ${commsAudience === 'emergency_services'
                      ? 'bg-red-950/20 text-red-400 border-red-500/40 shadow-lg'
                      : 'bg-[#0f0f0f] text-gray-500 border-[#222]'
                    }`}
                >
                  Rescue 1122
                </button>
                <button
                  onClick={() => setCommsAudience('hospitals')}
                  className={`px-3.5 py-1.5 border rounded-full text-[9px] uppercase tracking-wider font-bold transition-all shrink-0 cursor-pointer ${commsAudience === 'hospitals'
                      ? 'bg-blue-950/20 text-blue-400 border-blue-500/40 shadow-lg'
                      : 'bg-[#0f0f0f] text-gray-500 border-[#222]'
                    }`}
                >
                  Hospitals
                </button>
                <button
                  onClick={() => setCommsAudience('public')}
                  className={`px-3.5 py-1.5 border rounded-full text-[9px] uppercase tracking-wider font-bold transition-all shrink-0 cursor-pointer ${commsAudience === 'public'
                      ? 'bg-amber-950/20 text-amber-400 border-amber-500/40 shadow-lg'
                      : 'bg-[#0f0f0f] text-gray-500 border-[#222]'
                    }`}
                >
                  Public Alert
                </button>
                <button
                  onClick={() => setCommsAudience('media')}
                  className={`px-3.5 py-1.5 border rounded-full text-[9px] uppercase tracking-wider font-bold transition-all shrink-0 cursor-pointer ${commsAudience === 'media'
                      ? 'bg-purple-950/20 text-purple-400 border-purple-500/40 shadow-lg'
                      : 'bg-[#0f0f0f] text-gray-500 border-[#222]'
                    }`}
                >
                  Press Desk
                </button>
              </div>

              {/* Chat-bubble message logs (Generous Spacing, High Contrast, Large Fonts) */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-28 custom-scrollbar">
                <div className="text-center py-2 text-[9px] text-gray-500 font-extrabold uppercase tracking-widest border-b border-[#1a1a1a]/30 mb-3">
                  🔐 SECURED CRYPTO-CHANNEL: {commsAudience.toUpperCase()}
                </div>

                {allAlerts.filter(msg => msg.audience === commsAudience).length === 0 ? (
                  <div className="h-56 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#1f1f1f] rounded-lg">
                    <Radio className="w-10 h-10 text-gray-600 animate-pulse mb-3" />
                    <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest">COMMS VECTOR IDLE</span>
                    <span className="text-[9.5px] text-gray-600 mt-2.5 max-w-[220px] leading-relaxed">Waiting for scenario triggers or real-time regional signals...</span>
                  </div>
                ) : (
                  allAlerts.filter(msg => msg.audience === commsAudience).map((alert, idx) => (
                    <div key={idx} className="flex flex-col gap-3 animate-fade-in-up mb-6 border border-[#222]/80 bg-[#060606] rounded-xl p-5 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500"></div>

                      <div className="flex items-center gap-3 border-b border-[#1f1f1f] pb-3 mb-2">
                        <div className="w-12 h-12 rounded-full bg-[#111] border border-[#333] flex items-center justify-center shrink-0 shadow-lg">
                          {getAudienceIcon(commsAudience)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-lg font-black text-white uppercase block truncate tracking-wide font-mono">{alert.subject}</span>
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5 block">
                            Sent at: {new Date(alert.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div className="py-2">
                        <p className="text-[15px] sm:text-[16px] text-gray-100 leading-relaxed whitespace-pre-line font-mono font-semibold">{alert.body}</p>
                      </div>

                      <div className="flex justify-between items-center mt-3 border-t border-[#1f1f1f] pt-3 text-[10px] text-gray-500 font-mono">
                        <span className="font-bold">CHANNEL: <span className="text-gray-300 font-normal">{alert.channel.toUpperCase()}</span></span>
                        <span className={`px-2.5 py-1 rounded-full font-black text-[9px] tracking-widest ${alert.urgency_level.toLowerCase() === 'critical' ? 'bg-red-950/40 text-red-400 border border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.2)]' :
                            alert.urgency_level.toLowerCase() === 'severe' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.2)]' :
                              'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                          }`}>
                          {alert.urgency_level.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SECURE AI ASSISTANT CHAT PANEL */}
          {mobileTab === 'chat' && (
            <div className="w-full h-full flex flex-col bg-[#020202]">
              <ChatPanel />
            </div>
          )}

          {/* TAB 6: SETTINGS & BRAND PRESENTATION */}
          {mobileTab === 'settings' && (
            <div className="w-full h-full overflow-y-auto px-4 py-4 space-y-6 pb-24 custom-scrollbar bg-[#020202]">

              {/* 1. DYNAMIC SERVER LINKAGE DOCK */}
              <div className="bg-[#070707] border border-[#1f1f1f] rounded p-4 shadow-xl">
                <div className="flex items-center gap-2 border-b border-[#1a1a1a] pb-2 mb-3">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-200">Amaan Core Server Linkage</h3>
                </div>

                <p className="text-[8px] text-gray-400 leading-normal mb-3">
                  Amaan is fully open-source. If you are running the backend locally (or on a custom server instance) without Cloud Run access, simply input your custom API base address (e.g. <code className="text-emerald-400">http://127.0.0.1:8000/api</code> or local Wi-Fi IP <code className="text-emerald-400">http://192.168.1.100:8000/api</code>) and save. **The entire system dynamically redirects all network telemetry in real-time with zero codebase edits or application recompilation.**
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-[8px] font-bold text-gray-500 uppercase block mb-1">Server API Base Address</label>
                    <input
                      type="text"
                      value={serverUrlInput}
                      onChange={(e) => setServerUrlInput(e.target.value)}
                      placeholder="e.g. http://192.168.1.100:8080/api"
                      className="w-full bg-[#030303] border border-[#2c2c2c] rounded px-3 py-2 text-[10px] text-gray-200 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  <div className="flex justify-between items-center text-[7px] text-gray-500">
                    <span>ACTIVE LINK: {getActiveServer()}</span>
                  </div>

                  <button
                    onClick={saveServerUrl}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-black border border-emerald-400 font-extrabold uppercase text-[9px] tracking-widest rounded transition-all cursor-pointer active:scale-95"
                  >
                    ESTABLISH LINKAGE & SAVE
                  </button>

                  {isUrlSaved && (
                    <div className="flex items-center gap-1.5 text-[8px] text-emerald-400 font-bold justify-center bg-emerald-950/20 border border-emerald-500/20 p-2 rounded animate-pulse">
                      <CheckCircle className="w-3 h-3" />
                      <span>URL INSTANTLY BINDED IN CLIENT INTERCEPTOR</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. WHY AMAAN? THE PREMIUM CRISIS PLATFORM */}
              <div className="bg-[#070707] border border-[#1f1f1f] rounded p-4 shadow-xl">
                <div className="flex items-center gap-2 border-b border-[#1a1a1a] pb-2 mb-3">
                  <Award className="w-4 h-4 text-amber-400 animate-pulse" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Why Amaan Crisis Intelligence?</h3>
                </div>

                <div className="space-y-3.5 text-gray-300 text-[9px] leading-relaxed">
                  <p>
                    Pakistan loses billions of rupees and hundreds of lives annually to preventable crisis mismanagement.
                    The historical <strong>Karachi & Islamabad Monsoon Floods</strong> resulted in massive casualties and structural damages —
                    not because the storms were unpredicted, but because response teams were completely
                    <em> blind, reactive, and slow</em>.
                  </p>

                  <p>
                    Emergency services received information from disjointed, conflicting channels. Operations operators
                    had no intelligent central core to tell them where to deploy, which reports to trust,
                    and how to coordinate limited resources between multiple concurrent emergencies.
                  </p>

                  <div className="border-l-2 border-amber-500 pl-2.5 py-1 text-gray-400 italic text-[8px] bg-amber-950/5">
                    "Amaan isn't just a basic status dashboard that reports past catastrophes. Amaan is an autonomous
                    intelligence engine that decides optimal response vectors, predicted durations, and dispatch plans —
                    resolving conflicting field pings in seconds."
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-center pt-2">
                    <div className="bg-[#0f0f0f] border border-[#222] p-2.5 rounded flex items-center justify-between px-4">
                      <div className="text-[10px] font-bold text-emerald-400 tracking-wide">FUSION LATENCY</div>
                      <div className="text-[11px] font-black text-white">&lt; 5 SECONDS</div>
                    </div>
                    <div className="bg-[#0f0f0f] border border-[#222] p-2.5 rounded flex items-center justify-between px-4">
                      <div className="text-[10px] font-bold text-emerald-400 tracking-wide">OPTIMIZATION</div>
                      <div className="text-[11px] font-black text-white">DYNAMIC FAIRNESS</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. MOBILE CORE ENGINE ARCHITECTURE */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-purple-500 rounded-sm"></span>
                  <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">System Core Blueprint</h2>
                </div>
                <div className="space-y-3">
                  <ArchEnginePanel />
                  <ArchMapPanel />
                  <ArchChatPanel />
                  <ArchLayoutPanel />
                </div>
              </div>

            </div>
          )}
        </main>

        {/* STICKY BOTTOM TAB NAVIGATION BAR */}
        <nav className="h-16 bg-[#0a0a0a] border-t border-[#1f1f1f] flex items-center justify-around px-2 z-40 shrink-0 select-none shadow-[0_-5px_15px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => setMobileTab('overview')}
            className={`flex flex-col items-center justify-center gap-1 w-16 transition-colors cursor-pointer ${mobileTab === 'overview' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <LayoutGrid className="w-5.5 h-5.5" />
            <span className="text-[8px] font-bold uppercase tracking-wider font-mono">Overview</span>
          </button>

          <button
            onClick={() => setMobileTab('map')}
            className={`flex flex-col items-center justify-center gap-1 w-16 transition-colors cursor-pointer ${mobileTab === 'map' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <MapIcon className="w-5.5 h-5.5" />
            <span className="text-[8px] font-bold uppercase tracking-wider font-mono">Map View</span>
          </button>

          <button
            onClick={() => setMobileTab('alerts')}
            className={`flex flex-col items-center justify-center gap-1 w-16 transition-colors cursor-pointer ${mobileTab === 'alerts' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <div className="relative">
              <Bell className="w-5.5 h-5.5" />
              {allAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_5px_#10b981] animate-pulse"></span>
              )}
            </div>
            <span className="text-[8px] font-bold uppercase tracking-wider font-mono">Telemetry</span>
          </button>

          <button
            onClick={() => setMobileTab('comms')}
            className={`flex flex-col items-center justify-center gap-1 w-16 transition-colors cursor-pointer ${mobileTab === 'comms' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <MessageSquare className="w-5.5 h-5.5" />
            <span className="text-[8px] font-bold uppercase tracking-wider font-mono">Comms ({allAlerts.length})</span>
          </button>

          <button
            onClick={() => setMobileTab('chat')}
            className={`flex flex-col items-center justify-center gap-1 w-16 transition-colors cursor-pointer ${mobileTab === 'chat' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <Cpu className="w-5.5 h-5.5" />
            <span className="text-[8px] font-bold uppercase tracking-wider font-mono">Chat</span>
          </button>
        </nav>

        {/* Mobile floating overlay disabled to prevent map overlapping */}
      </div>
    )
  }

  // Desktop Render Flow (Preserves all existing premium configurations)
  return (
    <div id="amaan-command-center" className="min-h-screen w-full flex flex-col bg-[#020202] text-gray-200 custom-scrollbar font-mono pb-20">
      <TopNavBar />
      <AgentStatusBanner />
      <LiveStatusTicker />

      {/* STICKY DESKTOP TOOLBAR */}
      <div className="sticky top-0 z-40 h-12 bg-[#050505]/95 backdrop-blur-md border-b border-[#1f1f1f] px-4 py-0 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-black/60">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">CIRO Tactical Console</span>
          <span className="text-gray-700">|</span>
          <select
            onChange={(e) => setActiveTab(e.target.value as any)}
            value={activeTab}
            className="bg-[#0c0c0c] border border-[#222] text-gray-300 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold focus:outline-none focus:border-emerald-500/50 cursor-pointer"
          >
            <option value="overview">🧬 System Overview</option>
            <option value="map">🗺️ Operations Map</option>
            <option value="broadcasts">📺 Broadcast Links</option>
            <option value="alerts">🚨 Stakeholder Logs</option>
            <option value="operations">🛡️ Resource Allocation</option>
            <option value="settings">⚙️ System Linkage</option>
          </select>
        </div>

        <div className="flex gap-1.5 overflow-x-auto max-w-full custom-scrollbar py-0.5 select-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 border rounded text-[9px] uppercase tracking-widest font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'overview'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'bg-[#0c0c0c] text-gray-500 border-[#222] hover:text-gray-300 hover:border-[#333]'
              }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Overview
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 border rounded text-[9px] uppercase tracking-widest font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'map'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                : 'bg-[#0c0c0c] text-gray-500 border-[#222] hover:text-gray-300 hover:border-[#333]'
              }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            Map View
          </button>

          <button
            onClick={() => setActiveTab('broadcasts')}
            className={`px-3 py-1.5 border rounded text-[9px] uppercase tracking-widest font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'broadcasts'
                ? 'bg-red-500/10 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                : 'bg-[#0c0c0c] text-gray-500 border-[#222] hover:text-gray-300 hover:border-[#333]'
              }`}
          >
            <Radio className="w-3.5 h-3.5" />
            Broadcasts ({newsFeeds.length})
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 border rounded text-[9px] uppercase tracking-widest font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'alerts'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                : 'bg-[#0c0c0c] text-gray-500 border-[#222] hover:text-gray-300 hover:border-[#333]'
              }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Stakeholders ({allAlerts.length})
          </button>

          <button
            onClick={() => setActiveTab('operations')}
            className={`px-3 py-1.5 border rounded text-[9px] uppercase tracking-widest font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'operations'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                : 'bg-[#0c0c0c] text-gray-500 border-[#222] hover:text-gray-300 hover:border-[#333]'
              }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Operations
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 border rounded text-[9px] uppercase tracking-widest font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'settings'
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                : 'bg-[#0c0c0c] text-gray-500 border-[#222] hover:text-gray-300 hover:border-[#333]'
              }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-8 flex flex-col gap-8">

        {/* TAB 1: SYSTEM OVERVIEW (PREMIUM LANDING PAGE) */}
        {activeTab === 'overview' && (
          <div className="flex flex-col gap-8 w-full animate-fade-in-up font-mono">
            {/* ROW 1: Interactive map with float control */}
            <div className="h-[55vh] min-h-[450px] w-full relative border border-[#1f1f1f] rounded-lg overflow-hidden shadow-2xl shrink-0">
              <MapCanvas />

              {/* Floating Scenario Trigger overlay on map */}
              <div className="absolute top-4 right-4 z-10 flex flex-col items-end select-none">
                <button
                  onClick={() => setIsScenarioDropdownOpen(!isScenarioDropdownOpen)}
                  className="px-4 py-2.5 bg-emerald-500/90 hover:bg-emerald-500 text-black border border-emerald-400 rounded-md text-[10px] font-extrabold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse"
                >
                  <Play className="w-3.5 h-3.5 fill-black text-black" />
                  RUN SCENARIOS
                </button>

                {isScenarioDropdownOpen && (
                  <div className="mt-2 bg-[#0a0a0a]/95 backdrop-blur border border-[#1f1f1f] rounded shadow-2xl p-2.5 w-52 flex flex-col gap-2 animate-fade-in-down font-mono z-50">
                    <button
                      onClick={() => {
                        triggerPipelineRun('/pipeline/run');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                      📡 RUN LIVE SCENARIO
                    </button>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-a-v2');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2 bg-[#111] hover:bg-[#222] text-gray-300 border border-[#333] rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                      🌊 SCRIPTED SCENARIO A
                    </button>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-b');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2 bg-[#111] hover:bg-[#222] text-gray-300 border border-[#333] rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                      ⚠️ SCRIPTED SCENARIO B
                    </button>
                    <button
                      onClick={() => {
                        triggerPipelineRun('/demo/scenario-c');
                        setIsScenarioDropdownOpen(false);
                      }}
                      disabled={isLoading}
                      className="w-full text-left px-3 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                    >
                      💥 SCRIPTED SCENARIO C
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ROW 2: Brand Hero Symbol & Motto Banner */}
            <div className="bg-gradient-to-br from-[#0c0c0c] to-[#040404] border border-[#1f1f1f] rounded-lg p-8 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
              <div className="relative mb-4 flex items-center justify-center">
                <div className="absolute w-16 h-16 bg-emerald-500/10 rounded-full animate-ping"></div>
                <div className="w-12 h-12 rounded-full bg-[#0e1f18] border border-emerald-500/35 flex items-center justify-center shadow-inner">
                  <Activity className="w-6 h-6 text-emerald-400 animate-pulse" />
                </div>
              </div>

              <h2 className="text-2xl font-black tracking-widest text-white uppercase font-mono">AMAAN CIRO</h2>
              <p className="text-xs font-extrabold text-emerald-400 uppercase tracking-widest mt-1">Crisis Intelligence & Response Orchestrator</p>
              <div className="w-20 h-[1px] bg-emerald-800/60 my-4"></div>
              <span className="text-sm text-gray-300 leading-relaxed max-w-[650px] font-medium">
                "Empowering emergency services, predicting cascading risks, and safeguarding lives autonomously."
              </span>
            </div>

            {/* ROW 3: Satellite Broadcast News Live Feed */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1.5 h-4.5 bg-red-500 rounded-sm"></span>
                <h3 className="text-xs uppercase font-bold text-gray-200 tracking-wider">📺 Satellite Broadcast News Live Feed</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                <div className="col-span-1 min-h-[300px]">
                  <NewsIframe index={0} title="GEO NEWS LIVE SATELLITE FEED" />
                </div>
                <div className="col-span-1 min-h-[300px]">
                  <NewsIframe index={1} title="ARY NEWS LIVE SATELLITE FEED" />
                </div>
                <div className="col-span-1 min-h-[300px]">
                  <StreamDockPanel />
                </div>
              </div>
            </div>

            {/* ROW 4: Run System Scenarios Controls */}
            <div className="space-y-4 bg-[#070707] border border-[#1f1f1f] rounded-lg p-8 shadow-xl w-full">
              <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-2 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-4 bg-emerald-500 rounded-sm"></span>
                  <h3 className="text-xs uppercase font-bold text-gray-200 tracking-wider">Run System Scenarios</h3>
                </div>
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded animate-pulse">Ready</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Option 1: Live Ingestion */}
                <div className="bg-[#030303] border border-[#1f1f1f] hover:border-emerald-500/30 rounded p-4 flex justify-between items-center transition-all shadow-md">
                  <div className="space-y-1 max-w-[75%]">
                    <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider font-bold">📡 Run Live Scenario</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">Fetch real-time meteorological rainfall indexes, traffic sensors, and GDELT alerts.</p>
                  </div>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/pipeline/run');
                      setActiveTab('map');
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    TRIGGER
                  </button>
                </div>

                {/* Option 2: Scenario A (Flood) */}
                <div className="bg-[#030303] border border-[#1f1f1f] hover:border-blue-500/30 rounded p-4 flex justify-between items-center transition-all shadow-md">
                  <div className="space-y-1 max-w-[75%]">
                    <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider font-bold">🌊 Scripted Scenario A</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">Islamabad flooding response: deploys 4 rescue teams and manages a concurrent heat emergency.</p>
                  </div>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/demo/scenario-a-v2');
                      setActiveTab('map');
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-950/20 hover:bg-blue-950/40 text-blue-400 border border-blue-500/30 rounded text-[10px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    TRIGGER
                  </button>
                </div>

                {/* Option 3: Scenario B (False Alarm) */}
                <div className="bg-[#030303] border border-[#1f1f1f] hover:border-amber-500/30 rounded p-4 flex justify-between items-center transition-all shadow-md">
                  <div className="space-y-1 max-w-[75%]">
                    <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider font-bold">⚠️ Scripted Scenario B</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">Low-confidence flood ping: verifies utility water main burst and automatically retracts incident logs.</p>
                  </div>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/demo/scenario-b');
                      setActiveTab('map');
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-amber-950/20 hover:bg-[#ffaa0033] text-amber-400 border border-amber-500/30 rounded text-[10px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    TRIGGER
                  </button>
                </div>

                {/* Option 4: Scenario C (Dual Crisis) */}
                <div className="bg-[#030303] border border-[#1f1f1f] hover:border-red-500/30 rounded p-4 flex justify-between items-center transition-all shadow-md font-mono">
                  <div className="space-y-1 max-w-[75%]">
                    <h4 className="text-xs font-black text-red-400 uppercase tracking-wider font-bold">💥 Scripted Scenario C</h4>
                    <p className="text-[10px] text-gray-400 leading-normal">Simultaneous G-10 flood and I-8 heatwave: triggers resource trade-offs and dynamic fleet allocations.</p>
                  </div>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/demo/scenario-c');
                      setActiveTab('map');
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/30 rounded text-[10px] font-extrabold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    TRIGGER
                  </button>
                </div>

              </div>
            </div>

            {/* ROW 5: Tactical Fleet Inventory Panel */}
            <div className="bg-[#070707] border border-[#1f1f1f] rounded-lg p-8 shadow-xl font-mono w-full relative overflow-hidden">
              <div className="absolute top-6 right-8 flex items-center justify-center">
                <div className="absolute w-12 h-12 bg-emerald-500/10 rounded-full animate-ping"></div>
                <div className="w-10 h-10 rounded-full bg-[#0e1f18] border border-emerald-500/35 flex items-center justify-center shadow-inner">
                  <Activity className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-[#1f1f1f] pb-2 flex justify-between pr-16">
                <span>Tactical Fleet Inventory Panel</span>
                <span className="text-emerald-500 text-[10px] font-extrabold uppercase animate-pulse">Active</span>
              </h3>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center text-sm">
                <div className="bg-[#030303] border border-[#1f1f1f] p-4 rounded">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">AMBULANCES</span>
                  <strong className="text-white text-lg mt-1 block">8 / 12 AVAIL</strong>
                </div>
                <div className="bg-[#030303] border border-[#1f1f1f] p-4 rounded">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">RESCUE BOATS</span>
                  <strong className="text-white text-lg mt-1 block">4 / 6 AVAIL</strong>
                </div>
                <div className="bg-[#030303] border border-[#1f1f1f] p-4 rounded">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">RESCUE TEAMS</span>
                  <strong className="text-white text-lg mt-1 block">6 / 8 AVAIL</strong>
                </div>
                <div className="bg-[#030303] border border-[#1f1f1f] p-4 rounded">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">TRAFFIC POLICE</span>
                  <strong className="text-white text-lg mt-1 block">7 / 10 AVAIL</strong>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 mt-4 text-center">
                *Assets dynamically routed on scenario initialization via live coordinate logic
              </div>
            </div>

            {/* ROW 5.5: Stakeholder Logs Panel (5 Panels in one row) */}
            <div className="space-y-4 w-full">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1.5 h-3 bg-amber-500 rounded-sm"></span>
                <h3 className="text-xs uppercase font-bold text-gray-200 tracking-wider">🚨 Stakeholder Logs Panel</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <AlertsPanel audience="ndma" />
                <AlertsPanel audience="emergency_services" />
                <AlertsPanel audience="hospitals" />
                <AlertsPanel audience="public" />
                <AlertsPanel audience="media" />
              </div>
            </div>

            {/* ROW 5.6: Response Operations & Telemetry Deck + Simulation Impact (Two Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-blue-500 rounded-sm"></span>
                  <h4 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">Response Operations & Telemetry Deck</h4>
                </div>
                <ResourcePanel />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
                  <h4 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">Simulation Impact</h4>
                </div>
                <SimulationPanel />
              </div>
            </div>

            {/* ROW 6: Why Amaan Crisis Intelligence */}
            <div className="bg-[#070707] border border-[#1a1a1a]/85 rounded-lg p-8 shadow-xl font-mono relative w-full overflow-hidden">
              <div className="absolute top-6 right-8 flex items-center justify-center">
                <div className="absolute w-12 h-12 bg-emerald-500/10 rounded-full animate-ping"></div>
                <div className="w-10 h-10 rounded-full bg-[#0e1f18] border border-emerald-500/35 flex items-center justify-center shadow-inner">
                  <Activity className="w-5.5 h-5.5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-[#1f1f1f] pb-2 pr-16">Why Amaan Crisis Intelligence?</h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">
                Pakistan loses hundreds of innocent lives and billions in vital infrastructure annually to preventable crisis mismanagement. The devastating <strong>Karachi & Islamabad Monsoon Floods</strong> took massive tolls not because the storms were unpredictable, but because legacy operations rooms were <strong>blind, disjointed, and slow</strong>.
              </p>
              <p className="text-sm text-gray-300 leading-relaxed">
                <strong>Amaan CIRO</strong> breaks this cycle by acting as Pakistan's first unified crisis detection engine. It merges weather sensors, traffic flows, and citizen reports, optimizing emergency resources dynamically to save lives when every second counts.
              </p>
            </div>

            {/* ROW 7: System Core Blueprint (2x2 Grid Layout) */}
            <div className="space-y-4 w-full">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1.5 h-4.5 bg-purple-500 rounded-sm"></span>
                <h2 className="text-xs uppercase font-bold text-gray-300 tracking-widest font-mono">System Core Blueprint</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                <div className="scale-100 origin-top">
                  <ArchEnginePanel />
                </div>
                <div className="scale-100 origin-top">
                  <ArchMapPanel />
                </div>
                <div className="scale-100 origin-top">
                  <ArchChatPanel />
                </div>
                <div className="scale-100 origin-top">
                  <ArchLayoutPanel />
                </div>
              </div>
            </div>

            {/* DESKTOP OVERVIEW FOOTER */}
            <div className="border-t border-[#1f1f1f] pt-8 pb-4 text-center text-xs text-gray-500 font-mono tracking-wider w-full select-none shrink-0 mt-8">
              <p className="uppercase">AMAAN CIRO • Crisis Intelligence & Response Orchestrator</p>
              <p className="text-gray-600 mt-1">© {new Date().getFullYear()} Amaan emergency systems. Safeguarding lives autonomously.</p>
            </div>

          </div>
        )}

        {/* TAB 2: INTERACTIVE OPERATIONS MAP VIEW */}
        {activeTab === 'map' && (
          <div className="h-[72vh] min-h-[520px] w-full relative border border-[#1f1f1f] rounded-lg overflow-hidden shadow-2xl animate-fade-in-up shrink-0">
            <MapCanvas />

            {/* Floating Scenario Trigger overlay */}
            <div className="absolute top-4 right-4 z-10 flex flex-col items-end select-none">
              <button
                onClick={() => setIsScenarioDropdownOpen(!isScenarioDropdownOpen)}
                className="px-4 py-2.5 bg-emerald-500/90 hover:bg-emerald-500 text-black border border-emerald-400 rounded-md text-[10px] font-extrabold tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse"
              >
                <Play className="w-3.5 h-3.5 fill-black text-black" />
                RUN SCENARIOS
              </button>

              {isScenarioDropdownOpen && (
                <div className="mt-2 bg-[#0a0a0a]/95 backdrop-blur border border-[#1f1f1f] rounded shadow-2xl p-2.5 w-52 flex flex-col gap-2 animate-fade-in-down font-mono z-50">
                  <button
                    onClick={() => {
                      triggerPipelineRun('/pipeline/run');
                      setIsScenarioDropdownOpen(false);
                    }}
                    disabled={isLoading}
                    className="w-full text-left px-3 py-2 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                  >
                    📡 RUN LIVE SCENARIO
                  </button>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/demo/scenario-a-v2');
                      setIsScenarioDropdownOpen(false);
                    }}
                    disabled={isLoading}
                    className="w-full text-left px-3 py-2 bg-[#111] hover:bg-[#222] text-gray-300 border border-[#333] rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                  >
                    🌊 SCRIPTED SCENARIO A
                  </button>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/demo/scenario-b');
                      setIsScenarioDropdownOpen(false);
                    }}
                    disabled={isLoading}
                    className="w-full text-left px-3 py-2 bg-[#111] hover:bg-[#222] text-gray-300 border border-[#333] rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                  >
                    ⚠️ SCRIPTED SCENARIO B
                  </button>
                  <button
                    onClick={() => {
                      triggerPipelineRun('/demo/scenario-c');
                      setIsScenarioDropdownOpen(false);
                    }}
                    disabled={isLoading}
                    className="w-full text-left px-3 py-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 rounded text-[9px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50"
                  >
                    💥 SCRIPTED SCENARIO C
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: BROADCAST & NEWS LIVE DECK */}
        {activeTab === 'broadcasts' && (
          <div className="flex flex-col gap-3 animate-fade-in-up">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-3 bg-red-500 rounded-sm"></span>
              <h2 className="text-xs uppercase font-bold text-gray-300 tracking-widest font-mono">Satellite News & Broadcast Linkage Deck</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {newsFeeds[0] && (
                <div className="col-span-1 min-h-[300px]">
                  <NewsIframe index={0} title="GEO NEWS LIVE SATELLITE FEED" />
                </div>
              )}

              {newsFeeds[1] && (
                <div className="col-span-1 min-h-[300px]">
                  <NewsIframe index={1} title="ARY NEWS LIVE SATELLITE FEED" />
                </div>
              )}

              {newsFeeds.slice(2).map((_, idx) => (
                <div key={idx} className="col-span-1 min-h-[300px]">
                  <NewsIframe index={idx + 2} title={`CUSTOM BROADCAST VECTOR LINK #${idx + 1}`} />
                </div>
              ))}

              <div className="col-span-1 min-h-[300px]">
                <StreamDockPanel />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STAKEHOLDER EMERGENCY MONITORS */}
        {activeTab === 'alerts' && (
          <div className="flex flex-col gap-3 animate-fade-in-up">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-3 bg-amber-500 rounded-sm"></span>
              <h2 className="text-xs uppercase font-bold text-gray-300 tracking-widest font-mono">Dedicated Stakeholder Communication Centers</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <AlertsPanel audience="ndma" />
              <AlertsPanel audience="emergency_services" />
              <AlertsPanel audience="hospitals" />
              <AlertsPanel audience="public" />
              <AlertsPanel audience="media" />
            </div>
          </div>
        )}

        {/* TAB 5: LOGISTICS, DISPATCH & RESPONSE WORKSPACE */}
        {activeTab === 'operations' && (
          <div className="flex flex-col gap-3 animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-blue-500 rounded-sm"></span>
                  <h4 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">Response Operations & Telemetry Deck</h4>
                </div>
                <ResourcePanel />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="w-1.5 h-3 bg-emerald-500 rounded-sm"></span>
                  <h4 className="text-[10px] uppercase font-bold text-gray-300 tracking-widest font-mono">Simulation Impact</h4>
                </div>
                <SimulationPanel />
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: SETTINGS & SYSTEM LINKAGE */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-8 w-full animate-fade-in-up font-mono">

            {/* Why Amaan */}
            <div className="bg-[#070707] border border-[#1f1f1f] rounded p-6 shadow-xl w-full">
              <div className="flex items-center gap-2 border-b border-[#1a1a1a] pb-2.5 mb-4">
                <Award className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400">Why Amaan Crisis Intelligence?</h3>
              </div>

              <div className="space-y-4 text-gray-300 text-xs leading-relaxed">
                <p>
                  Pakistan loses billions of rupees and hundreds of lives annually to preventable crisis mismanagement.
                  The historical <strong>Karachi & Islamabad Monsoon Floods</strong> resulted in massive casualties and structural damages —
                  not because the storms were unpredicted, but because response teams were completely
                  <em> blind, reactive, and slow</em>.
                </p>

                <p>
                  Emergency services received information from disjointed, conflicting channels. Operations operators
                  had no intelligent central core to tell them where to deploy, which reports to trust,
                  and how to coordinate limited resources between multiple concurrent emergencies.
                </p>

                <div className="border-l-2 border-amber-500 pl-3.5 py-1.5 text-gray-400 italic text-[11px] bg-amber-950/5">
                  "Amaan isn't just a basic status dashboard that reports past catastrophes. Amaan is an autonomous
                  intelligence engine that decides optimal response vectors, predicted durations, and dispatch plans —
                  resolving conflicting field pings in seconds."
                </div>
              </div>
            </div>

            {/* Core Server Linkage Form */}
            <div className="bg-[#070707] border border-[#1f1f1f] rounded p-6 shadow-xl w-full">
              <div className="flex items-center gap-2 border-b border-[#1a1a1a] pb-2.5 mb-4">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-200">Amaan Core Server Linkage</h3>
              </div>

              <p className="text-xs text-gray-400 leading-normal mb-4">
                Amaan is fully open-source and architected for modular experimentation. If you are running the backend locally (or on a custom server instance) without Google Cloud Run access, simply input your custom API base address (e.g. <code className="text-emerald-400">http://127.0.0.1:8000/api</code> or local Wi-Fi IP <code className="text-emerald-400">http://192.168.1.100:8000/api</code>) and save. **The entire system dynamically redirects all network telemetry in real-time without requiring you to read/edit the source code or rebuild the application bundle.**
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Server API Base Address</label>
                  <input
                    type="text"
                    value={serverUrlInput}
                    onChange={(e) => setServerUrlInput(e.target.value)}
                    placeholder="e.g. http://192.168.1.100:8080/api"
                    className="w-full bg-[#030303] border border-[#2c2c2c] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-gray-500">
                  <span>ACTIVE LINK: {getActiveServer()}</span>
                </div>

                <button
                  onClick={saveServerUrl}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black border border-emerald-400 font-extrabold uppercase text-[10px] tracking-widest rounded transition-all cursor-pointer active:scale-95"
                >
                  ESTABLISH LINKAGE & SAVE
                </button>

                {isUrlSaved && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold justify-center bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded animate-pulse">
                    <CheckCircle className="w-4.5 h-4.5" />
                    <span>URL INSTANTLY BINDED IN CLIENT INTERCEPTOR</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {activeTab !== 'settings' && <ChatOverlay />}
    </div>
  )
}

export default App
