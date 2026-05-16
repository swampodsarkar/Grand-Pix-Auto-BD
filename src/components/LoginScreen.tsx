import React, { useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { rtdb } from "../firebase";
import { ref, get, set } from "firebase/database";
import { motion } from "motion/react";
import { User, ChevronRight } from "lucide-react";

export function LoginScreen() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setPlayerName = useGameStore(s => s.setPlayerName);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 3) {
      setError("Name must be at least 3 characters.");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const userRef = ref(rtdb, `users/${cleanName}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        setError("Username already taken. Please choose another.");
        setLoading(false);
        return;
      }

      // Reserve the name with default starting stats
      await set(userRef, {
        username: cleanName,
        createdAt: Date.now(),
        lastActive: Date.now(),
        money: 1000,
        bank: 5000,
        characterType: null // Will be set in CharacterSelect
      });

      setPlayerName(cleanName);
      useGameStore.getState().setCurrentScreen("character");
    } catch (err) {
      setError("Connection error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex items-center justify-center p-6 sm:p-0">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-lime-500/30 blur-[100px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm relative"
      >
        <form 
          onSubmit={handleJoin} 
          className="bg-slate-900/60 backdrop-blur-2xl border border-white/5 p-8 md:p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-lime-400 via-emerald-500 to-green-600" />
          
          <div className="mb-8 text-center">
            <span className="text-lime-400 text-[8px] font-black tracking-[0.6em] uppercase block mb-1">Village OS 1.4</span>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
              IDENTITY <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-emerald-500">GATE</span>
            </h1>
          </div>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black py-3 px-4 rounded-xl mb-4 text-center uppercase tracking-wider"
            >
              {error}
            </motion.div>
          )}

          <div className="w-full mb-6">
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Resident Code</label>
              <User className="w-3 h-3 text-slate-700" />
            </div>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              placeholder="Enter Citizen Name..."
              className="w-full bg-black/40 border-2 border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-700 font-black tracking-tight"
              maxLength={12}
            />
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || name.trim().length < 3}
            className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-xs flex items-center justify-center gap-2"
          >
            {loading ? "Authenticating..." : "Establish Residency"}
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </form>

        <div className="mt-6 text-center">
           <p className="text-[8px] text-slate-700 font-black uppercase tracking-[0.2em]">Village Protocol &copy; 2026 Antigravity</p>
        </div>
      </motion.div>
    </div>
  );
}
