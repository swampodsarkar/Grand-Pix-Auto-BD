import React, { useEffect, useRef } from "react";
import { useGameStore, GameState } from "../store/useGameStore";
import { rtdb } from "../firebase";
import { ref, update, get, set, child, push } from "firebase/database";
import { MAP_BUILDINGS, ROADS, MAP_SIZE, TREES } from "./MapData";

// Helper to shade colors
function shadeColor(color: string, percent: number) {
    let R = parseInt(color.substring(1,3), 16);
    let G = parseInt(color.substring(3,5), 16);
    let B = parseInt(color.substring(5,7), 16);

    R = Math.floor(R * (100 + percent) / 100);
    G = Math.floor(G * (100 + percent) / 100);
    B = Math.floor(B * (100 + percent) / 100);

    R = R < 255 ? R : 255;  
    G = G < 255 ? G : 255;  
    B = B < 255 ? B : 255;  
    R = R > 0 ? R : 0;
    G = G > 0 ? G : 0;
    B = B > 0 ? B : 0;

    const RR = R.toString(16).length === 1 ? "0" + R.toString(16) : R.toString(16);
    const GG = G.toString(16).length === 1 ? "0" + G.toString(16) : G.toString(16);
    const BB = B.toString(16).length === 1 ? "0" + B.toString(16) : B.toString(16);

    return "#"+RR+GG+BB;
}

