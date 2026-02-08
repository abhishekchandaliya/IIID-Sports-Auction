import { TeamStats, Player, TournamentConfig, TeamValidation } from './types';

export const calculateTeamStats = (
  teamName: string, 
  players: Player[], 
  config: TournamentConfig,
  sports: string[],
  categories: string[]
): TeamStats => {
  const teamPlayers = players.filter(p => p.team === teamName);
  
  const playerCount = teamPlayers.length;
  const spent = teamPlayers.reduce((sum, p) => sum + p.price, 0);
  
  // Initialize Dynamic Stats
  const sportStats: Record<string, { total: number; categoryCounts: Record<string, number> }> = {};
  const sportStatus: TeamValidation['sportStatus'] = {};
  let isTeamValid = true;

  sports.forEach(sport => {
    // Filter players who have a rating !== '0' for this sport
    const sportPlayers = teamPlayers.filter(p => p.ratings[sport] && p.ratings[sport] !== '0');
    
    const categoryCounts: Record<string, number> = {};
    categories.forEach(cat => {
      categoryCounts[cat] = sportPlayers.filter(p => p.ratings[sport] === cat).length;
    });

    const total = sportPlayers.length;
    sportStats[sport] = {
      total,
      categoryCounts
    };

    // Validation Logic
    const limits = config.sportLimits?.[sport] || { min: 0, max: 999 };
    if (total < limits.min) {
        sportStatus[sport] = { status: 'under', limit: limits.min };
        isTeamValid = false;
    } else if (total > limits.max) {
        sportStatus[sport] = { status: 'over', limit: limits.max };
        isTeamValid = false;
    } else {
        sportStatus[sport] = { status: 'ok', limit: 0 };
    }
  });

  const availableBalance = config.purseLimit - spent;
  
  // Rule: Reserve base price for empty slots
  const emptySlots = Math.max(0, config.maxSquadSize - playerCount);
  const reserveAmount = emptySlots * config.basePrice;
  const disposableBalance = availableBalance - reserveAmount;

  return {
    name: teamName,
    spent,
    playerCount,
    sportStats,
    validation: {
        isValid: isTeamValid,
        sportStatus
    },
    availableBalance,
    disposableBalance
  };
};

export const parseCurrency = (val: string): number => {
  if (!val) return 0;
  const clean = val.toLowerCase().replace(/lakhs?/g, '').trim();
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
};

// Normalize sport rating against valid categories
export const normalizeRating = (val: string, validCategories: string[]): string => {
  if (!val) return '0';
  const v = val.trim().toUpperCase();
  return validCategories.includes(v) ? v : '0';
};

// Fisher-Yates Shuffle Algorithm for true randomness
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Color Palette for Dynamic Sports
export const getSportColor = (index: number) => {
  const colors = [
    { name: 'blue', bg: 'bg-blue-600', text: 'text-blue-200', border: 'border-blue-500', soft: 'bg-blue-900/20' },
    { name: 'emerald', bg: 'bg-emerald-600', text: 'text-emerald-200', border: 'border-emerald-500', soft: 'bg-emerald-900/20' },
    { name: 'orange', bg: 'bg-orange-600', text: 'text-orange-200', border: 'border-orange-500', soft: 'bg-orange-900/20' },
    { name: 'purple', bg: 'bg-purple-600', text: 'text-purple-200', border: 'border-purple-500', soft: 'bg-purple-900/20' },
    { name: 'pink', bg: 'bg-pink-600', text: 'text-pink-200', border: 'border-pink-500', soft: 'bg-pink-900/20' },
    { name: 'cyan', bg: 'bg-cyan-600', text: 'text-cyan-200', border: 'border-cyan-500', soft: 'bg-cyan-900/20' },
  ];
  return colors[index % colors.length];
};