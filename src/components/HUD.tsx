import React, { useState, useEffect } from "react";
import { useGameStore } from "../store/useGameStore";
import { rtdb } from "../firebase";
import { ref, push, set, onChildAdded, update } from "firebase/database";
import { Phone, Users, Landmark, Car, MessageSquare, Map as MapIcon, X, Navigation, Anchor, Fish, Tractor, ShoppingBag, Home, Settings, ChevronDown, ChevronUp, Trophy, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Minimap } from "./Minimap";
import { VoiceChat } from "./VoiceChat";
import { FullMap } from "./FullMap";
import { MobileControls } from "./MobileControls";
import { SettingsMenu } from "./SettingsMenu";
import { FarmingUI } from "./FarmingUI";

export function HUD() {
  const gameState = useGameStore(s => s.gameState);
  const myId = useGameStore(s => s.myId);
  const roomId = useGameStore(s => s.roomId);
  const messages = useGameStore(s => s.messages);
  const activePhoneTab = useGameStore(s => s.activePhoneTab);
  const togglePhoneState = useGameStore(s => s.togglePhoneState);
  const showFullMap = useGameStore(s => s.showFullMap);
  const setShowFullMap = useGameStore(s => s.setShowFullMap);
  const showSettings = useGameStore(s => s.showSettings);
  const setShowSettings = useGameStore(s => s.setShowSettings);
  const fishingState = useGameStore(s => s.fishingState);
  const setFishingState = useGameStore(s => s.setFishingState);
  const ping = useGameStore(s => s.ping);
  const addMessage = useGameStore(s => s.addMessage);
  const characterType = useGameStore(s => s.characterType);
  const waypoint = useGameStore(s => s.waypoint);
  const setWaypoint = useGameStore(s => s.setWaypoint);
  const worldTime = useGameStore(s => s.worldTime);

  const [weatherInfo, setWeatherInfo] = useState("Sunny");
  const [chatMinimized, setChatMinimized] = useState(false);

  // Calculate weather for visuals
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      const isRain = Math.floor(now / 120000) % 3 === 2; // Rain 1 out of 3 periods
      setWeatherInfo(isRain ? "Raining" : "Sunny");
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for messages
  useEffect(() => {
    if (!roomId) return;
    const msgRef = ref(rtdb, `rooms/${roomId}/messages`);
    const unsub = onChildAdded(msgRef, (snap) => {
       const msg = snap.val();
       if (msg) {
         if (msg.channel === "local" && msg.x !== undefined && msg.y !== undefined) {
           const myPlayer = useGameStore.getState().gameState?.players?.[useGameStore.getState().myId || ""];
           if (myPlayer) {
             const dist = Math.hypot(myPlayer.x - msg.x, myPlayer.y - msg.y);
             if (dist <= 1000) {
               addMessage(msg);
             }
           } else {
             // Not loaded yet, just add it
             addMessage(msg);
           }
         } else {
           addMessage(msg);
         }
       }
    });
    return () => unsub();
  }, [addMessage, roomId]);

  useEffect(() => {
    if (fishingState && fishingState.active) {
        const interval = setInterval(() => {
            if (fishingState.progress > 0) {
                setFishingState({ ...fishingState, progress: Math.max(0, fishingState.progress - 1) });
            }
            // Auto close if idle too long
            if (Date.now() - fishingState.startedAt > 30000) {
                setFishingState(null);
            }
        }, 100);
        return () => clearInterval(interval);
    }
  }, [fishingState, setFishingState]);

  if (!gameState || !myId || !gameState.players[myId]) return null;
  const me = gameState.players[myId];

  const hours = Math.floor(worldTime / 100);
  const mins = worldTime % 100;
  const timeStr = `${hours.toString().padStart(2, '0')}:${(Math.floor(mins * 0.6)).toString().padStart(2, '0')}`;

  const archetypeLabel = characterType ? characterType.charAt(0).toUpperCase() + characterType.slice(1) : "Casual";

  const target = waypoint;
  const dist = target ? Math.floor(Math.hypot(target.x - me.x, target.y - me.y) / 10) : 0;
  const targetAngle = target ? Math.atan2(target.y - me.y, target.x - me.x) : 0;

  const potatoCount = me.inventory?.potato || 0;
  const wheatCount = me.inventory?.wheat || 0;
  const cornCount = me.inventory?.corn || 0;

  const handleFishingClick = () => {
    if (!fishingState || !roomId) return;
    const newProgress = fishingState.progress + 5;
    if (newProgress >= fishingState.target) {
        // Caught it!
        const currentFishCount = (me.inventory?.fish || 0) + 1;
        update(ref(rtdb), {
            [`rooms/${roomId}/gameState/players/${myId}/inventory/fish`]: currentFishCount
        });
        const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
        set(msgRef, { id: Date.now(), sender: "System", text: `🎣 You caught a fish! Total: ${currentFishCount}`, channel: "global", system: true });
        setFishingState(null);
    } else {
        setFishingState({ ...fishingState, progress: newProgress });
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Navigation Helper */}
      <AnimatePresence>
        {target && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
             <div className="bg-slate-900/90 backdrop-blur border-2 border-white/10 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto group relative">
                <div 
                   className="w-8 h-8 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400"
                   style={{ transform: `rotate(${targetAngle * 180 / Math.PI + 90}deg)` }}
                >
                   <Navigation className="w-5 h-5 fill-current" />
                </div>
                <div className="flex flex-col pr-2">
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">
                      {waypoint ? "Target Destination" : "Active Objective"}
                   </span>
                   <div className="flex items-center gap-2">
                      <span className="text-white font-black text-xl leading-none tracking-tighter">
                         {dist}m
                      </span>
                      {waypoint && (
                        <button 
                          onClick={() => setWaypoint(null)}
                          className="text-[8px] bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white px-2 py-0.5 rounded uppercase font-black transition-colors"
                        >
                          Clear
                        </button>
                      )}
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Left: Navigation & Chat */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 pointer-events-none z-[800]">
        {/* Minimap Header */}
        <div className="flex items-start gap-3">
            <button 
             onClick={() => setShowFullMap(true)}
             className="group relative transition-transform active:scale-95 outline-none pointer-events-auto w-20 h-20 md:w-24 md:h-24 flex-shrink-0 z-[900]"
           >
            <Minimap />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors rounded-full overflow-hidden">
               <span className="text-[8px] md:text-[10px] font-black text-white opacity-0 group-hover:opacity-100 uppercase tracking-widest shadow-lg">Map</span>
            </div>
          </button>

          {/* World Info */}
          <div className="mt-1 hidden sm:flex flex-col gap-0.5">
             <div className="bg-slate-900/80 backdrop-blur px-2 py-1 rounded text-[8px] font-black text-cyan-400 uppercase tracking-widest border border-white/5">
                {timeStr} | {weatherInfo}
             </div>
          </div>
        </div>
        
        {/* Chat */}
        <div className={`w-40 md:w-72 landscape:w-52 flex flex-col justify-end pointer-events-auto transition-all ${chatMinimized ? 'h-6 landscape:h-7' : 'h-24 md:h-48 landscape:h-32'}`}>
          <div className="flex items-center justify-between bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-t-lg border-b border-white/10 md:hidden">
             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Village Chat</span>
             <button onClick={() => setChatMinimized(!chatMinimized)}>
                {chatMinimized ? <ChevronUp className="w-3 h-3 text-white" /> : <ChevronDown className="w-3 h-3 text-white" />}
             </button>
          </div>
          {!chatMinimized && (
            <div className="flex-1 overflow-y-auto filter drop-shadow-md pb-2 flex flex-col justify-end gap-1 scrollbar-hide">
              {messages.slice(-6).map((m, i) => (
                <div key={i} className={`text-[9px] md:text-sm px-2 py-0.5 md:py-1 rounded bg-black/40 backdrop-blur-sm inline-block max-w-full break-words ${m.system ? 'text-yellow-400' : 'text-white'}`}>
                  {!m.system && <span className="font-bold text-slate-300 mr-1 md:mr-2 truncate max-w-[80px] inline-block align-bottom">{m.sender}:</span>}
                  {m.text}
                </div>
              ))}
            </div>
          )}
          {!chatMinimized && <ChatInput />}
        </div>
      </div>

      {/* Top Right: Status */}
      <div className="absolute top-2 right-2 md:top-4 md:right-4 flex flex-col items-end gap-1 landscape:gap-1.5 z-[950]">
        <div className="flex gap-2 items-center pointer-events-auto">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-slate-900/90 backdrop-blur border border-white/10 text-white rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-90"
          >
            <Settings className="w-5 h-5" />
          </button>
          
          {/* GTA 5 Style Name + Money HUD */}
          <div className="bg-black/70 backdrop-blur-md border-l-4 border-lime-400 text-white pl-3 pr-4 py-1 rounded-r-2xl shadow-2xl flex items-center gap-4 font-mono">
            <div>
              <div className="text-sm font-black tracking-tight text-white/90">{me.name}</div>
            </div>

            <div className="flex flex-col items-end">
              <div className="text-[10px] text-emerald-400 font-bold tracking-widest">CASH</div>
              <div className="text-2xl font-black text-lime-400 tabular-nums tracking-tighter leading-none">
                ${me.money}
              </div>
            </div>
          </div>
        </div>

        {/* Inventory Box */}
        <div className="flex flex-col gap-2">
          {(potatoCount > 0 || wheatCount > 0 || cornCount > 0 || (me.inventory?.fish || 0) > 0) && (
            <div className="bg-slate-900/90 backdrop-blur border border-white/10 text-white px-3 py-1 rounded-lg shadow-lg flex flex-col gap-0.5 pointer-events-auto">
              <span className="text-[6px] text-slate-500 font-black uppercase tracking-widest">Harvest</span>
              <div className="flex gap-2">
                 {potatoCount > 0 && <span className="text-[10px] font-bold text-amber-400">🥔{potatoCount} </span>}
                 {wheatCount > 0 && <span className="text-[10px] font-bold text-yellow-400">🌾{wheatCount} </span>}
                 {cornCount > 0 && <span className="text-[10px] font-bold text-orange-400">🌽{cornCount} </span>}
                 {me.inventory?.fish > 0 && <span className="text-[10px] font-bold text-blue-400">🐟{me.inventory.fish} </span>}
              </div>
            </div>
          )}

          {me.ownedProperties && me.ownedProperties.length > 0 && (
            <div className="bg-slate-900/90 backdrop-blur border border-white/10 text-white px-4 py-2 rounded-xl shadow-xl flex flex-col gap-1 pointer-events-auto">
              <span className="text-[8px] text-lime-400 font-black uppercase tracking-widest">Apnar Jomi (Owned Land)</span>
              <div className="flex flex-wrap gap-1 max-w-[150px]">
                {me.ownedProperties.map((p: string) => (
                  <span key={p} className="text-[7px] bg-lime-500/20 text-lime-400 border border-lime-500/30 px-1 rounded uppercase font-bold">{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {me.wantedLevel > 0 && (
          <div className="bg-orange-500/20 text-orange-400 border border-orange-500 px-4 py-2 rounded-xl shadow-lg border-2 animate-pulse font-bold tracking-widest text-lg pointer-events-auto text-center">
            FINES PENDING: ${Math.ceil(me.wantedLevel * 100)}
          </div>
        )}

      </div>

      {/* Voice join UI above joystick (bottom left) */}
      <div className="absolute bottom-24 left-4 z-[70] pointer-events-auto">
        <VoiceChat />
      </div>

      {/* Vitals under username/money (top right) */}
      <div className="absolute top-16 right-2 landscape:top-14 landscape:right-3 flex flex-col gap-1 pointer-events-none md:pointer-events-auto w-24 md:w-32 z-[60]">
        {/* Speedometer */}
        {me.inVehicleId && gameState.vehicles[me.inVehicleId] && (
          <div className="bg-slate-900/80 backdrop-blur border-2 border-slate-700 p-1.5 rounded-lg shadow">
            <div className="flex items-end gap-1 text-[10px]">
              <span className="font-mono text-emerald-400">{Math.floor(me.speed * 8)}</span>
              <span className="text-[7px] text-slate-500">KM/H</span>
            </div>
          </div>
        )}
        <div className="flex gap-1.5">
          <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div className="h-full bg-red-500" style={{ width: `${me.health}%` }} />
          </div>
          <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div className="h-full bg-blue-500" style={{ width: `${me.stamina}%` }} />
          </div>
        </div>
      </div>

      {/* Desktop HUD Buttons (Hidden on Mobile) */}
      <div className="absolute bottom-6 right-6 pointer-events-auto hidden md:grid grid-cols-2 gap-2">
        <button 
          onClick={() => togglePhoneState("inventory")}
          className="p-4 bg-slate-900/95 text-indigo-400 rounded-2xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 border border-white/10"
        >
          <ShoppingBag className="w-6 h-6" />
        </button>
        <button 
          onClick={() => togglePhoneState("home")}
          className="p-4 bg-slate-900/95 text-white rounded-2xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 border border-white/10"
        >
          <Phone className="w-6 h-6" />
        </button>
        <button onClick={() => setShowFullMap(true)} className="p-4 bg-slate-900/95 text-cyan-400 rounded-2xl shadow-2xl hover:bg-slate-800 transition-all hover:scale-110 active:scale-95 border border-white/10">
           <MapIcon className="w-6 h-6" />
        </button>
        <button className="p-4 bg-slate-900/95 text-white/40 rounded-2xl shadow-2xl border border-white/10 cursor-not-allowed">
           <Landmark className="w-6 h-6 opacity-30" />
        </button>
      </div>


      <AnimatePresence>
        {activePhoneTab && <PhoneUI />}
      </AnimatePresence>

      {/* Mobile Controls */}
      <div className="md:hidden">
         <MobileControls />
      </div>

      {/* Settings Menu */}
      <AnimatePresence>
        {showSettings && <SettingsMenu />}
      </AnimatePresence>

      {/* Farming UI */}
      <AnimatePresence>
        <FarmingUI />
      </AnimatePresence>

      {/* Full Map Overlay */}
      <AnimatePresence>
        {showFullMap && <FullMap />}
      </AnimatePresence>

      {/* Fishing Mini Game */}
      <AnimatePresence>
        {fishingState && fishingState.active && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border-4 border-cyan-500/30 rounded-[40px] p-8 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(6,182,212,0.2)] pointer-events-auto">
               <div className="w-24 h-24 bg-cyan-500/10 rounded-full flex items-center justify-center text-cyan-400 relative">
                  <Fish className="w-12 h-12" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-cyan-400 rounded-full"
                  />
               </div>
               
               <div className="text-center">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Fish on the line!</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Tap fast to reel it in!</p>
               </div>

               <div className="w-64 h-6 bg-slate-800 rounded-full overflow-hidden border border-white/5 relative">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-blue-400"
                    style={{ width: `${(fishingState.progress / fishingState.target) * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <span className="text-[10px] font-black text-white mix-blend-overlay">
                        {Math.floor((fishingState.progress / fishingState.target) * 100)}%
                     </span>
                  </div>
               </div>

               <button 
                 onClick={handleFishingClick}
                 className="group relative px-12 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-2xl transform transition-all active:scale-90 shadow-lg shadow-cyan-500/20"
               >
                  REEL IT IN
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
               </button>

               <button 
                 onClick={() => setFishingState(null)}
                 className="text-slate-500 hover:text-red-400 text-[10px] font-black uppercase tracking-widest transition-colors"
               >
                  Let it go (ESC)
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint Text */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 hidden md:flex items-center gap-3 px-6 py-2 rounded-full text-white/80 text-[10px] font-black uppercase tracking-widest border border-white/10 shadow-2xl backdrop-blur-xl">
        <span className="hidden md:flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400">WASD</kbd> Move</span>
        <span className="hidden md:flex w-1 h-1 bg-white/20 rounded-full" />
        <span className="hidden md:flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400">SHIFT</kbd> Run</span>
        <span className="hidden md:flex w-1 h-1 bg-white/20 rounded-full" />
        <span className="hidden md:flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400">E</kbd> Plant/Harvest</span>
        <span className="hidden md:flex w-1 h-1 bg-white/20 rounded-full" />
        <span className="hidden md:flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400">F</kbd> Tractor</span>
        <span className="hidden md:flex w-1 h-1 bg-white/20 rounded-full" />
        <span className="hidden md:flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400">P</kbd> Device</span>
        <span className="hidden md:flex w-1 h-1 bg-white/20 rounded-full" />
        <span className="hidden md:flex items-center gap-1.5"><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-cyan-400">M</kbd> Map</span>
      </div>
    </div>
  );
}

function ChatInput() {
  const [text, setText] = useState("");
  const myId = useGameStore(s => s.myId);
  const roomId = useGameStore(s => s.roomId);
  const gameState = useGameStore(s => s.gameState);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !myId || !roomId || !gameState) return;
    
    const p = gameState.players[myId];
    if (!p) return;

    // Removed job command, just send message
    const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
    set(msgRef, {
      id: Date.now(),
      sender: p.name,
      senderId: myId,
      text: text.trim(),
      channel: text.startsWith("/global ") ? "global" : "local",
      x: p.x,
      y: p.y
    });

    const displayTxt = text.startsWith("/global ") ? text.replace("/global ", "") : text;

    // Set bubble text on player
    update(ref(rtdb), {
       [`rooms/${roomId}/gameState/players/${myId}/lastMessage`]: displayTxt.trim().substring(0, 50),
       [`rooms/${roomId}/gameState/players/${myId}/lastMessageTime`]: Date.now()
    });
    
    setText("");
  };

  return (
    <form onSubmit={submit} className="relative mt-2">
      <input 
        type="text" 
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type to talk locally, or /global ..." 
        className="w-full bg-slate-900/80 border border-slate-700 text-white text-sm rounded-lg pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-lime-500 transition-colors placeholder:text-slate-400 font-medium"
        onKeyDown={e => e.stopPropagation()} // Prevent game movement while typing
        onKeyUp={e => e.stopPropagation()}
      />
      <MessageSquare className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
    </form>
  )
}

function PhoneUI() {
  const activePhoneTab = useGameStore(s => s.activePhoneTab);
  const togglePhoneState = useGameStore(s => s.togglePhoneState);
  const setShowFullMap = useGameStore(s => s.setShowFullMap);
  const gameState = useGameStore(s => s.gameState);
  const myId = useGameStore(s => s.myId);
  const roomId = useGameStore(s => s.roomId);
  
  const me = myId && gameState ? gameState.players[myId] : null;

  if (!me) return null;

  return (
    <motion.div 
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      className="fixed bottom-0 md:bottom-4 left-0 md:left-auto right-0 md:right-24 mx-auto md:mx-0 w-full md:w-80 landscape:w-[min(380px,70vw)] h-[70vh] md:h-[36rem] landscape:h-[82vh] bg-slate-950 rounded-t-[2.5rem] md:rounded-[3rem] border-t-8 md:border-[8px] border-slate-800 shadow-2xl overflow-hidden pointer-events-auto flex flex-col font-sans z-[200]"
    >
      {/* Notch / Handle */}
      <div className="h-6 w-32 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-xl z-20 md:block hidden" />
      <div className="h-1.5 w-16 bg-slate-700 absolute top-3 left-1/2 -translate-x-1/2 rounded-full z-20 md:hidden block" />
      
      {/* Header */}
       <div className="bg-slate-900 text-white py-6 px-4 flex flex-col border-b border-white/5 relative z-10">
        <div className="flex items-center justify-between">
          <span className="font-black text-xl uppercase tracking-tighter italic">{activePhoneTab}</span>
          <button onClick={() => togglePhoneState(undefined)} className="hover:bg-white/10 p-1.5 rounded-xl transition-colors outline-none"><X className="w-5 h-5 text-slate-400"/></button>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
           <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Village Net Connected</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-slate-100 overflow-y-auto p-4 text-slate-900 scrollbar-hide">
           {activePhoneTab === "home" && (
             <div className="grid grid-cols-2 landscape:grid-cols-4 gap-3 landscape:gap-4 pt-4 landscape:pt-6">
               <PhoneAppIcon icon={Landmark} label="Bank" color="bg-lime-600" onClick={() => togglePhoneState("bank")} />
               <PhoneAppIcon icon={ShoppingBag} label="Inventory" color="bg-indigo-600" onClick={() => togglePhoneState("inventory")} />
                <PhoneAppIcon icon={Users} label="Contacts" color="bg-blue-500" onClick={() => togglePhoneState("contacts")} />
                <PhoneAppIcon icon={MapIcon} label="Village Map" color="bg-slate-800" onClick={() => { setShowFullMap(true); togglePhoneState(null); }} />
                <PhoneAppIcon icon={Trophy} label="Leaderboard" color="bg-yellow-600" onClick={() => togglePhoneState("leaderboard")} />
                <PhoneAppIcon icon={Users} label="Clan" color="bg-purple-600" onClick={() => togglePhoneState("clan")} />
                <PhoneAppIcon icon={ShoppingBag} label="Trade" color="bg-emerald-600" onClick={() => togglePhoneState("trade")} />
                <PhoneAppIcon icon={Calendar} label="Events" color="bg-orange-600" onClick={() => togglePhoneState("events")} />
                <PhoneAppIcon icon={Home} label="Property" color="bg-blue-600" onClick={() => togglePhoneState("property")} />
             </div>
           )}

           {activePhoneTab === "contacts" && (
             <div className="p-4">
               <div className="text-blue-600 font-black text-lg mb-3">Online Players</div>
               
               {Object.values(gameState?.players || {})
                 .filter((p: any) => p.id !== myId)
                 .map((player: any, i) => (
                   <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border mb-2">
                     <span className="font-bold">{player.name}</span>
                     <button 
                       onClick={() => {
                         if (!myId || !roomId) return;
                         const updates: any = {};
                         updates[`rooms/${roomId}/gameState/players/${myId}/friends/${player.id}`] = {
                           name: player.name,
                           status: "pending",
                           timestamp: Date.now()
                         };
                         update(ref(rtdb), updates);
                         alert(`Friend request sent to ${player.name}!`);
                       }}
                       className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg font-bold active:scale-95"
                     >
                       Add Friend
                     </button>
                   </div>
                 ))}
               
               {Object.keys(gameState?.players || {}).length <= 1 && (
                 <div className="text-center text-sm text-slate-500 mt-4">No other players online</div>
               )}
             </div>
           )}

          {activePhoneTab === "inventory" && (
            <div className="flex flex-col gap-4">
               <div className="bg-indigo-100 p-4 rounded-2xl border border-indigo-200">
                  <span className="text-indigo-800 text-xs font-bold uppercase tracking-wider">Storage & Bag</span>
                  <p className="text-slate-600 text-[10px] mt-1 font-black italic">Everything you own in the village.</p>
               </div>
               
               <div className="flex flex-col gap-3">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Crops</h4>
                 <div className="grid grid-cols-2 gap-3 pb-8">
                    {[
                      { name: "Rice", val: me.inventory?.dhan, color: "text-emerald-600" },
                      { name: "Potato", val: me.inventory?.potato, color: "text-amber-500" },
                      { name: "Wheat", val: me.inventory?.wheat, color: "text-yellow-500" },
                      { name: "Corn", val: me.inventory?.corn, color: "text-orange-500" },
                      { name: "Milk", val: me.inventory?.milk, color: "text-blue-500" },
                      { name: "Fish", val: me.inventory?.fish, color: "text-cyan-500" },
                    ].map(item => (
                      <div key={item.name} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{item.name}</span>
                        <span className={`text-sm font-black ${item.color}`}>{item.val || 0} mon</span>
                      </div>
                    ))}
                 </div>

                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mt-2">Jomi (Land)</h4>
                 <div className="flex flex-wrap gap-2">
                    {me.ownedProperties && me.ownedProperties.length > 0 ? (
                      me.ownedProperties.map((p: string) => (
                        <div key={p} className="bg-white border border-slate-100 p-2 rounded-lg flex items-center gap-2">
                          <Home className="w-3 h-3 text-lime-600" />
                          <span className="text-[9px] font-black text-slate-700 uppercase">{p}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400 italic pl-1">No land owned yet.</span>
                    )}
                 </div>
               </div>
            </div>
          )}
 
         {activePhoneTab === "bank" && (
           <div className="flex flex-col gap-4">
             <div className="bg-pink-100 p-4 rounded-2xl border border-pink-200">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-pink-800 text-[10px] font-black uppercase tracking-wider">bKash Balance</span>
                 <div className="w-8 h-4 bg-pink-500 rounded" />
               </div>
               <h3 className="text-3xl font-black text-pink-600 tracking-tighter">${me.bank}</h3>
             </div>
             <div className="bg-orange-100 p-4 rounded-2xl border border-orange-200">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-orange-800 text-[10px] font-black uppercase tracking-wider">Nagad Savings</span>
                 <div className="w-8 h-4 bg-orange-600 rounded" />
               </div>
               <h3 className="text-2xl font-black text-orange-600 tracking-tighter">$0</h3>
             </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                 <p className="text-xs text-slate-500 font-medium">Bhumi Registry office theke jomi kinun.</p>
              </div>

              {/* Apartment Buy/Sell */}
              <div className="mt-4">
                <div className="text-sm font-black mb-2">Apartment</div>
                {!me.ownedProperties?.includes("apartment") ? (
                  <button 
                    onClick={() => {
                      if ((me.money || 0) >= 15000) {
                        const updates: any = {};
                        updates[`rooms/${roomId}/gameState/players/${myId}/money`] = (me.money || 0) - 15000;
                        updates[`rooms/${roomId}/gameState/players/${myId}/ownedProperties`] = [...(me.ownedProperties || []), "apartment"];
                        update(ref(rtdb), updates);
                      }
                    }}
                    className="w-full py-2 bg-emerald-600 text-white rounded-xl font-black text-sm active:scale-95"
                  >
                    Buy Apartment - ৳15,000
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      const updates: any = {};
                      updates[`rooms/${roomId}/gameState/players/${myId}/money`] = (me.money || 0) + 12000;
                      const newProps = (me.ownedProperties || []).filter(p => p !== "apartment");
                      updates[`rooms/${roomId}/gameState/players/${myId}/ownedProperties`] = newProps.length ? newProps : null;
                      update(ref(rtdb), updates);
                    }}
                    className="w-full py-2 bg-red-600 text-white rounded-xl font-black text-sm active:scale-95"
                  >
                    Sell Apartment - Get ৳12,000
                  </button>
                )}
              </div>
            </div>
          )}

          {activePhoneTab === "leaderboard" && (
            <div className="p-4">
              <div className="text-yellow-600 font-black text-lg mb-3 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Top Farmers
              </div>
              <div className="space-y-2 text-sm">
                {Object.values(gameState?.players || {}).sort((a: any, b: any) => (b.money || 0) - (a.money || 0)).slice(0, 8).map((p: any, i) => (
                  <div key={i} className="flex justify-between bg-white p-2 rounded-xl border">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-emerald-600 font-black">৳{p.money}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePhoneTab === "clan" && (
            <div className="p-4 text-center">
              <div className="text-purple-600 font-black text-lg mb-2">Your Clan</div>
              <div className="text-sm text-slate-600">Clan system coming soon...</div>
              <div className="mt-4 text-[10px] text-slate-400">Create or join a clan to play together</div>
            </div>
          )}

          {activePhoneTab === "trade" && (
            <div className="p-4">
              <div className="text-emerald-600 font-black text-lg mb-3">Player Trading</div>
              <div className="text-sm text-slate-600 mb-3">Select a player to trade with</div>
              
              {Object.values(gameState?.players || {})
                .filter((p: any) => p.id !== myId)
                .slice(0, 6)
                .map((player: any, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border mb-2">
                    <div>
                      <span className="font-bold">{player.name}</span>
                      <span className="text-xs text-slate-400 ml-2">৳{player.money}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const amount = prompt("How much money do you want to send?");
                        if (amount && parseInt(amount) > 0 && (me.money || 0) >= parseInt(amount)) {
                          const updates: any = {};
                          updates[`rooms/${roomId}/gameState/players/${myId}/money`] = (me.money || 0) - parseInt(amount);
                          updates[`rooms/${roomId}/gameState/players/${player.id}/money`] = (player.money || 0) + parseInt(amount);
                          update(ref(rtdb), updates);
                          alert(`Sent ৳${amount} to ${player.name}`);
                        }
                      }}
                      className="px-4 py-1 bg-emerald-600 text-white text-sm rounded-lg font-bold active:scale-95"
                    >
                      Send Money
                    </button>
                  </div>
                ))}
            </div>
          )}

          {activePhoneTab === "events" && (
            <div className="p-4 text-center">
              <div className="text-orange-600 font-black text-lg mb-2">Global Events</div>
              <div className="text-sm text-slate-600">Seasonal events & global missions coming soon...</div>
            </div>
          )}

          {activePhoneTab === "property" && (
            <div className="p-4">
              <div className="text-blue-600 font-black text-lg mb-3">Real Estate</div>
              
              {/* Multiple Properties */}
              {[
                { id: "apartment", name: "Village Apartment", price: 15000, sell: 12000 },
                { id: "house", name: "Brick House", price: 45000, sell: 36000 },
                { id: "shop", name: "Corner Shop", price: 85000, sell: 68000 },
                { id: "farm", name: "Small Farm", price: 120000, sell: 95000 },
              ].map((prop, index) => (
                <div key={index} className="mb-4 border-b pb-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold">{prop.name}</span>
                    <span className="text-sm text-emerald-600 font-black">৳{prop.price}</span>
                  </div>
                  {!me.ownedProperties?.includes(prop.id) ? (
                    <button 
                      onClick={() => {
                        if ((me.money || 0) >= prop.price) {
                          const updates: any = {};
                          updates[`rooms/${roomId}/gameState/players/${myId}/money`] = (me.money || 0) - prop.price;
                          updates[`rooms/${roomId}/gameState/players/${myId}/ownedProperties`] = [...(me.ownedProperties || []), prop.id];
                          update(ref(rtdb), updates);
                        }
                      }}
                      className="w-full py-2 bg-emerald-600 text-white rounded-xl text-sm font-black active:scale-95"
                    >
                      BUY
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        const updates: any = {};
                        updates[`rooms/${roomId}/gameState/players/${myId}/money`] = (me.money || 0) + prop.sell;
                        const newProps = (me.ownedProperties || []).filter(p => p !== prop.id);
                        updates[`rooms/${roomId}/gameState/players/${myId}/ownedProperties`] = newProps.length ? newProps : null;
                        update(ref(rtdb), updates);
                      }}
                      className="w-full py-2 bg-red-600 text-white rounded-xl text-sm font-black active:scale-95"
                    >
                      SELL (Get ৳{prop.sell})
                    </button>
                  )}
                </div>
              ))}

              <div className="text-[10px] text-slate-400 text-center mt-2">Properties are saved permanently</div>

              {/* Instant Vehicle Spawn */}
              <div className="mt-6 pt-4 border-t">
                <div className="text-blue-600 font-black text-sm mb-3">Spawn Vehicle ($20 each)</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: "sedan", label: "Car" },
                    { type: "bike", label: "Bike" },
                    { type: "quad", label: "Quad" }
                  ].map((v, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        if ((me.money || 0) >= 20 && myId && roomId) {
                          const updates: any = {};
                          updates[`rooms/${roomId}/gameState/players/${myId}/money`] = (me.money || 0) - 20;
                          
                          const newVehicleId = "v_" + Date.now();
                          updates[`rooms/${roomId}/gameState/vehicles/${newVehicleId}`] = {
                            id: newVehicleId,
                            x: (me.x || 0) + 60,
                            y: (me.y || 0) + 40,
                            angle: 0,
                            speed: 0,
                            fuel: 100,
                            health: 100,
                            carType: v.type,
                            brand: "Spawned",
                            ownerId: myId
                          };
                          update(ref(rtdb), updates);
                        }
                      }}
                      className="py-2 bg-blue-600 text-white text-xs font-black rounded-xl active:scale-95"
                    >
                      {v.label} ($20)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
 
       </div>

      {/* Home Indicator */}
      <div className="h-8 bg-slate-100 flex items-center justify-center">
        <div className="w-1/3 h-1 bg-slate-300 rounded-full cursor-pointer hover:bg-slate-400" onClick={() => togglePhoneState("home")}></div>
      </div>
    </motion.div>
  )
}

function PhoneAppIcon({ icon: Icon, label, color, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group outline-none">
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform group-focus:ring-2 group-focus:ring-slate-400`}>
        <Icon className="w-7 h-7" />
      </div>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </button>
  )
}
