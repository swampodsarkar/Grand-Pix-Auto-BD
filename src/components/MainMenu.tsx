import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Play, User, Settings as SettingsIcon, ShoppingBag, LogOut, ChevronRight, X, Monitor, Cpu, Zap } from "lucide-react";
import { useGameStore } from "../store/useGameStore";

export function MainMenu() {
  const { setCurrentScreen, logout, playerName, graphicsQuality, setGraphicsQuality } = useGameStore();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const menuItems = [
    { label: "Start Journey", icon: Play, screen: "lobby" as const },
    { label: "Settings", icon: SettingsIcon, screen: null, action: () => setShowSettings(true) },
    { label: "Exit", icon: LogOut, screen: "login" as const },
  ];

  const handleAction = (item: any) => {
    if (item.action) {
        item.action();
        return;
    }
    if (item.label === "Exit") {
        logout();
        setCurrentScreen("login");
        return;
    }
    if (item.screen) {
       setCurrentScreen(item.screen);
    }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex items-center select-none font-sans">
      {/* Cinematic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center brightness-[0.4] scale-110"
          style={{ 
            backgroundImage: "url('https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop')",
            filter: "sepia(20%) saturate(1.1)"
          }} 
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20 z-10" />
        
        {/* Subtle Animated Particles/Rain overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none mix-blend-screen overflow-hidden">
             {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ 
                        y: "110vh", 
                        opacity: [0, 1, 1, 0] 
                    }}
                    transition={{ 
                        duration: 1 + Math.random() * 2, 
                        repeat: Infinity, 
                        delay: Math.random() * 2,
                        ease: "linear"
                    }}
                    className="absolute w-[1px] h-20 bg-blue-400/50"
                    style={{ left: `${Math.random() * 100}%` }}
                />
             ))}
        </div>
      </div>

      {/* Content Layer */}
      <div className="relative z-20 w-full h-full flex flex-col md:flex-row items-center justify-between px-6 md:px-20 py-8 md:py-12">
        {/* Left Side: Title & Branding */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center md:items-start text-center md:text-left mb-8 md:mb-0"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-[2px] bg-lime-500 shadow-[0_0_10px_#84cc16]" />
            <span className="text-lime-400 font-black tracking-[0.4em] text-[10px] uppercase">Homestead Chronicles</span>
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-white tracking-widest italic leading-none mb-2">
            VILLAGE LIFE
          </h1>
          <h2 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-emerald-500 to-green-600 drop-shadow-2xl italic tracking-tighter">
            SIMULATOR 2D
          </h2>
          <div className="h-1 w-24 bg-gradient-to-r from-lime-500 to-transparent mt-2" />
        </motion.div>

        {/* Right Side: Navigation Menu (More Compact & Mobile Game Style) */}
        <div className="flex flex-col gap-3 w-full max-w-[280px] md:w-72">
          {menuItems.map((item, idx) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1, duration: 0.5 }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => handleAction(item)}
              className="group relative flex items-center justify-between py-4 px-6 transition-all duration-300 outline-none overflow-hidden rounded-2xl md:rounded-none"
            >
              {/* Glass Background */}
              <div className={`absolute inset-0 bg-slate-900/60 md:bg-white/[0.03] backdrop-blur-xl border border-white/5 md:border-none md:border-l-[6px] md:border-white/5 transition-all duration-300 ${hoveredIndex === idx ? 'bg-blue-600/20 md:bg-white/[0.1] border-blue-500 md:border-lime-500 md:translate-x-2' : ''}`} />
              
              {/* Icon & Label */}
              <div className="flex items-center gap-4 relative z-10 w-full justify-center md:justify-start">
                <item.icon className={`w-5 h-5 transition-all duration-300 ${hoveredIndex === idx ? 'text-blue-400 md:text-lime-400 scale-110' : 'text-slate-500'}`} />
                <span className={`text-sm md:text-lg font-black tracking-widest transition-all duration-300 uppercase ${hoveredIndex === idx ? 'text-white italic' : 'text-slate-400'}`}>
                  {item.label}
                </span>
              </div>
 
              {/* Arrow Indicator (Desktop only/small indicator on mobile) */}
              <div className="relative z-10 hidden md:block">
                <ChevronRight className={`w-5 h-5 transition-all duration-500 ${hoveredIndex === idx ? 'text-lime-400 translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`} />
              </div>
            </motion.button>
          ))}

          {/* Social/Stats Mini Bar */}
          <div className="mt-4 flex gap-2 w-full">
             <div className="flex-1 bg-white/[0.03] backdrop-blur py-2 px-4 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Players</span>
                <span className="text-[10px] font-black text-emerald-500">2.4k+</span>
             </div>
             <div className="flex-1 bg-white/[0.03] backdrop-blur py-2 px-4 rounded-xl border border-white/5 flex flex-col items-center justify-center">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Version</span>
                <span className="text-[10px] font-black text-blue-500">1.4.0</span>
             </div>
          </div>
        </div>

        {/* Footer Info (More compact for mobile) */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-6 left-0 right-0 px-6 flex flex-col md:flex-row items-center justify-between text-slate-600 font-bold text-[8px] md:text-[10px] uppercase tracking-widest pointer-events-none"
        >
          <div className="flex items-center gap-4 md:gap-8 mb-2 md:mb-0">
             <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Servers Optimized</span>
             </div>
             <div className="hidden md:block w-[1px] h-3 bg-slate-800" />
             <div className="flex flex-col">
                <span className="text-[6px] md:text-[8px] text-slate-700">Region</span>
                <span className="text-slate-500">Asia Southeast</span>
             </div>
          </div>
          <div className="text-slate-800 md:text-slate-700">
            &copy; 2026 ANTIGRAVITY STUDIOS
          </div>
        </motion.div>
      </div>

      {/* Decorative Accents */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-12 right-12 w-48 h-48 border-[1px] border-white/5 rounded-full flex items-center justify-center opacity-40">
           <div className="w-40 h-40 border-[1px] border-white/5 rounded-full animate-pulse" />
      </div>

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/20 rounded-2xl">
                    <SettingsIcon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Game Settings</h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8">
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Monitor className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Graphics Quality</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "low", label: "Low", icon: Zap, desc: "Max Performance" },
                      { id: "medium", label: "Medium", icon: Cpu, desc: "Balanced" },
                      { id: "high", label: "High", icon: Monitor, desc: "Max Quality" }
                    ].map((q) => (
                      <button
                        key={q.id}
                        onClick={() => setGraphicsQuality(q.id as any)}
                        className={`group relative p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden ${
                          graphicsQuality === q.id 
                            ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)]" 
                            : "bg-white/[0.02] border-white/5 hover:border-white/20"
                        }`}
                      >
                        <q.icon className={`w-5 h-5 mb-2 transition-colors ${graphicsQuality === q.id ? "text-cyan-400" : "text-slate-500Group-hover:text-slate-300"}`} />
                        <div className={`font-black uppercase tracking-wider text-sm mb-1 ${graphicsQuality === q.id ? "text-white" : "text-slate-400"}`}>
                          {q.label}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500">{q.desc}</div>
                        
                        {graphicsQuality === q.id && (
                          <motion.div layoutId="setting-active" className="absolute top-2 right-2 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl">
                   <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic">
                     * Lowering graphics settings disables high-resolution shadows, dynamic particles, and reduces rendering distance for better performance on older hardware.
                   </p>
                </div>
              </div>

              <div className="p-8 bg-white/[0.02] border-t border-white/5">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white font-black uppercase tracking-widest transition-all"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
