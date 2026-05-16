import React, { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";
import { MAP_BUILDINGS, ROADS, MAP_SIZE } from "./MapData";
import { X, Navigation, User, Car, ShoppingCart, Landmark, Building2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function FullMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, myId, setShowFullMap, waypoint, setWaypoint } = useGameStore();

  const handleMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale to map client coordinates to MAP_SIZE
    const scale = MAP_SIZE / Math.min(canvas.width, canvas.height);
    
    // We need to account for the object-contain scaling if the canvas aspect ratio doesn't match MAP_SIZE
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    const designScale = Math.min(displayWidth, displayHeight);
    
    const offsetX = (displayWidth - designScale) / 2;
    const offsetY = (displayHeight - designScale) / 2;
    
    const clickX = (e.clientX - rect.left - offsetX) * (MAP_SIZE / designScale);
    const clickY = (e.clientY - rect.top - offsetY) * (MAP_SIZE / designScale);

    if (clickX >= 0 && clickX <= MAP_SIZE && clickY >= 0 && clickY <= MAP_SIZE) {
        setWaypoint({ x: clickX, y: clickY });
    }
  };

  const handleMapTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scale = MAP_SIZE / Math.min(canvas.width, canvas.height);
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const designScale = Math.min(displayWidth, displayHeight);
      const offsetX = (displayWidth - designScale) / 2;
      const offsetY = (displayHeight - designScale) / 2;
      
      const clickX = (touch.clientX - rect.left - offsetX) * (MAP_SIZE / designScale);
      const clickY = (touch.clientY - rect.top - offsetY) * (MAP_SIZE / designScale);

      if (clickX >= 0 && clickX <= MAP_SIZE && clickY >= 0 && clickY <= MAP_SIZE) {
          setWaypoint({ x: clickX, y: clickY });
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;

    const draw = () => {
      const currentStore = useGameStore.getState();
      const state = currentStore.gameState;
      const myId = currentStore.myId;
      const activeWaypoint = currentStore.waypoint;
      
      if (!state || !myId) {
        animFrame = requestAnimationFrame(draw);
        return;
      }
      
      const me = state.players[myId];
      if (!me) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.save();
      
      // Calculate scale to fit the entire map onto the canvas
      const scale = Math.min(canvas.width, canvas.height) / MAP_SIZE;
      ctx.scale(scale, scale);

      // Biomes
      ctx.fillStyle = "#166534"; // Dense Village Green
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Lake from GameCanvas logic
      ctx.fillStyle = "#0c4a6e"; 
      ctx.fillRect(10000, 10000, 3000, 4000);

      // Roads
      ROADS.forEach(r => {
         ctx.fillStyle = r.type === 'paka' ? '#1e293b' : '#713f12';
         ctx.fillRect(r.x, r.y, r.w, r.h);
      });

      // Buildings
      MAP_BUILDINGS.forEach(b => {
         ctx.fillStyle = b.color;
         ctx.fillRect(b.x, b.y, b.w, b.h);
      });


      // Waypoint
      const time = Date.now() / 1000;
      if (activeWaypoint) {
          ctx.beginPath();
          ctx.arc(activeWaypoint.x, activeWaypoint.y, 200 + Math.sin(time * 10) * 100, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(167, 139, 250, 0.5)"; // Purple pulse
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(activeWaypoint.x, activeWaypoint.y, 100, 0, Math.PI * 2);
          ctx.fillStyle = "#a78bfa";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 40;
          ctx.stroke();

          // Navigation Line from Me to Waypoint
          ctx.beginPath();
          ctx.setLineDash([200, 100]);
          ctx.lineDashOffset = -time * 500;
          ctx.moveTo(me.x, me.y);
          ctx.lineTo(activeWaypoint.x, activeWaypoint.y);
          ctx.strokeStyle = "rgba(167, 139, 250, 0.6)";
          ctx.lineWidth = 40;
          ctx.stroke();
          ctx.setLineDash([]);
      }

      // Players
      Object.keys(state.players).forEach(pId => {
        const p = state.players[pId];
        const isMe = pId === myId;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, isMe ? 80 : 60, 0, Math.PI * 2);
        ctx.fillStyle = isMe ? "#fbbf24" : "rgba(255, 255, 255, 0.7)";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 20;
        ctx.stroke();

        // Label for me
        if (isMe) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 150px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("YOU", p.x, p.y - 150);
        }
      });

      // Vehicles
      Object.values(state.vehicles).forEach(v => {
          ctx.fillStyle = v.ownerId ? "#3b82f6" : "#64748b";
          ctx.fillRect(v.x - 30, v.y - 30, 60, 60);
      });

      ctx.restore();

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animFrame);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
    >
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] bg-slate-900 rounded-3xl border-4 border-slate-800 shadow-2xl overflow-hidden flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="bg-slate-800/50 px-6 py-4 flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-lime-500/20 rounded-xl">
                <Navigation className="w-5 h-5 text-lime-400" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter italic leading-none">VILLAGE LIFE</h2>
                <span className="text-[9px] font-black text-lime-500/80 uppercase tracking-[0.3em]">Land Navigation Satellite</span>
              </div>
              {waypoint && (
                <button 
                  onClick={() => setWaypoint(null)}
                  className="ml-4 px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-[10px] font-black uppercase rounded-lg border border-red-500/50 transition-colors"
                >
                  Clear Waypoint
                </button>
              )}
           </div>
           <button 
             onClick={() => setShowFullMap(false)}
             className="p-2 bg-slate-700 hover:bg-red-500 text-white rounded-xl transition-colors outline-none"
           >
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Map Canvas Area */}
        <div className="flex-1 relative overflow-hidden bg-[#1a1c1e]">
           <canvas 
             ref={canvasRef} 
             width={2000} 
             height={2000} 
             onClick={handleMapClick}
             onTouchStart={handleMapTouch}
             className="w-full h-full object-contain cursor-crosshair"
           />
           
           {/* POI Labels Overlay */}
           <div className="absolute inset-0 pointer-events-none">
              {MAP_BUILDINGS.filter(b => b.label).map(b => (
                 <div 
                   key={b.id} 
                   className="absolute -translate-x-1/2 -translate-y-1/2"
                   style={{ 
                     left: `${(b.x + b.w/2) / MAP_SIZE * 100}%`,
                     top: `${(b.y + b.h/2) / MAP_SIZE * 100}%` 
                   }}
                 >
                    <div className="flex flex-col items-center gap-1 group">
                       <MapMarkerIcon label={b.label} />
                       <span className="text-[8px] md:text-[10px] font-black text-white bg-black/80 px-2 py-0.5 rounded shadow-lg uppercase tracking-tight border border-white/10 whitespace-nowrap">
                          {b.label}
                       </span>
                    </div>
                 </div>
              ))}
              
              {/* Lake Label */}
              <div 
                className="absolute left-[33%] top-[33%] -translate-x-1/2 -translate-y-1/2"
              >
                <span className="text-[14px] font-black italic text-blue-300 drop-shadow-lg uppercase tracking-[0.2em]">Lake Area</span>
              </div>
           </div>
        </div>

        {/* Legend / Footer */}
        <div className="bg-slate-800/80 p-4 border-t border-slate-700 flex flex-wrap items-center justify-center gap-6">
           <LegendItem icon={User} label="Players" color="text-white" />
           <LegendItem icon={Car} label="Vehicles" color="text-blue-400" />
           <LegendItem icon={ShoppingCart} label="Market/Dealer" color="text-green-400" />
           <LegendItem icon={Landmark} label="Bank/ATM" color="text-slate-400" />
           <LegendItem icon={Building2} label="Services" color="text-red-400" />
           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-auto hidden md:block">
              Roll scroll to zoom (Coming soon) • Press ESC to close
           </div>
        </div>
      </div>
    </motion.div>
  );
}

function MapMarkerIcon({ label }: { label: string }) {
  if (label.includes("Police")) return <Building2 className="w-5 h-5 text-blue-500" />;
  if (label.includes("Clinic")) return <Building2 className="w-5 h-5 text-red-500" />;
  if (label.includes("Registry")) return <Landmark className="w-5 h-5 text-slate-300" />;
  if (label.includes("Shop")) return <Car className="w-5 h-5 text-lime-500" />;
  if (label.includes("Market")) return <ShoppingCart className="w-5 h-5 text-green-500" />;
  if (label.includes("House")) return <Building2 className="w-5 h-5 text-indigo-400" />;
  if (label.includes("Field") || label.includes("Farm") || label.includes("Barn")) return <MapPin className="w-5 h-5 text-lime-400" />;
  return <MapPin className="w-5 h-5 text-cyan-400" />;
}

function LegendItem({ icon: Icon, label, color }: any) {
  return (
    <div className="flex items-center gap-2">
       <Icon className={`w-4 h-4 ${color}`} />
       <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">{label}</span>
    </div>
  );
}
