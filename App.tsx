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
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-lg
