import React, { useState, useEffect, useMemo } from 'react';
import { Tab, Player, ActivityLog, TournamentConfig } from './types';
import { INITIAL_TEAMS, DEFAULT_CONFIG } from './constants';
import { calculateTeamStats, normalizeRating, parseCurrency } from './utils';
import Dashboard from './components/Dashboard';
import AuctionConsole from './components/AuctionConsole';
import RosterView from './components/RosterView';
import FileUploader from './components/FileUploader';
import CaptainAssignment from './components/CaptainAssignment';
import DeveloperProfile from './components/DeveloperProfile';
import { LayoutDashboard, Gavel, Users, Settings, Trophy, UploadCloud, Trash2, Crown, Lock, Unlock, Download, ChevronDown, Database, Menu, X, Save, Settings2, AlertCircle, CheckCircle, ShieldCheck, Scale } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- FIREBASE IMPORTS ---
import { ref, onValue, set, update, remove } from 'firebase/database';
import { db } from './firebaseConfig';

// --- DATA HELPERS ---
const getRowValue = (row: any, ...candidates: string[]) => {
    const keys = Object.keys(row);
    for (const candidate of candidates) {
        const foundKey = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
        if (foundKey !== undefined) return row[foundKey];
    }
    return undefined;
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
  // UI State
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); 
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  // Data State (Synced)
  const [players, setPlayers] = useState<Player[]>([]);
  const [config, setConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [currentAuctionPlayerId, setCurrentAuctionPlayerId] = useState<string>(""); 
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  
  // Local UI State
  const [dataLoaded, setDataLoaded] = useState(false);
  const [targetTeam, setTargetTeam] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<TournamentConfig>(DEFAULT_CONFIG);
  const [configSaved, setConfigSaved] = useState(false);
  const [settingsSportTab, setSettingsSportTab] = useState<'Cricket' | 'Badminton' | 'TT'>('Cricket');

  // --- 1. FIREBASE LISTENERS (The "Cloud Brain") ---
  useEffect(() => {
    // A. Sync Players
    const playersRef = ref(db, 'players');
    const unsubscribePlayers = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // SANITIZATION: Ensure data is perfect to prevent crashes
        const loadedPlayers = Object.values(data).map((p: any) => ({
            ...p,
            team: p.team || null, // Convert undefined to null
            price: p.price || 0,
            cricket: p.cricket || '0',
            badminton: p.badminton || '0',
            tt: p.tt || '0',
            contactNo: p.contactNo || 'N/A'
        }));
        loadedPlayers.sort((a: Player, b: Player) => a.id - b.id);
        setPlayers(loadedPlayers);
        setDataLoaded(true);
      } else {
        setPlayers([]);
        setDataLoaded(false);
      }
    });

    // B. Sync Config
    onValue(ref(db, 'config'), (snap) => {
        if (snap.exists()) {
            setConfig(snap.val());
            setTempConfig(snap.val());
        }
    });

    // C. Sync Current Auction Player
    onValue(ref(db, 'current_auction_id'), (snap) => {
        const id = snap.val();
        setCurrentAuctionPlayerId(id ? String(id) : "");
    });

    // D. Sync Activity Log
    onValue(ref(db, 'activity_log'), (snap) => {
        if (snap.exists()) {
            const logs = Object.values(snap.val()) as ActivityLog[];
            logs.sort((a, b) => b.timestamp - a.timestamp);
            setRecentActivity(logs.slice(0, 15));
        } else {
            setRecentActivity([]);
        }
    });

    return () => unsubscribePlayers();
  }, []);

  // --- 2. LOGIC & ACTIONS ---

  const logToFirebase = (type: string, message: string, details: any) => {
      const newLogRef = ref(db, `activity_log/${Date.now()}`);
      set(newLogRef, {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          type,
          message,
          details
      });
  };

  const handleSellPlayer = (playerId: number, teamName: string, price: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const updates: any = {};
    updates[`players/${playerId}/team`] = teamName;
    updates[`players/${playerId}/price`] = price;
    updates[`current_auction_id`] = null; // Clear active player

    update(ref(db), updates).then(() => {
        logToFirebase('sale', `💰 SOLD: ${player.name} to ${teamName} for **${price}**`, { playerName: player.name, teamName, price });
    });
  };

  const handleUnsellPlayer = (playerId: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      const prevTeam = player.team;

      update(ref(db, `players/${playerId}`), { team: null, price: 0, captainFor: null })
      .then(() => {
          logToFirebase('revert', `❌ REVERTED: ${player.name} removed from ${prevTeam}`, { playerName: player.name, teamName: prevTeam, price: 0 });
      });
  };

  const handleUpdatePlayer = (playerId: number, teamName: string, price: number) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return;
      
      update(ref(db, `players/${playerId}`), { team: teamName, price: price })
      .then(() => {
          logToFirebase('correction', `🛠️ CORRECTION: ${player.name} updated to ${teamName} @ **${price}**`, { playerName: player.name, teamName, price });
      });
  };

  const handleAssignCaptain = (playerId: number, teamName: string, sport: 'Cricket' | 'Badminton' | 'TT', price: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    update(ref(db, `players/${playerId}`), { team: teamName, price: price, captainFor: sport })
    .then(() => {
        logToFirebase('captain', `👑 CAPTAIN: ${player.name} assigned to ${teamName} (${sport}) for **${price}**`, { playerName: player.name, teamName, price });
    });
  };

  const handleRemoveCaptain = (playerId: number) => {
      update(ref(db, `players/${playerId}`), { team: null, price: 0, captainFor: null });
  };

  const handleMasterLoad = (rawData: any[]) => {
    const parsedPlayers: Player[] = rawData
        .filter((row: any) => {
             const name = getRowValue(row, 'Player Name', 'Name', 'Player');
             return name && typeof name === 'string' && name.trim() !== '';
        })
        .map((row: any, index: number) => {
            const pName = getRowValue(row, 'Player Name', 'Name', 'Player');
            const pTeam = getRowValue(row, 'Team', 'Winning Team');
            const pPriceVal = getRowValue(row, 'Auction Value', 'Price');
            const pContact = getRowValue(row, 'Contact No', 'Mobile', 'Contact');
            
            const cricket = getRowValue(row, 'Cricket', 'Cric'); 
            const badminton = getRowValue(row, 'Badminton', 'Bad');
            const tt = getRowValue(row, 'TT', 'Table Tennis');

            return {
                id: index + 1, 
                name: pName.trim(),
                team: pTeam ? pTeam.trim() : null,
                price: pPriceVal ? parseCurrency(pPriceVal) : 0, 
                cricket: normalizeRating(cricket),
                badminton: normalizeRating(badminton),
                tt: normalizeRating(tt),
                contactNo: pContact ? String(pContact).trim() : 'N/A'
            };
        });

    if (parsedPlayers.length === 0) return alert("No valid data found.");

    const updates: any = {};
    parsedPlayers.forEach(p => { updates[`players/${p.id}`] = p; });
    
    update(ref(db), updates)
        .then(() => alert(`✅ Uploaded ${parsedPlayers.length} players!`))
        .catch(e => alert("Upload failed: " + e.message));
  };

  const handleSaveConfig = (e: React.FormEvent) => {
      e.preventDefault();
      set(ref(db, 'config'), tempConfig);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
  };

  const handleReset = () => {
    if(confirm("⚠ WARNING: This will delete ALL auction data from the cloud. Proceed?")) {
        remove(ref(db, 'players'));
        remove(ref(db, 'current_auction_id'));
        remove(ref(db, 'activity_log'));
        location.reload();
    }
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `auction_data_${timestamp}`;
      const exportData = [...players].sort((a, b) => (a.team || "zz").localeCompare(b.team || "zz"));

      if (format === 'xlsx') {
          const ws = XLSX.utils.json_to_sheet(exportData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, "Auction Data");
          XLSX.writeFile(wb, `${fileName}.xlsx`);
      }
  };

  // --- 3. COMPUTED VALUES ---
  const teams = useMemo(() => {
    return INITIAL_TEAMS.map(initialTeam => calculateTeamStats(initialTeam.name, players, config));
  }, [players, config]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "ABCD2026") { 
        setIsAdmin(true); setLoginError(false); setPasswordInput("");
    } else {
        setLoginError(true);
    }
  };

  const switchTab = (tab: Tab) => { setActiveTab(tab); setMobileMenuOpen(false); }

  // --- 4. RENDER UI ---
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-amber-500/30">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-2 rounded-lg shadow-lg shadow-amber-900/40">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-lg md:text-2xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tight">
              IIID Sports Auction 2026
            </h1>
            <span className={`hidden md:inline-flex ml-2 px-2 py-0.5 rounded-full text-[10px] border uppercase tracking-wide font-bold ${isAdmin ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                {isAdmin ? 'Admin Mode' : 'Viewer Mode'}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                <button onClick={() => switchTab(Tab.DASHBOARD)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.DASHBOARD ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                    <LayoutDashboard className="w-4 h-4" /> <span>Dashboard</span>
                </button>
                {isAdmin && (
                    <button onClick={() => switchTab(Tab.AUCTION)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.AUCTION ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                        <Gavel className="w-4 h-4" /> <span>Console</span>
                    </button>
                )}
                <button onClick={() => switchTab(Tab.ROSTER)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === Tab.ROSTER ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                    <Users className="w-4 h-4" /> <span>Teams</span>
                </button>
                <button onClick={() => switchTab(Tab.SETTINGS)} className={`p-2 rounded-lg transition-all ${activeTab === Tab.SETTINGS ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                    {isAdmin ? <Settings className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </button>
            </nav>
            {isAdmin && <button onClick={() => setIsAdmin(false)} className="p-2 text-slate-400 hover:text-red-400" title="Logout"><Unlock className="w-5 h-5" /></button>}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-[1600px]">
        
        {!dataLoaded && activeTab !== Tab.SETTINGS ? (
           <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-700">
                <div className="bg-slate-900 p-8 rounded-full shadow-2xl border border-slate-800">
                    <Database className="w-16 h-16 text-indigo-500 mb-2" />
                </div>
                <div>
                    <h2 className="text-4xl font-black text-white mb-2">Initialize Database</h2>
                    <p className="text-slate-400 max-w-lg mx-auto text-lg">Welcome to Sports Auction Pro.</p>
                </div>
                <div className="w-full max-w-2xl bg-slate-900/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-800 shadow-xl">
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
                
                {/* SETTINGS TAB */}
                {activeTab === Tab.SETTINGS && (
                    <div className="max-w-5xl mx-auto pt-6 pb-20">
                        {/* SAFE DEVELOPER PROFILE */}
                        <div className="mb-8 flex justify-center">
                             {players.length > 0 && <DeveloperProfile players={players} variant="full" />}
                        </div>

                        {!isAdmin ? (
                            <div className="max-w-md mx-auto bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl text-center">
                                <div className="inline-flex p-4 bg-slate-800 rounded-full mb-6 text-indigo-400 border border-slate-700"><ShieldCheck className="w-8 h-8" /></div>
                                <h2 className="text-3xl font-black text-white mb-3">Admin Access</h2>
                                <form onSubmit={handleLogin} className="space-y-4">
                                    <input type="password" placeholder="Password" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-5 py-4 text-white outline-none" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                                    {loginError && <p className="text-red-400 text-sm font-medium">Incorrect password.</p>}
                                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg">Login</button>
                                </form>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* CONFIGURATION */}
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-indigo-500/30 shadow-xl">
                                    <h3 className="text-2xl font-black text-white mb-6">Tournament Setup</h3>
                                    <form onSubmit={handleSaveConfig} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Purse Limit</label>
                                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-4 text-white" value={tempConfig.purseLimit} onChange={(e) => setTempConfig({...tempConfig, purseLimit: parseInt(e.target.value) || 0})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Squad Size</label>
                                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-4 text-white" value={tempConfig.maxSquadSize} onChange={(e) => setTempConfig({...tempConfig, maxSquadSize: parseInt(e.target.value) || 0})} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Base Price</label>
                                                <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-4 text-white" value={tempConfig.basePrice} onChange={(e) => setTempConfig({...tempConfig, basePrice: parseInt(e.target.value) || 0})} />
                                            </div>
                                        </div>
                                        <button type="submit" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg flex items-center gap-2"><Save className="w-5 h-5" /> Save Rules</button>
                                        {configSaved && <span className="text-emerald-400 font-bold ml-4">Saved!</span>}
                                    </form>
                                </div>

                                {/* CAPTAINS & DATA */}
                                <div className="bg-slate-800/50 p-6 md:p-8 rounded-2xl border border-slate-700/50 shadow-xl">
                                    <h3 className="text-2xl font-black text-white mb-6">Management</h3>
                                    <CaptainAssignment players={players} teams={teams} onAssign={handleAssignCaptain} onRemove={handleRemoveCaptain} />
                                    
                                    <div className="mt-8 pt-8 border-t border-slate-700/50">
                                        <h4 className="text-xl font-bold text-white mb-4">Data Tools</h4>
                                        <div className="flex gap-4">
                                            <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-bold"><Download className="w-5 h-5"/> Download Excel</button>
                                            <button onClick={handleReset} className="flex items-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 text-white rounded-xl font-bold"><Trash2 className="w-5 h-5"/> Factory Reset</button>
                                        </div>
                                    </div>
                                    {/* EXTRA UPLOAD BUTTON IN SETTINGS */}
                                    <div className="mt-8">
                                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-2">Append/Re-Upload Data</h4>
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
