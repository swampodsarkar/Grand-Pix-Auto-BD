import React from "react";
import { useGameStore } from "../store/useGameStore";
import { Tractor, Info, Timer, CheckCircle2, Droplets, Leaf } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function FarmingUI() {
  const { currentPlot, gameState, myId } = useGameStore();
  
  if (!currentPlot || !gameState || !myId) return null;
  const p = gameState.players[myId];
  if (!p) return null;

  const farmKey = `isPlanting_${currentPlot.id}`;
  const harvestKey = `harvestTime_${currentPlot.id}`;
  const isGrowing = p.inventory?.[farmKey];
  const harvestTime = p.inventory?.[harvestKey] || 0;
  const isReady = isGrowing && Date.now() >= harvestTime;
  
  const remaining = Math.max(0, Math.ceil((harvestTime - Date.now()) / 1000));
  const progress = isGrowing ? Math.min(100, (1 - remaining / 20) * 100) : 0;

  const handleAction = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
  };

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md pointer-events-auto"
    >
      <div className="bg-slate-900/90 backdrop-blur-xl border-t-2 border-lime-500/50 rounded-[2rem] p-5 shadow-2xl flex flex-col gap-4 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
           <motion.div 
             className="h-full bg-lime-500"
             initial={{ width: 0 }}
             animate={{ width: `${progress}%` }}
           />
        </div>

        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-3 bg-lime-500/20 rounded-2xl">
                 <Tractor className="w-6 h-6 text-lime-400" />
              </div>
              <div>
                 <h3 className="text-lg font-black text-white uppercase tracking-tighter italic leading-none">{currentPlot.name}</h3>
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Village Farm Unit #4</span>
              </div>
           </div>
           
           {isGrowing && !isReady && (
              <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
                 <Timer className="w-3 h-3 text-blue-400 animate-pulse" />
                 <span className="text-xs font-black text-blue-400">{remaining}s</span>
              </div>
           )}
           {isReady && (
              <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                 <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                 <span className="text-xs font-black text-emerald-400 uppercase">Ready</span>
              </div>
           )}
        </div>

        <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleAction}
              className={`flex flex-col items-center justify-center gap-2 py-4 rounded-[1.5rem] transition-all active:scale-95 border-2 ${
                !isGrowing 
                ? "bg-lime-600 border-lime-400 text-white shadow-lg shadow-lime-500/20" 
                : isReady 
                ? "bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20"
                : "bg-slate-800 border-white/5 text-slate-500"
              }`}
            >
              {isReady ? <Leaf className="w-6 h-6" /> : <Droplets className="w-6 h-6" />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isReady ? "Harvest" : isGrowing ? "Growing..." : "Plant Seeds"}
              </span>
            </button>

            {/* Watering Button */}
            {isGrowing && !isReady && (
              <button 
                onClick={() => {
                  // Watering reduces remaining time by 5 seconds
                  const newHarvest = harvestTime - 5000;
                  window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" })); // trigger update
                }}
                className="flex flex-col items-center justify-center gap-2 py-4 rounded-[1.5rem] bg-blue-600 border-blue-400 text-white active:scale-95 transition-all"
              >
                <Droplets className="w-6 h-6" />
                <span className="text-[10px] font-black uppercase">Water Crop</span>
              </button>
            )}

           <div className="bg-slate-800/40 border border-white/5 rounded-[1.5rem] p-4 flex flex-col justify-center">
              <div className="flex items-center justify-between mb-1">
                 <span className="text-[9px] font-black text-slate-500 uppercase">Yield Est.</span>
                 <span className="text-[10px] font-black text-lime-400">+10 Mon</span>
              </div>
              <div className="flex items-center justify-between">
                 <span className="text-[9px] font-black text-slate-500 uppercase">Value</span>
                 <span className="text-[10px] font-black text-blue-400">High</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold bg-black/20 p-2 rounded-xl italic">
           <Info className="w-3 h-3" /> Note: Ensure proper watering for maximum yield results.
        </div>
      </div>
    </motion.div>
  );
}
