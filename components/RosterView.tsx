import React, { useState, useEffect, useMemo } from 'react';
import { Player, TeamStats, ActivityLog, TournamentConfig } from '../types';
import { ChevronDown, ChevronUp, Crown, Bell, Target, Wallet, Users, LayoutList, ArrowUpDown, ArrowUp, ArrowDown, Settings, Trash2, Plus, X, Search, Save, Download, FileSpreadsheet, Edit3 } from 'lucide-react';
import { getSportColor } from '../utils';
import * as XLSX from 'xlsx';

interface RosterViewProps {
  players: Player[];
  teams: TeamStats[];
  recentActivity: ActivityLog[];
  targetTeam?: string | null;
  config: TournamentConfig;
  isAdmin?: boolean;
  onAddTeam: (name: string) => void;
  onRenameTeam: (oldName: string, newName: string) => void;
  onDeleteTeam: (name: string) => void;
  onAssignCaptain: (playerId: number, teamName: string, sport: string, price: number) => void;
  onRemoveCaptain: (playerId: number) => void;
  onEditConfig?: () => void;
  sports: string[];
  categories: string[];
}

const RosterView: React.FC<RosterViewProps> = ({ 
    players, teams, recentActivity = [], targetTeam, config, isAdmin = false,
    onAddTeam, onRenameTeam, onDeleteTeam, onAssignCaptain, onRemoveCaptain, onEditConfig, sports, categories
}) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [highlightSport, setHighlightSport] = useState<string>('none');
  const [newTeamName, setNewTeamName] = useState("");
  const [manageTeam, setManageTeam] = useState<TeamStats | null>(null);
  const [manageTeamNameEdit, setManageTeamNameEdit] = useState("");
  const [captainSearch, setCaptainSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'price', direction: 'desc' });

  useEffect(() => {
    if (targetTeam) {
        setExpandedTeam(targetTeam);
        setTimeout(() => document.getElementById(`team-${targetTeam.replace(/\s+/g, '-')}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [targetTeam]);

  const unsoldPlayers = useMemo(() => players.filter(p => !p.team && p.name.toLowerCase().includes(captainSearch.toLowerCase())).slice(0, 50), [players, captainSearch]);

  const handleSort = (key: string) => {
      setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const getSortIcon = (key: string) => sortConfig.key !== key ? <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" /> : sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 ml-1 text-indigo-400" /> : <ArrowDown className="w-3 h-3 ml-1 text-indigo-400" />;

  const needsAttention = (team: TeamStats) => {
      if (highlightSport === 'none') return false;
      // Dynamic Logic: Check against config sport limits
      const minLimit = config.sportLimits?.[highlightSport]?.min || 0;
      return (team.sportStats[highlightSport]?.total || 0) < minLimit; 
  };

  const getActivityStyle = (type: ActivityLog['type']) => {
      switch(type) {
          case 'sale': return 'bg-emerald-900/20 border-emerald-500/30';
          case 'revert': return 'bg-red-900/20 border-red-500/30';
          case 'correction': return 'bg-amber-900/20 border-amber-500/30';
          case 'captain': return 'bg-indigo-900/20 border-indigo-500/30';
          default: return 'bg-slate-900 border-slate-700';
      }
  };

  const handleSaveRename = () => {
    if (manageTeam && manageTeamNameEdit && manageTeamNameEdit !== manageTeam.name) {
        onRenameTeam(manageTeam.name, manageTeamNameEdit);
        setManageTeam(null);
    }
  };

  const handleExportTeam = (teamName: string) => {
      const teamPlayers = players.filter(p => p.team === teamName);
      const team = teams.find(t => t.name === teamName);
      
      if (!team) {
          alert("Team data not found.");
          return;
      }

      if (teamPlayers.length === 0) {
          alert("No players in this team to export.");
          return;
      }

      const wb = XLSX.utils.book_new();

      // --- 1. SMART DASHBOARD SHEET (Master Roster) ---
      // We will construct an Array of Arrays (AoA) to layout the dashboard
      const summaryData: any[][] = [];
      
      // Row 1: Header Info
      summaryData.push([
          team.name.toUpperCase(), 
          `Remaining Purse: ${team.disposableBalance}`, 
          `Squad Size: ${team.playerCount}/${config.maxSquadSize}`
      ]);
      
      // Row 2: Spacer
      summaryData.push([]); 

      // Row 3: Sport Breakdown Header
      summaryData.push(["SPORT BREAKDOWNS"]);

      // Rows 4+: Dynamic Sport Stats
      sports.forEach(sport => {
          const stats = team.sportStats[sport] || { total: 0, categoryCounts: {} };
          const row = [`${sport}: Total ${stats.total}`];
          categories.forEach(cat => {
              row.push(`Grade ${cat}: ${stats.categoryCounts[cat] || 0}`);
          });
          summaryData.push(row);
      });

      // Spacers
      summaryData.push([]);
      summaryData.push([]);

      // Table Header
      const tableHeader = ["ID", "Player Name", "Gender", "Pool", "Price", ...sports.map(s => `${s} Grade`), "Contact"];
      summaryData.push(tableHeader);

      // Player Rows
      teamPlayers.forEach(p => {
          const row = [
              p.id,
              p.name,
              p.gender || '-',
              p.auctionType,
              p.price,
              ...sports.map(s => p.ratings[s] || '-'),
              p.contactNo || ''
          ];
          summaryData.push(row);
      });

      // Create Sheet from Data
      const wsMaster = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Set rough column widths
      wsMaster['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, ...sports.map(() => ({ wch: 12 })), { wch: 15 }];

      XLSX.utils.book_append_sheet(wb, wsMaster, "Master Roster");

      // --- 2. INDIVIDUAL SPORT SHEETS (Clean Lists) ---
      sports.forEach(sport => {
          // FILTER: Exclude players with rating '0' or 'N/A' for this specific sport
          const sportPlayers = teamPlayers.filter(p => {
              const r = p.ratings[sport];
              return r && r !== '0' && r !== 'N/A';
          });

          if (sportPlayers.length > 0) {
              const sheetData = sportPlayers.map(p => ({
                  "Player Name": p.name,
                  "Category": p.ratings[sport],
                  "Price": p.price
              }));
              const ws = XLSX.utils.json_to_sheet(sheetData);
              ws['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 10 }];
              XLSX.utils.book_append_sheet(wb, ws, sport);
          }
      });

      // Write file
      XLSX.writeFile(wb, `${teamName.replace(/\s+/g, '_')}_Roster.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20 relative">
      {/* 1. MANAGEMENT HEADER */}
      {isAdmin && (
          <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/30 flex flex-col md:flex-row justify-between gap-4">
             <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Settings className="w-5 h-5" /></div>
                 <div><h3 className="text-white font-bold">Team Management</h3><p className="text-xs text-slate-400">Add/Remove teams.</p></div>
             </div>
             <div className="flex gap-2">
                 <input type="text" placeholder="New Team Name" className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                 <button onClick={() => { onAddTeam(newTeamName); setNewTeamName(""); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
             </div>
          </div>
      )}

      {/* 2. ACTIVITY LOG */}
      {recentActivity.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentActivity.map(a => (
                  <div key={a.id} className={`${getActivityStyle(a.type)} border rounded-xl p-3 flex gap-3`}>
                      <div className="p-2 rounded-full bg-slate-800/50"><Bell className="w-4 h-4 text-slate-300" /></div>
                      <div className="text-xs text-slate-300"><strong className="block mb-1">{a.type.toUpperCase()}</strong>{a.message}</div>
                  </div>
              ))}
          </div>
      )}

      {/* 3. HIGHLIGHTER (Dynamic Config Connection) */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 mb-3 md:mb-0">
            <Target className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-white">Highlight Needs:</span>
            {isAdmin && onEditConfig && (
                <button onClick={onEditConfig} className="text-xs text-indigo-400 underline ml-2 flex items-center gap-1 hover:text-indigo-300">
                    <Edit3 className="w-3 h-3" /> Edit Targets
                </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto">
              <button onClick={() => setHighlightSport('none')} className={`px-4 py-2 rounded-lg text-sm font-bold ${highlightSport === 'none' ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-400'}`}>None</button>
              {sports.map((sport, i) => {
                  const colors = getSportColor(i);
                  const minLimit = config.sportLimits?.[sport]?.min || 0;
                  return (
                    <button 
                        key={sport} 
                        onClick={() => setHighlightSport(sport)} 
                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${highlightSport === sport ? `${colors.bg} text-white ${colors.border}` : 'bg-slate-700 border-transparent text-slate-400 hover:bg-slate-600'}`}
                    >
                        {sport} <span className="opacity-70 text-[10px] ml-1">(&lt; {minLimit})</span>
                    </button>
                  );
              })}
          </div>
      </div>

      {/* 4. TEAM GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {teams.map(team => {
             const isHighlighted = needsAttention(team);
             const isExpanded = expandedTeam === team.name;
             const playersInTeam = players.filter(p => p.team === team.name);

             const sortedPlayers = [...playersInTeam].sort((a, b) => {
                 const aV = sortConfig.key === 'price' ? a.price : sortConfig.key === 'name' ? a.name : a.ratings[sortConfig.key] || '';
                 const bV = sortConfig.key === 'price' ? b.price : sortConfig.key === 'name' ? b.name : b.ratings[sortConfig.key] || '';
                 if (typeof aV === 'number' && typeof bV === 'number') return sortConfig.direction === 'asc' ? aV - bV : bV - aV;
                 return sortConfig.direction === 'asc' ? String(aV).localeCompare(String(bV)) : String(bV).localeCompare(String(aV));
             });

             return (
                 <div key={team.name} id={`team-${team.name.replace(/\s+/g, '-')}`} className={`bg-slate-900 rounded-xl overflow-hidden border-2 relative flex flex-col transition-all duration-300 ${isHighlighted ? 'border-red-500 shadow-xl shadow-red-900/20 scale-[1.01]' : 'border-slate-800'} ${isExpanded ? 'ring-2 ring-indigo-500/50' : ''}`}>
                     {isAdmin && <button onClick={(e) => { e.stopPropagation(); setManageTeam(team); setManageTeamNameEdit(team.name); }} className="absolute top-4 right-4 z-20 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-bold border border-slate-700 flex items-center gap-2"><Settings className="w-3 h-3" /> Manage</button>}
                     
                     <div className="p-5 border-b border-slate-800 bg-slate-800/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                             <h2 className="text-2xl font-black text-white">{team.name}</h2>
                             <div className="flex items-center gap-3 mt-2">
                                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-900/50 text-emerald-200"><Wallet className="w-4 h-4" /><span className="font-mono font-bold text-lg">{team.disposableBalance}</span></div>
                                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"><Users className="w-4 h-4" /><span className="font-bold">{team.playerCount}/{config.maxSquadSize}</span></div>
                             </div>
                             {isHighlighted && highlightSport !== 'none' && (
                                 <div className="mt-3 inline-block px-3 py-1 bg-red-900/40 border border-red-500/40 rounded text-red-300 text-xs font-bold animate-pulse">
                                     Needs {config.sportLimits?.[highlightSport]?.min - (team.sportStats[highlightSport]?.total || 0)} more {highlightSport} players
                                 </div>
                             )}
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                            {sports.map((sport, i) => {
                                const colors = getSportColor(i);
                                const count = team.sportStats[sport]?.total || 0;
                                // Highlight specific sport box if needed
                                const isSportLow = highlightSport === sport && needsAttention(team);
                                return (
                                    <div key={sport} className={`${colors.soft} rounded-lg p-2 border ${isSportLow ? 'border-red-500 ring-1 ring-red-500' : colors.border}`}>
                                        <div className={`text-[10px] font-bold ${colors.text} uppercase mb-1 truncate`}>{sport}</div>
                                        <div className={`text-xl font-black ${isSportLow ? 'text-red-400' : 'text-white'}`}>{count}</div>
                                    </div>
                                )
                            })}
                         </div>
                     </div>

                     <button onClick={() => setExpandedTeam(prev => prev === team.name ? null : team.name)} className="w-full py-2 flex justify-center gap-2 text-xs font-bold uppercase bg-slate-900 text-slate-500 hover:bg-slate-800">{isExpanded ? <><ChevronUp className="w-3 h-3"/> Hide</> : <><ChevronDown className="w-3 h-3"/> View</>}</button>

                     {isExpanded && (
                         <div className="bg-slate-950 p-4 border-t border-slate-800 overflow-x-auto">
                             <table className="w-full text-sm text-left">
                                 <thead>
                                     <tr className="text-xs text-slate-500 uppercase border-b border-slate-800">
                                         <th className="p-3 cursor-pointer" onClick={() => handleSort('name')}>Name {getSortIcon('name')}</th>
                                         <th className="p-3 text-center cursor-pointer" onClick={() => handleSort('price')}>Price {getSortIcon('price')}</th>
                                         {sports.map(s => <th key={s} className="p-3 text-center cursor-pointer" onClick={() => handleSort(s)}>{s} {getSortIcon(s)}</th>)}
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-900">
                                     {sortedPlayers.map(p => (
                                         <tr key={p.id}>
                                             <td className="p-3 font-medium text-slate-200 flex items-center gap-2">
                                                 {p.captainFor && <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />}
                                                 <span className={p.captainFor ? "text-amber-100 font-bold" : ""}>{p.name}</span>
                                             </td>
                                             <td className="p-3 text-center font-mono text-emerald-400 font-bold">{p.price}</td>
                                             {sports.map((s, i) => {
                                                 const rating = p.ratings[s];
                                                 return <td key={s} className="p-3 text-center">{rating && rating !== '0' ? <span className={`px-2 py-0.5 rounded ${getSportColor(i).soft} ${getSportColor(i).text} text-xs font-bold`}>{rating}</span> : '-'}</td>
                                             })}
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                     )}
                 </div>
             );
          })}
      </div>

      {/* 5. MANAGE MODAL */}
      {manageTeam && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                  <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                      <h2 className="text-xl font-black text-white">Manage Team: {manageTeam.name}</h2>
                      <button onClick={() => setManageTeam(null)}><X className="w-6 h-6 text-slate-400" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
                      
                      {/* Rename Section */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Rename Team</label>
                          <div className="flex gap-2">
                              <input type="text" className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white" value={manageTeamNameEdit} onChange={(e) => setManageTeamNameEdit(e.target.value)} />
                              <button onClick={handleSaveRename} className="bg-indigo-600 text-white px-4 rounded font-bold text-sm">Save</button>
                          </div>
                      </div>

                      {/* Actions Section */}
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                           <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Data Actions</label>
                           <button onClick={() => handleExportTeam(manageTeam.name)} className="w-full py-3 bg-emerald-900/20 text-emerald-400 border border-emerald-500/30 rounded-xl font-bold flex justify-center gap-2 hover:bg-emerald-900/40 transition-colors">
                                <FileSpreadsheet className="w-5 h-5" /> Export {manageTeam.name} Roster
                           </button>
                      </div>

                      {/* Captains Section */}
                      <div>
                          <h4 className="font-bold text-white mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Captains</h4>
                          <div className="space-y-3">
                              {sports.map(sport => {
                                  const cap = players.find(p => p.team === manageTeam.name && p.captainFor === sport);
                                  return (
                                      <div key={sport} className="flex items-center gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                                          <div className="w-24 text-sm font-bold text-slate-400">{sport}</div>
                                          {cap ? (
                                              <div className="flex-1 flex justify-between bg-amber-900/20 px-3 py-2 rounded-lg text-amber-100 font-bold">
                                                  <span>{cap.name}</span><button onClick={() => onRemoveCaptain(cap.id)}><X className="w-4 h-4 text-red-400" /></button>
                                              </div>
                                          ) : (
                                              <div className="flex-1 relative">
                                                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                                                  <input type="text" placeholder="Search Unsold..." className="w-full bg-slate-900 border border-slate-700 rounded py-1.5 pl-8 text-sm text-white" value={captainSearch} onChange={(e) => setCaptainSearch(e.target.value)} />
                                                  {captainSearch && (
                                                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-40 overflow-y-auto">
                                                          {unsoldPlayers.map(p => <button key={p.id} onClick={() => { onAssignCaptain(p.id, manageTeam.name, sport, 0); setCaptainSearch(""); }} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">{p.name}</button>)}
                                                      </div>
                                                  )}
                                              </div>
                                          )}
                                      </div>
                                  )
                              })}
                          </div>
                      </div>
                      <div className="pt-6 border-t border-slate-800">
                          <button onClick={() => { onDeleteTeam(manageTeam.name); setManageTeam(null); }} className="w-full py-3 bg-red-900/20 text-red-400 border border-red-500/30 rounded-xl font-bold flex justify-center gap-2"><Trash2 className="w-4 h-4" /> Delete Team</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
export default RosterView;