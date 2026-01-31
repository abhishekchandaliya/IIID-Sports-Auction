import { TournamentConfig } from "./types";

export const TEAM_NAMES = [
  "Aditya Avengers",
  "Alfen Royals",
  "Lantern Legends",
  "Primark Superkings",
  "Sai Kripa Soldiers",
  "Taluka Fighters"
];

export const DEFAULT_CONFIG: TournamentConfig = {
  purseLimit: 2500,
  maxSquadSize: 35,
  basePrice: 10,
  categoryLimits: {
    Cricket: { A: 4, B: 4, C: 4 },
    Badminton: { A: 2, B: 2, C: 2 },
    TT: { A: 2, B: 2, C: 2 }
  }
};

export const INITIAL_TEAMS = TEAM_NAMES.map(name => ({
  name,
  spent: 0,
  playerCount: 0,
  
  cricketCount: 0,
  cricketCountA: 0,
  cricketCountB: 0,
  cricketCountC: 0,

  badmintonCount: 0,
  badmintonCountA: 0,
  badmintonCountB: 0,
  badmintonCountC: 0,

  ttCount: 0,
  ttCountA: 0,
  ttCountB: 0,
  ttCountC: 0,

  availableBalance: 0, // Placeholder, calculated dynamically
  disposableBalance: 0 // Placeholder, calculated dynamically
}));