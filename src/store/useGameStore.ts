import { create } from "zustand";

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  job?: string; // Kept as optional just in case it's in DB
  money: number;
  bank: number;
  wantedLevel: number;
  health: number;
  hunger: number;
  stamina: number;
  inVehicleId: string | null;
  facing: "up" | "down" | "left" | "right";
  speed: number;
  inventory?: Record<string, number>;
  ownedProperties?: string[];
  lastMessage?: string;
  lastMessageTime?: number;
}

export interface Vehicle {
  id: string;
  x: number;
  y: number;
  originX?: number;
  originY?: number;
  lastInteractionTime?: number;
  angle: number;
  speed: number;
  fuel: number;
  health: number;
  ownerId: string | null;
  purchasedBy?: string;
  carType: "sports" | "truck" | "suv" | "sedan" | "bike" | "police" | "taxi" | "tractor" | string;
  brand: string;
}

export interface GameState {
  players: Record<string, Player>;
  vehicles: Record<string, Vehicle>;
  timeOfDay: number;
  weather: string;
}

export interface ChatMessage {
  id: number;
  sender?: string;
  senderId?: string;
  text: string;
  channel: "global" | "local";
  system?: boolean;
  x?: number;
  y?: number;
}

interface StoreState {
  playerName: string | null;
  myId: string | null;
  roomId: string | null;
  gameState: GameState | null;
  messages: ChatMessage[];
  ui: boolean;
  activePhoneTab: string | null;
  showDealership: boolean;
  showFullMap: boolean;
  currentPlot: { id: string, name: string } | null;
  setCurrentPlot: (plot: { id: string, name: string } | null) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  setShowFullMap: (show: boolean) => void;
  worldTime: number; // 0 to 2400 (representing 00:00 to 24:00)
  setWorldTime: (time: number) => void;
  fishingState: { active: boolean; progress: number; target: number; startedAt: number } | null;
  setFishingState: (state: { active: boolean; progress: number; target: number; startedAt: number } | null) => void;
  waypoint: { x: number, y: number } | null;
  setWaypoint: (waypoint: { x: number, y: number } | null) => void;
  graphicsQuality: "low" | "medium" | "high";
  ping: number;
  setPing: (ping: number) => void;
  setGraphicsQuality: (quality: "low" | "medium" | "high") => void;
  currentScreen: "menu" | "login" | "lobby" | "game" | "character";
  characterType: string | null;
  setPlayerName: (name: string) => void;
  setMyId: (id: string) => void;
  setRoomId: (id: string) => void;
  setCurrentScreen: (screen: "menu" | "login" | "lobby" | "game" | "character") => void;
  setCharacterType: (type: string) => void;
  updateGameState: (state: GameState) => void;
  addMessage: (msg: ChatMessage) => void;
  togglePhoneState: (tab?: string) => void;
  setShowDealership: (show: boolean) => void;
  logout: () => void;
}

export const useGameStore = create<StoreState>((set) => {
  const savedPlayerName = localStorage.getItem("gta_playerName");
  const savedCharacterType = localStorage.getItem("gta_characterType");
  const savedGraphicsQuality = localStorage.getItem("gta_graphicsQuality") as "low" | "medium" | "high" | null;

  return {
    playerName: savedPlayerName,
    myId: null,
    roomId: null,
    gameState: null,
    messages: [],
    ui: true,
    activePhoneTab: null,
    showDealership: false,
    showFullMap: false,
    showSettings: false,
    currentPlot: null,
    setCurrentPlot: (plot) => set({ currentPlot: plot }),
    setShowSettings: (show) => set({ showSettings: show }),
    setShowFullMap: (show) => set({ showFullMap: show }),
    worldTime: 1200,
    setWorldTime: (time) => set({ worldTime: time }),
    fishingState: null,
    setFishingState: (fishingState) => set({ fishingState }),
    waypoint: null,
    setWaypoint: (waypoint) => set({ waypoint }),
    graphicsQuality: savedGraphicsQuality || "high",
    ping: 0,
    setPing: (ping) => set({ ping }),
    currentScreen: savedPlayerName ? (savedCharacterType ? "menu" : "character") : "login",
    characterType: savedCharacterType,
    setPlayerName: (name) => {
      localStorage.setItem("gta_playerName", name);
      set({ playerName: name });
    },
    setMyId: (id) => set({ myId: id }),
    setRoomId: (id) => set({ roomId: id }),
    setCurrentScreen: (screen) => set({ currentScreen: screen }),
    setCharacterType: (type) => {
      localStorage.setItem("gta_characterType", type);
      set({ characterType: type });
    },
    updateGameState: (gameState) => set({ gameState }),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg].slice(-50) })),
    togglePhoneState: (tab) => set((state) => ({ 
      activePhoneTab: state.activePhoneTab === tab ? null : (tab || null) 
    })),
    setShowDealership: (show) => set({ showDealership: show }),
    setGraphicsQuality: (quality) => {
      localStorage.setItem("gta_graphicsQuality", quality);
      set({ graphicsQuality: quality });
    },
    logout: () => {
      localStorage.removeItem("gta_playerName");
      localStorage.removeItem("gta_characterType");
      set({ 
        playerName: null, 
        characterType: null, 
        currentScreen: "login",
        myId: null,
        roomId: null,
        gameState: null,
        messages: []
      });
    }
  };
});
