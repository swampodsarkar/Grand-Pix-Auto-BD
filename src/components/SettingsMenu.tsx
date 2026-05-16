import React from "react";
import { useGameStore } from "../store/useGameStore";
import { X, Settings, Monitor, Volume2, Move, Gauge } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function SettingsMenu() {
  const { showSettings, setShowSettings, graphicsQuality, setGraphicsQuality } = useGameStore();

  if (!showSettings) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[300] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 md:p-6 landscape:p-3"
    >
      <div className="relative w-full max-w-full md:max-w-2xl max-h-[92vh] landscape:max-h-[88vh] bg-slate-900 rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="bg-slate-800/50 px-4 py-4 md:px-6 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl">
                <Settings className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">Game Settings</h2>
                <span className="text-[9px] font-black text-blue-500/80 uppercase tracking-widest">Village Simulator Mobile v1.0</span>
              </div>
           </div>
           <button 
             onClick={() => setShowSettings(false)}
             className="p-2 bg-slate-700 hover:bg-red-500 text-white rounded-xl transition-colors outline-none"
           >
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-5 md:gap-7 scrollbar-hide">
          
          {/* Graphics Quality */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-400 uppercase tracking-widest text-[10px] font-black">
              <Monitor className="w-3 h-3" /> Graphics Quality
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["low", "medium", "high"].map((q) => (
                <button
                  key={q}
                  onClick={() => setGraphicsQuality(q as any)}
                  className={`py-3 rounded-2xl font-black uppercase text-xs transition-all border-2 ${
                    graphicsQuality === q 
                    ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/20" 
                    : "bg-slate-800 border-white/5 text-slate-500 hover:border-white/10"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          {/* Controls Settings (Simulation) */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-400 uppercase tracking-widest text-[10px] font-black">
              <Move className="w-3 h-3" /> Joystick Sensitivity
            </div>
            <input 
              type="range" 
              className="w-full accent-blue-500 bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer"
              defaultValue={50}
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
              <span>Standard</span>
              <span>Fast</span>
            </div>
          </section>

          {/* Sound Settings */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-400 uppercase tracking-widest text-[10px] font-black">
              <Volume2 className="w-3 h-3" /> Master Volume
            </div>
            <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 space-y-4">
               {["Music", "SFX", "Voice"].map(s => (
                 <div key={s} className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-slate-300 uppercase w-12">{s}</span>
                    <input 
                      type="range" 
                      className="flex-1 accent-indigo-500 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700" 
                      defaultValue={80}
                    />
                 </div>
               ))}
            </div>
          </section>

          {/* Performance Info */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-slate-400 uppercase tracking-widest text-[10px] font-black">
              <Gauge className="w-3 h-3" /> Optimization
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
               <p className="text-[9px] text-blue-300 font-bold leading-relaxed">
                 Village Simulator is optimized for mobile performance. Low graphics setting disables shadows and reduces render distance for entry-level devices.
               </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="bg-slate-800/80 p-5 border-t border-slate-700">
           <button 
             onClick={() => setShowSettings(false)}
             className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-sm shadow-xl active:scale-95 transition-all"
           >
             Save Changes
           </button>
        </div>
      </div>
    </motion.div>
  );
}
