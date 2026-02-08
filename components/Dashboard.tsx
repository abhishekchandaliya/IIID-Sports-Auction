import React, { useState, useMemo } from 'react';
import { TeamStats, Player, TournamentConfig } from '../types';
import { Users, Activity, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, Crown, Zap, Gavel, Award } from 'lucide-react';
import { getSportColor } from '../utils';

interface DashboardProps {
  teams: TeamStats[];
  players: Player[];
  onTeamSelect: (teamName: string) => void;
  currentAuctionPlayerId?: string;
  config: TournamentConfig;
  sports: string[];
  categories: string[];
}

const Dashboard: React.FC<DashboardProps> = ({ teams, players, onTeamSelect, currentAuctionPlayerId, config, sports, categories }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'disposableBalance',
    direction: 'desc'
  });

  const totalPlayersSold = teams.reduce((acc, t) => acc + t.playerCount, 0);
  const totalCapacity = teams.length * config.maxSquadSize; 
  const remainingSlots = totalCapacity - totalPlayersSold;

  const currentAuctionPlayer = useMemo(() => players.find(p => p.id.toString() === currentAuctionPlayerId), [currentAuctionPlayerId, players]);

  // Dynamic Highest Bids
  const highestBids = useMemo(() => {
    const soldPlayers = players.filter(p => p.team); 
    const records: Record<string, Player | null> = {};
    sports.forEach(sport => {
        const sportPlayers = soldPlayers.filter(p => p.ratings[sport] && p.ratings[sport] !== '0');
        if (sportPlayers.length > 0) {
            records[sport] = sportPlayers.reduce((max, p) => p.price > max.price ? p : max, sportPlayers[0]);
        } else {
            records[sport] = null;
        }
    });
    return records;
  }, [players, sports]);

  const sortedTeams = [...teams].sort((a, b) => {
    // Helper to get value for sorting
    const getValue = (obj: any, key: string) => {
        if (key.includes('.')) {
            const [k1, k2, k3] = key.split('.');
            if(k3) return obj[k1]?.[k2]?.[k3] || 0;
            if(k2) return obj[k1]?.[k2] || 0;
            return 0;
        }
        return obj[key];
    };

    const aValue = getValue(a, sortConfig.key);
    const bValue = getValue(b, sortConfig.key);
    
    if (typeof aValue === 'string' && typeof bValue === 'string') return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: string) => {
    setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIcon = (columnKey: string) => {
      if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3 h-3 text-slate-700 opacity-50 group-hover:opacity-100" />;
      return sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-amber-400" /> : <ArrowDown className="w-3 h-3 text-amber-400" />;
  };

  const getTopStatLabel = (sport: string) => {
      const s = sport.toLowerCase();
      if (s.includes('cricket')) return 'HIGHEST PAID CRICKETER';
      if (s.includes('badminton')) return 'HIGHEST PAID SHUTTLER';
      if (s.includes('tt') || s.includes('table')) return 'HIGHEST PAID PADDLER';
      return `HIGHEST PAID ${sport.toUpperCase()}`;
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. LIVE AUCTION BANNER */}
      {currentAuctionPlayer && (
        <div className="bg-gradient-to-r from-red-900/80 to-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg animate-pulse"><Zap className="w-8 h-8 text-white fill-white" /></div>
                    <div>
                        <div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded animate-pulse">🔥 Now On Auction</span></div>
                        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">{currentAuctionPlayer.name}</h2>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                    {sports.map((sport, i) => {
                        const rating = currentAuctionPlayer.ratings[sport];
                        if (!rating || rating === '0') return null;
                        const colors = getSportColor(i);
                        return <span key={sport} className={`px-4 py-2 ${colors.soft} border ${colors.border} ${colors.text} rounded-lg font-bold text-sm`}>{sport}: {rating}</span>
                    })}
                </div>
            </div>
        </div>
      )}

      {/* HEADER ROW */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div><h2 className="text-3xl md:text-4xl font-black text-white tracking-tight projector-text">Team Standings</h2></div>
        <div className="flex gap-3">
            <div className="flex items-center gap-3 bg-slate-900 px-5 py-3 rounded-xl border border-slate-800"><Users className="w-5 h-5 text-blue-400" /><div><span className="text-[10px] text-slate-400 uppercase font-bold">Sold</span><div className="text-2xl font-black text-white leading-none">{totalPlayersSold}</div></div></div>
            <div className="flex items-center gap-3 bg-slate-900 px-5 py-3 rounded-xl border border-slate-800"><Activity className="w-5 h-5 text-orange-400" /><div><span className="text-[10px] text-slate-400 uppercase font-bold">Slots</span><div className="text-2xl font-black text-white leading-none">{remainingSlots}</div></div></div>
            <button onClick={() => { setIsRefreshing(true); setTimeout(() => setIsRefreshing(false), 800); }} className="p-4 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700"><RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* DYNAMIC TOP METRICS (UPDATED) */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sports.map((sport, index) => {
            const colors = getSportColor(index);
            const record = highestBids[sport];
            return (
                <div key={sport} className={`relative overflow-hidden bg-slate-900 p-6 rounded-2xl border ${colors.border} shadow-xl group text-center`}>
                    <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Award className={`w-12 h-12 ${colors.text}`} />
                    </div>
                    <div className="relative z-10 flex flex-col items-center">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                            {getTopStatLabel(sport)}
                        </h3>
                        {record ? (
                            <div className="flex flex-col items-center w-full">
                                <div className="text-3xl font-black text-emerald-400 mb-1 leading-none">
                                    {record.price}
                                </div>
                                <div className="text-lg font-bold text-white mb-2 truncate max-w-full">
                                    {record.name}
                                </div>
                                <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30 truncate max-w-full">
                                    {record.team}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="text-sm text-slate-600 italic font-medium">No bids yet</div>
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>

      {/* DYNAMIC LEADERBOARD */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-auto min-w-[1000px]">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-[10px] md:text-xs uppercase tracking-wider border-b border-slate-700">
                <th rowSpan={2} className="px-4 py-3 font-bold w-[200px] sticky left-0 bg-slate-950 z-10 cursor-pointer" onClick={() => handleSort('name')}>Team {getSortIcon('name')}</th>
                <th rowSpan={2} className="px-3 py-3 font-bold text-right cursor-pointer" onClick={() => handleSort('disposableBalance')}>Purse {getSortIcon('disposableBalance')}</th>
                <th rowSpan={2} className="px-3 py-3 font-bold text-center cursor-pointer" onClick={() => handleSort('playerCount')}>Size {getSortIcon('playerCount')}</th>
                
                {sports.map((sport, i) => (
                    <th key={sport} colSpan={categories.length + 1} className={`px-1 py-2 font-bold text-center border-l border-slate-800 ${getSportColor(i).text} ${getSportColor(i).soft}`}>
                        {sport}
                    </th>
                ))}
              </tr>
              <tr className="bg-slate-950 text-[10px] text-slate-500 font-bold uppercase border-b border-slate-700">
                  {sports.map((sport, i) => (
                      <React.Fragment key={sport}>
                          <th className="py-2 text-center border-l border-slate-800 cursor-pointer hover:text-white" onClick={() => handleSort(`sportStats.${sport}.total`)}>Tot</th>
                          {categories.map(cat => (
                              <th key={cat} className="py-2 text-center cursor-pointer hover:text-white" onClick={() => handleSort(`sportStats.${sport}.categoryCounts.${cat}`)}>{cat}</th>
                          ))}
                      </React.Fragment>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedTeams.map((team, index) => (
                  <tr key={team.name} className="hover:bg-slate-800/60 transition-colors">
                    <td onClick={() => onTeamSelect(team.name)} className="px-4 py-5 sticky left-0 bg-slate-900/90 hover:bg-slate-800 cursor-pointer z-10 border-r border-slate-800">
                        <div className="flex items-center gap-3">
                            <span className={`text-xs font-black w-5 h-5 flex items-center justify-center rounded ${index < 3 ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-500'}`}>{index + 1}</span>
                            <span className="font-bold text-white truncate max-w-[150px]">{team.name}</span>
                        </div>
                    </td>
                    <td className="px-3 py-5 text-right bg-slate-800/30"><span className={`text-2xl font-black font-mono tracking-tight ${team.disposableBalance < 200 ? 'text-red-400' : 'text-emerald-400'}`}>{team.disposableBalance}</span></td>
                    <td className="px-3 py-5 text-center"><span className="text-white font-bold">{team.playerCount}</span><span className="text-xs text-slate-600">/{config.maxSquadSize}</span></td>
                    
                    {sports.map((sport, i) => {
                         const stats = team.sportStats[sport] || { total: 0, categoryCounts: {} };
                         const validation = team.validation?.sportStatus?.[sport];
                         const colors = getSportColor(i);
                         
                         let statusClass = colors.text;
                         let warningText = "";
                         if (validation?.status === 'under') {
                             statusClass = "text-red-500 font-bold";
                             warningText = `(Min ${validation.limit})`;
                         } else if (validation?.status === 'over') {
                             statusClass = "text-red-500 font-bold";
                             warningText = `(Max ${validation.limit})`;
                         }

                         return (
                             <React.Fragment key={sport}>
                                 <td className={`px-1 py-4 text-center border-l border-slate-800/50 ${colors.soft}`}>
                                     <div className="flex flex-col items-center">
                                        <span className={`text-xl font-black ${statusClass}`}>{stats.total}</span>
                                        {warningText && <span className="text-[9px] text-red-400 font-bold whitespace-nowrap">{warningText}</span>}
                                     </div>
                                 </td>
                                 {categories.map(cat => (
                                     <td key={cat} className={`px-1 py-4 text-center ${colors.soft} text-slate-400 font-bold opacity-60`}>{stats.categoryCounts[cat] || 0}</td>
                                 ))}
                             </React.Fragment>
                         )
                    })}
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;