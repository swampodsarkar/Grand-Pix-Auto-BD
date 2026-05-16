import React, { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";
import { MAP_BUILDINGS, ROADS, MAP_SIZE } from "./MapData";

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, myId } = useGameStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      const state = useGameStore.getState().gameState;
      const myId = useGameStore.getState().myId;
      if (!state || !myId) {
        animFrame = requestAnimationFrame(draw);
        return;
      }
      
      const me = state.players[myId];
      if (!me) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background biomes
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // scale minimap (responsive but biased for visibility)
      const scale = Math.max(0.045, canvas.width / 3500); 
      ctx.scale(scale, scale);
      ctx.translate(-me.x, -me.y);

      // Grass / Background
      ctx.fillStyle = "#064e3b";
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Roads - Enhanced contrast
      ROADS.forEach(r => {
         ctx.fillStyle = r.type === 'paka' ? '#0f172a' : '#451a03';
         ctx.fillRect(r.x, r.y, r.w, r.h);
      });

      // Buildings - Brighter colors on map
      MAP_BUILDINGS.forEach(b => {
         ctx.fillStyle = b.color;
         ctx.fillRect(b.x, b.y, b.w, b.h);
         // Add small highlight to building on map
         ctx.strokeStyle = "rgba(255,255,255,0.1)";
         ctx.lineWidth = 20;
         ctx.strokeRect(b.x, b.y, b.w, b.h);
      });

      // Other Players
      Object.keys(state.players).forEach(pId => {
        if (pId !== myId) {
          const p = state.players[pId];
          ctx.beginPath();
          ctx.arc(p.x, p.y, 150, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.fill();
        }
      });

      // Waypoint - Glowing
      const currentWaypoint = useGameStore.getState().waypoint;
      if (currentWaypoint) {
          ctx.beginPath();
          ctx.arc(currentWaypoint.x, currentWaypoint.y, 300, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(34, 211, 238, 0.4)";
          ctx.fill();
          ctx.lineWidth = 150;
          ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
          ctx.stroke();

          // Navigation line
          ctx.beginPath();
          ctx.setLineDash([300, 150]);
          ctx.moveTo(me.x, me.y);
          ctx.lineTo(currentWaypoint.x, currentWaypoint.y);
          ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
          ctx.lineWidth = 120;
          ctx.stroke();
          ctx.setLineDash([]);
      }

      ctx.restore();

      // Draw Me - Enhanced visibility
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Outer glow for self
      ctx.beginPath();
      ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(251, 191, 36, 0.3)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Heading indicator - Sharper
      ctx.save();
      ctx.translate(centerX, centerY);
      let angle = 0;
      if (me.inVehicleId && state.vehicles[me.inVehicleId]) {
         angle = state.vehicles[me.inVehicleId].angle;
      } else {
         if (me.facing === "up") angle = -Math.PI / 2;
         else if (me.facing === "down") angle = Math.PI / 2;
         else if (me.facing === "left") angle = Math.PI;
         else angle = 0;
      }
      ctx.rotate(angle);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -5);
      ctx.lineTo(4, 5);
      ctx.fill();
      ctx.restore();

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (!gameState || !myId) return null;
  const me = gameState.players[myId];
  if (!me) return null;

  return (
    <div className="w-full h-full bg-slate-900/80 backdrop-blur border-2 border-slate-700 rounded-full overflow-hidden relative shadow-xl">
      <canvas ref={canvasRef} width={192} height={192} className="w-full h-full object-cover" />
      <div className="absolute inset-x-0 bottom-2 md:bottom-4 text-center pointer-events-none">
        <span className="text-white text-[6px] md:text-[10px] font-bold font-mono bg-black/60 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full backdrop-blur">
          X: {Math.floor(me.x)} Y: {Math.floor(me.y)}
        </span>
      </div>
      
      {/* Direction indicators */}
      <div className="absolute top-0.5 md:top-1 left-1/2 -translate-x-1/2 text-[6px] md:text-[10px] font-bold text-slate-500">N</div>
      <div className="absolute bottom-0.5 md:bottom-1 left-1/2 -translate-x-1/2 text-[6px] md:text-[10px] font-bold text-slate-500">S</div>
      <div className="absolute left-0.5 md:left-1 top-1/2 -translate-y-1/2 text-[6px] md:text-[10px] font-bold text-slate-500">W</div>
      <div className="absolute right-0.5 md:right-1 top-1/2 -translate-y-1/2 text-[6px] md:text-[10px] font-bold text-slate-500">E</div>
    </div>
  );
}
