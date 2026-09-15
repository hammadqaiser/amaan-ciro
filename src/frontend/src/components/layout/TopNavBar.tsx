import { Activity, Play, AlertTriangle, Eye } from 'lucide-react'
import { useCiroStore } from '../../store/useCiroStore'

export default function TopNavBar() {
  const { triggerPipelineRun, isLoading } = useCiroStore()

  return (
    <div className="h-12 bg-[#0a0a0a] border-b border-[#1f1f1f] flex items-center justify-between px-5 z-50 shrink-0 relative">
      <div className="flex items-center gap-5">
        {/* Amaan Branding */}
        <div className="flex items-center justify-center bg-transparent border border-[#333] p-1.5 rounded-sm">
          <Activity className="text-emerald-400 w-5 h-5" />
        </div>
        <h1 className="font-bold tracking-widest text-gray-200 text-sm uppercase">
          Amaan <span className="text-gray-500 font-normal ml-1 hidden sm:inline">CIRO</span>
        </h1>

        {/* Separator */}
        <span className="text-gray-700 hidden sm:inline">|</span>

        {/* Version Badge */}
        <span className="text-[10px] text-gray-500 font-bold tracking-wider hidden sm:inline">
          v1.0.0
        </span>

        {/* Separator */}
        <span className="text-gray-800 hidden sm:inline">•</span>

        {/* Viewers */}
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <Eye className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[10px] text-gray-400 font-bold">1.2k</span>
        </div>

        {/* Separator */}
        <span className="text-gray-800 hidden sm:inline">•</span>

        {/* LIVE Indicator — GREEN */}
        <div className="flex items-center gap-1.5 select-none">
          <div className="relative flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_6px_rgba(16,185,129,0.8)]"></div>
            <div className="absolute w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
          </div>
          <span className="text-[10px] text-gray-400 font-normal tracking-wider">Live</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Scenario Triggers */}
        <div className="flex gap-1.5 pr-2">
          <button
            onClick={() => triggerPipelineRun('/pipeline/run')}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            title="Run with Live Geo-Signals"
          >
            <Play className="w-3 h-3" />
            <span className="hidden sm:inline">LIVE SCENARIO</span>
            <span className="sm:hidden">LIVE</span>
          </button>

          <button
            onClick={() => triggerPipelineRun('/demo/scenario-a-v2')}
            disabled={isLoading}
            className="px-2.5 py-1.5 bg-[#111] hover:bg-[#222] text-gray-400 border border-[#333] rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            title="Trigger Flood Scenario"
          >
            SCRIPTED SCENARIO A
          </button>

          <button
            onClick={() => triggerPipelineRun('/demo/scenario-b')}
            disabled={isLoading}
            className="px-2.5 py-1.5 bg-[#111] hover:bg-[#222] text-gray-400 border border-[#333] rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            title="Trigger False Alarm Scenario"
          >
            SCRIPTED SCENARIO B
          </button>

          <button
            onClick={() => triggerPipelineRun('/demo/scenario-c')}
            disabled={isLoading}
            className="px-2.5 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded text-[10px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
            title="Trigger Dual Crisis Scenario"
          >
            <AlertTriangle className="w-3 h-3 inline mr-1" />
            SCRIPTED SCENARIO C
          </button>
        </div>
      </div>
    </div>
  )
}
