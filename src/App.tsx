import React, { useEffect, useState } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { HUD } from "./components/HUD";
import { LoginScreen } from "./components/LoginScreen";
import { RoomListScreen } from "./components/RoomListScreen";
import { Dealership } from "./components/Dealership";
import { MainMenu } from "./components/MainMenu";
import { CharacterSelect } from "./components/CharacterSelect";
import { useGameStore } from "./store/useGameStore";
import { rtdb } from "./firebase";
import { ref, onValue, set, get, update } from "firebase/database";

export default function App() {
  const currentScreen = useGameStore(s => s.currentScreen);
  const playerName = useGameStore(s => s.playerName);
  const roomId = useGameStore(s => s.roomId);
  const updateGameState = useGameStore(s => s.updateGameState);
  const setPing = useGameStore(s => s.setPing);

  // Force landscape on Android/mobile
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch {}
    };
    lockLandscape();
  }, []);

  // Ping heartbeat
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(async () => {
       const start = Date.now();
       try {
          await get(ref(rtdb, ".info/serverTimeOffset")); // Quickest check
          setPing(Date.now() - start);
       } catch (e) {
          console.error("Ping error", e);
       }
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, setPing]);

  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => {
       const now = new Date();
       const minutes = now.getMinutes() + now.getHours() * 60;
       // Scale minutes to a 0-2400 range for the game clock
       const gameTime = Math.floor((minutes / 1440) * 2400); 
       useGameStore.getState().setWorldTime(gameTime);
    }, 10000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Sync user persistence
  useEffect(() => {
    if (!playerName || currentScreen === "login") return;
    const userRef = ref(rtdb, `users/${playerName}`);
    update(userRef, { lastActive: Date.now() });
    
    const interval = setInterval(() => {
        update(userRef, { lastActive: Date.now() });
    }, 60000); // Pulse every minute
    
    return () => clearInterval(interval);
  }, [playerName, currentScreen]);

  // Sync game state from Firebase
  useEffect(() => {
    if (!roomId) return;

    const gameStateRef = ref(rtdb, `rooms/${roomId}/gameState`);
    const unsub = onValue(gameStateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        updateGameState({
          players: data.players || {},
          vehicles: data.vehicles || {},
          timeOfDay: 12,
          weather: data.weather || "clear",
        });
      }
    });

    return () => unsub();
  }, [roomId, updateGameState]);

  // Vehicle Respawn/Repair logic (Auto-repair damaged cars after 2 mins idle)
  useEffect(() => {
    if (!roomId) return;
    
    const interval = setInterval(() => {
       const gameState = useGameStore.getState().gameState;
       if (!gameState || !gameState.vehicles) return;
       
       const now = Date.now();
       const repairs: any = {};
       
       Object.values(gameState.vehicles).forEach((v: any) => {
          // If vehicle is damaged and hasn't been used for 2 minutes (120000ms)
          // AND it's not currently being driven (ownerId is null)
          const lastUsed = v.lastInteractionTime || 0;
          const isIdleLongEnough = (now - lastUsed) > 120000;
          const isDamaged = v.health < 100;
          const needsRespawn = v.originX !== undefined && v.originY !== undefined && (Math.abs(v.x - v.originX) > 100 || Math.abs(v.y - v.originY) > 100);

          if (!v.ownerId && isIdleLongEnough && (isDamaged || needsRespawn)) {
             repairs[`rooms/${roomId}/gameState/vehicles/${v.id}/health`] = 100;
             repairs[`rooms/${roomId}/gameState/vehicles/${v.id}/fuel`] = 100;
             if (v.originX !== undefined) repairs[`rooms/${roomId}/gameState/vehicles/${v.id}/x`] = v.originX;
             if (v.originY !== undefined) repairs[`rooms/${roomId}/gameState/vehicles/${v.id}/y`] = v.originY;
             repairs[`rooms/${roomId}/gameState/vehicles/${v.id}/speed`] = 0;
             repairs[`rooms/${roomId}/gameState/vehicles/${v.id}/lastInteractionTime`] = now;
          }
       });

       if (Object.keys(repairs).length > 0) {
          update(ref(rtdb), repairs);
       }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [roomId]);

  // Persistent data auto-save (every 30 seconds)
  useEffect(() => {
    if (!roomId || !playerName) return;

    const interval = setInterval(async () => {
       const myId = useGameStore.getState().myId;
       const gameState = useGameStore.getState().gameState;
       if (myId && playerName && gameState?.players[myId]) {
          const me = gameState.players[myId];
          const userRef = ref(rtdb, `users/${playerName}`);
          await update(userRef, {
             money: me.money,
             bank: me.bank,
             inventory: me.inventory || { fish: 0 },
             ownedProperties: me.ownedProperties || [],
             lastActive: Date.now()
          });
       }
    }, 30000);

    return () => clearInterval(interval);
  }, [roomId, playerName]);

  // Initial Vehicles setup (only first time if missing)
  useEffect(() => {
    if (!roomId) return;
    const vRef = ref(rtdb, `rooms/${roomId}/gameState/vehicles`);
    const unsub = onValue(vRef, (snap) => {
      if (!snap.exists()) {
          const initialVehicles = {
          "car_1": { id: "car_1", x: 2600, y: 1600, originX: 2600, originY: 1600, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "sedan", brand: "Lada", angle: 0 },
          "car_2": { id: "car_2", x: 3200, y: 1800, originX: 3200, originY: 1800, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "truck", brand: "Fordson", angle: 0 },
          "car_3": { id: "car_3", x: 4500, y: 3000, originX: 4500, originY: 3000, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "truck", brand: "Toyota", angle: 0 },
          "car_4": { id: "car_4", x: 2000, y: 3000, originX: 2000, originY: 3000, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "sedan", brand: "Fiat", angle: 0 },
          "bike_1": { id: "bike_1", x: 2800, y: 1600, originX: 2800, originY: 1600, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "bike", brand: "Hero", angle: 0 },
          "bike_2": { id: "bike_2", x: 2900, y: 1600, originX: 2900, originY: 1600, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "bike", brand: "Bajaj", angle: 0 },
          "ranger_1": { id: "ranger_1", x: 2750, y: 900, originX: 2750, originY: 900, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "police", brand: "Ranger", angle: 0 },
          "ranger_2": { id: "ranger_2", x: 2850, y: 900, originX: 2850, originY: 900, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "police", brand: "Ranger", angle: 0 },
          "bus_1": { id: "bus_1", x: 3600, y: 1900, originX: 3600, originY: 1900, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "truck", brand: "VillageBus", angle: 0 },
          "tractor_1": { id: "tractor_1", x: 1250, y: 8000, originX: 1250, originY: 8000, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "tractor", brand: "JohnDeere", angle: 0 },
          "tractor_2": { id: "tractor_2", x: 1400, y: 1100, originX: 1400, originY: 1100, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "tractor", brand: "MassyFerg", angle: 0 },
          "tractor_3": { id: "tractor_3", x: 8000, y: 4800, originX: 8000, originY: 4800, speed: 0, fuel: 100, health: 100, ownerId: null, carType: "tractor", brand: "NewHolland", angle: 0 },
        };
        set(vRef, initialVehicles);
      }
    }, { onlyOnce: true });
    return () => unsub();
  }, [roomId]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black text-slate-900 font-sans selection:bg-blue-200">
      {currentScreen === "menu" ? (
        <MainMenu />
      ) : currentScreen === "login" ? (
        <LoginScreen />
      ) : currentScreen === "character" ? (
        <CharacterSelect />
      ) : currentScreen === "lobby" ? (
        <RoomListScreen />
      ) : (
        <>
          <GameCanvas />
          <HUD />
          <Dealership />
        </>
      )}
    </div>
  );
}

