import React, { useState, useEffect } from 'react';
import { Player, TeamStats, ActivityLog, TournamentConfig } from '../types';
import { ChevronDown, ChevronUp, Crown, Zap, Bell, Target, Wallet, Users, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, PenTool } from 'lucide-react';

interface RosterViewProps {
  players: Player[];
  teams: TeamStats[];
  recentActivity: ActivityLog[];
  targetTeam?: string | null;
  config: TournamentConfig;
}

type SortKey = keyof Player | 'price'; 

const RosterView: React.FC<RosterViewProps> = ({ players, teams, recentActivity = [], targetTeam, config }) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [highlightSport, setHighlightSport] = useState<'none' | 'cricket' | 'badminton' | 'tt'>('none');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'price',
    direction: 'desc' // Default to highest price first
  });

  useEffect(() => {
    if (targetTeam) {
        setExpandedTeam(targetTeam);
        // Delay scroll slightly to allow render
        setTimeout(() => {
            const element = document.getElementById(`team-${targetTeam.replace(/\s+/g, '-')}`);
            if(element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }
  }, [targetTeam]);

  const toggleTeam = (teamName: string) => {
    setExpandedTeam(prev => prev === teamName ? null : teamName);
  };

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const getSortIcon = (key: SortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-600 opacity-50" />;
      return sortConfig.direction === 'asc' 
        ? <ArrowUp className="w-3 h-3 ml-1 text-indigo-400" /> 
        : <ArrowDown className="w-3 h-3 ml-1 text-indigo-400" />;
  };

  // Helper to check if a team needs attention based on the highlight setting
  const needsAttention = (team: TeamStats) => {
      if (highlightSport === 'cricket') return team.cricketCount < 6;
      if (highlightSport === 'badminton') return team.badmintonCount < 4; // Assuming 4 is threshold for BM
      if (highlightSport === 'tt') return team.ttCount < 4; // Assuming 4 is threshold for TT
      return false;
  };

  const getAttentionColor = () => {
      if (highlightSport === 'cricket') return 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]';
      if (highlightSport === 'badminton') return 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
      if (highlightSport === 'tt') return 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]';
      return 'border-slate-700';
  };

  const getActivityStyle = (type: ActivityLog['type']) => {
      switch(type) {
          case 'sale': return 'bg-gradient-to-r from-emerald-900/40 to-slate-900 border-emerald-500/30';
          case 'revert': return 'bg-gradient-to-r from-red-900/40 to-slate-900 border-red-500/30';
          case 'correction': return 'bg-gradient-to-r from-amber-900/40 to-slate-900 border-amber-500/30';
          case 'captain': return 'bg-gradient-to-r from-indigo-900/40 to-slate-900 border-indigo-500/30';
          default: return 'bg-slate-900 border-slate-700';
      }
  };

  const getActivityIcon = (type: ActivityLog['type']) => {
      switch(type) {
          case 'sale': return <Bell className="w-5 h-5 text-emerald-400" />;
          case 'revert': return <AlertTriangle className="w-5 h-5 text-red-400" />;
          case 'correction': return <PenTool className="w-5 h-5 text-amber-400" />;
          case 'captain': return <Crown className="w-5 h-5 text-indigo-400" />;
          default: return <Bell className="w-5 h-5 text-slate-400" />;
      }
  };

  // Basic Markdown Bold Parser for **text**
  const formatMessage = (msg: string) => {
      const parts = msg.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-white font-black bg-white/10 px-1 rounded mx-0.5">{part.slice(2, -2)}</strong>;
          }
          return part;
      });
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* 1. RECENT ACTIVITY LOG (Updated) */}
      {recentActivity.length > 0 && (
          <div className="space-y-2">
              <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider px-1">Audit Trail & Activity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {recentActivity.map((activity, index) => (
                      <div key={activity.id} className={`${getActivityStyle(activity.type)} border rounded-xl p-3 flex items-start gap-3 shadow-lg animate-in slide-in-from-top-4`} style={{ animationDelay: `${index * 50}ms` }}>
                          <div className={`p-2 rounded-full bg-slate-800/50 border border-slate-700/50 flex-shrink-0`}>
                              {getActivityIcon(activity.type)}
                          </div>
                          <div className="overflow-hidden min-w-0">
                              <div className="text-sm font-bold text-slate-200 break-words leading-tight">{formatMessage(activity.message)}</div>
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                                  <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                                  {activity.type === 'revert' && <span className="text-red-400 font-bold uppercase tracking-wider">Undone</span>}
                                  {activity.type === 'correction' && <span className="text-amber-400 font-bold uppercase tracking-wider">Edited</span>}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 2. AUCTIONEER'S AID (Smart Highlight) */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-3 md:mb-0">
              <Target className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-white">Auctioneer's Context:</span>
              <span className="text-sm text-slate-400">Highlight teams needing players</span>
          </div>
          <div className="flex gap-2">
              <button 
                onClick={() => setHighlightSport('none')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${highlightSport === 'none' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >
                  None
              </button>
              <button 
                onClick={() => setHighlightSport('cricket')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border flex items-center gap-2 ${highlightSport === 'cricket' ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-700 text-slate-400 border-transparent hover:bg-slate-600'}`}
              >
                  🏏 Cricket {highlightSport === 'cricket' && <span className="text-xs opacity-70">(&lt;6)</span>}
              </button>
              <button 
                onClick={() => setHighlightSport('badminton')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border flex items-center gap-2 ${highlightSport === 'badminton' ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-slate-700 text-slate-400 border-transparent hover:bg-slate-600'}`}
              >
                  🏸 Badminton {highlightSport === 'badminton' && <span className="text-xs opacity-70">(&lt;4)</span>}
              </button>
              <button 
                onClick={() => setHighlightSport('tt')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border flex items-center gap-2 ${highlightSport === 'tt' ? 'bg-orange-600 text-white border-orange-400' : 'bg-slate-700 text-slate-400 border-transparent hover:bg-slate-600'}`}
              >
                  🏓 TT {highlightSport === 'tt' && <span className="text-xs opacity-70">(&lt;4)</span>}
              </button>
          </div>
      </div>

      {/* 3. TEAM GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {teams.map(team => {
             const isHighlighted = needsAttention(team);
             const isExpanded = expandedTeam === team.name;
             const playersInTeam = players.filter(p => p.team === team.name);

             // Apply Sorting
             const sortedPlayers = [...playersInTeam].sort((a, b) => {
                 let valA = a[sortConfig.key];
                 let valB = b[sortConfig.key];

                 // Handle potential undefined or null
                 if (valA === undefined || valA === null) valA = '';
                 if (valB === undefined || valB === null) valB = '';

                 // Numeric Sort for Price
                 if (sortConfig.key === 'price') {
                     // Ensure numeric comparison
                     return sortConfig.direction === 'asc' 
                        ? (a.price - b.price) 
                        : (b.price - a.price);
                 }

                 // Default String Sort (Name, Sports)
                 if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                 if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                 return 0;
             });

             return (
                 <div 
                    key={team.name}
                    id={`team-${team.name.replace(/\s+/g, '-')}`}
                    className={`bg-slate-900 rounded-xl overflow-hidden border-2 transition-all duration-300 relative flex flex-col ${isHighlighted ? getAttentionColor() : 'border-slate-800 hover:border-slate-600'} ${isExpanded ? 'ring-2 ring-indigo-500/50 shadow-2xl scale-[1.01] z-10' : ''}`}
                 >
                     {/* Highlight Badge */}
                     {isHighlighted && (
                         <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg z-10 animate-pulse">
                             NEEDS PLAYERS
                         </div>
                     )}

                     {/* CARD HEADER - Summary */}
                     <div className="p-5 border-b border-slate-800 bg-slate-800/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="flex flex-col justify-center">
                             <h2 className="text-2xl font-black text-white leading-tight tracking-tight">{team.name}</h2>
                             <div className="flex items-center gap-3 mt-2">
                                 <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${team.disposableBalance < 200 ? 'bg-red-950/30 border-red-900/50 text-red-200' : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-200'}`}>
                                    <Wallet className="w-4 h-4" />
                                    <span className="font-mono font-bold text-lg">{team.disposableBalance}</span>
                                 </div>
                                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300">
                                    <Users className="w-4 h-4" />
                                    <span className="font-bold">{team.playerCount}/{config.maxSquadSize}</span>
                                 </div>
                             </div>
                         </div>
                         
                         {/* Mini Stat Matrix */}
                         <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-blue-900/20 rounded-lg p-2 border border-blue-900/30">
                                <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Cricket</div>
                                <div className="text-xl font-black text-white leading-none">{team.cricketCount}</div>
                                <div className="flex justify-center gap-1 mt-1 text-[10px] font-mono text-blue-300/70">
                                    <span>A:{team.cricketCountA}</span>
                                    <span>B:{team.cricketCountB}</span>
                                    <span>C:{team.cricketCountC}</span>
                                </div>
                            </div>
                            <div className="bg-emerald-900/20 rounded-lg p-2 border border-emerald-900/30">
                                <div className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Badminton</div>
                                <div className="text-xl font-black text-white leading-none">{team.badmintonCount}</div>
                                <div className="flex justify-center gap-1 mt-1 text-[10px] font-mono text-emerald-300/70">
                                    <span>A:{team.badmintonCountA}</span>
                                    <span>B:{team.badmintonCountB}</span>
                                    <span>C:{team.badmintonCountC}</span>
                                </div>
                            </div>
                            <div className="bg-orange-900/20 rounded-lg p-2 border border-orange-900/30">
                                <div className="text-[10px] font-bold text-orange-400 uppercase mb-1">Table Tennis</div>
                                <div className="text-xl font-black text-white leading-none">{team.ttCount}</div>
                                <div className="flex justify-center gap-1 mt-1 text-[10px] font-mono text-orange-300/70">
                                    <span>A:{team.ttCountA}</span>
                                    <span>B:{team.ttCountB}</span>
                                    <span>C:{team.ttCountC}</span>
                                </div>
                            </div>
                         </div>
                     </div>

                     {/* EXPANDER TOGGLE */}
                     <button 
                        onClick={() => toggleTeam(team.name)}
                        className={`w-full py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors ${isExpanded ? 'bg-slate-800 text-white border-b border-slate-700' : 'bg-slate-900 text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
                     >
                         {isExpanded ? (
                             <>Hide Roster <ChevronUp className="w-3 h-3" /></>
                         ) : (
                             <>View Full Roster <ChevronDown className="w-3 h-3" /></>
                         )}
                     </button>

                     {/* EXPANDED ROSTER - DETAIL VIEW */}
                     {isExpanded && (
                         <div className="flex-1 bg-slate-950 p-4 border-t border-slate-800 animate-in slide-in-from-top-2">
                             {sortedPlayers.length === 0 ? (
                                 <div className="text-center text-slate-600 py-8 border-2 border-dashed border-slate-800 rounded-xl">
                                     <LayoutList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                     <p>No players purchased yet.</p>
                                 </div>
                             ) : (
                                 <div className="overflow-x-auto">
                                     <table className="w-full text-sm text-left border-collapse">
                                         <thead>
                                             <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                                                 <th 
                                                    className="p-3 cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors rounded-tl-lg" 
                                                    onClick={() => handleSort('name')}
                                                 >
                                                    <div className="flex items-center">Player Name {getSortIcon('name')}</div>
                                                 </th>
                                                 <th 
                                                    className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors"
                                                    onClick={() => handleSort('price')}
                                                 >
                                                    <div className="flex items-center justify-center">Price {getSortIcon('price')}</div>
                                                 </th>
                                                 <th 
                                                    className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors"
                                                    onClick={() => handleSort('cricket')}
                                                 >
                                                    <div className="flex items-center justify-center">Cricket {getSortIcon('cricket')}</div>
                                                 </th>
                                                 <th 
                                                    className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors"
                                                    onClick={() => handleSort('badminton')}
                                                 >
                                                    <div className="flex items-center justify-center">Badminton {getSortIcon('badminton')}</div>
                                                 </th>
                                                 <th 
                                                    className="p-3 text-center cursor-pointer hover:text-white hover:bg-slate-800/50 transition-colors rounded-tr-lg"
                                                    onClick={() => handleSort('tt')}
                                                 >
                                                    <div className="flex items-center justify-center">TT {getSortIcon('tt')}</div>
                                                 </th>
                                             </tr>
                                         </thead>
                                         <tbody className="divide-y divide-slate-900">
                                             {sortedPlayers.map(p => (
                                                 <tr key={p.id} className="group hover:bg-slate-900/50 transition-colors">
                                                     <td className="p-3 font-medium text-slate-200">
                                                         <div className="flex items-center gap-2">
                                                            {p.captainFor && (
                                                                <span title={`Captain for ${p.captainFor}`} className="flex items-center justify-center w-5 h-5 bg-amber-500/20 rounded text-lg leading-none cursor-help">👑</span>
                                                            )}
                                                            <div className="flex flex-col">
                                                                <span className={p.captainFor ? "text-amber-100 font-bold" : ""}>
                                                                    {p.name}
                                                                </span>
                                                                {p.captainFor && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">(C) {p.captainFor}</span>}
                                                            </div>
                                                         </div>
                                                     </td>
                                                     <td className="p-3 text-center">
                                                         <span className={`font-mono font-bold px-2 py-1 rounded border ${p.captainFor ? 'text-amber-400 bg-amber-950/30 border-amber-900/50' : 'text-emerald-400 bg-emerald-950/30 border-emerald-900/50'}`}>
                                                            {p.price}
                                                         </span>
                                                     </td>
                                                     <td className="p-3 text-center">
                                                         {p.cricket !== '0' ? (
                                                             <span className={`inline-block w-6 h-6 leading-6 text-center rounded font-bold text-xs ${p.cricket === 'A' ? 'bg-blue-600 text-white' : 'bg-blue-900/40 text-blue-300'}`}>{p.cricket}</span>
                                                         ) : <span className="text-slate-700">-</span>}
                                                     </td>
                                                     <td className="p-3 text-center">
                                                         {p.badminton !== '0' ? (
                                                             <span className={`inline-block w-6 h-6 leading-6 text-center rounded font-bold text-xs ${p.badminton === 'A' ? 'bg-emerald-600 text-white' : 'bg-emerald-900/40 text-emerald-300'}`}>{p.badminton}</span>
                                                         ) : <span className="text-slate-700">-</span>}
                                                     </td>
                                                     <td className="p-3 text-center">
                                                         {p.tt !== '0' ? (
                                                             <span className={`inline-block w-6 h-6 leading-6 text-center rounded font-bold text-xs ${p.tt === 'A' ? 'bg-orange-600 text-white' : 'bg-orange-900/40 text-orange-300'}`}>{p.tt}</span>
                                                         ) : <span className="text-slate-700">-</span>}
                                                     </td>
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
             );
          })}
      </div>
    </div>
  );
};

export default RosterView;