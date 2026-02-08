

// Global types

// PapaParse declaration for window object
declare global {
  interface Window {
    Papa: any;
  }
}

export interface TournamentConfig {
  purseLimit: number;
  maxSquadSize: number;
  basePrice: number;
  // Dynamic limits: { "Cricket": { "A": 2, "B": 2 }, "Football": { ... } }
  categoryLimits: Record<string, Record<string, number>>;
  // Dynamic Max limits: { "Cricket": { "A": 5, "B": 5 } }
  categoryMaxLimits: Record<string, Record<string, number>>;
  // Squad Rules: { "Cricket": { min: 4, max: 10 } }
  sportLimits: Record<string, { min: number; max: number }>;
}

export interface Player {
  id: number;
  name: string;
  gender?: string; // New Field: Male, Female, Kid
  team: string | null;
  price: number;
  // Dynamic Ratings: { "Cricket": "A", "Badminton": "0", "Football": "B" }
  ratings: Record<string, string>; 
  captainFor?: string; // Now stores the Sport Name dynamically
  contactNo?: string;
  status: 'available' | 'sold' | 'unsold';
  auctionType: 'LIVE' | 'LOTTERY'; // New Field: Determines if they appear in live bidding or lottery
}

export interface ActivityLog {
  id: string;
  type: 'sale' | 'revert' | 'correction' | 'captain' | 'unsold' | 'autofill';
  message: string;
  timestamp: number;
  details?: {
    playerName: string;
    teamName?: string | null;
    price?: number;
  };
}

export interface SportStat {
  total: number;
  // Counts per category: { "A": 2, "B": 1, "C": 0 }
  categoryCounts: Record<string, number>; 
}

export interface TeamValidation {
  // Status per sport: "ok", "under" (needs more), "over" (too many)
  sportStatus: Record<string, { status: 'ok' | 'under' | 'over'; limit: number }>;
  isValid: boolean;
}

export interface TeamStats {
  name: string;
  spent: number;
  playerCount: number;
  
  // Dynamic Stats keyed by Sport Name
  sportStats: Record<string, SportStat>;
  validation: TeamValidation;

  availableBalance: number;
  disposableBalance: number;
}

export interface AutoFillAssignment {
  playerId: number;
  playerName: string;
  teamName: string;
  reason: string;
  sport?: string;
}

export enum Tab {
  DASHBOARD = 'dashboard',
  AUCTION = 'auction',
  ROSTER = 'roster',
  SETTINGS = 'settings'
}