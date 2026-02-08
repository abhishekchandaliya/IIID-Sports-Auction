import { TournamentConfig } from "./types";

export const DEFAULT_TEAM_NAMES = [
  "Aditya Avengers",
  "Alfen Royals",
  "Lantern Legends",
  "Primark Superkings",
  "Sai Kripa Soldiers",
  "Taluka Fighters"
];

export const DEFAULT_SPORTS = ["Cricket", "Badminton", "TT"];
export const DEFAULT_CATEGORIES = ["A", "B", "C"];

export const DEFAULT_CONFIG: TournamentConfig = {
  purseLimit: 2500,
  maxSquadSize: 35,
  basePrice: 10,
  // This will now be dynamically initialized in App.tsx based on sports/categories
  categoryLimits: {
    Cricket: { A: 4, B: 4, C: 4 },
    Badminton: { A: 2, B: 2, C: 2 },
    TT: { A: 2, B: 2, C: 2 }
  },
  categoryMaxLimits: {
    Cricket: { A: 99, B: 99, C: 99 },
    Badminton: { A: 99, B: 99, C: 99 },
    TT: { A: 99, B: 99, C: 99 }
  },
  sportLimits: {
    Cricket: { min: 0, max: 20 },
    Badminton: { min: 0, max: 10 },
    TT: { min: 0, max: 10 }
  }
};