let lastInputState = { up: false, down: false, left: false, right: false, sprint: false };

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { addMessage } = useGameStore();

  useEffect(() => {
    // Input handlers
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === "w" || key === "arrowup") lastInputState.up = true;
      if (key === "s" || key === "arrowdown") lastInputState.down = true;
      if (key === "a" || key === "arrowleft") lastInputState.left = true;
      if (key === "d" || key === "arrowright") lastInputState.right = true;
      if (key === "shift") lastInputState.sprint = true;

      const myId = useGameStore.getState().myId;
      if (!myId) return;

      // Single action keys
      if (key === "e") handleAction("interact", myId);
      if (key === "f") handleAction("vehicle", myId);
      if (key === "h") handleAction("heist", myId);
      if (key === "m") useGameStore.getState().setShowFullMap(!useGameStore.getState().showFullMap);
      if (key === "p") useGameStore.getState().togglePhoneState("home");
      if (key === "t") {
        const input = document.querySelector('input[placeholder*="chat"]') as HTMLInputElement;
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || key === "arrowup") lastInputState.up = false;
      if (key === "s" || key === "arrowdown") lastInputState.down = false;
      if (key === "a" || key === "arrowleft") lastInputState.left = false;
      if (key === "d" || key === "arrowright") lastInputState.right = false;
      if (key === "shift") lastInputState.sprint = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Input loop - physics evaluation (throttled for mobile)
    let lastFirebaseUpdate = 0;
    const inputInterval = setInterval(() => {
      const state = useGameStore.getState().gameState;
      const myId = useGameStore.getState().myId;
      const roomId = useGameStore.getState().roomId;
      if (!state || !myId || !roomId) return;

      const p = state.players[myId];
      if (!p) return;

      const updates: any = {};
      const input = lastInputState;

      const getCollidingBuilding = (x: number, y: number, radius: number) => {
        for (const b of MAP_BUILDINGS) {
          if (x + radius > b.x && x - radius < b.x + b.w &&
              y + radius > b.y && y - radius < b.y + b.h) {
            return b;
          }
        }
        return null;
      };

      const getCollidingVehicle = (x: number, y: number, radius: number, ignoreVehicleId: string | null) => {
        const vehicles = state.vehicles || {};
        for (const vKey in vehicles) {
          const v = vehicles[vKey];
          if (v.id === ignoreVehicleId) continue;
          if (Math.hypot(x - v.x, y - v.y) < radius + 40) return v;
        }
        return null;
      };

      if (p.inVehicleId) {
        const v = state.vehicles[p.inVehicleId];
        const MAX_SPEED = 18;
        const MAX_REVERSE = -6;
        const ACCEL = 0.5;
        const BRAKE = 1.0;
        const FRICTION = 0.2;

        if (v) {
          let newSpeed = v.speed;
          let newAngle = v.angle;
          let newFuel = v.fuel;
          let newHealth = v.health;

          if (v.health > 0 && v.fuel > 0) {
            if (input.up) {
              newSpeed += ACCEL;
            } else if (input.down) {
              if (newSpeed > 0) newSpeed -= BRAKE;
              else newSpeed -= ACCEL;
            } else {
              if (newSpeed > 0) newSpeed = Math.max(0, newSpeed - FRICTION);
              else if (newSpeed < 0) newSpeed = Math.min(0, newSpeed + FRICTION);
            }
            
            newSpeed = Math.max(MAX_REVERSE, Math.min(MAX_SPEED, newSpeed));

            if (input.left && Math.abs(newSpeed) > 0.5) newAngle -= 0.05 * Math.sign(newSpeed);
            if (input.right && Math.abs(newSpeed) > 0.5) newAngle += 0.05 * Math.sign(newSpeed);
            
            // Fuel is now unlimited, so we don't decrement it.
            // if (Math.abs(newSpeed) > 0.1) {
            //   newFuel = Math.max(0, newFuel - 0.015 * Math.abs(newSpeed));
            // }
            newFuel = 100; // Keep it full
          } else {
            // Coasting if broken or out of fuel
            if (newSpeed > 0) newSpeed = Math.max(0, newSpeed - FRICTION * 2);
            else if (newSpeed < 0) newSpeed = Math.min(0, newSpeed + FRICTION * 2);
          }

          let nextX = v.x + Math.cos(newAngle) * newSpeed;
          let nextY = v.y + Math.sin(newAngle) * newSpeed;

          let playerHealthLoss = 0;
          
          let bX = getCollidingBuilding(nextX, v.y, 35);
          let vX = getCollidingVehicle(nextX, v.y, 35, p.inVehicleId);
          if (bX || vX) {
             nextX = v.x;
             const impactDamage = Math.max(0, Math.floor(Math.abs(newSpeed) * 1.5));
             newSpeed *= -0.4;
             newHealth = Math.max(0, newHealth - impactDamage);
             playerHealthLoss += Math.floor(impactDamage / 2);
          }
          let bY = getCollidingBuilding(nextX, nextY, 35);
          let vY = getCollidingVehicle(nextX, nextY, 35, p.inVehicleId);
          if (bY || vY) {
             nextY = v.y;
             const impactDamage = Math.max(0, Math.floor(Math.abs(newSpeed) * 1.5));
             newSpeed *= -0.4;
             if (!bX && !vX) {
                newHealth = Math.max(0, newHealth - impactDamage);
                playerHealthLoss += Math.floor(impactDamage / 2);
             }
          }

          if (nextX <= 0 || nextX >= MAP_SIZE) { newSpeed *= -0.5; newHealth -= 5; playerHealthLoss += 2; nextX = Math.max(0, Math.min(MAP_SIZE, nextX)); }
          if (nextY <= 0 || nextY >= MAP_SIZE) { newSpeed *= -0.5; newHealth -= 5; playerHealthLoss += 2; nextY = Math.max(0, Math.min(MAP_SIZE, nextY)); }

          if (playerHealthLoss > 0) {
             const currentPHealth = p.health || 100;
             const finalHealth = Math.max(0, currentPHealth - playerHealthLoss);
             updates[`rooms/${roomId}/gameState/players/${myId}/health`] = finalHealth;
             if (finalHealth === 0) { // Die
                updates[`rooms/${roomId}/gameState/players/${myId}/health`] = 100;
                updates[`rooms/${roomId}/gameState/players/${myId}/money`] = Math.max(0, p.money - 500); // Hospital fee
                updates[`rooms/${roomId}/gameState/players/${myId}/x`] = 2350; // Outside hospital
                updates[`rooms/${roomId}/gameState/players/${myId}/y`] = 2480;
                updates[`rooms/${roomId}/gameState/players/${myId}/inVehicleId`] = null;
                updates[`rooms/${roomId}/gameState/vehicles/${v.id}/ownerId`] = null;
             }
          }

          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/x`] = nextX;
          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/y`] = nextY;
          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/speed`] = newSpeed;
          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/angle`] = newAngle;
          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/fuel`] = newFuel;
          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/health`] = newHealth;
          updates[`rooms/${roomId}/gameState/vehicles/${v.id}/lastInteractionTime`] = Date.now();

          updates[`rooms/${roomId}/gameState/players/${myId}/x`] = nextX;
          updates[`rooms/${roomId}/gameState/players/${myId}/y`] = nextY;
          updates[`rooms/${roomId}/gameState/players/${myId}/speed`] = Math.abs(newSpeed);
        }
      } else {
        const speed = input.sprint && p.stamina > 0 ? 8 : 4;
        let dx = 0;
        let dy = 0;

        if (input.up) dy -= speed;
        if (input.down) dy += speed;
        if (input.left) dx -= speed;
        if (input.right) dx += speed;

        let nextX = Math.max(0, Math.min(MAP_SIZE, p.x + dx));
        let bX = getCollidingBuilding(nextX, p.y, 20);
        let vX = getCollidingVehicle(nextX, p.y, 20, null);
        if (bX || vX) nextX = p.x;

        let nextY = Math.max(0, Math.min(MAP_SIZE, p.y + dy));
        let bY = getCollidingBuilding(nextX, nextY, 20);
        let vY = getCollidingVehicle(nextX, nextY, 20, null);
        if (bY || vY) nextY = p.y;

        let newStamina = p.stamina;
        if (input.sprint && (dx !== 0 || dy !== 0)) {
          newStamina = Math.max(0, newStamina - 1);
        } else if (!input.sprint) {
          newStamina = Math.min(100, newStamina + 0.5);
        }

        let newFacing = p.facing;
        if (dx > 0) newFacing = "right";
        else if (dx < 0) newFacing = "left";
        else if (dy > 0) newFacing = "down";
        else if (dy < 0) newFacing = "up";
        
        updates[`rooms/${roomId}/gameState/players/${myId}/x`] = nextX;
        updates[`rooms/${roomId}/gameState/players/${myId}/y`] = nextY;
        updates[`rooms/${roomId}/gameState/players/${myId}/stamina`] = newStamina;
        updates[`rooms/${roomId}/gameState/players/${myId}/facing`] = newFacing;
        updates[`rooms/${roomId}/gameState/players/${myId}/speed`] = Math.abs(dx) + Math.abs(dy);
      }

      if (Object.keys(updates).length > 0) {
        // Only update if something actually changed significantly (throttling tiny jitter)
        const hasSignificantChange = Object.keys(updates).some(key => {
           if (key.endsWith("/x") || key.endsWith("/y")) {
              const parts = key.split("/");
              const id = parts[parts.length - 2];
              const type = parts[parts.length - 3];
              const existingVal = type === "players" ? state.players[id]?.[parts[parts.length-1] as "x"|"y"] : state.vehicles[id]?.[parts[parts.length-1] as "x"|"y"];
              return existingVal === undefined || Math.abs(updates[key] - existingVal) > 0.1;
           }
           return true; 
        });

        const now = Date.now();
        if (hasSignificantChange && now - lastFirebaseUpdate > 80) { // ~12.5 updates/sec max (mobile friendly)
            lastFirebaseUpdate = now;
            update(ref(rtdb), updates);
         }
      }
    }, 32); // ~30fps logic loop

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearInterval(inputInterval);
    };
  }, []);

  const handleAction = async (type: string, myId: string) => {
    const state = useGameStore.getState().gameState;
    const roomId = useGameStore.getState().roomId;
    if (!state || !roomId) return;
    const p = state.players[myId];
    if (!p) return;

    if (type === "vehicle") {
      if (p.inVehicleId) {
        const v = state.vehicles[p.inVehicleId];
        // Get out of car
        const updatesForCar: any = {
          [`rooms/${roomId}/gameState/players/${myId}/inVehicleId`]: null,
          [`rooms/${roomId}/gameState/players/${myId}/x`]: p.x + 60,
          [`rooms/${roomId}/gameState/players/${myId}/y`]: p.y + 60
        };
        if (!v.purchasedBy) {
          updatesForCar[`rooms/${roomId}/gameState/vehicles/${p.inVehicleId}/ownerId`] = null;
        } else {
          updatesForCar[`rooms/${roomId}/gameState/vehicles/${p.inVehicleId}/ownerId`] = v.purchasedBy;
        }
        update(ref(rtdb), updatesForCar);

        // Stop car music
        if ((window as any).__carMusic) {
          (window as any).__carMusic.pause();
        }
        return; // Exited car, stop processing
        } else {
          // Play car music
          if (!(window as any).__carMusic) {
            const musicUrl = new URL('../../assets/music.mp3', import.meta.url).href;
            (window as any).__carMusic = new Audio(musicUrl);
            (window as any).__carMusic.loop = true;
            (window as any).__carMusic.volume = 0.5;
          }
          (window as any).__carMusic.play().catch(() => {});

          // Priority 1: Enter nearby car
          let closest: any = null;
          let minDist = 150; // Distance to enter
        const vehicles = state.vehicles || {};
        for (const vKey in vehicles) {
          const v = vehicles[vKey];
          const dist = Math.hypot(p.x - v.x, p.y - v.y);
          if (dist < minDist) { // Removed strict ownership lock to allow stealing cars
            closest = v;
            minDist = dist;
          }
        }
        if (closest) {
          const newUpdates: any = {
            [`rooms/${roomId}/gameState/players/${myId}/inVehicleId`]: closest.id,
            [`rooms/${roomId}/gameState/vehicles/${closest.id}/ownerId`]: myId
          };
          
          // Kick out existing driver if there is one
          Object.values(state.players).forEach((otherP: any) => {
            if (otherP.inVehicleId === closest.id && otherP.id !== myId) {
               newUpdates[`rooms/${roomId}/gameState/players/${otherP.id}/inVehicleId`] = null;
               newUpdates[`rooms/${roomId}/gameState/players/${otherP.id}/x`] = closest.x + 60;
               newUpdates[`rooms/${roomId}/gameState/players/${otherP.id}/y`] = closest.y + 60;
            }
          });

          update(ref(rtdb), newUpdates);
          return; // Entered car, stop processing
        }
      }
    }

    if (type === "interact") {
      if (p.inVehicleId) {
        const v = state.vehicles[p.inVehicleId];
        const nearGasStation = MAP_BUILDINGS.some(b => b.label === "Gas" && Math.hypot(b.x + b.w/2 - p.x, b.y + b.h/2 - p.y) < 300);
        
        if (nearGasStation && v && v.fuel < 100) {
          if (p.money >= 50) {
            update(ref(rtdb), {
              [`rooms/${roomId}/gameState/vehicles/${p.inVehicleId}/fuel`]: 100,
              [`rooms/${roomId}/gameState/players/${myId}/money`]: p.money - 50
            });
            return;
          }
        }
      }

      // Helper to match building
      const getBuilding = (labelMatch: string) => {
         return MAP_BUILDINGS.find(b => b.label.includes(labelMatch));
      }

      // Priority 2: Building Interactions
      // 1. Hospital Healing check
      const clinic = getBuilding("Clinic");
      const distToHospital = clinic ? Math.hypot(clinic.x + clinic.w/2 - p.x, clinic.y + clinic.h/2 - p.y) : Infinity;
      if (distToHospital < 200) {
         if (p.health < 100) {
            if (p.money >= 100) {
               update(ref(rtdb), {
                  [`rooms/${roomId}/gameState/players/${myId}/health`]: 100,
                  [`rooms/${roomId}/gameState/players/${myId}/money`]: p.money - 100
               });
               const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
               set(msgRef, { id: Date.now(), sender: "Hospital", text: `${p.name} was fully healed for $100.`, channel: "global", system: true });
            } else {
               const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
               set(msgRef, { id: Date.now(), sender: "Hospital", text: "You need $100 to get healed!", channel: "global", system: true });
            }
         }
         return;
      }

      // 2. Fishing Logic
      // Check Pukur (Fishing) area
      const pukur = getBuilding("Fishing Pond");
      const isNearLake = p.x > 22000 && p.x < 26000;
      if ((isNearLake || (pukur && Math.hypot(pukur.x - p.x, pukur.y - p.y) < 500)) && !p.inVehicleId) {
          const store = useGameStore.getState();
          if (!store.fishingState) {
              store.setFishingState({
                  active: true,
                  progress: 0,
                  target: 40 + Math.random() * 60,
                  startedAt: Date.now()
              });
          }
          return;
      }

      // 3. Market Sell (Gramer Haat)
      const haat = getBuilding("Market");
      const distToMarket = haat ? Math.hypot(haat.x + haat.w/2 - p.x, haat.y + haat.h/2 - p.y) : Infinity;
      if (distToMarket < 200 && !p.inVehicleId) {
          const fishCount = p.inventory?.fish || 0;
          const potatoCount = p.inventory?.potato || 0;
          const wheatCount = p.inventory?.wheat || 0;
          const cornCount = p.inventory?.corn || 0;
          const dhanCount = p.inventory?.dhan || 0;
          const milkCount = p.inventory?.milk || 0;
          
          if (fishCount > 0 || potatoCount > 0 || wheatCount > 0 || cornCount > 0 || dhanCount > 0 || milkCount > 0) {
              const fishEarnings = fishCount * 120;
              const potatoEarnings = potatoCount * 40;
              const wheatEarnings = wheatCount * 70;
              const cornEarnings = cornCount * 110;
              const dhanEarnings = dhanCount * 150;
              const milkEarnings = milkCount * 60;
              const totalEarnings = fishEarnings + potatoEarnings + wheatEarnings + cornEarnings + dhanEarnings + milkEarnings;
              
              update(ref(rtdb), {
                  [`rooms/${roomId}/gameState/players/${myId}/money`]: p.money + totalEarnings,
                  [`rooms/${roomId}/gameState/players/${myId}/inventory/fish`]: 0,
                  [`rooms/${roomId}/gameState/players/${myId}/inventory/potato`]: 0,
                  [`rooms/${roomId}/gameState/players/${myId}/inventory/wheat`]: 0,
                  [`rooms/${roomId}/gameState/players/${myId}/inventory/corn`]: 0,
                  [`rooms/${roomId}/gameState/players/${myId}/inventory/dhan`]: 0,
                  [`rooms/${roomId}/gameState/players/${myId}/inventory/milk`]: 0,
              });
              const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
              set(msgRef, { id: Date.now(), sender: "Haat", text: `💰 Bazar-e phosol bikri kore $${totalEarnings} pailen!`, channel: "global", system: true });
          } else {
              const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
              set(msgRef, { id: Date.now(), sender: "Haat", text: "Bikri korar moto kisu nai!", channel: "global", system: true });
          }
          return;
      }

      // 3.5 Tea Stall (Cha-er Dokan)
      const teaStall = getBuilding("Tea Stall");
      const distToTea = teaStall ? Math.hypot(teaStall.x + teaStall.w/2 - p.x, teaStall.y + teaStall.h/2 - p.y) : Infinity;
      if (distToTea < 150 && !p.inVehicleId) {
          const cost = 10;
          if (p.money >= cost) {
              update(ref(rtdb), {
                  [`rooms/${roomId}/gameState/players/${myId}/money`]: p.money - cost,
              });
              const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
              set(msgRef, { id: Date.now(), sender: "Tea Stall", text: "☕ Mofiz-er dokane ek cup cha khailen. Shanti!", channel: "global", system: true });
          } else {
             const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
             set(msgRef, { id: Date.now(), sender: "Tea Stall", text: "Taka nai, cha paben na!", channel: "global", system: true });
          }
          return;
      }

      // 4. Bhumi Registry Office
      const registry = getBuilding("Registry");
      const distToRegistry = registry ? Math.hypot(registry.x + registry.w/2 - p.x, registry.y + registry.h/2 - p.y) : Infinity;
      if (distToRegistry < 150 && !p.inVehicleId) {
          const plots = [
              { name: "Potato Field", cost: 4000 },
              { name: "Wheat Field", cost: 7000 },
              { name: "Corn Field", cost: 11000 },
              { name: "Rice Field", cost: 20000 },
              { name: "Fish Farm", cost: 35000 }
          ];
          
          const nextPlot = plots.find(plot => !p.ownedProperties?.includes(plot.name));
          
          if (nextPlot) {
              if (p.money >= nextPlot.cost) {
                  const newOwned = [...(p.ownedProperties || []), nextPlot.name];
                  update(ref(rtdb), {
                      [`rooms/${roomId}/gameState/players/${myId}/money`]: p.money - nextPlot.cost,
                      [`rooms/${roomId}/gameState/players/${myId}/ownedProperties`]: newOwned
                  });
                  const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                  set(msgRef, { id: Date.now(), sender: "Land Registry", text: `Congratulations! You bought ${nextPlot.name} for $${nextPlot.cost}.`, channel: "global", system: true });
              } else {
                  const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                  set(msgRef, { id: Date.now(), sender: "Land Registry", text: `You need $${nextPlot.cost} to buy ${nextPlot.name}. Earn more cash!`, channel: "global", system: true });
              }
          } else {
             const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
             set(msgRef, { id: Date.now(), sender: "Land Registry", text: "You have purchased all available fields!", channel: "global", system: true });
          }
          return;
      }

      // 5. Farming Logic (Requires Ownership)
      const farms = [
          { name: "Potato Field", key: "potato", b: getBuilding("Potato Field") },
          { name: "Corn Field", key: "corn", b: getBuilding("Corn Field") },
          { name: "Rice Field", key: "dhan", b: getBuilding("Rice Field") }
      ].map(f => f.b ? { ...f, x: f.b.x, y: f.b.y, w: f.b.w, h: f.b.h } : null).filter(f => f);

      for (const farm of farms) {
          if (!farm) continue;
          const distToFarm = Math.hypot(farm.x + farm.w/2 - p.x, farm.y + farm.h/2 - p.y);
          if (distToFarm < Math.max(farm.w, farm.h)/1.5 && !p.inVehicleId) {
              const isOwned = p.ownedProperties?.includes(farm.name);
              
              if (!isOwned) {
                  const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                  set(msgRef, { id: Date.now(), sender: "Registry", text: `Ei jomi apnar na! Age Bhumi Office theke ${farm.name} kinun.`, channel: "global", system: true });
                  return;
              }

              const farmKey = `isPlanting_${farm.key}`;
              const harvestKey = `harvestTime_${farm.key}`;
              const isGrowing = p.inventory?.[farmKey];
              
              if (isGrowing) {
                  const harvestTime = p.inventory?.[harvestKey] || 0;
                  if (Date.now() > harvestTime) {
                      const currentCount = (p.inventory?.[farm.key] || 0) + 10;
                      update(ref(rtdb), {
                          [`rooms/${roomId}/gameState/players/${myId}/inventory/${farm.key}`]: currentCount,
                          [`rooms/${roomId}/gameState/players/${myId}/inventory/${farmKey}`]: false
                      });
                      const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                      set(msgRef, { id: Date.now(), sender: "Khet", text: `🌾 ${farm.key} kata holo! You now have ${currentCount} mon.`, channel: "global", system: true });
                  } else {
                      const remaining = Math.ceil((harvestTime - Date.now()) / 1000);
                      const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                      set(msgRef, { id: Date.now(), sender: "Khet", text: `⏳ Ar ${remaining}s... ${farm.key} boro hocche.`, channel: "global", system: true });
                  }
              } else {
                  update(ref(rtdb), {
                      [`rooms/${roomId}/gameState/players/${myId}/inventory/${farmKey}`]: true,
                      [`rooms/${roomId}/gameState/players/${myId}/inventory/${harvestKey}`]: Date.now() + 20000 // 20 seconds growth
                  });
                  const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                  set(msgRef, { id: Date.now(), sender: "Khet", text: "🌱 Bij bopon holo. Valo phosol-er asha korlam.", channel: "global", system: true });
              }
              return;
          }
      }

      // Cow Milking Logic
      const cows = [
          { x: 700, y: 8300 }, { x: 600, y: 8400 },
          { x: 8300, y: 5200 }, { x: 8200, y: 5400 }
      ];
      for (const cow of cows) {
          const distToCow = Math.hypot(cow.x - p.x, cow.y - p.y);
          if (distToCow < 80 && !p.inVehicleId) {
              const lastMilkTime = p.inventory?.lastMilkTime || 0;
              if (Date.now() - lastMilkTime > 60000) { // Every 1 minute
                 const milkCount = (p.inventory?.milk || 0) + 1;
                 update(ref(rtdb), {
                    [`rooms/${roomId}/gameState/players/${myId}/inventory/milk`]: milkCount,
                    [`rooms/${roomId}/gameState/players/${myId}/inventory/lastMilkTime`]: Date.now()
                 });
                 const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                 set(msgRef, { id: Date.now(), sender: "Hambaaa", text: "🐄 Dudh doha holo! You collect 1 Mon milk.", channel: "global", system: true });
              } else {
                 const remaining = Math.ceil((60000 - (Date.now() - lastMilkTime)) / 1000);
                 const msgRef = push(ref(rtdb, `rooms/${roomId}/messages`));
                 set(msgRef, { id: Date.now(), sender: "Hambaaa", text: `🐄 Goru ekhon dudh dibe na. ${remaining}s opekkha korun.`, channel: "global", system: true });
              }
              return;
          }
      }

      // 6. Equipment Dealer check
      const dealer = getBuilding("Farming Shop");
      const distToDealer = dealer ? Math.hypot(dealer.x + dealer.w/2 - p.x, dealer.y + dealer.h/2 - p.y) : Infinity;
      if (distToDealer < 200 && !p.inVehicleId) {
         useGameStore.getState().setShowDealership(true);
         return;
      }


    }
  };

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false; // crisp HD look

    let animFrame: number;
    let camera = { x: 0, y: 0 };
    let tireMarks: Array<{x: number, y: number, a: number, angle: number, id: number}> = [];
    let markId = 0;
    let particles: Array<{x: number, y: number, vx: number, vy: number, life: number, size: number}> = [];

    const draw = () => {
      const { gameState: state, myId, graphicsQuality, worldTime } = useGameStore.getState();
      
      // HD / High DPI support
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = window.innerWidth;
      const displayHeight = window.innerHeight;
      
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        canvas.style.width = displayWidth + "px";
        canvas.style.height = displayHeight + "px";
        ctx.scale(dpr, dpr);
      }

      // Performance optimization
      const showShadows = graphicsQuality !== "low";
      const renderDist = graphicsQuality === "low" ? 1200 : graphicsQuality === "medium" ? 2200 : 3500;
      const maxParticles = graphicsQuality === "low" ? 80 : graphicsQuality === "medium" ? 150 : 300;
      
      // Draw Grid / Ground Textures
      const drawGrid = (size: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0; x<MAP_SIZE; x+=size) { ctx.moveTo(x, 0); ctx.lineTo(x, MAP_SIZE); }
        for(let y=0; y<MAP_SIZE; y+=size) { ctx.moveTo(0, y); ctx.lineTo(MAP_SIZE, y); }
        ctx.stroke();
      };
      
      ctx.fillStyle = "#166534"; // Dense Village Green
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
      
      // Draw Lake/Pond (Repositioned for larger map)
      ctx.fillStyle = "#0c4a6e"; 
      ctx.fillRect(10000, 10000, 3000, 4000);

      // Bamboo Bridge (Sako)
      ctx.fillStyle = "#d97706";
      ctx.fillRect(12800, 12000, 400, 80); 
      ctx.fillStyle = "#78350f";
      for (let i = 0; i < 8; i++) {
         ctx.fillRect(12800 + i * 50, 11990, 8, 100); // Rails
      }
      
      ctx.fillStyle = "#713f12"; // Muddy patches near center
      ctx.fillRect(14000, 14000, 2000, 2000); 
      
      // Grass Grid
      if (showShadows) {
          drawGrid(200, "rgba(0,0,0,0.03)");
      }

      // 3. Environment Details (Trees)
      const scale = 1; // Default scale since it's not defined
      const cameraX = camera.x;
      const cameraY = camera.y;

      TREES.forEach(tree => {
         // Only draw if on screen (optimization)
         if (tree.x > cameraX - 100 && tree.x < cameraX + canvas.width/scale + 100 &&
             tree.y > cameraY - 100 && tree.y < cameraY + canvas.height/scale + 100) {
            
            // Skip drawing if on a road
            const isOnRoad = ROADS.some(r => 
               tree.x > r.x - 20 && tree.x < r.x + r.w + 20 &&
               tree.y > r.y - 20 && tree.y < r.y + r.h + 20
            );
            if (isOnRoad) return;

             if (tree.type === 'banana') {
                // Detailed Banana Tree
                ctx.save();
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(tree.x + 6, tree.y + 10, 16, 7, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();

                // Trunk with detail
                ctx.fillStyle = "#5c4033";
                ctx.fillRect(tree.x - 3, tree.y - 18, 6, 28);
                ctx.fillStyle = "#3f2a1f";
                ctx.fillRect(tree.x - 1, tree.y - 16, 2, 24); // inner trunk

                // Layered leaves (more detailed)
                for(let i = 0; i < 6; i++) {
                   ctx.fillStyle = (i % 2 === 0) ? "#4ade80" : "#22c55e";
                   ctx.beginPath();
                   ctx.ellipse(tree.x, tree.y - 20 - i * 5, 16, 32, (i - 2.5) * 0.65, 0, Math.PI*2);
                   ctx.fill();
                   ctx.strokeStyle = "#166534";
                   ctx.lineWidth = 0.8;
                   ctx.stroke();
                }
              } else {
                // Detailed Mango Tree
                ctx.save();
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(tree.x + 7, tree.y + 12, 20, 9, 0, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();

                // Trunk with bark detail
                ctx.fillStyle = "#5c4033";
                ctx.fillRect(tree.x - 5, tree.y - 12, 10, 26);
                ctx.fillStyle = "#3f2a1f";
                ctx.fillRect(tree.x - 2, tree.y - 10, 4, 22);

                // Layered canopy (more realistic)
                ctx.fillStyle = "#064e3b";
                ctx.beginPath();
                ctx.arc(tree.x, tree.y - 22, 30, 0, Math.PI*2);
                ctx.fill();

                ctx.fillStyle = "#047857";
                ctx.beginPath();
                ctx.arc(tree.x + 3, tree.y - 28, 24, 0, Math.PI*2);
                ctx.fill();

                ctx.fillStyle = "#10b981";
                ctx.beginPath();
                ctx.arc(tree.x - 5, tree.y - 32, 16, 0, Math.PI*2);
                ctx.fill();

                // Small highlight dots (leaves)
                ctx.fillStyle = "#4ade80";
                ctx.beginPath();
                ctx.arc(tree.x + 8, tree.y - 25, 5, 0, Math.PI*2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tree.x - 7, tree.y - 30, 4, 0, Math.PI*2);
                ctx.fill();
             }
         }
      });

      // Football Field markings
      const field = MAP_BUILDINGS.find(b => b.id === "football_field");
      if (field) {
         ctx.strokeStyle = "rgba(255,255,255,0.5)";
         ctx.lineWidth = 4;
         ctx.strokeRect(field.x + 20, field.y + 20, field.w - 40, field.h - 40);
         ctx.beginPath();
         ctx.moveTo(field.x + field.w/2, field.y + 20);
         ctx.lineTo(field.x + field.w/2, field.y + field.h - 20);
         ctx.stroke();
         ctx.beginPath();
         ctx.arc(field.x + field.w/2, field.y + field.h/2, 80, 0, Math.PI*2);
         ctx.stroke();
      }
      
      // Draw Farms and Growing Crops
      const checkBuilding = (labelMatch: string) => {
         return MAP_BUILDINGS.find(b => b.label.includes(labelMatch));
      }
      
      const farmsContext = [
          { name: "Potato Field", key: "potato", color: "#d97706", b: checkBuilding("Potato Field") },
          { name: "Corn Field", key: "corn", color: "#facc15", b: checkBuilding("Corn Field") },
          { name: "Rice Field", key: "dhan", color: "#22c55e", b: checkBuilding("Rice Field") }
      ].map(f => f.b ? { ...f, x: f.b.x, y: f.b.y, w: f.b.w, h: f.b.h } : null).filter(f => f) as any[];

      if (state) {
        farmsContext.forEach(farm => {
           let isPlanting = false;
           let harvestTime = 0;
           let fullyGrown = false;
           let ownerName = "";
           
           for (const pid in state.players) {
               const op = state.players[pid];
               if (op.inventory?.[`isPlanting_${farm.key}`]) {
                   isPlanting = true;
                   harvestTime = op.inventory?.[`harvestTime_${farm.key}`] || 0;
                   fullyGrown = Date.now() >= harvestTime;
                   ownerName = op.name;
                   break;
               }
           }

           if (isPlanting) {
               // Draw crops in a grid
               const cols = farm.w / 40;
               const rows = farm.h / 40;
               ctx.fillStyle = fullyGrown ? farm.color : "#65a30d"; // Greenish if still growing
               
               for (let c = 0; c < cols; c++) {
                   for (let r = 0; r < rows; r++) {
                       const cx = farm.x + c * 40 + 20;
                       const cy = farm.y + r * 40 + 20;
                       
                       // Random sway based on time and position
                       const sway = Math.sin((Date.now() / 500) + cx + cy) * 5;
                       
                       const size = fullyGrown ? 15 : 8; // Larger if fully grown
                       
                       ctx.beginPath();
                       ctx.arc(cx + sway, cy, size, 0, Math.PI * 2);
                       ctx.fill();
                   }
               }
               
               // Progress bar if growing
               if (!fullyGrown) {
                   const totalGrowthTime = 20000;
                   const remaining = harvestTime - Date.now();
                   const progress = Math.max(0, Math.min(1, 1 - (remaining / totalGrowthTime)));
                   ctx.fillStyle = "#000";
                   ctx.fillRect(farm.x + farm.w/2 - 40, farm.y + farm.h/2 - 20, 80, 10);
                   ctx.fillStyle = "#3b82f6"; // Blue progress
                   ctx.fillRect(farm.x + farm.w/2 - 40, farm.y + farm.h/2 - 20, 80 * progress, 10);
               }
               
               ctx.fillStyle = "#ffffff";
               ctx.font = "bold 14px Inter, sans-serif";
               ctx.textAlign = "center";
               ctx.shadowColor = "rgba(0,0,0,0.8)";
               ctx.shadowBlur = 4;
               ctx.fillText(ownerName + "'s " + (fullyGrown ? "Ready!" : "Growing..."), farm.x + farm.w/2, farm.y + farm.h/2 + 10);
               ctx.shadowBlur = 0;
           }
        });
      }

      const nowTime = Date.now();
      for(let i=0; i<10; i++) {
          const cx = 500 + 200 + Math.sin(nowTime/2000 + i) * 150;
          const cy = 8200 + 150 + Math.cos(nowTime/2500 + i) * 100;
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = "#ef4444"; // Comb/Beak
          ctx.fillRect(cx+3, cy-3, 3, 3);
      }

      if (!state || !myId) {
        animFrame = requestAnimationFrame(draw);
        return;
      }

      const me = state.players[myId];
      if (me) {
        // Lerp camera (cinematic focus with target leading based on speed/direction)
        let targetCamX = me.x - canvas.width / 2;
        let targetCamY = me.y - canvas.height / 2;

        if (me.inVehicleId && state.vehicles[me.inVehicleId]) {
           const v = state.vehicles[me.inVehicleId];
           targetCamX += Math.cos(v.angle) * (v.speed * 15);
           targetCamY += Math.sin(v.angle) * (v.speed * 15);
        }

        camera.x += (targetCamX - camera.x) * 0.12;
        camera.y += (targetCamY - camera.y) * 0.12;
      }

      ctx.save();
      ctx.translate(-camera.x, -camera.y);

      // Interpolation logic goes here theoretically, but we'll snap for now to save complexity
      
      // Draw roads (Paka vs Kacha)
      ROADS.forEach(r => {
         if (r.type === 'paka') {
            // Main Asphalt
            ctx.fillStyle = "#1e293b"; 
            ctx.fillRect(r.x, r.y, r.w, r.h);
            
            ctx.save();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = 4;
            ctx.setLineDash([20, 20]);
            if (r.w > r.h) { // Horizontal
               ctx.beginPath();
               ctx.moveTo(r.x, r.y + r.h / 2);
               ctx.lineTo(r.x + r.w, r.y + r.h / 2);
               ctx.stroke();
            } else { // Vertical
               ctx.beginPath();
               ctx.moveTo(r.x + r.w / 2, r.y);
               ctx.lineTo(r.x + r.w / 2, r.y + r.h);
               ctx.stroke();
            }
            ctx.restore();
            
            // Sidewalks
            ctx.fillStyle = "#4a5568";
            if (r.w > r.h) {
              ctx.fillRect(r.x, r.y, r.w, 15);
              ctx.fillRect(r.x, r.y + r.h - 15, r.w, 15);
            } else {
              ctx.fillRect(r.x, r.y, 15, r.h);
              ctx.fillRect(r.x + r.w - 15, r.y, 15, r.h);
            }
         } else {
            // Dirt Road (Kacha)
            ctx.fillStyle = "#713f12"; // Muddy brown
            ctx.fillRect(r.x, r.y, r.w, r.h);
            
            // Add some "mud" texture
            ctx.fillStyle = "rgba(0,0,0,0.1)";
            for (let i=0; i<5; i++) {
               const offset = (Math.sin(r.x + i) * 20);
               if (r.w > r.h) {
                 ctx.fillRect(r.x, r.y + (r.h/5)*i + offset, r.w, 2);
               } else {
                 ctx.fillRect(r.x + (r.w/5)*i + offset, r.y, 2, r.h);
               }
            }
         }
      });

      // Draw Tire Marks
      tireMarks.forEach((m, idx) => {
         m.a -= 0.005; // Fade over time
         if (m.a > 0) {
           ctx.save();
           ctx.translate(m.x, m.y);
           ctx.rotate(m.angle);
           ctx.fillStyle = `rgba(0, 0, 0, ${m.a})`;
           ctx.fillRect(-15, -10, 10, 4); // Rear tire left
           ctx.fillRect(-15, 6, 10, 4);   // Rear tire right
           ctx.restore();
         }
      });
      // Cleanup old marks
      tireMarks = tireMarks.filter(m => m.a > 0);

      // 2.5D Buildings - sort players/vehicles/buildings by Y coordinate
      const renderables: any[] = [];
      const camCenterX = camera.x + canvas.width / 2;
      const camCenterY = camera.y + canvas.height / 2;

      MAP_BUILDINGS.forEach(b => {
        const dx = (b.x + b.w/2) - camCenterX;
        const dy = (b.y + b.h/2) - camCenterY;
        if (Math.abs(dx) < renderDist && Math.abs(dy) < renderDist) {
            renderables.push({ ...b, type: "building", sortY: b.y + b.h });
        }
      });
      
      Object.values(state.vehicles).forEach(v => {
        const dx = v.x - camCenterX;
        const dy = v.y - camCenterY;
        if (Math.abs(dx) < renderDist && Math.abs(dy) < renderDist) {
            renderables.push({ ...v, type: "vehicle", sortY: v.y });
        }
      });
      
      Object.values(state.players).forEach(p => {
        const dx = p.x - camCenterX;
        const dy = p.y - camCenterY;
        if (Math.abs(dx) < renderDist && Math.abs(dy) < renderDist && !p.inVehicleId) {
            renderables.push({ ...p, type: "player", sortY: p.y });
        }
      });

      renderables.sort((a, b) => a.sortY - b.sortY);

      // Global shadow settings for better lighting
      if (showShadows) {
          ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
          ctx.shadowBlur = graphicsQuality === "medium" ? 20 : 40;
      }
      
      renderables.forEach(item => {
        if (item.type === "building") {
           const frontWallY = item.y + item.h - item.height;

           // Apply shadow to buildings
           if (showShadows) {
              ctx.save();
              ctx.shadowBlur = graphicsQuality === "medium" ? 20 : 40;
              ctx.shadowOffsetX = 10;
              ctx.shadowOffsetY = 20;
           }

           // Front Wall Gradient
           const wallGrad = ctx.createLinearGradient(item.x, frontWallY, item.x, frontWallY + item.height);
           wallGrad.addColorStop(0, shadeColor(item.color, -10));
           wallGrad.addColorStop(1, shadeColor(item.color, -50));
           ctx.fillStyle = wallGrad;
           ctx.fillRect(item.x, frontWallY, item.w, item.height);
           
           // Draw windows
           if (graphicsQuality !== "low") {
               const winSize = graphicsQuality === "medium" ? 80 : 50;
               const cols = Math.floor(item.w / winSize);
               const rows = Math.floor(item.height / winSize);
               for(let r = 0; r < rows; r++) {
                 for(let c = 0; c < cols; c++) {
                   if (r === rows - 1 && c === Math.floor(cols/2)) {
                      // Door frame
                      ctx.fillStyle = "#291304";
                      ctx.fillRect(item.x + c * winSize + 13, frontWallY + r * winSize + 8, 24, 44);
                      // Door
                      ctx.fillStyle = "#5c2e0b";
                      ctx.fillRect(item.x + c * winSize + 15, frontWallY + r * winSize + 10, 20, 42);
                      
                      // Door knob
                      ctx.fillStyle = "#facc15";
                      ctx.beginPath();
                      ctx.arc(item.x + c * winSize + 30, frontWallY + r * winSize + 30, 2, 0, Math.PI*2);
                      ctx.fill();
                      continue;
                   }
                   if (item.label !== "Gas") {
                      // Window frame
                      ctx.fillStyle = "#334155";
                      ctx.fillRect(item.x + c * winSize + 13, frontWallY + r * winSize + 13, 24, 24);
                      
                      // Window glass with gradient
                      const glassGrad = ctx.createLinearGradient(
                        item.x + c * winSize + 15, frontWallY + r * winSize + 15,
                        item.x + c * winSize + 35, frontWallY + r * winSize + 35
                      );
                      glassGrad.addColorStop(0, "rgba(186, 230, 253, 0.9)");
                      glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.6)");
                      ctx.fillStyle = glassGrad;
                      ctx.fillRect(item.x + c * winSize + 15, frontWallY + r * winSize + 15, 20, 20);
                      
                      // Window reflection glare
                      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                      ctx.beginPath();
                      ctx.moveTo(item.x + c * winSize + 15, frontWallY + r * winSize + 15);
                      ctx.lineTo(item.x + c * winSize + 25, frontWallY + r * winSize + 15);
                      ctx.lineTo(item.x + c * winSize + 15, frontWallY + r * winSize + 25);
                      ctx.fill();
                   }
                 }
               }
           }
           
           // Roof
           const roofGrad = ctx.createLinearGradient(item.x, item.y - item.height, item.x, item.y - item.height + item.h);
           roofGrad.addColorStop(0, shadeColor(item.color, 20));
           roofGrad.addColorStop(1, shadeColor(item.color, -20));
           ctx.fillStyle = roofGrad;
           ctx.fillRect(item.x, item.y - item.height, item.w, item.h);
           
           // Roof details (border)
           ctx.strokeStyle = shadeColor(item.color, -40);
           ctx.lineWidth = 4;
           ctx.strokeRect(item.x + 2, item.y - item.height + 2, item.w - 4, item.h - 4);
           
           // Roof shading/texture lines
           ctx.strokeStyle = "rgba(0,0,0,0.1)";
           ctx.lineWidth = 1;
           for(let rx = item.x + 10; rx < item.x + item.w; rx += 20) {
               ctx.beginPath();
               ctx.moveTo(rx, item.y - item.height);
               ctx.lineTo(rx, item.y - item.height + item.h);
               ctx.stroke();
           }

           if (item.label === "Gas") {
              // Gas Station details
              ctx.fillStyle = "#94a3b8"; 
              ctx.fillRect(item.x + 20, item.y - item.height + item.h, 15, item.height);
              ctx.fillRect(item.x + item.w - 35, item.y - item.height + item.h, 15, item.height);
              
              ctx.fillStyle = "#ef4444"; 
              ctx.fillRect(item.x + 15, item.y + item.h - 20, 25, 40);
              ctx.fillRect(item.x + item.w - 40, item.y + item.h - 20, 25, 40);

              ctx.fillStyle = "#1e293b";
              ctx.fillRect(item.x + 18, item.y + item.h - 15, 19, 12);
              ctx.fillRect(item.x + item.w - 37, item.y + item.h - 15, 19, 12);

              ctx.fillStyle = "#eab308";
              ctx.fillRect(item.x + 40, item.y + item.h - 10, 5, 20);
              ctx.fillRect(item.x + item.w - 15, item.y + item.h - 10, 5, 20);
           }

           // Label
           ctx.restore(); // remove shadow for label
           
           ctx.fillStyle = "#ffffff";
           ctx.font = "bold 16px Inter, sans-serif";
           ctx.textAlign = "center";
           ctx.shadowColor = "rgba(0,0,0,0.8)";
           ctx.shadowBlur = 4;
           ctx.fillText(item.label, item.x + item.w/2, item.y - item.height + item.h/2);
           ctx.shadowBlur = 0;

         } else if (item.type === "vehicle") {
            ctx.save();
            // Apply vehicle drop shadow
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 10;

            // Strong smoothing for high speed (reduce shake)
            let drawX = item.x;
            let drawY = item.y;
            if (item.speed && Math.abs(item.speed) > 6) {
              const smoothFactor = 0.85; // stronger smoothing
              drawX = item.x * smoothFactor + (item.lastX || item.x) * (1 - smoothFactor);
              drawY = item.y * smoothFactor + (item.lastY || item.y) * (1 - smoothFactor);
            }
            
            ctx.translate(drawX, drawY);
            if (item.angle !== undefined) {
              ctx.rotate(item.angle);
            }
           
           // Generate tire marks if turning hard (drifting locally)
           if (item.speed !== undefined && Math.abs(item.speed) > 8 && item.ownerId === myId) {
              if (lastInputState.left || lastInputState.right) {
                 if (Math.random() < 0.6) {
                    tireMarks.push({
                      x: item.x,
                      y: item.y,
                      angle: item.angle || 0,
                      a: 0.5,
                      id: markId++
                    });
                    if (tireMarks.length > 500) tireMarks.shift();
                 }
              }
           }
           
           const isBroken = item.health <= 0;

           if (item.carType === "tractor") {
             // Tires
             ctx.fillStyle = "#111";
             ctx.fillRect(-30, -25, 20, 10);
             ctx.fillRect(-30, 15, 20, 10);
             ctx.fillRect(15, -22, 10, 6);
             ctx.fillRect(15, 16, 10, 6);
             
             // Body
             ctx.fillStyle = "#000";
             ctx.beginPath(); ctx.roundRect(-26, -21, 52, 42, 4); ctx.fill();
             ctx.fillStyle = "#166534";
             ctx.beginPath(); ctx.roundRect(-25, -20, 50, 40, 2); ctx.fill();
             
             // Engine / Exhaust
             ctx.fillStyle = "#facc15";
             ctx.fillRect(-5, -15, 20, 30);
             ctx.fillStyle = "#64748b";
             ctx.beginPath(); ctx.arc(10, -5, 4, 0, Math.PI*2); ctx.fill();
             
             // Seat
             ctx.fillStyle = "#1e293b";
             ctx.fillRect(-20, -10, 10, 20);
           } else if (item.carType === "truck") {
             // Tires
             ctx.fillStyle = "#111";
             ctx.beginPath(); ctx.roundRect(-25, -20, 14, 5, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(15, -20, 14, 5, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-25, 15, 14, 5, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(15, 15, 14, 5, 2); ctx.fill();
             
             ctx.fillStyle = "#000";
             ctx.beginPath(); ctx.roundRect(-40, -18, 80, 36, 8); ctx.fill();
             ctx.fillStyle = item.ownerId === myId ? "#eab308" : (isBroken ? "#334155" : "#1e40af");
             ctx.beginPath(); ctx.roundRect(-38, -18, 76, 36, 6); ctx.fill();
             
             // Cab
             const glassGrad = ctx.createLinearGradient(10, 0, 30, 0);
             glassGrad.addColorStop(0, "#0f172a"); glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.4)");
             ctx.fillStyle = glassGrad;
             ctx.beginPath(); ctx.roundRect(10, -16, 20, 32, 4); ctx.fill();
             
             // Bed
             ctx.fillStyle = "#0f172a";
             ctx.fillRect(-35, -15, 40, 30);
             ctx.fillStyle = "#1e293b";
             ctx.fillRect(-33, -13, 36, 26);
             
             // Lights
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.fillRect(36, -14, 3, 6); ctx.fillRect(36, 8, 3, 6);
             ctx.fillStyle = "#ef4444";
             ctx.fillRect(-39, -14, 3, 6); ctx.fillRect(-39, 8, 3, 6);
           } else if (item.carType === "sports") {
             // Tires
             ctx.fillStyle = "#111";
             ctx.beginPath(); ctx.roundRect(-20, -16, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, -16, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-20, 12, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, 12, 12, 4, 2); ctx.fill();

             // Body drop shadow inside base
             ctx.beginPath(); ctx.roundRect(-25, -14, 50, 28, 8); ctx.fill();
             
             ctx.fillStyle = item.ownerId === myId ? "#eab308" : (isBroken ? "#334155" : "#dc2626");
             ctx.beginPath(); ctx.roundRect(-25, -14, 50, 28, 8); ctx.fill();
             
             // Roof / Windows
             const glassGrad = ctx.createLinearGradient(-10, 0, 15, 0);
             glassGrad.addColorStop(0, "#0f172a"); glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.6)");
             ctx.fillStyle = glassGrad;
             ctx.beginPath(); ctx.roundRect(-5, -12, 20, 24, 4); ctx.fill();
             
             // Spoiler
             ctx.fillStyle = "#000";
             ctx.fillRect(-24, -12, 4, 24);
             
             // Headlights
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.fillRect(22, -12, 4, 6);
             ctx.fillRect(22, 6, 4, 6);
             // Taillights
             ctx.fillStyle = "#ef4444";
             ctx.fillRect(-26, -12, 3, 6);
             ctx.fillRect(-26, 6, 3, 6);

           } else if (item.carType === "suv") {
             // Tires
             ctx.fillStyle = "#111";
             ctx.beginPath(); ctx.roundRect(-22, -18, 14, 5, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(12, -18, 14, 5, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-22, 13, 14, 5, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(12, 13, 14, 5, 2); ctx.fill();

             ctx.fillStyle = "#000";
             ctx.beginPath(); ctx.roundRect(-30, -16, 60, 32, 8); ctx.fill();
             ctx.fillStyle = item.ownerId === myId ? "#eab308" : (isBroken ? "#334155" : "#475569");
             ctx.beginPath(); ctx.roundRect(-30, -16, 60, 32, 6); ctx.fill();
             
             // Roof / Windows
             const glassGrad = ctx.createLinearGradient(-15, 0, 20, 0);
             glassGrad.addColorStop(0, "#0f172a"); glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.4)");
             ctx.fillStyle = glassGrad;
             ctx.beginPath(); ctx.roundRect(-15, -14, 35, 28, 4); ctx.fill();
             
             // Headlights
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.fillRect(28, -14, 3, 6);
             ctx.fillRect(28, 8, 3, 6);
             // Taillights
             ctx.fillStyle = "#ef4444";
             ctx.fillRect(-31, -14, 3, 6);
             ctx.fillRect(-31, 8, 3, 6);
           } else if (item.carType === "bike") {
             ctx.fillStyle = item.ownerId === myId ? "#eab308" : (isBroken ? "#334155" : "#16a34a");
             // Rickshaw Drawing\n              ctx.rotate(Math.PI);\n              ctx.fillStyle = '#dc2626';\n              ctx.fillRect(-20, -10, 40, 20);\n              ctx.fillStyle = '#000';\n              ctx.beginPath(); ctx.arc(15, -12, 6, 0, Math.PI*2); ctx.fill();\n              ctx.beginPath(); ctx.arc(15, 12, 6, 0, Math.PI*2); ctx.fill();\n              ctx.beginPath(); ctx.arc(-18, 0, 6, 0, Math.PI*2); ctx.fill();\n              ctx.fillStyle = '#eab308';\n              ctx.fillRect(0, -12, 10, 24);\n              ctx.fillStyle = '#22c55e';\n              ctx.fillRect(10, -12, 5, 24);
             // Handlebars
             ctx.fillStyle = "#000";
             ctx.fillRect(8, -8, 3, 16);
             // Seat
             ctx.fillStyle = "#111";
             ctx.fillRect(-10, -4, 15, 8);
           } else if (item.carType === "police") {
             // Tires
             ctx.fillStyle = "#111";
             ctx.beginPath(); ctx.roundRect(-20, -18, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, -18, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-20, 14, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, 14, 12, 4, 2); ctx.fill();

             ctx.fillStyle = "#000";
             ctx.beginPath(); ctx.roundRect(-28, -16, 56, 32, 8); ctx.fill();
             ctx.fillStyle = isBroken ? "#334155" : "#ffffff";
             ctx.beginPath(); ctx.roundRect(-28, -16, 56, 32, 6); ctx.fill();
             // Black middle section
             ctx.fillStyle = "#000000";
             ctx.fillRect(-12, -16, 28, 32);
             // Roof / Windows
             const glassGrad = ctx.createLinearGradient(-10, 0, 18, 0);
             glassGrad.addColorStop(0, "#0f172a"); glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.4)");
             ctx.fillStyle = glassGrad;
             ctx.beginPath(); ctx.roundRect(-10, -14, 28, 28, 4); ctx.fill();
             // Lightbar
             ctx.fillStyle = (Date.now() % 400 < 200) ? "#ef4444" : "#3b82f6";
             ctx.fillRect(-2, -12, 6, 12);
             ctx.fillStyle = (Date.now() % 400 >= 200) ? "#ef4444" : "#3b82f6";
             ctx.fillRect(-2, 0, 6, 12);
             
             // Lights
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.fillRect(26, -14, 3, 6); ctx.fillRect(26, 8, 3, 6);
             ctx.fillStyle = "#ef4444";
             ctx.fillRect(-29, -14, 3, 6); ctx.fillRect(-29, 8, 3, 6);

            } else if (item.carType === "taxi") {
              // Taxi drawing already exists

            } else if (item.carType === "quad") {
              // Quad Bike
              ctx.fillStyle = "#334155";
              ctx.fillRect(-18, -10, 36, 20);
              ctx.fillStyle = "#1e2937";
              ctx.fillRect(-10, -6, 20, 12);
              ctx.fillStyle = "#64748b";
              ctx.fillRect(-22, -14, 8, 8);
              ctx.fillRect(14, -14, 8, 8);
              ctx.fillRect(-22, 6, 8, 8);
              ctx.fillRect(14, 6, 8, 8);

            } else if (item.carType === "helicopter") {
              // Helicopter
              ctx.fillStyle = "#1e40af";
              ctx.beginPath();
              ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#1e3a8a";
              ctx.fillRect(-4, -4, 8, 8);
              // Rotor
              ctx.strokeStyle = "#64748b";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(-30, -8);
              ctx.lineTo(30, -8);
              ctx.stroke();
             // Tires
             ctx.fillStyle = "#111";
             ctx.beginPath(); ctx.roundRect(-20, -18, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, -18, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-20, 14, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, 14, 12, 4, 2); ctx.fill();

             ctx.fillStyle = "#000";
             ctx.beginPath(); ctx.roundRect(-28, -16, 56, 32, 8); ctx.fill();
             ctx.fillStyle = isBroken ? "#334155" : "#eab308";
             ctx.beginPath(); ctx.roundRect(-28, -16, 56, 32, 6); ctx.fill();
             // Checker stripe
             ctx.fillStyle = "#000";
             for (let i = -20; i < 20; i += 8) {
                ctx.fillRect(i, -16, 4, 2);
                ctx.fillRect(i+4, 14, 4, 2);
             }
             // Roof / Windows
             const glassGrad = ctx.createLinearGradient(-10, 0, 18, 0);
             glassGrad.addColorStop(0, "#0f172a"); glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.4)");
             ctx.fillStyle = glassGrad;
             ctx.beginPath(); ctx.roundRect(-10, -14, 28, 28, 4); ctx.fill();
             // Taxi Sign
             ctx.fillStyle = "#ffffff";
             ctx.fillRect(-4, -6, 10, 12);
             
             // Lights
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.fillRect(26, -14, 3, 6); ctx.fillRect(26, 8, 3, 6);
             ctx.fillStyle = "#ef4444";
             ctx.fillRect(-29, -14, 3, 6); ctx.fillRect(-29, 8, 3, 6);

           } else {
             // Sedan
             // Tires
             ctx.fillStyle = "#111";
             ctx.beginPath(); ctx.roundRect(-20, -18, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, -18, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(-20, 14, 12, 4, 2); ctx.fill();
             ctx.beginPath(); ctx.roundRect(10, 14, 12, 4, 2); ctx.fill();

             ctx.fillStyle = "#000";
             ctx.beginPath(); ctx.roundRect(-28, -16, 56, 32, 8); ctx.fill();
             ctx.fillStyle = item.ownerId === myId ? "#eab308" : (isBroken ? "#334155" : "#64748b");
             ctx.beginPath(); ctx.roundRect(-28, -16, 56, 32, 6); ctx.fill();
             // Roof / Windows
             const glassGrad = ctx.createLinearGradient(-10, 0, 18, 0);
             glassGrad.addColorStop(0, "#0f172a"); glassGrad.addColorStop(1, "rgba(56, 189, 248, 0.4)");
             ctx.fillStyle = glassGrad;
             ctx.beginPath(); ctx.roundRect(-10, -14, 28, 28, 4); ctx.fill();
             
             // Lights
             ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
             ctx.fillRect(26, -14, 3, 6); ctx.fillRect(26, 8, 3, 6);
             ctx.fillStyle = "#ef4444";
             ctx.fillRect(-29, -14, 3, 6); ctx.fillRect(-29, 8, 3, 6);
           }

           if (item.health > 0) {
              // Headlights
              ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
              ctx.fillRect(24, -14, 4, 6); ctx.fillRect(24, 8, 4, 6);
              
              // Taillights
              ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
              ctx.fillRect(-28, -14, 4, 6); ctx.fillRect(-28, 8, 4, 6);
           } else {
              // Fire
              ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
              ctx.beginPath(); ctx.arc(10, 0, 15 + Math.random()*5, 0, Math.PI*2); ctx.fill();
              ctx.fillStyle = "rgba(249, 115, 22, 0.8)";
              ctx.beginPath(); ctx.arc(10, 0, 10 + Math.random()*5, 0, Math.PI*2); ctx.fill();
           }

           // Smoke
           if (item.health < 50 && item.health > 0) {
              ctx.fillStyle = "rgba(0,0,0,0.5)";
              ctx.beginPath(); 
              ctx.arc(15 - Math.random()*10, -10 + Math.random()*20, 10 + Math.random()*10, 0, Math.PI*2); 
              ctx.fill();
           }
           
           // Health Bar
           if (item.health < 100) {
              ctx.fillStyle = "#000";
              ctx.fillRect(-20, -30, 40, 6);
              ctx.fillStyle = item.health > 50 ? "#22c55e" : item.health > 25 ? "#eab308" : "#ef4444";
              ctx.fillRect(-20, -30, 40 * (Math.max(0, item.health)/100), 6);
           }

           // Draw rider name
           const riders = Object.values(state.players).filter(p => p.inVehicleId === item.id);
           if (riders.length > 0) {
             ctx.fillStyle = "#ffffff";
             ctx.textAlign = "center";
             ctx.font = "bold 12px sans-serif";
             ctx.shadowColor = "rgba(0,0,0,0.8)";
             ctx.shadowBlur = 4;
             ctx.fillText(riders[0].name, 0, -25);
             ctx.shadowBlur = 0;
           }
           ctx.restore();

        } else if (item.type === "player") {
           ctx.save();
           ctx.translate(item.x, item.y);
           
           let bounce = item.speed > 0 ? Math.abs(Math.sin(Date.now() / 150)) * 3 : 0;
           let armSwing = item.speed > 0 ? Math.sin(Date.now() / 150) * 6 : 0;

           // Dynamic Player Shadow
           ctx.shadowBlur = 10;
           ctx.shadowOffsetX = -2;
           ctx.shadowOffsetY = 10;
           ctx.shadowColor = "rgba(0,0,0,1)";

           // Rotate based on facing
           let angle = 0;
           if (item.facing === "up") angle = Math.PI;
           else if (item.facing === "right") angle = -Math.PI / 2;
           else if (item.facing === "left") angle = Math.PI / 2;
           ctx.rotate(angle);

           // Shoulders/Body
           ctx.fillStyle = item.color;
           ctx.beginPath();
           ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
           ctx.fill();

           // Remove shadow for body parts overlap
           ctx.shadowBlur = 0;
           ctx.shadowOffsetX = 0;
           ctx.shadowOffsetY = 0;

           // Arms
           ctx.fillStyle = item.color;
           ctx.beginPath(); ctx.ellipse(-14, armSwing, 4, 8, 0, 0, Math.PI * 2); ctx.fill(); // Left Arm
           ctx.beginPath(); ctx.ellipse(14, -armSwing, 4, 8, 0, 0, Math.PI * 2); ctx.fill(); // Right Arm

           // Hands
           ctx.fillStyle = "#fcd34d"; // Skin
           ctx.beginPath(); ctx.arc(-14, 6 + armSwing, 4, 0, Math.PI * 2); ctx.fill();
           ctx.beginPath(); ctx.arc(14, 6 - armSwing, 4, 0, Math.PI * 2); ctx.fill();

           // Head
           ctx.beginPath();
           ctx.arc(0, 2 - bounce, 8, 0, Math.PI * 2);
           ctx.fill();

           // Hair
           ctx.fillStyle = "#1c1917"; 
           ctx.beginPath();
           ctx.arc(0, 2 - bounce, 8, Math.PI, Math.PI * 2 + 0.1); // Add little overhang
           ctx.fill();

           // Face (eyes) if looking forward
           // Because rotate aligns "down" visually, drawing at positive Y is the front face
           ctx.fillStyle = "#000";
           ctx.fillRect(-3, 5 - bounce, 2, 2);
           ctx.fillRect(1, 5 - bounce, 2, 2);

           ctx.restore();

           // Player Selection / Interaction highlight
           let nearestCar = null;
           let nDist = 150;
           if (item.id === myId && !item.inVehicleId) {
             // Find closest car
             for (const vKey in state.vehicles) {
               const v = state.vehicles[vKey];
               const dist = Math.hypot(item.x - v.x, item.y - v.y);
               if (dist < nDist) {
                 nearestCar = v;
                 nDist = dist;
               }
             }
             if (nearestCar) {
               ctx.fillStyle = "#ffffff";
               ctx.font = "bold 12px Inter, sans-serif";
               ctx.textAlign = "center";
               ctx.shadowColor = "rgba(0,0,0,1)";
               ctx.shadowBlur = 4;
               ctx.fillText("Press F to drive", item.x, item.y - 40);
               ctx.shadowBlur = 0;
             } else {
               // Check buildings
               let nearestBuilding = null;
               let bDist = 200;
               const checkB = (labelMatch: string, distThresh: number, distMethod: "center"|"edge") => {
                 const b = checkBuilding(labelMatch);
                 if (!b) return null;
                 let dist = Infinity;
                 if (distMethod === "center") {
                   dist = Math.hypot(b.x + b.w/2 - item.x, b.y + b.h/2 - item.y);
                 } else {
                   dist = Math.max(0, item.x < b.x ? b.x - item.x : item.x > b.x+b.w ? item.x - (b.x+b.w) : 0, item.y < b.y ? b.y - item.y : item.y > b.y+b.h ? item.y - (b.y+b.h) : 0);
                 }
                 if (dist < distThresh) return { b, dist };
                 return null;
               };
               
               const interactions = [
                 { id: "clinic", label: "Press E to heal ($100)", match: "Clinic", thresh: 200, dist: "center" },
                 { id: "haat", label: "Press E to sell goods", match: "Market", thresh: 400, dist: "center" },
                 { id: "tea", label: "Press E to drink tea ($10)", match: "Tea Stall", thresh: 150, dist: "center" },
                 { id: "registry", label: "Press E to buy land", match: "Registry", thresh: 150, dist: "center" },
                 { id: "dealer", label: "Press E to view vehicles", match: "Farming Shop", thresh: 200, dist: "center" },
                 { id: "potato", label: "Press E to Farm Potato", match: "Potato Field", thresh: Infinity, dist: "edge" },
                 { id: "corn", label: "Press E to Farm Corn", match: "Corn Field", thresh: Infinity, dist: "edge" },
                 { id: "dhan", label: "Press E to Farm Rice", match: "Rice Field", thresh: Infinity, dist: "edge" },
                 { id: "river", label: "Press E to Fish", match: "Fishing Pond", thresh: 500, dist: "center" }
               ];

               let bestInteraction = null;
               let minDist = Infinity;

               // Add animals (putting them in the animal market at Haat)
               const animalsList = [
                   { type: 'cow', x: 12550, y: 15250 },
                   { type: 'cow', x: 12650, y: 15300 },
                   { type: 'cow', x: 12600, y: 15400 },
                   { type: 'cow', x: 12700, y: 15350 }
               ];
               for (const ani of animalsList) {
                   const dist = Math.hypot(ani.x - item.x, ani.y - item.y);
                   if (dist < 100) {
                      interactions.push({ id: "cow", label: "Press E to Milk Cow", match: "", thresh: 100, dist: "center" });
                      // Fake checkB result just to pass the check loop below
                      minDist = dist;
                      bestInteraction = interactions[interactions.length - 1];
                   }
               }

               for (const i of interactions) {
                 if (i.id === "cow") continue;
                 const res = checkB(i.match, i.dist === "edge" ? Math.max(checkBuilding(i.match)?.w || 0, checkBuilding(i.match)?.h || 0)/1.5 : i.thresh, i.dist as "center"|"edge");
                 if (res && res.dist < minDist) {
                   minDist = res.dist;
                   bestInteraction = i;
                 }
               }
               
               if (bestInteraction) {
                 const currentStore = useGameStore.getState();
                 if (["potato", "corn", "dhan"].includes(bestInteraction.id)) {
                   if (currentStore.currentPlot?.id !== bestInteraction.id) {
                     currentStore.setCurrentPlot({ id: bestInteraction.id, name: bestInteraction.match });
                   }
                 } else {
                   if (currentStore.currentPlot !== null) {
                     currentStore.setCurrentPlot(null);
                   }
                 }
                 ctx.fillStyle = "#ffffff";
                 ctx.font = "bold 12px Inter, sans-serif";
                 ctx.textAlign = "center";
                 ctx.shadowColor = "rgba(0,0,0,1)";
                 ctx.shadowBlur = 4;
                 ctx.fillText(bestInteraction.label, item.x, item.y - 40);
                 ctx.shadowBlur = 0;
               }
             }
           }

           // Chat Bubble
           if (item.lastMessage && item.lastMessageTime && Date.now() - item.lastMessageTime < 6000) {
             const bubbleWidth = Math.min(200, Math.max(50, ctx.measureText(item.lastMessage).width + 20));
             ctx.fillStyle = "rgba(0,0,0,0.7)";
             ctx.beginPath();
             ctx.roundRect(item.x - bubbleWidth/2, item.y - 70, bubbleWidth, 30, 8);
             ctx.fill();
             
             // Bubble pointer
             ctx.beginPath();
             ctx.moveTo(item.x - 5, item.y - 40);
             ctx.lineTo(item.x + 5, item.y - 40);
             ctx.lineTo(item.x, item.y - 30);
             ctx.fill();
             
             ctx.fillStyle = "#a3e635"; // lime-400
             ctx.font = "bold 12px Inter, sans-serif";
             ctx.textAlign = "center";
             ctx.textBaseline = "middle";
             ctx.fillText(item.lastMessage, item.x, item.y - 55);
             
             ctx.textBaseline = "alphabetic"; // reset
           }

           // Name Tag
           ctx.fillStyle = "#ffffff";
           ctx.font = "bold 12px Inter, sans-serif";
           ctx.textAlign = "center";
           let name = item.name;
           if (item.wantedLevel > 0) {
             ctx.fillStyle = "#ef4444";
             name = `[WANTED ${Math.ceil(item.wantedLevel)}] ` + name;
           }
           ctx.shadowColor = "rgba(0,0,0,0.8)";
           ctx.shadowBlur = 4;
           ctx.fillText(name, item.x, item.y - 25);
           ctx.shadowBlur = 0;
        }
      });


      // Draw Farm Animals
      const animals = [
          { type: 'cow', x: 700, y: 8300 },
          { type: 'cow', x: 600, y: 8400 },
          { type: 'sheep', x: 1000, y: 1100 },
          { type: 'sheep', x: 900, y: 1200 },
          { type: 'sheep', x: 1100, y: 1150 },
          { type: 'cow', x: 8300, y: 5200 },
          { type: 'cow', x: 8200, y: 5400 }
      ];

      animals.forEach(ani => {
          ctx.save();
          const breathe = Math.sin(Date.now() / 1000 + ani.x) * 0.05;
          ctx.translate(ani.x, ani.y);
          ctx.scale(1 + breathe, 1);
          
          if (ani.type === 'cow') {
             ctx.fillStyle = "#ffffff";
             ctx.fillRect(-15, -10, 30, 20); // Body
             ctx.fillStyle = "#000";
             ctx.fillRect(-8, -5, 8, 8); // Spots
             ctx.fillRect(5, 2, 6, 6);
             ctx.fillStyle = "#ffffff";
             ctx.fillRect(10, -5, 10, 10); // Head
             ctx.fillStyle = "#000";
             ctx.fillRect(16, -2, 2, 2); // Eye
          } else {
             ctx.fillStyle = "#f8fafd";
             ctx.beginPath();
             ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill(); // Body
             ctx.beginPath();
             ctx.arc(10, -2, 6, 0, Math.PI * 2); ctx.fill(); // Head
             ctx.fillStyle = "#111";
             ctx.fillRect(12, 0, 2, 2); // Eye
          }
          ctx.restore();
      });
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      for (let i = 0; i < 15; i++) {
         const birdSeed = (Date.now() / 5000) + i * 500;
         const bx = (Math.sin(birdSeed) * 3000) + 5000;
         const by = (Math.cos(birdSeed * 0.7) * 3000) + 5000;
         
         const wing = Math.sin(Date.now() / 150) * 8;
         ctx.beginPath();
         ctx.moveTo(bx - 10, by + wing);
         ctx.lineTo(bx, by);
         ctx.lineTo(bx + 10, by + wing);
         ctx.stroke();
      }

      ctx.restore(); // reset camera for UI overlays

      const isNight = false;
      const darknessAlpha = 0;
      const isRain = Math.floor(Date.now() / 120000) % 3 === 2; // Every 2x3=6 mins, rain for 2 mins

      // Rain sound (Vite compatible)
      if (!(window as any).__rainAudio) {
        const rainUrl = new URL('../../assets/rain.mp3', import.meta.url).href;
        (window as any).__rainAudio = new Audio(rainUrl);
        (window as any).__rainAudio.loop = true;
        (window as any).__rainAudio.volume = 0.55;
      }
      const rainAudio = (window as any).__rainAudio;
      if (isRain && rainAudio.paused) {
        rainAudio.play().catch(() => {});
      }
      if (!isRain && !rainAudio.paused) rainAudio.pause();

      // Draw Headlights through the dark
      if (darknessAlpha > 0.1) {
         for (const vKey in state.vehicles) {
            const v = state.vehicles[vKey];
            if (v.health > 0) {
              const screenX = canvas.width / 2 + (v.x - me.x);
              const screenY = canvas.height / 2 + (v.y - me.y);
              if (screenX > -200 && screenX < canvas.width + 200 && screenY > -200 && screenY < canvas.height + 200) {
                 ctx.save();
                 ctx.translate(screenX, screenY);
                 ctx.rotate(v.angle);
                 ctx.globalCompositeOperation = "screen";
                 const grad = ctx.createLinearGradient(40, 0, 450, 0);
                 grad.addColorStop(0, `rgba(255, 255, 220, ${darknessAlpha * 0.8})`);
                 grad.addColorStop(1, "rgba(255, 255, 220, 0)");
                 ctx.fillStyle = grad;
                 ctx.beginPath();
                 ctx.moveTo(30, -15);
                 ctx.lineTo(450, -150);
                 ctx.lineTo(450, 150);
                 ctx.lineTo(30, 15);
                 ctx.fill();
                 ctx.restore();
              }
            }
         }
      }

      // Draw Rain Upgrade
      if (isRain && graphicsQuality !== "low") {
        // Thunder flash
        if (Math.random() < 0.005) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        const rainDensity = graphicsQuality === "medium" ? 200 : 400;
        const rainSpeed = 25;
        const rainAngleX = -5;
        const time = Date.now() / 1000;
        
        ctx.strokeStyle = "rgba(150, 160, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let i = 0; i < rainDensity; i++) {
            // Seeded random positions that move with time
            const seedX = (Math.sin(i * 123.456) * 0.5 + 0.5);
            const seedY = (Math.cos(i * 654.321) * 0.5 + 0.5);
            
            // Calculate position with modulo to wrap around screen
            let rx = (seedX * canvas.width + time * rainAngleX * 50) % canvas.width;
            let ry = (seedY * canvas.height + time * rainSpeed * 50) % canvas.height;
            
            if (rx < 0) rx += canvas.width;
            if (ry < 0) ry += canvas.height;
            
            const dropLen = 15 + Math.random() * 10;
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + rainAngleX, ry + dropLen);
        }
        ctx.stroke();

        // Update & draw dust particles
        ctx.fillStyle = "rgba(210, 180, 140, 0.6)";
        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life--;
          pt.size *= 0.96;

          if (pt.life <= 0 || pt.size < 0.5) {
            particles.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Splash effects on ground (if High quality)
        if (graphicsQuality === "high") {
            ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            for (let i = 0; i < 20; i++) {
                const sx = Math.random() * canvas.width;
                const sy = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.ellipse(sx, sy, 2, 1, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
      }

      // Draw Rain if active
      if (isRain) {
          ctx.strokeStyle = "rgba(100, 150, 255, 0.4)";
          ctx.lineWidth = 1;
          for (let i = 0; i < 50; i++) {
              const rx = Math.random() * canvas.width;
              const ry = Math.random() * canvas.height;
              ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 15); ctx.stroke();
          }
      }

      // Global Night Overlay
      if (darknessAlpha > 0.05) {
          ctx.fillStyle = `rgba(15, 23, 42, ${darknessAlpha})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Vignette around player
          const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 100, canvas.width/2, canvas.height/2, 500);
          grad.addColorStop(0, "rgba(0,0,0,0)");
          grad.addColorStop(1, `rgba(15, 23, 42, ${darknessAlpha})`);
          ctx.globalCompositeOperation = "destination-in";
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalCompositeOperation = "source-over";
      }
 
      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animFrame);
  }, []);

  return <canvas ref={canvasRef} className="block w-full h-full" />;
}
