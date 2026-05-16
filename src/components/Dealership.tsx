import React from "react";
import { useGameStore } from "../store/useGameStore";
import { rtdb } from "../firebase";
import { ref, update, push, set } from "firebase/database";
import { Tractor, X, Truck } from "lucide-react";

const VEHICLES_FOR_SALE = [
  { id: "rickshaw", label: "Desi Rickshaw", type: "bike", brand: "Local", price: 500, color: "#dc2626" },
  { id: "compact", label: "Utility Car (Lada)", type: "sedan", brand: "Yanmar", price: 3000, color: "#166534" },
  { id: "pickup", label: "Desi Pickup", type: "truck", brand: "Fordson", price: 8000, color: "#1e40af" },
  { id: "tractor", label: "Lal-Sada Tractor", type: "tractor", brand: "John Deere", price: 15000, color: "#15803d" },
  { id: "hauler", label: "Village Bus", type: "suv", brand: "CAT", price: 22000, color: "#eab308" }
];

export function Dealership() {
  const { showDealership, setShowDealership, gameState, myId, roomId } = useGameStore();

  const [error, setError] = React.useState<string | null>(null);

  if (!showDealership || !gameState || !myId || !roomId) return null;
  const p = gameState.players[myId];
  if (!p) return null;

  const handleBuy = async (car: any) => {
    if (p.money < car.price) {
      setError("Taka kom! Age boro kuro phosol bikri korun.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newCarId = "veh_" + Date.now();
    const updates: any = {};
    updates[`rooms/${roomId}/gameState/players/${myId}/money`] = p.money - car.price;
    // Spawn vehicle near Equipment Dealer (4000, 4000)
    updates[`rooms/${roomId}/gameState/vehicles/${newCarId}`] = {
      id: newCarId,
      x: 4000 + Math.random() * 100 - 50,
      y: 4350,
      speed: 0,
      fuel: 100,
      health: 100,
      ownerId: myId,
      purchasedBy: myId,
      carType: car.type,
      brand: car.brand,
      angle: 0
    };

    await update(ref(rtdb), updates);
    setShowDealership(false);
    
    // Announce
    const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
    set(msgRef, { id: Date.now(), sender: "System", text: `${p.name} just bought a new ${car.label}!`, channel: "global", system: true });
  };

  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative pointer-events-auto text-white">
        <button onClick={() => setShowDealership(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-lime-500 via-green-600 to-emerald-700" />
        <h2 className="text-3xl font-black mb-1 flex items-center gap-3 italic tracking-tighter uppercase leading-none">
          KRISHI SEBA <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-400 to-emerald-400">EQUIPMENT SHOP</span>
        </h2>
        <p className="text-[10px] font-black text-lime-500 uppercase tracking-[0.3em] mb-6">Authorize Dealer of Village Implements</p>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold p-3 rounded-xl mb-4 animate-pulse">
            {error}
          </div>
        )}

        <p className="text-slate-400 mb-6 font-medium">Nagad Taka: <span className="text-lime-400 font-bold">${p.money.toLocaleString()}</span></p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VEHICLES_FOR_SALE.map(car => (
            <div key={car.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col items-center group hover:border-lime-500 transition-colors">
              <div className="w-full h-24 mb-4 rounded bg-slate-900 flex items-center justify-center relative overflow-hidden">
                <div style={{ backgroundColor: car.color }} className="w-20 h-10 rounded-lg shadow-lg relative">
                  <div className="absolute inset-x-2 top-2 h-4 bg-slate-900 rounded-sm opacity-50"></div>
                </div>
              </div>
              <h3 className="text-lg font-bold w-full">{car.brand} {car.label}</h3>
              <div className="flex justify-between items-center w-full mt-2">
                <span className="text-xl font-bold font-mono text-lime-400">${car.price.toLocaleString()}</span>
                <button 
                  onClick={() => handleBuy(car)}
                  disabled={p.money < car.price}
                  className={`px-4 py-2 rounded font-bold ${p.money >= car.price ? 'bg-lime-500 hover:bg-lime-400 text-slate-900' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                >
                  Purchase
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
