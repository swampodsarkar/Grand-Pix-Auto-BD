import React, { useRef, useState } from "react";
import { useGameStore } from "../store/useGameStore";
import { Phone, ShoppingBag, MessageSquare } from "lucide-react";

export function MobileControls() {
  const togglePhoneState = useGameStore(s => s.togglePhoneState);
  const gameState = useGameStore(s => s.gameState);
  const myId = useGameStore(s => s.myId);
  const inVehicle = myId && gameState?.players[myId]?.inVehicleId;

  const [joy, setJoy] = useState({ x: 0, y: 0, active: false });
  const joyRef = useRef<HTMLDivElement>(null);

  const handleKeydown = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  const handleKeyup = (key: string) => window.dispatchEvent(new KeyboardEvent("keyup", { key }));
  const focusChat = () => {
    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
    if (input) input.focus();
  };

  const startJoy = (cx: number, cy: number) => {
    const rect = joyRef.current!.getBoundingClientRect();
    const dx = cx - (rect.left + rect.width/2);
    const dy = cy - (rect.top + rect.height/2);
    const dist = Math.min(Math.hypot(dx, dy), 36);
    const ang = Math.atan2(dy, dx);
    const nx = Math.cos(ang) * dist;
    const ny = Math.sin(ang) * dist;
    setJoy({ x: nx, y: ny, active: true });
    handleKeydown("Shift"); // auto sprint while dragging
    updateDir(nx, ny);
  };

  const moveJoy = (cx: number, cy: number) => {
    if (!joy.active) return;
    const rect = joyRef.current!.getBoundingClientRect();
    const dx = cx - (rect.left + rect.width/2);
    const dy = cy - (rect.top + rect.height/2);
    const dist = Math.min(Math.hypot(dx, dy), 36);
    const ang = Math.atan2(dy, dx);
    const nx = Math.cos(ang) * dist;
    const ny = Math.sin(ang) * dist;
    setJoy({ x: nx, y: ny, active: true });
    updateDir(nx, ny);
  };

  const endJoy = () => {
    setJoy({ x: 0, y: 0, active: false });
    ["w","a","s","d","Shift"].forEach(k => handleKeyup(k));
  };

  const updateDir = (x: number, y: number) => {
    const t = 10;
    handleKeydown("w"); if (y > -t) handleKeyup("w");
    handleKeydown("s"); if (y < t) handleKeyup("s");
    handleKeydown("a"); if (x > -t) handleKeyup("a");
    handleKeydown("d"); if (x < t) handleKeyup("d");
  };

  return (
    <div className="fixed inset-0 pointer-events-none p-3 flex justify-between items-end z-[999]">
      {/* Joystick - D-pad when in vehicle, Analog otherwise */}
      {inVehicle ? (
        // D-PAD for vehicles
        <div className="grid grid-cols-3 gap-1 pointer-events-auto opacity-90">
          <div />
          <ControlButton label="▲" onDown={() => handleKeydown("w")} onUp={() => handleKeyup("w")} />
          <div />
          <ControlButton label="◀" onDown={() => handleKeydown("a")} onUp={() => handleKeyup("a")} />
          <div />
          <ControlButton label="▶" onDown={() => handleKeydown("d")} onUp={() => handleKeyup("d")} />
          <div />
          <ControlButton label="▼" onDown={() => handleKeydown("s")} onUp={() => handleKeyup("s")} />
          <div />
        </div>
      ) : (
        // CIRCLE JOYSTICK (small)
        <div
          ref={joyRef}
          className="w-20 h-20 rounded-full border-[5px] border-slate-600 bg-slate-900/70 pointer-events-auto relative touch-none z-[1000]"
          onPointerDown={e => startJoy(e.clientX, e.clientY)}
          onPointerMove={e => moveJoy(e.clientX, e.clientY)}
          onPointerUp={endJoy}
          onPointerLeave={endJoy}
          onPointerCancel={endJoy}
        >
          <div
            className="absolute w-8 h-8 bg-white/90 rounded-full shadow border border-slate-400 transition-transform"
            style={{ left: `calc(50% + ${joy.x}px - 16px)`, top: `calc(50% + ${joy.y}px - 16px)` }}
          />
        </div>
      )}

      {/* Buttons Area (Bottom Right) */}
      <div className="flex flex-col gap-2 items-end pointer-events-auto">
        {/* Top row: Phone, Bag, Chat icon buttons */}
        <div className="flex gap-1.5 mb-1">
          <button 
            className="w-9 h-9 bg-blue-600/80 backdrop-blur-md border border-white/30 rounded-xl flex items-center justify-center text-white shadow active:bg-blue-600 active:scale-95 transition-all"
            onClick={(e) => { e.preventDefault(); togglePhoneState("home"); }}
          >
            <Phone className="w-4 h-4 pointer-events-none" />
          </button>
          <button 
            className="w-9 h-9 bg-indigo-600/80 backdrop-blur-md border border-white/30 rounded-xl flex items-center justify-center text-white shadow active:bg-indigo-600 active:scale-95 transition-all"
            onClick={(e) => { e.preventDefault(); togglePhoneState("inventory"); }}
          >
            <ShoppingBag className="w-4 h-4 pointer-events-none" />
          </button>
          <button 
            className="w-9 h-9 bg-emerald-600/80 backdrop-blur-md border border-white/30 rounded-xl flex items-center justify-center text-white shadow active:bg-emerald-600 active:scale-95 transition-all"
            onClick={(e) => { e.preventDefault(); focusChat(); }}
          >
            <MessageSquare className="w-4 h-4 pointer-events-none" />
          </button>
        </div>

        {/* Action Grid (small spaced) */}
        <div className="grid grid-cols-2 gap-2 opacity-90">
          <ControlButton label="MAP" onDown={() => handleKeydown("m")} onUp={() => handleKeyup("m")} />
          <ControlButton label="INV" onDown={() => handleKeydown("p")} onUp={() => handleKeyup("p")} />
          <ControlButton label="DRIVE" onDown={() => handleKeydown("f")} onUp={() => handleKeyup("f")} />
          <ControlButton label="ACT" onDown={() => handleKeydown("e")} onUp={() => handleKeyup("e")} />
        </div>
      </div>
    </div>
  );
}

function ControlButton({ label, onDown, onUp }: { label: string, onDown: () => void, onUp: () => void }) {
    return (
        <button
            className="w-10 h-10 landscape:w-8 landscape:h-8 bg-black/60 backdrop-blur-lg border border-white/20 rounded-xl flex items-center justify-center text-white font-black text-[9px] shadow-2xl active:bg-white/30 active:scale-90 transition-all uppercase tracking-tighter"
            onTouchStart={(e) => { e.preventDefault(); onDown(); }}
            onTouchEnd={(e) => { e.preventDefault(); onUp(); }}
            onMouseDown={(e) => { e.preventDefault(); onDown(); }}
            onMouseUp={(e) => { e.preventDefault(); onUp(); }}
        >
            {label}
        </button>
    );
}
