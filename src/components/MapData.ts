export const MAP_SIZE = 30000;

export const MAP_BUILDINGS: Array<{id: string, x: number; y: number; w: number; h: number; color: string; height: number; label: string}> = [
  { id: "mosque", x: 15350, y: 15350, w: 400, h: 400, color: "#f1f5f9", height: 180, label: "Central Mosque" },
  { id: "tea_stall", x: 14600, y: 15300, w: 100, h: 80, color: "#78350f", height: 20, label: "Tea Stall" },
  { id: "registry", x: 14400, y: 14400, w: 250, h: 250, color: "#475569", height: 60, label: "Land Registry" },
  { id: "police", x: 15350, y: 14500, w: 250, h: 180, color: "#1e3a8a", height: 50, label: "Police Station" },
  { id: "union_parishad", x: 15350, y: 15800, w: 300, h: 200, color: "#78350f", height: 40, label: "Union Council" },
  { id: "clinic", x: 14400, y: 15800, w: 250, h: 200, color: "#dc2626", height: 60, label: "Clinic" },
  { id: "haat", x: 14100, y: 15300, w: 400, h: 250, color: "#16a34a", height: 40, label: "Village Market" },
  { id: "equipment", x: 14800, y: 15800, w: 300, h: 200, color: "#f59e0b", height: 50, label: "Farming Shop" },
  
  // Buyable Land Plots (Khet) - Spread far out
  { id: "dhan_khet", x: 5000, y: 5000, w: 2000, h: 2000, color: "#15803d", height: 2, label: "Rice Field" },
  { id: "gher", x: 22000, y: 5000, w: 1500, h: 1500, color: "#0c4a6e", height: 2, label: "Fish Farm" },
  { id: "potato_khet", x: 5000, y: 22000, w: 1200, h: 1000, color: "#78350f", height: 5, label: "Potato Field" },
  { id: "barn1", x: 16200, y: 15800, w: 200, h: 300, color: "#991b1b", height: 100, label: "Barn" },
  
  { id: "wheat_khet", x: 22000, y: 22000, w: 1800, h: 1500, color: "#713f12", height: 5, label: "Wheat Field" },
  
  { id: "corn_khet", x: 12000, y: 25000, w: 1500, h: 1500, color: "#422006", height: 5, label: "Corn Field" },

  { id: "lake_label", x: 11500, y: 12000, w: 50, h: 50, color: "transparent", height: 0, label: "Fishing Pond" },
  { id: "bari1", x: 15350, y: 15550, w: 150, h: 150, color: "#312e81", height: 80, label: "Brick House" },
  { id: "bari2", x: 15350, y: 14300, w: 150, h: 150, color: "#312e81", height: 80, label: "Mud House" },
  { id: "football_field", x: 13200, y: 14100, w: 1000, h: 600, color: "#15803d", height: 1, label: "Football Field" },
  { id: "school", x: 14200, y: 14100, w: 400, h: 200, color: "#94a3b8", height: 40, label: "Primary School" },
];

// Add thousands of trees spread across the map
export const TREES: Array<{x: number, y: number, type: 'banana' | 'mango'}> = [];
for (let i = 0; i < 800; i++) {
  TREES.push({
    x: Math.random() * MAP_SIZE,
    y: Math.random() * MAP_SIZE,
    type: Math.random() > 0.5 ? 'banana' : 'mango'
  });
}

// Roadside trees (along main paka roads)
for (let i = 0; i < 180; i++) {
  // Vertical main road (left side)
  TREES.push({ x: 14550 + Math.random() * 180, y: Math.random() * MAP_SIZE, type: 'mango' });
  // Vertical main road (right side)
  TREES.push({ x: 15050 + Math.random() * 180, y: Math.random() * MAP_SIZE, type: 'banana' });
  // Horizontal main road (top side)
  TREES.push({ x: Math.random() * MAP_SIZE, y: 14550 + Math.random() * 180, type: 'mango' });
  // Horizontal main road (bottom side)
  TREES.push({ x: Math.random() * MAP_SIZE, y: 15050 + Math.random() * 180, type: 'banana' });
}

export const ROADS: Array<{x: number; y: number; w: number; h: number; type: 'paka' | 'kacha'}> = [
  // Main Paka Rasta (Central Cross) - mobile friendly
  { x: 14775, y: 0, w: 450, h: MAP_SIZE, type: 'paka' },
  { x: 0, y: 14775, w: MAP_SIZE, h: 450, type: 'paka' },

  // Kacha Rastas
  { x: 5000, y: 5000, w: 9750, h: 140, type: 'kacha' },
  { x: 15250, y: 5000, w: 6750, h: 140, type: 'kacha' },
  { x: 5000, y: 15000, w: 140, h: 7000, type: 'kacha' },
  { x: 15250, y: 22000, w: 6750, h: 140, type: 'kacha' },
  { x: 12000, y: 15250, w: 140, h: 9750, type: 'kacha' },
];
