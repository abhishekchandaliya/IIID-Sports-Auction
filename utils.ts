
import { TeamStats, Player, TournamentConfig } from './types';

export const calculateTeamStats = (teamName: string, players: Player[], config: TournamentConfig): TeamStats => {
  const teamPlayers = players.filter(p => p.team === teamName);
  
  const playerCount = teamPlayers.length;
  const spent = teamPlayers.reduce((sum, p) => sum + p.price, 0);
  
  // Cricket Stats
  const cricketPlayers = teamPlayers.filter(p => p.cricket && p.cricket !== '0');
  const cricketCount = cricketPlayers.length;
  const cricketCountA = cricketPlayers.filter(p => p.cricket === 'A').length;
  const cricketCountB = cricketPlayers.filter(p => p.cricket === 'B').length;
  const cricketCountC = cricketPlayers.filter(p => p.cricket === 'C').length;

  // Badminton Stats
  const badmintonPlayers = teamPlayers.filter(p => p.badminton && p.badminton !== '0');
  const badmintonCount = badmintonPlayers.length;
  const badmintonCountA = badmintonPlayers.filter(p => p.badminton === 'A').length;
  const badmintonCountB = badmintonPlayers.filter(p => p.badminton === 'B').length;
  const badmintonCountC = badmintonPlayers.filter(p => p.badminton === 'C').length;

  // TT Stats
  const ttPlayers = teamPlayers.filter(p => p.tt && p.tt !== '0');
  const ttCount = ttPlayers.length;
  const ttCountA = ttPlayers.filter(p => p.tt === 'A').length;
  const ttCountB = ttPlayers.filter(p => p.tt === 'B').length;
  const ttCountC = ttPlayers.filter(p => p.tt === 'C').length;

  const availableBalance = config.purseLimit - spent;
  
  // Rule: Available Balance = Purse - Spent - ((Max_Squad - Current_Player_Count) * Base_Price)
  // We reserve the base price for every empty slot to ensure the team can fill the roster.
  const emptySlots = Math.max(0, config.maxSquadSize - playerCount);
  const reserveAmount = emptySlots * config.basePrice;
  const disposableBalance = availableBalance - reserveAmount;

  return {
    name: teamName,
    spent,
    playerCount,
    
    cricketCount,
    cricketCountA,
    cricketCountB,
    cricketCountC,

    badmintonCount,
    badmintonCountA,
    badmintonCountB,
    badmintonCountC,

    ttCount,
    ttCountA,
    ttCountB,
    ttCountC,

    availableBalance,
    disposableBalance
  };
};

export const parseCurrency = (val: string): number => {
  if (!val) return 0;
  // Handle "10 Lakhs" -> 10, "200" -> 200
  const clean = val.toLowerCase().replace(/lakhs?/g, '').trim();
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
};

// Normalize sport rating (handle CSV inconsistencies if any)
export const normalizeRating = (val: string): string => {
  if (!val) return '0';
  const v = val.trim().toUpperCase();
  return ['A', 'B', 'C'].includes(v) ? v : '0';
};