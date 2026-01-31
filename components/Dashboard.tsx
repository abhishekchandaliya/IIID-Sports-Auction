import React, { useState, useMemo } from 'react';
import { TeamStats, Player, TournamentConfig } from '../types';
import { Users, Activity, Trophy, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Crown, Wallet, Zap, Gavel, Code } from 'lucide-react';
import { INITIAL_TEAMS } from '../constants';

interface DashboardProps {
  teams: TeamStats[];
  players: Player[];
  onTeamSelect: (teamName: string) => void;
  currentAuctionPlayerId?: string;
  config: TournamentConfig;
}

type SortKey = keyof TeamStats;

const Dashboard: React.FC<DashboardProps> = ({ teams, players, onTeamSelect, currentAuctionPlayerId, config }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'disposableBalance',
    direction: 'desc'
  });

  const totalPlayersSold = teams.reduce((acc, t) => acc + t.playerCount, 0);
  const totalCapacity = INITIAL_TEAMS.length * config.maxSquadSize; 
  const remainingSlots = totalCapacity - totalPlayersSold;

  // Retrieve current player being auctioned
  const currentAuctionPlayer = useMemo(() => {
    if (!currentAuctionPlayerId) return null;
    return players.find(p => p.id.toString() === currentAuctionPlayerId);
  }, [currentAuctionPlayerId, players]);

  const categoryRecords = useMemo(() => {
    const soldPlayers = players.filter(p => p.team); 

    const getHighestBid = (sport: 'cricket' | 'badminton' | 'tt') => {
        const sportPlayers = soldPlayers.filter(p => p[sport] && p[sport] !== '0');
        if (sportPlayers.length === 0) return null;
        return sportPlayers.reduce((max, p) => p.price > max.price ? p : max, sportPlayers[0]);
    };

    return {
        cricket: getHighestBid('cricket'),
        badminton: getHighestBid('badminton'),
        tt: getHighestBid('tt')
    };
  }, [players]);

  const sortedTeams = [...teams].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
    }
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: SortKey) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (columnKey: SortKey) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-slate-700 opacity-50 group-hover:opacity-100" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp className="w-3 h-3 text-amber-400" /> 
          : <ArrowDown className="w-3 h-3 text-amber-400" />;
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 1. LIVE AUCTION BANNER (New) */}
      {currentAuctionPlayer && (
        <div className="bg-gradient-to-r from-red-900/80 to-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-in slide-in-from-top-4">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Gavel className="w-32 h-32 text-red-500 transform -rotate-12" />
            </div>
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/50 animate-pulse">
                        <Zap className="w-8 h-8 text-white fill-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded animate-pulse">
                                🔥 Now On Auction
                            </span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">{currentAuctionPlayer.name}</h2>
                    </div>
                </div>
                
                <div className="flex gap-2">
                    {currentAuctionPlayer.cricket !== '0' && <span className="px-4 py-2 bg-blue-900/40 border border-blue-500/30 text-blue-200 rounded-lg font-bold text-sm">CR: {currentAuctionPlayer.cricket}</span>}
                    {currentAuctionPlayer.badminton !== '0' && <span className="px-4 py-2 bg-emerald-900/40 border border-emerald-500/30 text-emerald-200 rounded-lg font-bold text-sm">BM: {currentAuctionPlayer.badminton}</span>}
                    {currentAuctionPlayer.tt !== '0' && <span className="px-4 py-2 bg-orange-900/40 border border-orange-500/30 text-orange-200 rounded-lg font-bold text-sm">TT: {currentAuctionPlayer.tt}</span>}
                </div>
            </div>
        </div>
      )}

      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-widest">Live Leaderboard</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight projector-text">
                Team Standings
            </h2>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
             {/* Mini Metrics */}
            <div className="flex-1 md:flex-none flex items-center gap-3 bg-slate-900 px-5 py-3 rounded-xl border border-slate-800 shadow-lg">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sold</span>
                    <div className="text-2xl font-black text-white leading-none">{totalPlayersSold}</div>
                </div>
            </div>
            <div className="flex-1 md:flex-none flex items-center gap-3 bg-slate-900 px-5 py-3 rounded-xl border border-slate-800 shadow-lg">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Activity className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Slots</span>
                    <div className="text-2xl font-black text-white leading-none">{remainingSlots}</div>
                </div>
            </div>
            <button 
                onClick={handleRefresh}
                className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all active:scale-95 shadow-lg"
            >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {/* TOP METRICS - High Impact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {/* Cricket Record */}
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 to-slate-900 p-5 rounded-2xl border border-blue-800/50 shadow-xl group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Crown className="w-24 h-24 text-blue-400" />
           </div>
           <div className="relative z-10">
               <h3 className="text-blue-400 text-xs uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                   🏏 Top Cricketer
               </h3>
               {categoryRecords.cricket ? (
                   <div>
                       <div className="text-4xl md:text-5xl font-black text-white mb-1">{categoryRecords.cricket.price}</div>
                       <div className="text-sm font-medium text-blue-200 truncate pr-8">
                           {categoryRecords.cricket.name} <span className="opacity-60 text-xs">({categoryRecords.cricket.team})</span>
                       </div>
                   </div>
               ) : (
                   <div className="text-sm text-slate-600 italic mt-2 font-medium">No bids yet</div>
               )}
           </div>
        </div>

        {/* Badminton Record */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 to-slate-900 p-5 rounded-2xl border border-emerald-800/50 shadow-xl group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Crown className="w-24 h-24 text-emerald-400" />
           </div>
           <div className="relative z-10">
               <h3 className="text-emerald-400 text-xs uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                   🏸 Top Shuttler
               </h3>
               {categoryRecords.badminton ? (
                   <div>
                       <div className="text-4xl md:text-5xl font-black text-white mb-1">{categoryRecords.badminton.price}</div>
                       <div className="text-sm font-medium text-emerald-200 truncate pr-8">
                           {categoryRecords.badminton.name} <span className="opacity-60 text-xs">({categoryRecords.badminton.team})</span>
                       </div>
                   </div>
               ) : (
                   <div className="text-sm text-slate-600 italic mt-2 font-medium">No bids yet</div>
               )}
           </div>
        </div>

        {/* TT Record */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-950 to-slate-900 p-5 rounded-2xl border border-orange-800/50 shadow-xl group">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
               <Crown className="w-24 h-24 text-orange-400" />
           </div>
           <div className="relative z-10">
               <h3 className="text-orange-400 text-xs uppercase font-bold tracking-widest mb-2 flex items-center gap-2">
                   🏓 Top Paddler
               </h3>
               {categoryRecords.tt ? (
                   <div>
                       <div className="text-4xl md:text-5xl font-black text-white mb-1">{categoryRecords.tt.price}</div>
                       <div className="text-sm font-medium text-orange-200 truncate pr-8">
                           {categoryRecords.tt.name} <span className="opacity-60 text-xs">({categoryRecords.tt.team})</span>
                       </div>
                   </div>
               ) : (
                   <div className="text-sm text-slate-600 italic mt-2 font-medium">No bids yet</div>
               )}
           </div>
        </div>
      </div>

      {/* LEADERBOARD TABLE - Projector Optimized */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl ring-1 ring-white/5">
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-auto min-w-[800px]">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700">
                {/* Team & Finance Headers */}
                <th rowSpan={2} className="px-4 py-3 font-bold w-[20%] cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort('name')}>
                    <div className="flex items-center gap-1">Team {getSortIcon('name')}</div>
                </th>
                <th rowSpan={2} className="px-3 py-3 font-bold text-right w-[12%] cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort('disposableBalance')}>
                    <div className="flex items-center justify-end gap-1">Purse {getSortIcon('disposableBalance')}</div>
                </th>
                <th rowSpan={2} className="px-3 py-3 font-bold text-center w-[8%] cursor-pointer hover:bg-slate-800/50" onClick={() => handleSort('playerCount')}>
                     <div className="flex items-center justify-center gap-1">Size {getSortIcon('playerCount')}</div>
                </th>
                
                {/* Sport Group Headers */}
                <th colSpan={4} className="px-1 py-2 font-bold text-center bg-blue-950/20 border-l border-slate-800 text-blue-400 w-[20%]">
                    Cricket
                </th>
                <th colSpan={4} className="px-1 py-2 font-bold text-center bg-emerald-950/20 border-l border-slate-800 text-emerald-400 w-[20%]">
                    Badminton
                </th>
                <th colSpan={4} className="px-1 py-2 font-bold text-center bg-orange-950/20 border-l border-slate-800 text-orange-400 w-[20%]">
                    TT
                </th>
              </tr>
              
              {/* Sub Headers for Sports */}
              <tr className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-700">
                  {/* Cricket */}
                  <th className="py-2 text-center bg-blue-950/20 border-l border-slate-800 hover:text-white cursor-pointer" onClick={() => handleSort('cricketCount')}>Tot</th>
                  <th className="py-2 text-center bg-blue-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('cricketCountA')}>A</th>
                  <th className="py-2 text-center bg-blue-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('cricketCountB')}>B</th>
                  <th className="py-2 text-center bg-blue-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('cricketCountC')}>C</th>

                  {/* Badminton */}
                  <th className="py-2 text-center bg-emerald-950/20 border-l border-slate-800 hover:text-white cursor-pointer" onClick={() => handleSort('badmintonCount')}>Tot</th>
                  <th className="py-2 text-center bg-emerald-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('badmintonCountA')}>A</th>
                  <th className="py-2 text-center bg-emerald-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('badmintonCountB')}>B</th>
                  <th className="py-2 text-center bg-emerald-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('badmintonCountC')}>C</th>

                  {/* TT */}
                  <th className="py-2 text-center bg-orange-950/20 border-l border-slate-800 hover:text-white cursor-pointer" onClick={() => handleSort('ttCount')}>Tot</th>
                  <th className="py-2 text-center bg-orange-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('ttCountA')}>A</th>
                  <th className="py-2 text-center bg-orange-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('ttCountB')}>B</th>
                  <th className="py-2 text-center bg-orange-950/20 hover:text-white cursor-pointer" onClick={() => handleSort('ttCountC')}>C</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedTeams.map((team, index) => {
                 return (
                  <tr key={team.name} className="hover:bg-slate-800/60 transition-colors group">
                    {/* Team Name - Compact but Readable */}
                    <td 
                      onClick={() => onTeamSelect(team.name)}
                      className="px-4 py-5 truncate max-w-[200px] cursor-pointer"
                    >
                        <div className="flex items-center gap-3 group-hover:translate-x-1 transition-transform">
                            <span className={`text-sm font-black w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-md ${index < 3 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500'}`}>
                                {index + 1}
                            </span>
                            <span className="text-lg font-bold text-white tracking-tight truncate group-hover:text-indigo-400 transition-colors" title={`View ${team.name} Details`}>{team.name}</span>
                        </div>
                    </td>

                    {/* Available Balance - Big Numbers */}
                    <td className="px-3 py-5 text-right bg-slate-800/30">
                        <span className={`text-3xl font-black font-mono tracking-tight ${team.disposableBalance < 200 ? 'text-red-400' : 'text-emerald-400'} projector-text`}>
                            {team.disposableBalance}
                        </span>
                    </td>

                    {/* Player Count */}
                    <td className="px-3 py-5 text-center">
                        <span className="text-xl font-bold text-white">{team.playerCount}</span>
                        <span className="text-xs text-slate-600 ml-0.5 font-bold">/{config.maxSquadSize}</span>
                    </td>

                    {/* CRICKET STATS - Big Fonts */}
                    <td className="px-1 py-4 text-center bg-blue-900/5 border-l border-slate-800/50">
                        <span className="text-2xl font-black text-blue-300">{team.cricketCount}</span>
                    </td>
                    <td className="px-1 py-4 text-center bg-blue-900/5 text-slate-300 font-bold text-lg opacity-60">{team.cricketCountA}</td>
                    <td className="px-1 py-4 text-center bg-blue-900/5 text-slate-400 font-bold text-lg opacity-60">{team.cricketCountB}</td>
                    <td className="px-1 py-4 text-center bg-blue-900/5 text-slate-500 font-bold text-lg opacity-60">{team.cricketCountC}</td>

                    {/* BADMINTON STATS - Big Fonts */}
                    <td className="px-1 py-4 text-center bg-emerald-900/5 border-l border-slate-800/50">
                        <span className="text-2xl font-black text-emerald-300">{team.badmintonCount}</span>
                    </td>
                    <td className="px-1 py-4 text-center bg-emerald-900/5 text-slate-300 font-bold text-lg opacity-60">{team.badmintonCountA}</td>
                    <td className="px-1 py-4 text-center bg-emerald-900/5 text-slate-400 font-bold text-lg opacity-60">{team.badmintonCountB}</td>
                    <td className="px-1 py-4 text-center bg-emerald-900/5 text-slate-500 font-bold text-lg opacity-60">{team.badmintonCountC}</td>

                    {/* TT STATS - Big Fonts */}
                    <td className="px-1 py-4 text-center bg-orange-900/5 border-l border-slate-800/50">
                        <span className="text-2xl font-black text-orange-300">{team.ttCount}</span>
                    </td>
                    <td className="px-1 py-4 text-center bg-orange-900/5 text-slate-300 font-bold text-lg opacity-60">{team.ttCountA}</td>
                    <td className="px-1 py-4 text-center bg-orange-900/5 text-slate-400 font-bold text-lg opacity-60">{team.ttCountB}</td>
                    <td className="px-1 py-4 text-center bg-orange-900/5 text-slate-500 font-bold text-lg opacity-60">{team.ttCountC}</td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER: Signature (New) */}
      <footer className="w-full text-center py-6 mt-10 text-slate-600 border-t border-slate-800/50">
        <div className="flex items-center justify-center gap-2">
            <span className="text-indigo-500"><Zap className="w-4 h-4" /></span>
            <span className="text-sm font-medium">Digital Auction System developed by <strong className="text-slate-400">Ar. Abhishek Chandaliya</strong></span>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;