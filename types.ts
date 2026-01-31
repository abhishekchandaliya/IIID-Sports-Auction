
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
  categoryLimits: {
    Cricket: { A: number; B: number; C: number; };
    Badminton: { A: number; B: number; C: number; };
    TT: { A: number; B: number; C: number; };
  };
}

export interface Player {
  id: number;
  name: string;
  team: string | null;
  price: number;
  cricket: string; // 'A', 'B', 'C', '0'
  badminton: string;
  tt: string;
  captainFor?: 'Cricket' | 'Badminton' | 'TT';
  contactNo?: string;
}

export interface ActivityLog {
  id: string;
  type: 'sale' | 'revert' | 'correction' | 'captain';
  message: string;
  timestamp: number;
  details?: {
    playerName: string;
    teamName?: string | null;
    price?: number;
  };
}

export interface TeamStats {
  name: string;
  spent: number;
  playerCount: number;
  
  cricketCount: number;
  cricketCountA: number;
  cricketCountB: number;
  cricketCountC: number;

  badmintonCount: number;
  badmintonCountA: number;
  badmintonCountB: number;
  badmintonCountC: number;

  ttCount: number;
  ttCountA: number;
  ttCountB: number;
  ttCountC: number;

  availableBalance: number;
  disposableBalance: number; // The logic-heavy one
}

export enum Tab {
  DASHBOARD = 'dashboard',
  AUCTION = 'auction',
  ROSTER = 'roster',
  SETTINGS = 'settings'
}