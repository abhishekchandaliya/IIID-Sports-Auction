import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Player, ActivityLog, TournamentConfig } from './types';
import { INITIAL_TEAMS, DEFAULT_CONFIG } from './constants';
import { calculateTeamStats, normalizeRating, parseCurrency } from './utils';
import Dashboard from './components/Dashboard';
import AuctionConsole from './components/AuctionConsole';
import RosterView from './components/RosterView';
import FileUploader from './components/FileUploader';
// REMOVED BROKEN COMPONENTS TO PREVENT CRASHES
import { LayoutDashboard, Gavel, Users, Settings, Trophy, Trash2, Lock, Unlock, Download, Database, Menu, X, Save, ShieldCheck, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- FIREBASE IMPORTS ---
import { ref, onValue, set, update, remove } from 'firebase/database';
import { db } from './firebaseConfig';

const getRowValue = (row: any, ...candidates: string[]) => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
        if (foundKey !== undefined) return row[foundKey];
    }
    return undefined;
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  // Data State
  const [players, setPlayers] = useState<Player[]>([]);
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [currentAuctionPlayerId, setCurrentAuctionPlayerId] = useState<string>(""); 
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  
  const [dataLoaded, setDataLoaded] = useState(false);
  const [targetTeam, setTargetTeam] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [configSaved, setConfigSaved] = useState(false);

  // --- FIREBASE SYNC ---
  useEffect(() => {
    const playersRef = ref(db, 'players');
    const unsubscribePlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Aggressive Sanitization to prevent UI crashes
        const loaded = Object.values(data).map((p: any) => ({
            ...p,
            team: p.team || null,
            price: Number(p.price) || 0,
            cricket: p.cricket || '0',
            badminton: p.badminton || '0',
            tt: p.tt || '0',
            contactNo: p.contactNo || 'N/A'
        }));
        loaded.sort((a: any, b: any) => a.id - b.id);
        setPlayers(loaded);
        setDataLoaded(true);
      } else {
        setPlayers([]);
        setDataLoaded(false);
      }
    });

    onValue(ref(db, 'config'), (snap) => {
        if (snap.exists()) {
            setConfig(snap.val());
            setTempConfig(snap.val());
        }
    });

    onValue(ref(db, 'current_auction_id'), (snap) => setCurrentAuctionPlayerId(snap.val() ? String(snap.val()) : ""));

    onValue(ref(db, 'activity_log'), (snap) => {
        if (snap.exists()) {
            const logs = Object.values(snap.val()) as ActivityLog[];
            logs.sort((a, b) => b.timestamp - a.timestamp);
            setRecentActivity(logs.slice(0, 15));
        } else setRecentActivity([]);
    });

    return () => unsubscribePlayers();
  }, []);

  // --- ACTIONS ---
  const logToFirebase = (type: string, message: string, details: any) => {
      const newLogRef = ref(db, `activity_log/${Date.now()}`);
      set(newLogRef, { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), type, message, details });
  };

  const handleSellPlayer = (playerId: number, teamName: string, price: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const updates: any = {};
    updates[`players/${playerId}/team`] = teamName;
    updates[`players/${playerId}/price`] = price;
    updates[`current_auction_id`] = null;
    update(ref(db), updates).then(() => {
        logToFirebase('sale', `💰 SOLD: ${player.name} to ${teamName} for ${price}`, { playerName: player.name, teamName, price });
    });
  };

  const handleUnsellPlayer = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      update(ref(db, `players/${playerId}`), { team: null, price: 0, captainFor: null });
  };

  const handleUpdatePlayer = (playerId: number, teamName: string, price: number) => {
      update(ref(db, `players/${playerId}`), { team: teamName, price: price });
  };

  const handleMasterLoad = (rawData: any[]) => {
    const parsedPlayers = rawData.filter((row: any) => getRowValue(row, 'Player Name', 'Name')).map((row: any, index: number) => {
        const pName = getRowValue(row, 'Player Name', 'Name');
        return {
            id: index + 1,
            name: pName.trim(),
            team: null,
            price: 0,
            cricket: normalizeRating(getRowValue(row, 'Cricket', 'Cric')),
            badminton: normalizeRating(getRowValue(row, 'Badminton', 'Bad')),
            tt: normalizeRating(getRowValue(row, 'TT', 'Table Tennis')),
            contactNo: String(getRowValue(row, 'Contact No', 'Mobile') || 'N/A').trim()
        };
    });
    if (parsedPlayers.length === 0) return alert("No valid data found.");
    const updates: any = {};
    parsedPlayers.forEach((p: any) => { updates[`players/${p.id}`] = p; });
    update(ref(db), updates).then(() => alert(`✅ Loaded ${parsedPlayers.length} players!`));
  };

  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      set(ref(db, 'config'), tempConfig);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleReset = () => {
    if(confirm("⚠ WARNING: This will delete ALL cloud data. Proceed?")) {
        remove(ref(db, 'players'));
        remove(ref(db, 'current_auction_id'));
        remove(ref(db, 'activity_log'));
        location.reload();
    }
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
      const fileName = `auction_data_${new Date().toISOString().split('T')[0]}`;
      const exportData = [...players].sort((a, b) => (a.team || "zz").localeCompare(b.team || "zz"));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auction Data");
      XLSX.writeFile(wb, `${fileName}.xlsx`);
  };

  // --- RENDER ---
  const teams = useMemo(() => INITIAL_TEAMS.map(t => calculateTeamStats(t.name, players, config)), [players, config]);
  const switchTab = (tab: Tab) => { setActiveTab(tab); setMobileMenuOpen(false); }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30">
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-black text-white">IIID Sports Auction 2026</h1>
          </div>
          <div className="hidden md:flex gap-4">
            <button onClick={() => switchTab(Tab.DASHBOARD)} className="text-slate-400 hover:text-white">Dashboard</button>
            {isAdmin && <button onClick={() => switchTab(Tab.AUCTION)} className="text-slate-400 hover:text-white">Console</button>}
            <button onClick={() => switchTab(Tab.ROSTER)} className="text-slate-400 hover:text-white">Teams</button>
            <button onClick={() => switchTab(Tab.SETTINGS)} className="text-slate-400 hover:text-white">{isAdmin ? 'Settings' : 'Login'}</button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!dataLoaded && activeTab !== Tab.SETTINGS ? (
           <div className="text-center mt-20">
                <h2 className="text-3xl font-bold text-white mb-4">Initialize Database</h2>
                <div className="max-w-xl mx-auto bg-slate-900 p-8 rounded-xl border border-slate-800">
                      <FileUploader label="Upload Master Player.csv" onDataLoaded={handleMasterLoad} />
                </div>
           </div>
        ) : (
            <>
                {activeTab === Tab.DASHBOARD && (
                    <Dashboard 
                        teams={teams} 
                        players={players} 
                        onTeamSelect={(team) => { setTargetTeam(team); setActiveTab(Tab.ROSTER); }} 
                        currentAuctionPlayerId={currentAuctionPlayerId}
                        config={config}
                    />
                )}
                {activeTab === Tab.AUCTION && isAdmin && (
                    <AuctionConsole 
                        players={players} 
                        teams={teams} 
                        onSellPlayer={handleSellPlayer} 
                        onUnsellPlayer={handleUnsellPlayer}
                        onUpdatePlayer={handleUpdatePlayer}
                        isReadOnly={!isAdmin} 
                        currentPlayerId={currentAuctionPlayerId}
                        onSelectPlayer={(id) => set(ref(db, 'current_auction_id'), id)} 
                        recentActivity={recentActivity}
                        config={config}
                    />
                )}
                {activeTab === Tab.ROSTER && <RosterView players={players} teams={teams} recentActivity={recentActivity} targetTeam={targetTeam} config={config} />}
                
                {activeTab === Tab.SETTINGS && (
                    <div className="max-w-4xl mx-auto pt-10">
                        {!isAdmin ? (
                            <div className="max-w-md mx-auto bg-slate-900 p-8 rounded-xl border border-slate-800 text-center">
                                <ShieldCheck className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                                <h2 className="text-2xl font-bold text-white mb-4">Admin Access</h2>
                                <form onSubmit={(e) => { e.preventDefault(); if(passwordInput==="ABCD2026") setIsAdmin(true); else setLoginError(true); }}>
                                    <input type="password" placeholder="Password" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 mb-4 text-white" value={passwordInput} onChange={e=>setPasswordInput(e.target.value)} />
                                    {loginError && <p className="text-red-500 mb-4">Wrong password.</p>}
                                    <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg">Login</button>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                                    <h3 className="text-xl font-bold text-white mb-4">Rules</h3>
                                    <div className="grid grid-cols-3 gap-4 mb-4">
                                        <input type="number" className="bg-slate-950 border border-slate-700 rounded p-2 text-white" value={tempConfig.purseLimit} onChange={e=>setTempConfig({...tempConfig, purseLimit: +e.target.value})} />
                                        <input type="number" className="bg-slate-950 border border-slate-700 rounded p-2 text-white" value={tempConfig.maxSquadSize} onChange={e=>setTempConfig({...tempConfig, maxSquadSize: +e.target.value})} />
                                        <input type="number" className="bg-slate-950 border border-slate-700 rounded p-2 text-white" value={tempConfig.basePrice} onChange={e=>setTempConfig({...tempConfig, basePrice: +e.target.value})} />
                                    </div>
                                    <button onClick={handleSaveConfig} className="bg-indigo-600 text-white px-4 py-2 rounded flex gap-2"><Save size={18}/> Save</button>
                                </div>

                                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800">
                                    <h3 className="text-xl font-bold text-white mb-4">Data Management</h3>
                                    <div className="flex gap-4">
                                        <button onClick={() => handleExport('xlsx')} className="bg-emerald-600 text-white px-4 py-2 rounded flex gap-2"><Download size={18}/> Excel</button>
                                        <button onClick={handleReset} className="bg-red-600 text-white px-4 py-2 rounded flex gap-2"><Trash2 size={18}/> Factory Reset</button>
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-slate-800">
                                        <p className="mb-2 text-slate-400">Re-upload Data:</p>
                                        <FileUploader label="Upload CSV" onDataLoaded={handleMasterLoad} />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </>
        )}
      </main>
    </div>
  );
};

export default App;
