import React, { useEffect, useRef, useState } from "react";
import { Hand, Navigation, Car, DollarSign } from "lucide-react";

export function Joypad() {
  const [isTouch, setIsTouch] = useState(false);
  const [joystick, setJoystick] = useState({ active: false, x: 0, y: 0 });

  const joyRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0 || window.innerWidth < 768) {
       setIsTouch(true);
    }
    const handleTouch = () => setIsTouch(true);
    window.addEventListener("touchstart", handleTouch, { once: true });
    return () => window.removeEventListener("touchstart", handleTouch);
  }, []);

  if (!isTouch) return null;

  const fireKey = (key: string, type: "keydown" | "keyup") => {
    window.dispatchEvent(new KeyboardEvent(type, { key }));
  };

  // Circular analog joystick handlers
  const handleJoystickStart = (clientX: number, clientY: number) => {
    if (!joyRef.current) return;
    const rect = joyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.min(Math.hypot(dx, dy), 40);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;
    setJoystick({ active: true, x: nx, y: ny });
    updateDirection(nx, ny);
  };

  const handleJoystickMove = (clientX: number, clientY: number) => {
    if (!joyRef.current || !joystick.active) return;
    const rect = joyRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.min(Math.hypot(dx, dy), 40);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;
    setJoystick({ active: true, x: nx, y: ny });
    updateDirection(nx, ny);
  };

  const handleJoystickEnd = () => {
    setJoystick({ active: false, x: 0, y: 0 });
    // release all directions
    ["w","a","s","d"].forEach(k => fireKey(k, "keyup"));
  };

  const updateDirection = (x: number, y: number) => {
    const threshold = 12;
    const up = y < -threshold;
    const down = y > threshold;
    const left = x < -threshold;
    const right = x > threshold;

    // fire current state
    fireKey("w", up ? "keydown" : "keyup");
    fireKey("s", down ? "keydown" : "keyup");
    fireKey("a", left ? "keydown" : "keyup");
    fireKey("d", right ? "keydown" : "keyup");
  };

  return (
    <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end pointer-events-none z-10" style={{ touchAction: 'none' }}>
      {/* CIRCULAR ANALOG JOYSTICK */}
      <div
        ref={joyRef}
        className="w-28 h-28 rounded-full border-4 border-slate-700 bg-slate-900/60 backdrop-blur pointer-events-auto relative select-none touch-none"
        onPointerDown={(e) => { e.preventDefault(); handleJoystickStart(e.clientX, e.clientY); }}
        onPointerMove={(e) => { e.preventDefault(); handleJoystickMove(e.clientX, e.clientY); }}
        onPointerUp={handleJoystickEnd}
        onPointerLeave={handleJoystickEnd}
        onPointerCancel={handleJoystickEnd}
      >
        <div
          ref={knobRef}
          className="absolute w-10 h-10 rounded-full bg-white/90 shadow-xl border border-slate-400 transition-transform"
          style={{
            left: `calc(50% + ${joystick.x}px - 20px)`,
            top: `calc(50% + ${joystick.y}px - 20px)`,
            transform: joystick.active ? 'scale(0.95)' : 'scale(1)'
          }}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pointer-events-auto mb-2 items-end">
        <div className="flex gap-4">
           {/* Rob Bank */}
           <PadButton 
              className="w-12 h-12 rounded-full bg-red-600/50" 
              icon={DollarSign} 
              onDown={() => fireKey("h", "keydown")} 
              onUp={() => fireKey("h", "keyup")} 
           />
           {/* Sprint */}
           <PadButton 
              className="w-12 h-12 rounded-full bg-slate-600/50" 
              icon={Navigation} 
              onDown={() => fireKey("Shift", "keydown")} 
              onUp={() => fireKey("Shift", "keyup")} 
           />
        </div>
        <div className="flex gap-4 mt-2">
           {/* Enter/Exit Vehicle */}
           <PadButton 
              className="w-16 h-16 rounded-full bg-blue-600/50" 
              icon={Car} 
              onDown={() => fireKey("f", "keydown")} 
              onUp={() => fireKey("f", "keyup")} 
           />
           {/* Interact */}
           <PadButton 
              className="w-16 h-16 rounded-full bg-green-600/50" 
              icon={Hand} 
              onDown={() => fireKey("e", "keydown")} 
              onUp={() => fireKey("e", "keyup")} 
           />
        </div>
      </div>
    </div>
  );
}

function PadButton({ icon: Icon, onDown, onUp, className = "w-12 h-12 rounded-lg" }: { icon: any, onDown: ()=>void, onUp: ()=>void, className?: string }) {
  return (
    <button 
      onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onDown(); }}
      onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); onUp(); }}
      onPointerLeave={(e) => { e.preventDefault(); e.stopPropagation(); onUp(); }}
      onContextMenu={e => e.preventDefault()}
      className={`bg-slate-900/70 backdrop-blur-sm border border-slate-600 text-white shadow-xl flex items-center justify-center active:bg-slate-700 active:scale-95 transition-all outline-none touch-none select-none ${className}`}
    >
      <Icon className="w-6 h-6 text-slate-300" />
    </button>
  )
}
