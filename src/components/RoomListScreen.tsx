import React, { useEffect, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { rtdb } from "../firebase";
import { ref, onValue, set, onDisconnect, get } from "firebase/database";
import { ChevronLeft, Globe, Signal, Users, ChevronRight } from "lucide-react";
import { motion } from "motion/react";

const ROOMS = [
  { id: "village_1", label: "Village Server 1", region: "South Asia" },
  { id: "village_2", label: "Village Server 2", region: "South Asia" },
  { id: "village_3", label: "Village Server 3", region: "Europe" },
  { id: "village_4", label: "Village Server 4", region: "North America" }
];
const MAX_PLAYERS = 10;

export function RoomListScreen() {
  const playerName = useGameStore(s => s.playerName);
  const setMyId = useGameStore(s => s.setMyId);
  const setRoomId = useGameStore(s => s.setRoomId);
  
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [hasVehicles, setHasVehicles] = useState<Record<string, boolean>>({});

  // Fetch all rooms data to count players
  useEffect(() => {
    const roomsRef = ref(rtdb, 'rooms');
    const unsub = onValue(roomsRef, (snap) => {
      const data = snap.val();
      const newCounts: Record<string, number> = {};
      const newHasVehicles: Record<string, boolean> = {};
      ROOMS.forEach(room => {
        const players = data?.[room.id]?.gameState?.players || {};
        newCounts[room.id] = Object.keys(players).length;
        newHasVehicles[room.id] = !!data?.[room.id]?.gameState?.vehicles;
      });
      setCounts(newCounts);
      setHasVehicles(newHasVehicles);
    });
    return () => unsub();
  }, []);

  const handleJoin = async (roomId: string) => {
    if ((counts[roomId] || 0) >= MAX_PLAYERS) return;

    // Fetch persistent user data
    let userData: any = {
      money: 5000,
      bank: 20000,
      characterType: null,
      inventory: { fish: 0 },
      ownedProperties: []
    };

    if (playerName) {
      const userRef = ref(rtdb, `users/${playerName}`);
      const snap = await get(userRef);
      if (snap.exists()) {
        const val = snap.val();
        userData = {
          money: val.money ?? 1000,
          bank: val.bank ?? 5000,
          characterType: val.characterType ?? null,
          inventory: val.inventory ?? { fish: 0 },
          ownedProperties: val.ownedProperties ?? []
        };
      }
    }

    const myId = "player_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    
    // Set initial player state
    const playerRef = ref(rtdb, `rooms/${roomId}/gameState/players/${myId}`);
    
    // Setup onDisconnect
    onDisconnect(playerRef).remove();

    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 300;

    await set(playerRef, {
      id: myId,
      name: playerName,
      x: 15000 + Math.cos(angle) * r,
      y: 15000 + Math.sin(angle) * r,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      money: userData.money,
      bank: userData.bank,
      wantedLevel: 0,
      health: 100,
      hunger: 100,
      stamina: 100,
      inVehicleId: null,
      facing: "down",
      speed: 0,
      inventory: userData.inventory,
      ownedProperties: userData.ownedProperties
    });

    if (!hasVehicles[roomId]) {
       // spawn some default village vehicles near the central town (15000, 15000)
       const defaultCars: Record<string, any> = {};
       const carSpawns = [
          { x: 14800, y: 15400, type: "sedan", brand: "Lada" },
          { x: 14700, y: 15400, type: "truck", brand: "Fordson" },
          { x: 15200, y: 15200, type: "truck", brand: "Toyota" },
          { x: 14300, y: 16100, type: "sedan", brand: "Fiat" },
          { x: 15600, y: 14600, type: "tractor", brand: "JohnDeere" },
          { x: 15900, y: 15300, type: "sedan", brand: "Lada" },
       ];
       carSpawns.forEach((c, i) => {
          const id = `car_default_${i}`;
          defaultCars[id] = {
             id,
             x: c.x,
             y: c.y,
             speed: 0,
             fuel: 100,
             health: 100,
             ownerId: null, 
             carType: c.type,
             brand: c.brand,
             angle: 0
          };
       });
       await set(ref(rtdb, `rooms/${roomId}/gameState/vehicles`), defaultCars);
    }

    setRoomId(roomId);
    setMyId(myId);
    useGameStore.getState().setCurrentScreen("game");
  };

  const handleBack = () => {
    useGameStore.getState().setCurrentScreen("menu");
  };

  return (
    <div className="absolute inset-0 bg-slate-950 z-50 flex items-center justify-center p-4 md:p-12 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-600/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-4xl h-full max-h-[600px] flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
           <div className="flex items-center gap-4">
              <button 
                onClick={handleBack}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all active:scale-90"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                  Select <span className="text-blue-500">Node</span>
                </h1>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Village Simulator Multi-Cell v1.4</span>
              </div>
           </div>
           
           <div className="hidden md:flex items-center gap-6 bg-slate-900/50 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/5">
              <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-500 uppercase">Latency</span>
                 <span className="text-xs font-bold text-emerald-400">42ms Optimized</span>
              </div>
              <div className="flex flex-col">
                 <span className="text-[8px] font-black text-slate-500 uppercase">Global Pop</span>
                 <span className="text-xs font-bold text-blue-400">2,481 Active</span>
              </div>
           </div>
        </div>

        {/* Server List */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-2 scrollbar-hide">
           {ROOMS.map((room, idx) => {
             const count = counts[room.id] || 0;
             const isFull = count >= MAX_PLAYERS;
             return (
               <motion.div 
                 key={room.id}
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.05 }}
                 className="group relative"
               >
                  <button 
                    onClick={() => handleJoin(room.id)}
                    disabled={isFull}
                    className={`w-full text-left p-4 md:p-5 rounded-2xl border-2 transition-all flex flex-col gap-3 relative overflow-hidden ${
                      isFull 
                      ? "bg-slate-900/40 border-white/5 opacity-60 cursor-not-allowed" 
                      : "bg-slate-900 border-white/5 hover:border-blue-500/50 hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${isFull ? 'bg-slate-800' : 'bg-blue-500/20'}`}>
                             <Globe className={`w-4 h-4 ${isFull ? 'text-slate-500' : 'text-blue-400'}`} />
                          </div>
                          <div className="flex flex-col leading-none">
                             <span className={`text-base md:text-lg font-black tracking-tight ${isFull ? 'text-slate-500' : 'text-white'}`}>{room.label}</span>
                             <span className="text-[9px] font-bold text-slate-500 uppercase">{room.region}</span>
                          </div>
                       </div>
                       <Signal className={`w-4 h-4 ${isFull ? 'text-slate-700' : 'text-emerald-500'}`} />
                    </div>

                    <div className="flex items-center justify-between mt-1">
                       <div className="flex items-center gap-2">
                          <Users className="w-3 h-3 text-slate-500" />
                          <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                             <div 
                               className={`h-full transition-all ${count > 8 ? 'bg-red-500' : 'bg-emerald-500'}`}
                               style={{ width: `${(count / MAX_PLAYERS) * 100}%` }}
                             />
                          </div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            {count}/{MAX_PLAYERS}
                          </span>
                       </div>
                       <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-1 ${isFull ? 'text-slate-700' : 'text-blue-500'}`} />
                    </div>
                  </button>
               </motion.div>
             )
           })}
        </div>
        
        {/* Footer Hint */}
        <div className="mt-4 text-center">
           <p className="text-[9px] font-medium text-slate-600 uppercase tracking-widest">
              Please choose a low-latency node for the best homesteading performance.
           </p>
        </div>
      </div>
    </div>
  );
}
