import React, { useState, useMemo } from 'react';
import { Player } from '../types';
import { Search, Plus, Edit2, Trash2, X, Save, User, Phone, Gavel, Dice5, Download, Filter, ChevronDown, UserCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PlayerManagerProps {
  players: Player[];
  sports: string[];
  categories: string[];
  onAdd: (player: Omit<Player, 'id' | 'team' | 'price' | 'status' | 'captainFor'>) => void;
  onUpdate: (player: Player) => void;
  onDelete: (id: number) => void;
  onBulkUpdateType: (ids: number[], type: 'LIVE' | 'LOTTERY') => void;
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({ players, sports, categories, onAdd, onUpdate, onDelete, onBulkUpdateType }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'LIVE' | 'LOTTERY'>('ALL');
  const [visibleCount, setVisibleCount] = useState(50);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    contactNo: "",
    gender: "Male",
    ratings: {} as Record<string, string>,
    auctionType: 'LIVE' as 'LIVE' | 'LOTTERY'
  });

  // Stats Calculation
  const stats = useMemo(() => {
      return {
          total: players.length,
          live: players.filter(p => p.auctionType === 'LIVE').length,
          lottery: players.filter(p => p.auctionType === 'LOTTERY').length,
          unassigned: players.filter(p => !p.auctionType).length
      };
  }, [players]);

  // Filtering
  const filteredPlayers = useMemo(() => {
    let result = players;
    if (activeFilter !== 'ALL') {
        result = result.filter(p => p.auctionType === activeFilter);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(p => p.name.toLowerCase().includes(lower));
    }
    return result;
  }, [players, searchTerm, activeFilter]);

  const visiblePlayers = useMemo(() => {
      return filteredPlayers.slice(0, visibleCount);
  }, [filteredPlayers, visibleCount]);

  const handleLoadMore = () => {
      setVisibleCount(prev => prev + 50);
  };

  // Modal Handlers
  const openAddModal = () => {
    setEditingPlayer(null);
    const initialRatings: Record<string, string> = {};
    sports.forEach(s => initialRatings[s] = '0');
    setFormData({ name: "", contactNo: "", gender: "Male", ratings: initialRatings, auctionType: 'LIVE' });
    setIsModalOpen(true);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    const currentRatings = { ...player.ratings };
    sports.forEach(s => { if (!currentRatings[s]) currentRatings[s] = '0'; });

    setFormData({
        name: player.name,
        contactNo: player.contactNo || "",
        gender: player.gender || "Male",
        ratings: currentRatings,
        auctionType: player.auctionType || 'LIVE'
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const payload = {
        name: formData.name,
        contactNo: formData.contactNo,
        gender: formData.gender,
        ratings: formData.ratings,
        auctionType: formData.auctionType
    };

    if (editingPlayer) {
        onUpdate({
            ...editingPlayer,
            ...payload
        });
    } else {
        onAdd(payload);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: number, name: string) => {
      if (confirm(`Delete ${name}?`)) {
          onDelete(id);
      }
  };

  const handleBulkAction = (type: 'LIVE' | 'LOTTERY') => {
      const count = filteredPlayers.length;
      if (count === 0) return;
      if (confirm(`Apply batch update to ${count} currently filtered players?\n\nAction: Set Pool to ${type}`)) {
          const ids = filteredPlayers.map(p => p.id);
          onBulkUpdateType(ids, type);
      }
  };

  const handleExportList = (type: 'LIVE' | 'LOTTERY') => {
      const list = players.filter(p => p.auctionType === type);
      if (list.length === 0) {
          alert(`No players found in ${type} pool.`);
          return;
      }
      const data = list.map(p => {
          const row: any = { ID: p.id, Name: p.name, Gender: p.gender || 'Male', Type: p.auctionType, Status: p.status };
          sports.forEach(s => row[s] = p.ratings[s]);
          return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Players");
      XLSX.writeFile(wb, `${type}_POOL_LIST.xlsx`);
  };

  const toggleType = (player: Player) => {
      const newType = player.auctionType === 'LIVE' ? 'LOTTERY' : 'LIVE';
      onUpdate({ ...player, auctionType: newType });
  };

  return (
    <div className="space-y-6 mt-8">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center">
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">Total Players</span>
              <span className="text-3xl font-black text-white">{stats.total}</span>
          </div>
          <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl flex flex-col items-center justify-center">
              <span className="text-indigo-400 text-[10px] uppercase font-bold tracking-widest mb-1">Auction (Live)</span>
              <span className="text-3xl font-black text-indigo-400">{stats.live}</span>
          </div>
          <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-xl flex flex-col items-center justify-center">
              <span className="text-amber-400 text-[10px] uppercase font-bold tracking-widest mb-1">Lottery (Draft)</span>
              <span className="text-3xl font-black text-amber-400">{stats.lottery}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
              {stats.unassigned > 0 && <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Unassigned</span>
              <span className="text-3xl font-black text-slate-300">{stats.unassigned}</span>
          </div>
      </div>

      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h4 className="text-xl font-black text-white flex items-center gap-2">
                <User className="text-indigo-400" /> Player Database
            </h4>
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input 
                        type="text" 
                        placeholder="Search name, grade..." 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                        value={searchTerm}
                        onChange={e => { setSearchTerm(e.target.value); setVisibleCount(50); }}
                    />
                </div>
                <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 whitespace-nowrap">
                    <Plus className="w-4 h-4" /> Add
                </button>
            </div>
        </div>

        {/* Filter & Bulk Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4 mb-4 justify-between">
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
                {(['ALL', 'LIVE', 'LOTTERY'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => { setActiveFilter(f); setVisibleCount(50); }}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeFilter === f 
                            ? 'bg-slate-800 text-white shadow' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {f === 'ALL' ? 'Show All' : f === 'LIVE' ? 'Live Only' : 'Lottery Only'}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 uppercase mr-2">
                        Edit Filtered ({filteredPlayers.length})
                    </span>
                    <button onClick={() => handleBulkAction('LIVE')} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-900/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold hover:bg-indigo-900/50 transition-all">
                        <Gavel className="w-3 h-3"/> Set LIVE
                    </button>
                    <button onClick={() => handleBulkAction('LOTTERY')} className="flex items-center gap-1 px-3 py-1.5 bg-amber-900/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold hover:bg-amber-900/50 transition-all">
                        <Dice5 className="w-3 h-3"/> Set LOTTERY
                    </button>
                </div>
                <div className="w-px h-8 bg-slate-800 hidden xl:block"></div>
                <button onClick={() => handleExportList('LIVE')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-700"><Download className="w-3 h-3"/> Live CSV</button>
                <button onClick={() => handleExportList('LOTTERY')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2 border border-slate-700"><Download className="w-3 h-3"/> Lottery CSV</button>
            </div>
        </div>

        {/* Data Table */}
        <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-900 text-slate-400 font-bold uppercase text-xs sticky top-0 z-10 shadow-lg">
                        <tr>
                            <th className="p-3">ID</th>
                            <th className="p-3">Name</th>
                            <th className="p-3 text-center">Gender</th>
                            <th className="p-3 text-center">Pool</th>
                            <th className="p-3 text-center">Status</th>
                            {sports.map(s => <th key={s} className="p-3 text-center">{s}</th>)}
                            <th className="p-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {visiblePlayers.map(p => (
                            <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                                <td className="p-3 font-mono text-slate-500">#{p.id}</td>
                                <td className="p-3 font-bold text-slate-200">
                                    {p.name}
                                    {p.contactNo && <div className="text-[10px] text-slate-500 font-mono font-normal">{p.contactNo}</div>}
                                </td>
                                <td className="p-3 text-center">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                        {p.gender ? p.gender.charAt(0) : 'M'}
                                    </span>
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => toggleType(p)}
                                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 mx-auto border transition-all min-w-[80px] justify-center ${
                                        p.auctionType === 'LIVE' 
                                        ? 'bg-indigo-900/30 text-indigo-400 border-indigo-500/30 hover:bg-indigo-900/50' 
                                        : 'bg-amber-900/30 text-amber-400 border-amber-500/30 hover:bg-amber-900/50'
                                        }`}
                                    >
                                        {p.auctionType === 'LIVE' ? <Gavel className="w-3 h-3" /> : <Dice5 className="w-3 h-3" />}
                                        {p.auctionType || 'LIVE'}
                                    </button>
                                </td>
                                <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        p.status === 'sold' ? 'bg-emerald-900/30 text-emerald-400' :
                                        p.status === 'unsold' ? 'bg-red-900/30 text-red-400' :
                                        'bg-slate-800 text-slate-400'
                                    }`}>
                                        {p.status}
                                    </span>
                                </td>
                                {sports.map(s => (
                                    <td key={s} className="p-3 text-center text-slate-400">
                                        {p.ratings[s] && p.ratings[s] !== '0' ? 
                                            <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-bold text-xs">{p.ratings[s]}</span> 
                                            : '-'}
                                    </td>
                                ))}
                                <td className="p-3 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => openEditModal(p)} className="p-1.5 text-indigo-400 hover:bg-indigo-900/30 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                        <button type="button" onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-red-400 hover:bg-red-900/30 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {visiblePlayers.length === 0 && (
                            <tr><td colSpan={6 + sports.length} className="p-8 text-center text-slate-500">No players found matching filter</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            
            {filteredPlayers.length > visibleCount && (
                <div className="p-4 border-t border-slate-800 bg-slate-900 text-center">
                    <button onClick={handleLoadMore} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold flex items-center gap-2 mx-auto transition-all border border-slate-700">
                        <ChevronDown className="w-4 h-4" /> Load More ({filteredPlayers.length - visibleCount} remaining)
                    </button>
                </div>
            )}
        </div>

        {/* Modal */}
        {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                        <h3 className="text-xl font-black text-white">{editingPlayer ? 'Edit Player' : 'Add New Player'}</h3>
                        <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <input 
                                        required 
                                        type="text" 
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-indigo-500 outline-none" 
                                        placeholder="Enter player name"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Gender & Pool</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <select 
                                        className="bg-slate-950 border border-slate-700 rounded-lg py-2.5 px-3 text-white text-sm focus:border-indigo-500 outline-none appearance-none"
                                        value={formData.gender}
                                        onChange={e => setFormData({...formData, gender: e.target.value})}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Kid">Kid</option>
                                    </select>
                                    <select 
                                        className="bg-slate-950 border border-slate-700 rounded-lg py-2.5 px-3 text-white text-sm focus:border-indigo-500 outline-none appearance-none"
                                        value={formData.auctionType}
                                        onChange={e => setFormData({...formData, auctionType: e.target.value as any})}
                                    >
                                        <option value="LIVE">Live Auction</option>
                                        <option value="LOTTERY">Lottery Draft</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Contact Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-indigo-500 outline-none" 
                                        placeholder="Optional"
                                        value={formData.contactNo}
                                        onChange={e => setFormData({...formData, contactNo: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <h4 className="text-sm font-bold text-white mb-3">Sports Ratings</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {sports.map(sport => (
                                        <div key={sport}>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">{sport}</label>
                                            <select 
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-white text-sm focus:border-indigo-500 outline-none appearance-none"
                                                value={formData.ratings[sport] || '0'}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    ratings: { ...formData.ratings, [sport]: e.target.value }
                                                })}
                                            >
                                                <option value="0">N/A</option>
                                                {categories.map(c => (
                                                    <option key={c} value={c}>Grade {c}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold">Cancel</button>
                            <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold flex justify-center items-center gap-2">
                                <Save className="w-4 h-4" /> Save Player
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};