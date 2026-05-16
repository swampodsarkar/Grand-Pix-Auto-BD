import React, { useState } from "react";
import { motion } from "motion/react";
import { useGameStore } from "../store/useGameStore";
import { ChevronRight, ChevronLeft, UserCircle2 } from "lucide-react";
import { rtdb } from "../firebase";
import { ref, update } from "firebase/database";

export function CharacterSelect() {
  const { setCharacterType, setCurrentScreen, playerName } = useGameStore();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const characters = [
    { 
      id: "farmer", 
      name: "Novice Farmer", 
      desc: "Fresh to the village, eager to grow the finest crops.", 
      color: "from-lime-600 to-emerald-500",
      stats: { speed: 50, luck: 70, stamina: 80 }
    },
    { 
      id: "ranger", 
      name: "Village Ranger", 
      desc: "Protector of the trails and expert in the local wilderness.", 
      color: "from-amber-700 to-orange-800",
      stats: { speed: 70, luck: 40, stamina: 90 }
    },
    { 
      id: "merchant", 
      name: "Curious Merchant", 
      desc: "A trader with an eye for value and a penchant for tradition.", 
      color: "from-blue-700 to-indigo-900",
      stats: { speed: 40, luck: 90, stamina: 50 }
    },
  ];

  const handleConfirm = async () => {
    const charId = characters[selectedIdx].id;
    if (playerName) {
      const userRef = ref(rtdb, `users/${playerName}`);
      await update(userRef, { characterType: charId });
    }
    setCharacterType(charId);
    setCurrentScreen("menu");
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex flex-col items-center justify-center font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
        <div className={`absolute inset-0 bg-gradient-to-br ${characters[selectedIdx].color} opacity-10 transition-colors duration-1000`} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-slate-900 group" />
      </div>

      <div className="relative z-10 w-full max-w-5xl px-6 md:px-12 grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-12 items-center">
        {/* Left: Info & Selection (Spans 3 cols on large screens) */}
        <motion.div
           initial={{ opacity: 0, x: -50 }}
           animate={{ opacity: 1, x: 0 }}
           className="lg:col-span-3 flex flex-col gap-4 md:gap-6"
        >
          <div>
            <span className="text-lime-400 font-extrabold tracking-[0.4em] uppercase text-[10px] mb-1 block">Identity Module</span>
            <h1 className="text-3xl md:text-5xl font-black text-white italic tracking-tighter leading-tight">CHOOSE YOUR <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-emerald-600 uppercase">Legacy</span></h1>
          </div>

          <div className="space-y-2 md:space-y-3">
             {characters.map((char, idx) => (
                <button
                    key={char.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={`w-full flex items-center justify-between p-4 md:p-5 rounded-xl border-2 transition-all duration-300 outline-none ${selectedIdx === idx ? 'bg-white/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-transparent border-white/5 hover:bg-white/5'}`}
                >
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className={`text-base md:text-lg font-black tracking-tight leading-none mb-1 ${selectedIdx === idx ? 'text-white' : 'text-slate-500'}`}>{char.name}</span>
                        <span className="text-[10px] md:text-xs text-slate-400 font-medium truncate w-full text-left">{char.desc}</span>
                    </div>
                    {selectedIdx === idx && <ChevronRight className="w-5 h-5 text-cyan-400 flex-shrink-0" />}
                </button>
             ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirm}
            className="mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black py-4 rounded-xl shadow-2xl flex items-center justify-center gap-2 text-xs tracking-widest uppercase italic"
          >
            Enter Village <ChevronRight className="w-4 h-4" />
          </motion.button>
        </motion.div>

        {/* Right: Preview Visual (Spans 2 cols on large screens) */}
        <div className="hidden lg:flex lg:col-span-2 flex-col items-center justify-center relative">
            <motion.div 
                key={selectedIdx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full aspect-square bg-slate-900/50 backdrop-blur-3xl rounded-[40px] border border-white/10 flex items-center justify-center overflow-hidden"
            >
                <div className={`absolute inset-0 bg-gradient-to-tr ${characters[selectedIdx].color} opacity-20`} />
                <UserCircle2 className={`w-48 h-48 transition-all duration-500 ${selectedIdx === 0 ? 'text-cyan-400' : selectedIdx === 1 ? 'text-red-500' : 'text-slate-200'}`} strokeWidth={0.5} />
                
                {/* Stats Overlay (Smaller) */}
                <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-3">
                    {Object.entries(characters[selectedIdx].stats).map(([key, val]) => (
                        <div key={key} className="space-y-1">
                            <div className="flex justify-between text-[8px] font-black uppercase text-slate-400 tracking-widest leading-none">
                                <span>{key}</span>
                                <span>{val}%</span>
                            </div>
                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${val}%` }}
                                    className={`h-full bg-gradient-to-r ${characters[selectedIdx].color}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
      </div>

      {/* Decorative Branding */}
      <div className="absolute bottom-12 right-12 text-white/5 font-black text-9xl pointer-events-none italic select-none">
        VILLAGE
      </div>
    </div>
  );
}
