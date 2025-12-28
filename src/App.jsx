import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, query, where, getDoc, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, OAuthProvider, signInWithCustomToken } from 'firebase/auth';

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyAcZy0oY6fmwJ4Lg9Ac-Bq__eMukMC_u0w",
    authDomain: "syrix-team-schedule.firebaseapp.com",
    projectId: "syrix-team-schedule",
    storageBucket: "syrix-team-schedule.firebasestorage.app",
    messagingSenderId: "571804588891",
    appId: "1:571804588891:web:c3c17a4859b6b4f057187e",
    measurementId: "G-VGXG0NCTGX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const discordWebhookUrl = "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD";

// --- GLOBAL CONSTANTS ---
const ADMIN_UIDS = ["M9FzRywhRIdUveh5JKUfQgJtlIB3", "SiPLxB20VzVGBZL3rTM42FsgEy52", "pmXgTX5dxbVns0nnO54kl1BR07A3"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAPS = ["Ascent", "Bind", "Breeze", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset", "Abyss", "Corrode"];
const ROLES = ["Flex", "Duelist", "Initiator", "Controller", "Sentinel"];
const RANKS = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
const AGENT_NAMES = ["Jett", "Raze", "Reyna", "Yoru", "Phoenix", "Neon", "Iso", "Vyse", "Waylay", "Omen", "Astra", "Brimstone", "Viper", "Harbor", "Clove", "Sova", "Fade", "Skye", "Breach", "KAY/O", "Gekko", "Killjoy", "Cypher", "Sage", "Chamber", "Deadlock", "Veto"];
const ROLE_ABBREVIATIONS = { Flex: "FLX", Duelist: "DUEL", Initiator: "INIT", Controller: "CTRL", Sentinel: "SENT" };

const UTILITY_TYPES = [
    { id: 'smoke', color: 'rgba(209, 213, 219, 0.3)', border: '#d1d5db', label: 'Smoke', shape: 'ring' },
    { id: 'molly', color: 'rgba(239, 68, 68, 0.3)', border: '#ef4444', label: 'Molly', shape: 'ring' },
    { id: 'flash', color: '#facc15', border: '#facc15', label: 'Flash', shape: 'star' },
    { id: 'recon', color: '#3b82f6', border: '#3b82f6', label: 'Recon', shape: 'triangle' },
    { id: 'stun', color: 'rgba(249, 115, 22, 0.3)', border: '#f97316', label: 'Stun', shape: 'square' },
    { id: 'barrier', color: 'rgba(45, 212, 191, 0.3)', border: '#2dd4bf', label: 'Barrier', shape: 'rect' },
    { id: 'trap', color: 'rgba(168, 85, 247, 0.5)', border: '#a855f7', label: 'Trap', shape: 'cross' },
    { id: 'ult', color: 'rgba(16, 185, 129, 0.2)', border: '#10b981', label: 'Ult', shape: 'diamond' }
];

const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

// --- UTILITY FUNCTIONS ---
function timeToMinutes(t) { if (!t || t === '24:00') return 1440; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const minutes = m % 1440; const hh = Math.floor(minutes / 60).toString().padStart(2, '0'); const mm = (minutes % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

const convertFromGMT = (day, time, timezone) => {
    if (!day || !time) return { day: '', time: '' };
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = jsDays.indexOf(day);
    const today = new Date();
    const currentDayIndex = today.getUTCDay();
    const distance = targetIndex - currentDayIndex;
    const gmtDate = new Date(today);
    gmtDate.setUTCDate(today.getUTCDate() + distance);
    const [hours, minutes] = time.split(':').map(Number);
    gmtDate.setUTCHours(hours, minutes, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = formatter.formatToParts(gmtDate);
    const part = (type) => parts.find(p => p.type === type)?.value;
    let localHours = part('hour');
    if (localHours === '24') localHours = '00';
    return { day: part('weekday'), time: `${localHours}:${part('minute')}` };
};

const convertToGMT = (day, time) => {
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = jsDays.indexOf(day);
    const today = new Date();
    const currentDayIndex = today.getDay();
    let distance = targetIndex - currentDayIndex;
    const d = new Date(today);
    d.setDate(today.getDate() + distance);
    const [hours, minutes] = time.split(':').map(Number);
    d.setHours(hours, minutes, 0, 0);
    return { day: jsDays[d.getUTCDay()], time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` };
};

// --- HELPER: SORT ROSTER ---
const sortRosterByRole = (rosterList, lookupData = null) => {
    const priority = { 'Captain': 0, 'Main': 1, 'Sub': 2, 'Tryout': 3 };
    return [...rosterList].sort((a, b) => {
        const roleA = (lookupData ? lookupData[a]?.role : a.role) || 'Tryout';
        const roleB = (lookupData ? lookupData[b]?.role : b.role) || 'Tryout';
        return (priority[roleA] ?? 99) - (priority[roleB] ?? 99);
    });
};

const GlobalStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        
        /* Root Reset - FIXED: Removed fixed height to allow scrolling */
        html, body, #root { 
            width: 100%; 
            margin: 0; 
            padding: 0; 
            overflow-x: hidden; /* Prevents side-to-side scrolling */
            /* Removed 'height: 100%' so the page can grow and scroll */
        }

        /* Shared & Hub Styles */
        .glass-panel { background: rgba(15, 15, 15, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
        .card-shine:hover { border-color: rgba(220, 38, 38, 0.3); background: rgba(20, 20, 20, 0.95); box-shadow: 0 8px 32px rgba(220, 38, 38, 0.1); }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ef4444; }
        .mask-fade { -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%); mask-image: linear-gradient(to right, black 90%, transparent 100%); }

        /* Landing Page Specific Styles */
        :root { --primary-red: #ff3333; --dark-bg: #1a1a1a; --card-bg: #282828; }
        .accent-text { color: var(--primary-red); }
        .accent-bg { background-color: var(--primary-red); transition: background-color 0.3s; }
        .accent-bg:hover { background-color: #e02c2c; }
        
        .hero-section {
            min-height: 100vh; /* Ensures it covers at least the full screen */
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            /* background-attachment removed from here to prevent scroll glitches on some mobile browsers */
        }
        
        /* Move background attachment here for desktop only */
        @media only screen and (min-width: 769px) { 
            .hero-section { background-attachment: fixed; } 
        }

        @keyframes pulse-red { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .live-indicator { animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .player-card { perspective: 1000px; min-height: 350px; }
        .card-inner { position: relative; width: 100%; height: 100%; transition: transform 0.7s; transform-style: preserve-3d; }
        .player-card:hover .card-inner { transform: rotateY(180deg); }
        .card-front, .card-back { position: absolute; width: 100%; height: 100%; backface-visibility: hidden; border-radius: 0.75rem; }
        .card-back { background-color: var(--card-bg); color: white; transform: rotateY(180deg); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem; text-align: center; }
        /* Scroll Mouse Animation */
        .scroll-mouse {
            width: 26px;
            height: 42px;
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 20px;
            position: relative;
        }
        .scroll-wheel {
            width: 2px;
            height: 6px;
            background: #ef4444;
            border-radius: 2px;
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            animation: scroll-bounce 2s infinite;
        }
        @keyframes scroll-bounce {
            0% { transform: translate(-50%, 0); opacity: 1; }
            50% { transform: translate(-50%, 8px); opacity: 0; }
            100% { transform: translate(-50%, 0); opacity: 1; }
        }    `
    }</style>
);

// --- SHARED COMPONENTS ---
const Background = () => (
    <div className="fixed inset-0 w-full h-full z-0 pointer-events-none bg-black">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(127,29,29,0.25)_0%,rgba(0,0,0,0)_70%)]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(69,10,10,0.25)_0%,rgba(0,0,0,0)_70%)]"></div>
        <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,#555_1px,transparent_1px),linear-gradient(to_bottom,#555_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,#000_100%)] opacity-80"></div>
    </div>
);

// --- CONTEXT ---
const ToastContext = createContext();
const useToast = () => useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto min-w-[240px] backdrop-blur-xl border-l-4 p-4 rounded-r-lg shadow-2xl animate-slide-in flex items-center gap-3 ${t.type === 'success' ? 'bg-green-900/80 border-green-500 text-white' : 'bg-red-900/80 border-red-500 text-white'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${t.type === 'success' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{t.type === 'success' ? '✓' : '!'}</div>
                        <span className="font-bold text-sm">{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// --- DATA PROVIDER HOOK ---
const useValorantData = () => {
    const [agentData, setAgentData] = useState({});
    const [mapImages, setMapImages] = useState({});
    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const agentRes = await fetch('https://valorant-api.com/v1/agents');
                const agentJson = await agentRes.json();
                const aMap = {};
                if (agentJson.data) agentJson.data.forEach(agent => {
                    aMap[agent.displayName] = {
                        icon: agent.displayIcon,
                        abilities: agent.abilities.map(a => ({ name: a.displayName, icon: a.displayIcon, slot: a.slot })).filter(a => a.slot !== "Passive" && a.icon)
                    };
                });
                setAgentData(aMap);
                const mapRes = await fetch('https://valorant-api.com/v1/maps');
                const mapJson = await mapRes.json();
                const mMap = {};
                if (mapJson.data) mapJson.data.forEach(map => { mMap[map.displayName] = map.displayIcon; });
                setMapImages(mMap);
            } catch (e) { console.error("Failed to fetch Valorant assets", e); }
        };
        fetchAssets();
    }, []);
    return { agentData, mapImages };
};

// --- REUSABLE COMPONENTS ---
const Modal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[150] flex justify-center items-center backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-neutral-900 rounded-2xl shadow-2xl shadow-red-900/20 p-6 w-full max-w-md border border-red-900/40 animate-fade-in relative">
                <h3 className="text-2xl font-black text-white mb-4 border-b pb-2 border-red-900/50 uppercase tracking-wider italic">{title}</h3>
                <div className="text-neutral-300 mb-8">{children}</div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-black/40 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 py-2 px-4 rounded-xl">Cancel</button>
                    {onConfirm && <button onClick={onConfirm} className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-xl">Confirm</button>}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// LANDING PAGE COMPONENT
// ==========================================
const LandingPage = ({ onEnterHub }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [roster, setRoster] = useState([]);
    const [matches, setMatches] = useState([]);
    const [allEvents, setAllEvents] = useState([]); // Added to store all events for stats
    const [newsData, setNewsData] = useState([]);
    const [intelData, setIntelData] = useState([]);
    const [merchData, setMerchData] = useState([]);
    const [achievements, setAchievements] = useState([]);

    // Load real data from Firestore
    useEffect(() => {
        const unsubRoster = onSnapshot(collection(db, 'roster'), (snap) => {
            const r = [];
            snap.forEach(doc => r.push({ id: doc.id, ...doc.data() }));
            setRoster(r);
        });
        const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
            const e = [];
            snap.forEach(doc => e.push({ id: doc.id, ...doc.data() }));
            setAllEvents(e); // Store all events for stats calculation
            // Filter for future matches
            const futureMatches = e
                .filter(m => new Date(m.date) >= new Date())
                .sort((a, b) => new Date(a.date) - new Date(b.date));
            setMatches(futureMatches);
        });

        // News Listener
        const unsubNews = onSnapshot(query(collection(db, 'news')), (snap) => {
            const n = []; snap.forEach(doc => n.push({ id: doc.id, ...doc.data() }));
            setNewsData(n.sort((a, b) => (b.isFeatured === a.isFeatured) ? new Date(b.date) - new Date(a.date) : b.isFeatured ? 1 : -1));
        });

        // Intel (VOD) Listener
        const unsubIntel = onSnapshot(query(collection(db, 'intel')), (snap) => {
            const i = []; snap.forEach(doc => i.push({ id: doc.id, ...doc.data() }));
            setIntelData(i.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3));
        });

        // Merch Listener
        const unsubMerch = onSnapshot(collection(db, 'merch'), (snap) => {
            const m = [];
            snap.forEach(doc => m.push({ id: doc.id, ...doc.data() }));
            setMerchData(m);
        });

        // NEW: Achievements Listener for Landing Page
        const unsubAchieve = onSnapshot(collection(db, 'achievements'), (snap) => {
            const a = [];
            snap.forEach(doc => a.push({ id: doc.id, ...doc.data() }));
                // Sort by created date (newest first) or any other logic
            setAchievements(a.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)));
        });

        return () => {
            unsubRoster(); unsubEvents(); unsubNews(); unsubIntel(); unsubMerch(); unsubAchieve();
        };
    }, []);

    const sortedRoster = useMemo(() => sortRosterByRole(roster), [roster]);

    // --- NEW STATS CALCULATION ---
    const teamStats = useMemo(() => {
        const pastMatches = allEvents.filter(e => e.result && e.result.myScore).sort((a, b) => new Date(a.date) - new Date(b.date));
        let wins = 0, losses = 0;
        pastMatches.forEach(m => {
            const my = parseInt(m.result.myScore);
            const enemy = parseInt(m.result.enemyScore);
            if (my > enemy) wins++;
            else if (my < enemy) losses++;
        });
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        let cumulative = 0;
        const trendPoints = pastMatches.slice(-10).map(m => {
            cumulative += (parseInt(m.result.myScore) - parseInt(m.result.enemyScore));
            return cumulative;
        });

        return { winRate, wins, losses, trendPoints };
    }, [allEvents]);

    const generateTrendPath = (points) => {
        if (!points.length) return "";
        const max = Math.max(...points.map(Math.abs)) || 10;
        const height = 50; const width = 150;
        const stepX = width / (points.length - 1 || 1);
        return points.map((pt, i) => `${i * stepX},${height / 2 - (pt / max) * (height / 2)}`).join(" ");
    };
    // -----------------------------

    const featuredNews = newsData.find(n => n.isFeatured) || newsData[0];
    const otherNews = newsData.filter(n => n.id !== featuredNews?.id).slice(0, 3);

    // Dynamic Script Loading for AOS
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/aos@2.3.1/dist/aos.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/aos@2.3.1/dist/aos.js';
        script.onload = () => { if (window.AOS) window.AOS.init({ duration: 800, once: true, offset: 50 }); };
        document.body.appendChild(script);

        return () => {
            document.head.removeChild(link);
            document.body.removeChild(script);
        };
    }, []);

    const PlayerCard = ({ player, delay }) => {
        return (
            <div className="player-card group w-full sm:w-72" data-aos="fade-up" data-aos-delay={delay}>
                <div className="card-inner">
                    {/* Front of Card */}
                    <div className={`card-front glass-panel rounded-xl overflow-hidden shadow-2xl border-b-4 border-red-600 relative`}>
                        <div className="w-full h-48 bg-gradient-to-b from-neutral-800 to-black flex items-center justify-center overflow-hidden">
                            {player.pfp ? (
                                <img src={player.pfp} alt={player.id} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                                <span className="text-6xl font-black text-neutral-700 group-hover:text-red-600 transition-colors">{player.id[0]}</span>
                            )}
                            {player.ingameRole && (
                                <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-lg">
                                    {player.ingameRole}
                                </div>
                            )}
                        </div>
                        <div className="p-6 text-center relative">
                            <h4 className={`text-2xl font-extrabold text-white mb-1`}>{player.id}</h4>
                            <p className="text-sm font-black text-red-600 mb-1 uppercase tracking-widest border-y border-red-900/30 py-1 inline-block">{player.role || 'Member'}</p>
                            <div className="mt-2 text-xs text-neutral-500 font-mono bg-black/50 py-1 px-2 rounded inline-block">Rank: {player.rank || 'N/A'}</div>
                        </div>
                    </div>

                    {/* Back of Card (Updated to remove Gamer Tag) */}
                    <div className="card-back glass-panel border border-red-900/30">
                        <h5 className="text-xl font-bold text-red-500 mb-2">{player.id}</h5>
                        <p className="text-neutral-300 text-sm italic">"{player.notes || 'No bio available.'}"</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen w-full font-sans text-white flex flex-col relative overflow-x-hidden bg-black">
            <Background />

            <header className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-md shadow-2xl border-b border-white/10 flex justify-center">
                <nav className="max-w-7xl w-full px-6 py-4 flex justify-between items-center">
                    <a href="#home" className="flex items-center space-x-2 text-white hover:text-red-500 transition-colors"><span className="text-3xl font-black text-red-600 italic">/</span><h1 className="text-xl font-black uppercase tracking-tighter italic">Syrix</h1></a>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl z-50 p-2 focus:outline-none text-white">☰</button>
                    <div className="hidden md:flex items-center space-x-8 text-xs font-bold uppercase tracking-widest">
                        <a href="#roster" className="text-white hover:text-red-500 transition duration-300">Roster</a>
                        <a href="#schedule" className="text-white hover:text-red-500 transition duration-300">Matches</a>
                        <a href="#vods" className="text-white hover:text-red-500 transition duration-300">VODs</a>
                        <a href="#merch" className="text-white hover:text-red-500 transition duration-300">Shop</a>
                        <button onClick={onEnterHub} className="px-6 py-2 rounded-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition duration-300 flex items-center gap-2 transform hover:scale-105">
                            <span>TEAM HUB</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>
                </nav>
            </header>

            {/* Mobile Menu */}
            <div className={`fixed inset-0 bg-black/95 z-40 transform transition-transform duration-300 md:hidden pt-24 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col items-center space-y-8 text-xl font-black uppercase italic tracking-tighter">
                    <a onClick={() => setMobileMenuOpen(false)} href="#roster" className="text-white hover:text-red-500">Roster</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#schedule" className="text-white hover:text-red-500">Matches</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#vods" className="text-white hover:text-red-500">VODs</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#merch" className="text-white hover:text-red-500">Shop</a>
                    <button onClick={() => { setMobileMenuOpen(false); onEnterHub(); }} className="px-8 py-4 rounded-full bg-red-600 text-white shadow-xl">TEAM HUB</button>
                </div>
            </div>

            <main className="flex-1 relative z-10 flex flex-col items-center w-full">
                <section id="home" className="w-full hero-section flex items-center justify-center text-center p-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black pointer-events-none"></div>
                    <div className="relative z-10 max-w-5xl mx-auto" data-aos="zoom-in">
                        <div className="flex justify-center mb-6">
                            <div className="h-1 w-24 bg-red-600 rounded-full shadow-[0_0_15px_red]"></div>
                        </div>
                        <h2 className="text-5xl md:text-8xl font-black leading-none mb-6 tracking-tighter italic drop-shadow-2xl">
                            DOMINATE THE SITE. <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500">UNITE AS SYRIX.</span>
                        </h2>
                        <p className="text-neutral-400 max-w-2xl mx-auto text-lg md:text-xl mb-10 font-light tracking-wide">
                            Pushing the limits of performance in every arena, driven by innovation, strategy, and relentless passion for the win.
                        </p>
                        <div className="flex flex-col md:flex-row gap-6 justify-center">
                            <a href="#roster" className="px-10 py-4 rounded-full bg-black/50 border border-white/20 text-white font-black uppercase tracking-widest hover:bg-white/10 hover:border-white/40 transition-all">
                                View Roster
                            </a>
                        </div>
                    </div>
                </section>

                {/* --- NEW TEAM STATS SECTION --- */}
                <section className="w-full py-12 bg-black border-b border-white/10 flex justify-center relative z-20">
                    <div className="max-w-7xl w-full px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border border-red-900/30" data-aos="fade-up" data-aos-delay="0">
                            <div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">Season Win Rate</div>
                                <div className="text-5xl font-black text-white italic tracking-tighter">{teamStats.winRate}%</div>
                            </div>
                            <div className="h-16 w-16 rounded-full border-4 border-red-600 flex items-center justify-center bg-red-900/20 shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                                <span className="text-2xl">🔥</span>
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border border-white/10" data-aos="fade-up" data-aos-delay="100">
                            <div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">Current Record</div>
                                <div className="text-5xl font-black text-white italic tracking-tighter flex gap-3">
                                    <span className="text-green-500">{teamStats.wins}W</span>
                                    <span className="text-neutral-600">-</span>
                                    <span className="text-red-500">{teamStats.losses}L</span>
                                </div>
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between border border-white/10 relative overflow-hidden" data-aos="fade-up" data-aos-delay="200">
                            <div className="relative z-10">
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">Performance Trend</div>
                                <div className="text-sm text-neutral-300 font-mono">Last 10 Matches</div>
                            </div>
                            <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-50">
                                <svg className="w-full h-full" viewBox="0 0 150 50" preserveAspectRatio="none">
                                    <path d={`M 0,25 ${generateTrendPath(teamStats.trendPoints)}`} fill="none" stroke={teamStats.trendPoints[teamStats.trendPoints.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="3" />
                                    <line x1="0" y1="25" x2="150" y2="25" stroke="#555" strokeWidth="1" strokeDasharray="4" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </section>
                {/* ------------------------------- */}

                <section id="about" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div data-aos="fade-right">
                            <h3 className="text-4xl font-black text-white italic tracking-tighter mb-6">OUR <span className="text-red-600">MISSION</span></h3>
                            <p className="text-neutral-400 text-lg leading-relaxed mb-6">
                                Syrix was founded on the principle that uncompromising skill and unified strategy conquer all. We are a disciplined organization dedicated to achieving excellence in every major competitive title.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-neutral-300"><span className="text-red-600 font-bold">01.</span> Relentless Training & Preparation</li>
                                <li className="flex items-center gap-3 text-neutral-300"><span className="text-red-600 font-bold">02.</span> Fan-First Community Engagement</li>
                                <li className="flex items-center gap-3 text-neutral-300"><span className="text-red-600 font-bold">03.</span> Unrivaled Professionalism</li>
                            </ul>
                        </div>
                        <div className="relative h-96 glass-panel rounded-3xl border-white/10 overflow-hidden" data-aos="fade-left">
                            <div className="absolute inset-0 bg-gradient-to-tr from-red-900/20 to-transparent"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-black text-9xl opacity-20 italic tracking-tighter">SYRIX</div>
                        </div>
                    </div>
                </section>

                {/* --- TROPHY CASE SECTION (DYNAMIC) --- */}
                <section className="w-full py-12 border-y border-white/5 bg-neutral-900/30 flex justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>

                    <div className="max-w-7xl w-full px-6 flex flex-wrap justify-center gap-8 md:gap-24 text-center">
                        {achievements.length > 0 ? (
                            achievements.map((item, index) => (
                                <div key={item.id} className="group" data-aos="fade-up" data-aos-delay={index * 100}>
                                    <div className="text-4xl mb-2 group-hover:-translate-y-2 transition-transform duration-300">{item.icon}</div>
                                    <div className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                        {item.highlight ? <span className="text-red-600">{item.title}</span> : item.title}
                                    </div>
                                    <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{item.subtitle}</div>
                                </div>
                            ))
                        ) : (
                            // Placeholder if no trophies yet
                            <div className="text-neutral-600 italic text-sm">Achievements loading or empty...</div>
                        )}
                    </div>
                </section>

                <section id="roster" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4"><span className="text-red-600">/</span> ACTIVE ROSTER</h3>
                            <p className="text-neutral-500 uppercase tracking-widest font-bold text-sm">The Squad</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8">
                            {sortedRoster.length > 0 ? sortedRoster.map((p, i) => <PlayerCard key={p.id} player={p} delay={i * 50} />) : <div className="w-full text-center text-neutral-500 py-12 border border-dashed border-neutral-800 rounded-xl">Loading Agents...</div>}
                        </div>
                    </div>
                </section>

                <section id="schedule" className="w-full py-24 bg-gradient-to-b from-transparent to-neutral-900/20 border-y border-white/5 relative flex justify-center">
                    <div className="max-w-5xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4"><span className="text-red-600">/</span> UPCOMING OPS</h3>
                            <p className="text-neutral-500 uppercase tracking-widest font-bold text-sm">Mission Log</p>
                        </div>
                        <div className="space-y-4" data-aos="fade-up">
                            {matches.length > 0 ? matches.map((match, i) => (
                                <div key={i} className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-6 hover:border-red-600/50 transition-all group">
                                    <div className="flex items-center gap-6">
                                        <div className="text-3xl font-black text-neutral-700 group-hover:text-white transition-colors">0{i + 1}</div>
                                        <div>
                                            <div className="text-2xl font-black text-white italic tracking-tight flex items-center gap-2">
                                                SYRIX <span className="text-sm text-red-600 not-italic font-bold px-2">VS</span> {match.opponent}
                                            </div>
                                            <div className="text-xs text-neutral-500 font-mono uppercase tracking-widest mt-1">{match.type} • {match.map || 'TBD'}</div>
                                        </div>
                                    </div>
                                    <div className="text-right bg-black/40 px-6 py-3 rounded-xl border border-white/5">
                                        <div className="text-red-500 font-black text-lg">{match.date}</div>
                                        <div className="text-white font-mono text-sm">@{match.time} {match.timezone}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 glass-panel rounded-2xl">
                                    <p className="text-neutral-500 italic">No upcoming operations scheduled.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="vods" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4"><span className="text-red-600">/</span> RECENT INTEL</h3>
                            <p className="text-neutral-500 uppercase tracking-widest font-bold text-sm">VODs & Highlights</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {intelData.length > 0 ? intelData.map((item, i) => (
                                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="glass-panel rounded-xl overflow-hidden group cursor-pointer block" data-aos="fade-up" data-aos-delay={i * 100}>
                                    <div className="aspect-video bg-neutral-900 relative">
                                        <img
                                            src={`https://img.youtube.com/vi/${item.url.split('v=')[1]?.split('&')[0] || item.url.split('/').pop()}/maxresdefault.jpg`}
                                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                                            onError={(e) => { e.target.style.display = 'none' }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center text-white group-hover:text-red-600 transition-colors z-10">
                                            <svg className="w-16 h-16 drop-shadow-xl" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                    <div className="p-4 relative z-20 bg-black/50 backdrop-blur-sm">
                                        <h4 className="font-bold text-white uppercase tracking-tight truncate">{item.title}</h4>
                                        <p className="text-xs text-neutral-500 mt-1">{item.subtitle}</p>
                                    </div>
                                </a>
                            )) : (
                                <div className="col-span-3 text-center text-neutral-500 italic">No recent intel declassified.</div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="news" className="w-full py-24 relative flex justify-center bg-black/50">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4"><span className="text-red-600">/</span> SITREP</h3>
                            <p className="text-neutral-500 uppercase tracking-widest font-bold text-sm">News & Updates</p>
                        </div>

                        {newsData.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Featured Article */}
                                {featuredNews && (
                                    <div className="glass-panel p-8 rounded-3xl border border-red-900/30 flex flex-col justify-center" data-aos="fade-right">
                                        <span className="text-red-500 text-xs font-bold uppercase tracking-widest mb-2 block">Featured • {featuredNews.date}</span>
                                        <h4 className="text-3xl font-black text-white mb-4 uppercase leading-none">{featuredNews.title}</h4>
                                        <p className="text-neutral-400 mb-6 line-clamp-4">{featuredNews.body}</p>
                                        <button className="text-white font-bold text-sm hover:text-red-500 transition-colors self-start">Read Full Report &rarr;</button>
                                    </div>
                                )}

                                {/* Other News List */}
                                <div className="space-y-4" data-aos="fade-left">
                                    {otherNews.map(item => (
                                        <div key={item.id} className="glass-panel p-6 rounded-2xl flex gap-4 items-center group hover:border-red-600/30 transition-all">
                                            <div className="w-16 h-16 bg-neutral-800 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl font-black text-neutral-700">
                                                {/* Initials as icon */}
                                                {item.title.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-white group-hover:text-red-500 transition-colors line-clamp-1">{item.title}</h5>
                                                <p className="text-xs text-neutral-500 uppercase tracking-wider">{item.type} • {item.date}</p>
                                                <p className="text-xs text-neutral-400 mt-1 line-clamp-1">{item.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-neutral-500 italic">Communications offline.</div>
                        )}
                    </div>
                </section>

                <section id="merch" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <h3 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4"><span className="text-red-600">/</span> ARMORY</h3>
                            <p className="text-neutral-500 uppercase tracking-widest font-bold text-sm">Official Gear</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {merchData.length > 0 ? merchData.map((item, i) => (
                                <div key={item.id} className="glass-panel rounded-2xl overflow-hidden group cursor-pointer" data-aos="fade-up" data-aos-delay={i * 100}>
                                    <div className="h-64 bg-neutral-800 flex items-center justify-center group-hover:bg-neutral-700 transition-colors relative">
                                        <span className="text-neutral-500 font-black uppercase tracking-widest z-10">{item.name}</span>
                                        {/* Placeholder gradient background if no image provided */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </div>
                                    <div className="p-6 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-white truncate max-w-[150px]">{item.name}</h4>
                                            <p className="text-xs text-red-500 font-bold">{item.price}</p>
                                        </div>
                                        <a href={item.link || '#'} target={item.link ? "_blank" : "_self"} rel="noreferrer" className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-red-600 hover:text-white transition-colors">
                                            Buy
                                        </a>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-3 text-center text-neutral-500 italic py-12">New collection dropping soon.</div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="partners" className="w-full py-16 relative flex justify-center border-t border-white/5 bg-black">
                    <div className="max-w-7xl w-full px-6">
                        <p className="text-center text-neutral-600 text-xs font-bold uppercase tracking-[0.3em] mb-8">Trusted By</p>
                        <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                            {['RougeEnergy','Logitech'].map((p) => (
                                <div key={p} className="text-2xl font-black text-white italic tracking-tighter">{p}</div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="community" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-4xl w-full px-6">
                        <div className="glass-panel rounded-[3rem] p-12 text-center border border-red-600/30 relative overflow-hidden" data-aos="zoom-in">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/20 rounded-full blur-[100px] pointer-events-none"></div>
                            <div className="relative z-10">
                                <h3 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter mb-6">JOIN THE <span className="text-red-600">SYNDICATE</span></h3>
                                <p className="text-neutral-400 mb-10 max-w-xl mx-auto text-lg">Become part of the Syrix family. Join our official Discord server for match-day chats, community events, and direct interaction with the team.</p>
                                <a href="https://discord.gg/HWbJr8sCse" target="_blank" rel="noopener noreferrer" className="inline-block px-12 py-5 rounded-full bg-white text-black font-black text-xl shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform uppercase tracking-widest">
                                    Join Discord
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-black border-t border-white/10 py-12 relative z-10 flex justify-center">
                <div className="max-w-7xl w-full px-6 text-center">
                    <div className="text-3xl font-black text-neutral-800 italic tracking-tighter mb-4">SYRIX</div>
                    <div className="text-xs text-neutral-600 uppercase tracking-widest">© 2025 Syrix Team Portal. All Rights Reserved.</div>
                </div>
            </footer>
        </div>
    );
};

// ==========================================
// SYRIX HUB / DASHBOARD (REACT APP INPUT)
// ==========================================

// ... (Helper Components for Hub)
const Input = (props) => (
    <input {...props} className={`w-full bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 shadow-inner hover:border-neutral-700 ${props.className}`} />
);
const Select = (props) => (
    <select {...props} className={`w-full bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all shadow-inner hover:border-neutral-700 ${props.className}`}>
        {props.children}
    </select>
);
const ButtonPrimary = ({ children, onClick, disabled, className = "" }) => (
    <button onClick={onClick} disabled={disabled} className={`bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow-lg shadow-red-900/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
        {children}
    </button>
);
const ButtonSecondary = ({ children, onClick, className = "" }) => (
    <button onClick={onClick} className={`bg-black/40 hover:bg-neutral-900 border border-neutral-800 hover:border-red-900/50 text-neutral-400 hover:text-white font-bold uppercase tracking-wider py-2 px-4 rounded-xl transition-all ${className}`}>
        {children}
    </button>
);
const Card = ({ children, className = "" }) => (
    <div className={`glass-panel rounded-3xl p-6 relative overflow-hidden group card-shine transition-all duration-300 ${className}`}>
        {children}
    </div>
);

const VictoryStamp = () => <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-green-500 text-green-500 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter -rotate-12 pointer-events-none mix-blend-screen shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-fade-in">VICTORY</div>;
const DefeatStamp = () => <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-red-600 text-red-600 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter rotate-12 pointer-events-none mix-blend-screen shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-fade-in">DEFEAT</div>;

// --- HUB SECTIONS ---
function LoginScreen({ signIn, onBack }) {
    return (
        <div className="fixed inset-0 bg-black w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 w-full h-full z-0 pointer-events-none bg-black">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(127,29,29,0.25)_0%,rgba(0,0,0,0)_70%)]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(69,10,10,0.25)_0%,rgba(0,0,0,0)_70%)]"></div>
            </div>
            <div className="relative z-10 bg-neutral-900/80 backdrop-blur-xl border border-white/10 p-12 rounded-[3rem] shadow-2xl shadow-red-900/40 flex flex-col items-center text-center max-w-md w-full mx-4">
                <h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">SYRIX</h1>
                <div className="h-1.5 w-32 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,1)] my-6"></div>

                <button onClick={signIn} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 rounded-2xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-3 text-lg uppercase tracking-wider mb-8">
                    Login with Discord
                </button>

                <button onClick={onBack} className="text-neutral-500 hover:text-white text-sm uppercase font-bold tracking-widest">
                    &larr; Back to Home
                </button>
            </div>
        </div>
    );
}

// ... (Including condensed versions of the functional components from the React input)
// ... (Due to length constraints, I'm integrating the essential logic of the Hub components below)

function CaptainsMessage() {
    const [message, setMessage] = useState({ text: "Welcome", updatedBy: "System" }); const [isEditing, setIsEditing] = useState(false); const [draft, setDraft] = useState(""); const auth = getAuth();
    const addToast = useToast();
    useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'captain_message'), (s) => { if (s.exists()) setMessage(s.data()); }); return () => unsub(); }, []);
    const handleSave = async () => { await setDoc(doc(db, 'general', 'captain_message'), { text: draft, updatedBy: auth.currentUser.displayName }); setIsEditing(false); addToast('Message Updated'); };
    return (<div className="bg-gradient-to-br from-red-950 to-black p-6 rounded-3xl border border-red-900/50 shadow-xl"><div className="flex justify-between items-center mb-2"><h2 className="text-lg font-black text-white">📢 CAPTAIN'S MESSAGE</h2>{!isEditing && <button onClick={() => { setDraft(message.text); setIsEditing(true) }} className="text-xs text-neutral-400">Edit</button>}</div>{isEditing ? <div><textarea value={draft} onChange={e => setDraft(e.target.value)} className="w-full bg-black p-2 text-white mb-2" /><ButtonPrimary onClick={handleSave} className="text-xs py-2">Post</ButtonPrimary></div> : <p className="text-slate-200 text-sm whitespace-pre-wrap">"{message.text}"</p>}</div>);
}

function LeaveLogger({ members }) {
    const [leaves, setLeaves] = useState([]);
    const [newLeave, setNewLeave] = useState({ start: '', end: '', reason: '' });
    const { currentUser } = getAuth();
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'leaves'), (snap) => {
            const l = []; snap.forEach(doc => l.push({ id: doc.id, ...doc.data() }));
            l.sort((a, b) => new Date(a.start) - new Date(b.start));
            setLeaves(l.filter(leave => new Date(leave.end) >= new Date()));
        });
        return () => unsub();
    }, []);
    const addLeave = async () => { if (!newLeave.start || !newLeave.end) return; await addDoc(collection(db, 'leaves'), { ...newLeave, user: currentUser.displayName || 'Guest', timestamp: new Date().toISOString() }); setNewLeave({ start: '', end: '', reason: '' }); };
    const deleteLeave = async (id) => await deleteDoc(doc(db, 'leaves', id));
    return (
        <Card className="border-red-900/20">
            <h3 className="text-lg font-black text-white mb-4 border-b border-red-900/30 pb-2 uppercase tracking-widest flex items-center gap-2"><span className="text-xl">🏖️</span> Absence Log</h3>
            <div className="space-y-3 mb-4"><div className="grid grid-cols-2 gap-2"><Input type="date" value={newLeave.start} onChange={e => setNewLeave({ ...newLeave, start: e.target.value })} className="[color-scheme:dark]" /><Input type="date" value={newLeave.end} onChange={e => setNewLeave({ ...newLeave, end: e.target.value })} className="[color-scheme:dark]" /></div><Input type="text" placeholder="Reason" value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} /><ButtonSecondary onClick={addLeave} className="w-full text-xs py-3">Log Absence</ButtonSecondary></div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{leaves.length === 0 && <p className="text-neutral-600 italic text-xs text-center py-2">No upcoming absences.</p>}{leaves.map(l => (<div key={l.id} className="p-3 bg-black/50 border border-neutral-800 rounded-lg flex justify-between items-center text-xs hover:border-red-900/50 transition-colors group"><div><span className="font-bold text-red-500 mr-2">{l.user}</span><span className="text-neutral-400">{l.start} - {l.end}</span><div className="text-neutral-500 italic mt-0.5">{l.reason}</div></div>{(l.user === currentUser?.displayName || ADMIN_UIDS.includes(currentUser?.uid)) && (<button onClick={() => deleteLeave(l.id)} className="text-neutral-600 hover:text-red-500 font-bold px-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>)}</div>))}</div>
        </Card>
    );
}

function ScrimScheduler({ onSchedule, userTimezone }) {
    const [form, setForm] = useState({ type: 'Scrim', date: '', time: '', opponent: '', map: MAPS[0] });

    const submit = async () => {
        if (!form.date || !form.time) return; // Basic validation
        await onSchedule({ ...form, timezone: userTimezone });
        setForm({ ...form, opponent: '' });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-red-500 block mb-1">EVENT TYPE</label>
                    <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                        <option>Scrim</option>
                        <option>Premier</option>
                        <option>Tournament</option>
                        <option>Competitive</option>
                        <option>VOD Review</option>
                        <option>Strategy Session</option>
                    </Select>
                </div>
                <div>
                    <label className="text-xs font-bold text-red-500 block mb-1">OPPONENT / NOTES</label>
                    <Input
                        value={form.opponent}
                        onChange={e => setForm({ ...form, opponent: e.target.value })}
                        placeholder={form.type === 'VOD Review' ? "e.g. Reviewing Ascent Scrim" : "e.g. Team Liquid"}
                    />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-red-500 block mb-1">MAP</label>
                    <Select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}>
                        <option value="General">General / None</option>
                        {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                    </Select>
                </div>
                <div>
                    <label className="text-xs font-bold text-red-500 block mb-1">TIME</label>
                    <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="[color-scheme:dark]" />
                </div>
            </div>
            <div className="grid grid-cols-1">
                <div>
                    <label className="text-xs font-bold text-red-500 block mb-1">DATE</label>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="[color-scheme:dark]" />
                </div>
            </div>
            <ButtonPrimary onClick={submit} className="w-full py-3">SCHEDULE EVENT</ButtonPrimary>
        </div>
    );
}

function AvailabilityHeatmap({ availabilities, members }) {
    const bucketSize = 60; const numBuckets = (24 * 60) / bucketSize;
    const data = useMemo(() => { const d = {}; for (const day of DAYS) { const b = new Array(numBuckets).fill(0); members.forEach(m => { (availabilities[m] || []).filter(s => s.day === day).forEach(s => { const start = Math.floor(timeToMinutes(s.start) / bucketSize); const end = Math.ceil(timeToMinutes(s.end) / bucketSize); for (let i = start; i < end && i < numBuckets; i++) b[i]++; }); }); d[day] = b; } return d; }, [availabilities, members]);
    return (<div className="overflow-x-auto rounded-xl border border-neutral-800 bg-black/50 shadow-inner"><div className="min-w-[600px]"><div className="flex border-b border-neutral-800"><div className="w-24 bg-black/50 sticky left-0 p-2 text-xs font-bold text-red-500 border-r border-neutral-800">DAY</div>{Array.from({ length: 24 }).map((_, i) => <div key={i} className="flex-1 text-[10px] text-center text-neutral-500 py-1 border-l border-neutral-800">{i}</div>)}</div>{DAYS.map(day => <div key={day} className="flex border-b border-neutral-800/50"><div className="w-24 bg-black/50 sticky left-0 p-2 text-xs font-bold text-neutral-400 border-r border-neutral-800">{day.substring(0, 3).toUpperCase()}</div>{data[day]?.map((c, i) => <div key={i} className="flex-1 h-8 border-l border-neutral-800/30 relative group bg-red-600" style={{ opacity: c > 0 ? (c / members.length) * 0.9 + 0.1 : 0 }}>{c > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{c}</span>}</div>)}</div>)}</div></div>);
}

function ApplicationForm({ currentUser }) {
    // added 'ign' (In-Game Name) to state
    const [form, setForm] = useState({ ign: '', tracker: '', rank: 'Unranked', role: 'Flex', exp: '', why: '' });
    const [status, setStatus] = useState('idle');
    const addToast = useToast();

    // Check if user already applied
    useEffect(() => {
        const checkExisting = async () => {
            if (!currentUser) return;
            const q = query(collection(db, 'applications'), where("uid", "==", currentUser.uid));
            try {
                const snap = await getDocs(q);
                if (!snap.empty) setStatus('already_applied');
            } catch (e) { console.error("Auth check error", e); }
        };
        checkExisting();
    }, [currentUser]);

    const submitApp = async () => {
        // Validation: Ensure IGN is filled
        if (!form.ign || !form.tracker || !form.why) return addToast("Please fill out all fields (IGN, Tracker, Why)", "error");

        setStatus('saving');

        // Use the manually entered IGN as the 'user' field, fallback to Discord name if needed
        const finalUsername = form.ign || currentUser.displayName || "Unknown_User";

        const appData = {
            ...form,
            user: finalUsername, // This is now safe
            uid: currentUser.uid,
            submittedAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, 'applications'), appData);

            // Discord Webhook
            const content = { embeds: [{ title: `New App: ${finalUsername}`, color: 16776960, fields: [{ name: 'Rank', value: form.rank }, { name: 'Role', value: form.role }, { name: 'Tracker', value: form.tracker }] }] };
            fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) }).catch(console.error);

            setStatus('success');
            addToast("Application Submitted Successfully");
        } catch (e) {
            console.error(e);
            setStatus('error');
            addToast("Error submitting application", "error");
        }
    };

    if (status === 'success') return <div className="h-full flex flex-col gap-4 items-center justify-center text-white text-2xl font-black">✅ APPLICATION SENT</div>;
    if (status === 'already_applied') return <div className="h-full flex flex-col gap-4 items-center justify-center text-white text-2xl font-black">⏳ APPLICATION PENDING</div>;

    return (
        <div className="bg-neutral-900/90 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 max-w-2xl mx-auto shadow-2xl">
            <h2 className="text-4xl font-black text-white mb-6 italic tracking-tighter">JOIN <span className="text-red-600">SYRIX</span></h2>

            <div className="space-y-4">
                {/* NEW INPUT: Riot ID */}
                <div>
                    <label className="text-xs font-bold text-red-500 uppercase mb-1 block">Riot ID (Game Name)</label>
                    <Input
                        value={form.ign}
                        onChange={e => setForm({ ...form, ign: e.target.value })}
                        placeholder="e.g. Syrix#NA1"
                        className="border-red-500/50" // Highlight this input
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Current Rank</label>
                        <Select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}>
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Preferred Role</label>
                        <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </Select>
                    </div>
                </div>

                <Input value={form.tracker} onChange={e => setForm({ ...form, tracker: e.target.value })} placeholder="Tracker.gg URL" />
                <Input value={form.exp} onChange={e => setForm({ ...form, exp: e.target.value })} placeholder="Competitive Experience" />

                <textarea
                    className="w-full bg-black/50 border border-neutral-800 rounded-xl p-4 text-white min-h-[100px]"
                    value={form.why}
                    onChange={e => setForm({ ...form, why: e.target.value })}
                    placeholder="Why do you want to join?"
                />

                <ButtonPrimary onClick={submitApp} disabled={status === 'saving'} className="w-full py-4 text-lg">
                    {status === 'saving' ? 'SENDING...' : 'SUBMIT APPLICATION'}
                </ButtonPrimary>
            </div>
        </div>
    );
}
function PerformanceWidget({ events }) {
    const stats = useMemo(() => {
        let wins = 0, losses = 0; let atkWins = 0, atkPlayed = 0, defWins = 0, defPlayed = 0; const mapStats = {};
        const recentMatches = events.filter(e => e.result && e.result.myScore).sort((a, b) => new Date(a.date) - new Date(b.date));

        recentMatches.forEach(m => {
            const my = parseInt(m.result.myScore); const enemy = parseInt(m.result.enemyScore);
            if (my > enemy) wins++; else if (my < enemy) losses++;
            if (!mapStats[m.result.map]) mapStats[m.result.map] = { played: 0, wins: 0 };
            mapStats[m.result.map].played++;
            if (my > enemy) mapStats[m.result.map].wins++;
            if (m.result.atkScore) { atkWins += parseInt(m.result.atkScore); atkPlayed += 12; }
            if (m.result.defScore) { defWins += parseInt(m.result.defScore); defPlayed += 12; }
        });

        const totalGames = wins + losses;
        const overallWinRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const atkWinRate = atkPlayed > 0 ? Math.round((atkWins / atkPlayed) * 100) : 0;
        const defWinRate = defPlayed > 0 ? Math.round((defWins / defPlayed) * 100) : 0;
        let bestMap = 'N/A'; let bestRate = -1;
        Object.keys(mapStats).forEach(m => { const r = mapStats[m].wins / mapStats[m].played; if (r > bestRate) { bestRate = r; bestMap = m; } });

        let cumulative = 0;
        const trendPoints = recentMatches.slice(-10).map((m, i) => {
            const diff = parseInt(m.result.myScore) - parseInt(m.result.enemyScore);
            cumulative += diff;
            return cumulative;
        });

        return { wins, losses, overallWinRate, bestMap, atkWinRate, defWinRate, trendPoints };
    }, [events]);

    const generatePath = () => {
        if (!stats.trendPoints.length) return "";
        const max = Math.max(...stats.trendPoints.map(Math.abs)) || 10;
        const height = 50; const width = 100;
        const stepX = width / (stats.trendPoints.length - 1 || 1);
        const points = stats.trendPoints.map((pt, i) => {
            const x = i * stepX;
            const y = height / 2 - (pt / max) * (height / 2);
            return `${x},${y}`;
        });
        return points.join(" ");
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="!p-4 flex flex-col justify-between relative overflow-hidden">
                <div className="text-[10px] text-neutral-500 font-bold uppercase z-10">Performance Trend</div>
                <div className="text-xs text-white font-bold z-10">Round Diff History</div>
                <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path d={`M 0,25 ${generatePath()}`} fill="none" stroke={stats.trendPoints[stats.trendPoints.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="2" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#555" strokeWidth="0.5" strokeDasharray="2" />
                </svg>
            </Card>
            <Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Win Rate</div><div className="text-3xl font-black text-white">{stats.overallWinRate}%</div><div className="w-full h-1 bg-neutral-800 mt-2"><div className="h-full bg-red-600" style={{ width: `${stats.overallWinRate}%` }}></div></div></Card>
            <Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">ATK / DEF</div><div className="flex gap-2 text-xs font-bold text-white"><div>⚔️ {stats.atkWinRate}%</div><div>🛡️ {stats.defWinRate}%</div></div></Card>
            <Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Best Map</div><div className="text-xl font-black text-white truncate">{stats.bestMap}</div></Card>
        </div>
    );
}

// --- Missing Components Restored ---

function Playbook() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [side, setSide] = useState('Attack');
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const fetchNotes = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'playbooks', `${selectedMap}_${side}`);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setContent(snap.data().text);
                } else {
                    setContent("");
                }
            } catch (error) {
                console.error("Playbook Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNotes();
    }, [selectedMap, side]);

    const handleSave = async () => {
        try {
            await setDoc(doc(db, 'playbooks', `${selectedMap}_${side}`), {
                text: content,
                updatedAt: new Date().toISOString()
            });
            addToast(`${selectedMap} ${side} Protocols Saved!`);
        } catch (e) {
            addToast("Error saving protocols", "error");
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-3xl font-black text-white italic tracking-tighter">
                    <span className="text-red-600">/</span> PROTOCOLS
                </h3>
                <div className="flex bg-black border border-neutral-800 rounded-xl p-1">
                    <button onClick={() => setSide('Attack')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${side === 'Attack' ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}>Attack</button>
                    <button onClick={() => setSide('Defense')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${side === 'Defense' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}>Defense</button>
                </div>
            </div>

            <div className="flex justify-center w-full">
                <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar max-w-full">
                    {MAPS.map(m => (
                        <button key={m} onClick={() => setSelectedMap(m)} className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${selectedMap === m ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600'}`}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-neutral-900/80 border border-white/10 rounded-3xl p-1 relative overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                <div className={`absolute top-0 left-0 w-full h-1 z-10 ${side === 'Attack' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                {loading && <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center text-xs font-bold text-white animate-pulse">LOADING PROTOCOLS...</div>}
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 w-full h-full bg-transparent p-8 text-sm md:text-base text-neutral-300 font-mono focus:outline-none resize-none custom-scrollbar placeholder-neutral-700 leading-relaxed"
                    placeholder={`Write your ${selectedMap} ${side} protocols here...\n\nExamples:\n- Default setup: Omen smokes tree, Sova darts main.\n- Anti-Eco: Play retake A, hold passive angles.\n- Ult Economy: If we have KJ ult, rush B.`}
                />
                <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end backdrop-blur-sm">
                    <ButtonPrimary onClick={handleSave} className="text-xs py-3 px-8">Save {side} Notes</ButtonPrimary>
                </div>
            </div>
        </div>
    );
}

function TeamComps({ members }) {
    const [comps, setComps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [newComp, setNewComp] = useState({ agents: Array(5).fill(''), players: Array(5).fill('') });
    const [activeDropdown, setActiveDropdown] = useState(null);

    const { agentData } = useValorantData();
    const addToast = useToast();

    const getAgentIcon = (agentName) => {
        if (!agentName) return null;
        if (agentData && agentData[agentName]) return agentData[agentName].icon;
        return null;
    };

    useEffect(() => { const unsub = onSnapshot(collection(db, 'comps'), (snap) => { const c = []; snap.forEach(doc => c.push({ id: doc.id, ...doc.data() })); setComps(c); }); return () => unsub(); }, []);
    const saveComp = async () => { if (newComp.agents.some(a => !a)) return addToast('Please select all 5 agents', 'error'); await addDoc(collection(db, 'comps'), { map: selectedMap, ...newComp }); setNewComp({ agents: Array(5).fill(''), players: Array(5).fill('') }); addToast('Composition Saved'); };
    const deleteComp = async (id) => { await deleteDoc(doc(db, 'comps', id)); addToast('Composition Deleted'); };
    const currentMapComps = comps.filter(c => c.map === selectedMap);

    const AgentCard = ({ index }) => {
        const isOpen = activeDropdown === index;
        const selectedAgent = newComp.agents[index];
        const agentImage = getAgentIcon(selectedAgent);

        return (
            <div className="relative group h-64 bg-neutral-900/80 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-red-600 hover:shadow-[0_0_30px_rgba(220,38,38,0.2)] flex flex-col">
                {selectedAgent && agentImage && (<div className="absolute inset-0 z-0"><img src={agentImage} alt={selectedAgent} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity mix-blend-luminosity" style={{ objectPosition: 'center top' }} /><div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-900/50 to-neutral-950"></div></div>)}
                <div onClick={() => setActiveDropdown(isOpen ? null : index)} className="flex-1 relative flex flex-col justify-center items-center p-4 z-10 border-b border-white/5 cursor-pointer">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-3 z-20 drop-shadow-md">Role {index + 1}</label>
                    {selectedAgent ? (<div className="flex flex-col items-center animate-fade-in z-20"><div className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">{selectedAgent}</div><div className="mt-2 h-0.5 w-8 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div></div>) : (<div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-xl p-4 w-full h-full hover:border-red-500/50 transition-all opacity-60 hover:opacity-100"><span className="text-2xl text-neutral-400 mb-1">+</span><span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Select Agent</span></div>)}
                </div>
                {isOpen && (<div className="absolute inset-0 bg-neutral-950 z-50 flex flex-col animate-fade-in"><div className="flex justify-between items-center p-3 border-b border-white/10 bg-neutral-900"><span className="text-xs font-bold text-white uppercase tracking-widest">Pick Agent</span><button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }} className="text-neutral-500 hover:text-red-500 text-lg leading-none">×</button></div><div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1 custom-scrollbar">{AGENT_NAMES.map(agent => (<button key={agent} onClick={(e) => { e.stopPropagation(); const a = [...newComp.agents]; a[index] = agent; setNewComp({ ...newComp, agents: a }); setActiveDropdown(null); }} className={`text-[10px] font-bold uppercase py-2 rounded border border-transparent hover:border-red-900 transition-all ${newComp.agents[index] === agent ? 'bg-red-700 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>{agent}</button>))}</div></div>)}
                <div className="h-16 relative bg-black/80 backdrop-blur flex items-center justify-center z-20 border-t border-white/5"><select value={newComp.players[index]} onChange={e => { const p = [...newComp.players]; p[index] = e.target.value; setNewComp({ ...newComp, players: p }); }} className="appearance-none bg-transparent text-center text-xs font-bold text-neutral-500 uppercase outline-none cursor-pointer w-full h-full hover:text-white transition-all tracking-wider" style={{ textAlignLast: 'center' }}><option value="" className="bg-neutral-900">Assign Player</option>{members.map(m => <option key={m} value={m} className="bg-neutral-900">{m}</option>)}</select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-700 text-[10px]">▼</div></div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-white/10 pb-6"><h3 className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3"><span className="text-red-600 text-5xl">/</span> TACTICAL COMPS</h3></div>
            <div className="flex flex-wrap gap-2">{MAPS.map(m => (<button key={m} onClick={() => setSelectedMap(m)} className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all transform ${selectedMap === m ? 'bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] scale-105 border border-red-500' : 'bg-black border border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:text-white hover:border-white/20'}`}>{m}</button>))}</div>
            <div className="bg-neutral-900/50 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="flex justify-between items-center mb-8 relative z-10"><div className="flex items-center gap-3"><span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span></span><h4 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Design {selectedMap} Strategy</h4></div><ButtonPrimary onClick={saveComp} className="text-xs py-2">Save Loadout</ButtonPrimary></div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4" onClick={() => setActiveDropdown(null)}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} onClick={e => e.stopPropagation()}><AgentCard index={i} /></div>))}</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{currentMapComps.map(comp => (<div key={comp.id} className="bg-neutral-900/80 rounded-2xl border border-white/5 overflow-hidden relative group hover:border-red-600/40 transition-all shadow-lg"><div className="bg-black/50 px-5 py-3 flex justify-between items-center border-b border-neutral-800 group-hover:bg-red-900/10 transition-colors"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div><div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">ID: {comp.id.substring(0, 6)}</div></div><button onClick={() => deleteComp(comp.id)} className="text-neutral-600 hover:text-white font-bold text-[10px] bg-neutral-800 hover:bg-red-600 px-2 py-1 rounded transition-all">DELETE</button></div><div className="p-5 grid grid-cols-5 gap-2 divide-x divide-neutral-800/50">{comp.agents.map((agent, i) => (<div key={i} className="text-center flex flex-col justify-center items-center gap-1"><div className="text-xs sm:text-sm font-black text-white uppercase tracking-tight drop-shadow-sm">{agent}</div><div className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest truncate w-full">{comp.players[i] || '-'}</div></div>))}</div></div>))}</div>
        </div>
    );
}

function StratBook() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [selectedAgentForUtil, setSelectedAgentForUtil] = useState(AGENT_NAMES[0]);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const { mapImages, agentData } = useValorantData();
    const [color, setColor] = useState('#ef4444');
    const addToast = useToast();

    const [mapIcons, setMapIcons] = useState([]);
    const [dragItem, setDragItem] = useState(null);
    const [movingIconIndex, setMovingIconIndex] = useState(null);
    const [selectedIconId, setSelectedIconId] = useState(null);

    const [savedStrats, setSavedStrats] = useState([]);
    const [viewingStrat, setViewingStrat] = useState(null);

    useEffect(() => {
        const qStrats = query(collection(db, 'strats'), where("map", "==", selectedMap));
        const unsubStrats = onSnapshot(qStrats, (snap) => { const s = []; snap.forEach(doc => s.push({ id: doc.id, ...doc.data() })); s.sort((a, b) => new Date(b.date) - new Date(a.date)); setSavedStrats(s); });
        return () => { unsubStrats(); };
    }, [selectedMap]);

    const getPos = (e) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.nativeEvent ? e.nativeEvent.clientX : e.touches[0].clientX;
        const clientY = e.nativeEvent ? e.nativeEvent.clientY : e.touches[0].clientY;
        return { x: (clientX - rect.left) * (canvasRef.current.width / rect.width), y: (clientY - rect.top) * (canvasRef.current.height / rect.height) };
    };

    const startDraw = (e) => {
        if (movingIconIndex !== null || selectedIconId !== null) return;
        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y); setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        const ctx = canvasRef.current.getContext('2d');
        const pos = getPos(e);
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
    };

    const stopDraw = () => setIsDrawing(false);
    const clearCanvas = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setMapIcons([]);
        setSelectedIconId(null);
        addToast('Canvas Cleared');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (dragItem) {
            setMapIcons([...mapIcons, { id: Date.now(), ...dragItem, x, y, rotation: 0, scale: 1.0 }]);
            setDragItem(null);
        } else if (movingIconIndex !== null) {
            const updated = [...mapIcons];
            updated[movingIconIndex] = { ...updated[movingIconIndex], x, y };
            setMapIcons(updated);
            setMovingIconIndex(null);
        }
    };

    const updateSelectedIcon = (prop, value) => {
        if (selectedIconId === null) return;
        setMapIcons(prev => prev.map(icon => icon.id === selectedIconId ? { ...icon, [prop]: value } : icon));
    };

    const deleteSelectedIcon = () => {
        setMapIcons(prev => prev.filter(icon => icon.id !== selectedIconId));
        setSelectedIconId(null);
    };

    const saveStrat = async () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1024; tempCanvas.height = 1024;
        const ctx = tempCanvas.getContext('2d');

        if (mapImages[selectedMap]) {
            const img = new Image();
            img.src = mapImages[selectedMap];
            img.crossOrigin = "anonymous";
            await new Promise((r) => { img.onload = r; img.onerror = r; });
            ctx.drawImage(img, 0, 0, 1024, 1024);
        }

        ctx.drawImage(canvasRef.current, 0, 0);

        for (const icon of mapIcons) {
            const px = (icon.x / 100) * 1024;
            const py = (icon.y / 100) * 1024;
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate((icon.rotation || 0) * Math.PI / 180);
            const scale = icon.scale || 1;
            ctx.scale(scale, scale);

            if (icon.type === 'agent' && agentData[icon.name]?.icon) {
                const img = new Image(); img.crossOrigin = "anonymous"; img.src = agentData[icon.name].icon;
                await new Promise(r => { img.onload = r; img.onerror = r; });
                ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.clip();
                ctx.drawImage(img, -25, -25, 50, 50);
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
            } else if (icon.type === 'ability') {
                const img = new Image(); img.crossOrigin = "anonymous"; img.src = icon.icon;
                await new Promise(r => { img.onload = r; img.onerror = r; });
                ctx.drawImage(img, -20, -20, 40, 40);
            } else if (icon.type === 'site_label') {
                ctx.font = "bold 60px Arial"; ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillText(icon.label, 0, 0);
            } else {
                ctx.beginPath();
                if (icon.shape === 'ring') { ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fillStyle = icon.color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = icon.border; ctx.stroke(); }
                else if (icon.shape === 'square') { ctx.fillStyle = icon.color; ctx.rect(-15, -15, 30, 30); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = icon.border; ctx.stroke(); }
                else if (icon.shape === 'rect') { ctx.fillStyle = icon.color; ctx.rect(-25, -8, 50, 16); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = icon.border; ctx.stroke(); }
                else if (icon.shape === 'cross') { ctx.strokeStyle = icon.border; ctx.lineWidth = 4; ctx.moveTo(-15, -15); ctx.lineTo(15, 15); ctx.moveTo(15, -15); ctx.lineTo(-15, 15); ctx.stroke(); }
                else if (icon.shape === 'diamond') { ctx.fillStyle = icon.color; ctx.moveTo(0, -20); ctx.lineTo(20, 0); ctx.lineTo(0, 20); ctx.lineTo(-20, 0); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = icon.border; ctx.stroke(); }
                else if (icon.shape === 'triangle') { ctx.fillStyle = icon.color; ctx.moveTo(0, -15); ctx.lineTo(15, 15); ctx.lineTo(-15, 15); ctx.fill(); }
                else { ctx.fillStyle = icon.color; ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.restore();
        }

        const dataUrl = tempCanvas.toDataURL();
        await addDoc(collection(db, 'strats'), { map: selectedMap, image: dataUrl, date: new Date().toISOString() });
        addToast('Strat Saved!');
    };

    const deleteStrat = async (id) => { if (viewingStrat) setViewingStrat(null); await deleteDoc(doc(db, 'strats', id)); addToast('Strategy Deleted'); };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex gap-4 h-[75vh]">
                <Card className="w-64 flex flex-col gap-4 overflow-hidden !p-0">
                    <div className="bg-neutral-900 p-4 border-b border-white/10">
                        <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">1. Map Markers</h4>
                        <div className="flex gap-2 justify-center">
                            {['A', 'B', 'C', 'S'].map(l => (
                                <div key={l} draggable onDragStart={() => setDragItem({ type: 'site_label', label: l })} className="w-8 h-8 bg-white/10 rounded flex items-center justify-center text-xs font-bold cursor-grab hover:bg-white/20 border border-white/20">{l}</div>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                        <div>
                            <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">2. Generic Util</h4>
                            <div className="grid grid-cols-4 gap-2">
                                {UTILITY_TYPES.map(u => (
                                    <div key={u.id} draggable onDragStart={() => setDragItem({ type: 'util', ...u })} className="w-10 h-10 rounded border border-neutral-700 bg-black cursor-grab hover:border-white flex items-center justify-center" title={u.label}>
                                        {u.shape === 'ring' && <div className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: u.color, borderColor: u.border }}></div>}
                                        {u.shape === 'square' && <div className="w-5 h-5 border-2" style={{ backgroundColor: u.color, borderColor: u.border }}></div>}
                                        {u.shape === 'rect' && <div className="w-6 h-3 border-2" style={{ backgroundColor: u.color, borderColor: u.border }}></div>}
                                        {u.shape === 'cross' && <div className="text-sm font-black" style={{ color: u.border }}>X</div>}
                                        {u.shape === 'diamond' && <div className="w-4 h-4 transform rotate-45 border-2" style={{ backgroundColor: u.color, borderColor: u.border }}></div>}
                                        {u.shape === 'triangle' && <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[10px]" style={{ borderBottomColor: u.border }}></div>}
                                        {u.shape === 'star' && <div className="w-2 h-2 bg-yellow-500 rotate-45"></div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">3. Abilities</h4>
                            <Select value={selectedAgentForUtil} onChange={e => setSelectedAgentForUtil(e.target.value)} className="mb-2">
                                {AGENT_NAMES.map(a => <option key={a} value={a}>{a}</option>)}
                            </Select>
                            <div className="grid grid-cols-4 gap-2">
                                {agentData[selectedAgentForUtil]?.abilities.map((ability, i) => (
                                    <div key={i} draggable onDragStart={() => setDragItem({ type: 'ability', name: ability.name, icon: ability.icon })} className="aspect-square bg-black border border-neutral-800 rounded hover:border-red-500 cursor-grab flex items-center justify-center p-1 group">
                                        <img src={ability.icon} alt={ability.name} className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">4. Agents</h4>
                            <div className="grid grid-cols-4 gap-2">
                                {AGENT_NAMES.map(a => (
                                    <img key={a} src={agentData[a]?.icon} alt={a} draggable onDragStart={() => setDragItem({ type: 'agent', name: a })} className="w-8 h-8 rounded-full border border-neutral-700 bg-black cursor-grab hover:border-white" />
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="flex-1 flex flex-col relative items-center justify-center bg-black/80 !p-2">
                    <div className="w-full flex justify-between items-center mb-2 px-4 pt-2">
                        <h3 className="text-2xl font-black text-white">STRATBOOK {viewingStrat && <span className="text-red-500 text-sm ml-2">(VIEWING)</span>}</h3>
                        <div className="flex gap-2">{!viewingStrat ? (<><button onClick={() => setColor('#ef4444')} className="w-6 h-6 rounded-full bg-red-500 border border-white"></button><button onClick={() => setColor('#3b82f6')} className="w-6 h-6 rounded-full bg-blue-500 border border-white"></button><button onClick={() => setColor('#ffffff')} className="w-6 h-6 rounded-full bg-white border border-white"></button><ButtonSecondary onClick={clearCanvas} className="text-xs py-1 px-3">Clear</ButtonSecondary><ButtonPrimary onClick={saveStrat} className="text-xs py-1 px-3">Save</ButtonPrimary></>) : <ButtonSecondary onClick={() => setViewingStrat(null)} className="text-xs bg-red-900/50 border-red-500 text-white">Close</ButtonSecondary>}</div>
                    </div>
                    <div className="w-full flex overflow-x-auto gap-2 pb-4 mb-2 px-4 custom-scrollbar">{MAPS.map(m => <button key={m} onClick={() => { setSelectedMap(m); clearCanvas(); setViewingStrat(null); }} className={`px-3 py-1 rounded-full text-xs font-bold ${selectedMap === m ? 'bg-red-600 text-white' : 'bg-black text-neutral-500'}`}>{m}</button>)}</div>

                    <div ref={containerRef} className="relative h-full aspect-square bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl mx-auto" onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => setSelectedIconId(null)}>
                        {mapImages[selectedMap] && <img src={mapImages[selectedMap]} alt="Map" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />}

                        {!viewingStrat && mapIcons.map((icon, i) => (
                            <div
                                key={icon.id}
                                className={`absolute cursor-grab active:cursor-grabbing group ${selectedIconId === icon.id ? 'z-50' : 'z-20'}`}
                                style={{
                                    left: `${icon.x}%`, top: `${icon.y}%`,
                                    transform: `translate(-50%, -50%) rotate(${icon.rotation || 0}deg) scale(${icon.scale || 1})`,
                                    transition: 'transform 0.1s'
                                }}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); setMovingIconIndex(i); }}
                                onClick={(e) => { e.stopPropagation(); setSelectedIconId(icon.id); }}
                            >
                                {icon.type === 'agent' ? <img src={agentData[icon.name]?.icon} alt={icon.name} className={`w-10 h-10 rounded-full border-2 shadow-md pointer-events-none bg-black ${selectedIconId === icon.id ? 'border-green-500' : 'border-white'}`} /> :
                                    icon.type === 'ability' ? <img src={icon.icon} className={`w-8 h-8 drop-shadow-md ${selectedIconId === icon.id ? 'filter brightness-150' : ''}`} /> :
                                        icon.type === 'site_label' ? <div className="text-4xl font-black text-white drop-shadow-lg select-none" style={{ textShadow: '0 0 10px black' }}>{icon.label}</div> :
                                            (icon.shape === 'ring' ? <div className="w-12 h-12 rounded-full border-4 shadow-sm backdrop-blur-sm" style={{ backgroundColor: icon.color, borderColor: icon.border }}></div> :
                                                (icon.shape === 'triangle' ? <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px]" style={{ borderBottomColor: icon.border }}></div> :
                                                    (icon.shape === 'square' ? <div className="w-8 h-8 border-2 shadow-md backdrop-blur-sm" style={{ backgroundColor: icon.color, borderColor: icon.border }}></div> :
                                                        (icon.shape === 'rect' ? <div className="w-16 h-4 border-2 shadow-md backdrop-blur-sm" style={{ backgroundColor: icon.color, borderColor: icon.border }}></div> :
                                                            (icon.shape === 'cross' ? <div className="text-3xl font-black leading-none drop-shadow-md" style={{ color: icon.border }}>X</div> :
                                                                (icon.shape === 'diamond' ? <div className="w-12 h-12 transform rotate-45 border-2 shadow-md backdrop-blur-sm" style={{ backgroundColor: icon.color, borderColor: icon.border }}></div> :
                                                                    <div className="w-6 h-6 transform rotate-45" style={{ backgroundColor: icon.color }}></div>))))))}
                            </div>
                        ))}

                        <canvas ref={canvasRef} width={1024} height={1024} className={`absolute inset-0 w-full h-full z-10 touch-none ${viewingStrat ? 'hidden' : 'cursor-crosshair'}`} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} />
                        {viewingStrat && <div className="absolute inset-0 z-30 bg-black flex items-center justify-center"><img src={viewingStrat} alt="Saved Strat" className="w-full h-full object-contain" /></div>}

                        {selectedIconId && (
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur border border-white/20 p-3 rounded-xl flex gap-4 items-center z-50 shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col gap-1"><label className="text-[9px] font-bold text-neutral-400 uppercase">Rotate</label><input type="range" min="0" max="360" onChange={(e) => updateSelectedIcon('rotation', e.target.value)} className="w-24 accent-red-600" /></div>
                                <div className="flex flex-col gap-1"><label className="text-[9px] font-bold text-neutral-400 uppercase">Size</label><input type="range" min="0.5" max="3" step="0.1" onChange={(e) => updateSelectedIcon('scale', e.target.value)} className="w-24 accent-red-600" /></div>
                                <button onClick={deleteSelectedIcon} className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg text-xs font-bold">DELETE</button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6"><Card><h4 className="text-lg font-bold text-white mb-4">SAVED STRATS</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-60 overflow-y-auto custom-scrollbar">{savedStrats.map((s, i) => <div key={s.id} onClick={() => setViewingStrat(s.image)} className="bg-black/50 p-2 rounded-lg border border-neutral-800 hover:border-red-500 cursor-pointer group relative aspect-square"><img src={s.image} className="w-full h-full object-cover rounded opacity-60 group-hover:opacity-100" /><div className="absolute bottom-0 left-0 w-full bg-black/80 p-1 text-[9px] text-center text-white truncate">{new Date(s.date).toLocaleDateString()}</div><button onClick={(e) => { e.stopPropagation(); deleteStrat(s.id) }} className="absolute top-1 right-1 text-red-500 bg-black rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs opacity-0 group-hover:opacity-100">×</button></div>)}</div></Card></div>
        </div>
    );
}

function LineupLibrary() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const { mapImages, agentData } = useValorantData();
    const [lineups, setLineups] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [viewingLineup, setViewingLineup] = useState(null);
    const [tempCoords, setTempCoords] = useState(null);
    const [newLineup, setNewLineup] = useState({ title: '', url: '', description: '', agent: 'Sova', type: 'Recon' });
    const { currentUser } = getAuth();
    const addToast = useToast();
    const mapRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'lineups'), where("map", "==", selectedMap));
        const unsub = onSnapshot(q, (snap) => {
            const l = [];
            snap.forEach(doc => l.push({ id: doc.id, ...doc.data() }));
            setLineups(l);
        });
        return () => unsub();
    }, [selectedMap]);

    const handleMapClick = (e) => {
        if (!mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setTempCoords({ x, y });
        setIsAdding(true);
    };

    const saveLineup = async () => {
        if (!newLineup.title || !newLineup.url) {
            addToast("Please enter a Title and URL", "error");
            return;
        }
        if (!tempCoords) {
            addToast("Error: No location selected", "error");
            return;
        }

        try {
            await addDoc(collection(db, 'lineups'), {
                ...newLineup,
                map: selectedMap,
                x: tempCoords.x,
                y: tempCoords.y,
                addedBy: currentUser.displayName || "Unknown",
                userId: currentUser.uid,
                date: new Date().toISOString()
            });
            setIsAdding(false);
            setNewLineup({ title: '', url: '', description: '', agent: 'Sova', type: 'Recon' });
            addToast("Lineup Added to Library");
        } catch (error) {
            console.error("Error saving lineup:", error);
            addToast("Failed to save lineup", "error");
        }
    };

    const deleteLineup = async (id) => {
        await deleteDoc(doc(db, 'lineups', id));
        setViewingLineup(null);
        addToast("Lineup Removed");
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col space-y-2">
                <h3 className="text-3xl font-black text-white italic tracking-tighter"><span className="text-red-600">/</span> LINEUP LIBRARY</h3>
                <div className="text-xs text-neutral-500">Click on the map to add a new lineup pin.</div>
            </div>

            <div className="w-full bg-black/40 border border-white/5 p-2 rounded-xl overflow-x-auto flex gap-2 custom-scrollbar">
                {MAPS.map(m => (
                    <button
                        key={m}
                        onClick={() => setSelectedMap(m)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${selectedMap === m ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/50' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 hover:bg-neutral-800'}`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                <div className="relative aspect-square h-full max-h-[600px] bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex-shrink-0 group self-start lg:self-auto">
                    {mapImages[selectedMap] && <img ref={mapRef} onClick={handleMapClick} src={mapImages[selectedMap]} alt="Map" className="w-full h-full object-cover cursor-crosshair opacity-80 group-hover:opacity-100 transition-opacity" />}
                    {lineups.map(l => (
                        <div
                            key={l.id}
                            onClick={(e) => { e.stopPropagation(); setViewingLineup(l); }}
                            className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform z-10 shadow-[0_0_10px_red] flex items-center justify-center"
                            style={{ left: `${l.x}%`, top: `${l.y}%` }}
                        >
                            {agentData[l.agent]?.icon && <img src={agentData[l.agent].icon} className="w-full h-full rounded-full object-cover" />}
                        </div>
                    ))}
                </div>

                <Card className="flex-1 flex flex-col h-full min-h-[400px]">
                    {viewingLineup ? (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="flex justify-between items-start border-b border-white/10 pb-4">
                                <div>
                                    <h4 className="text-2xl font-black text-white uppercase">{viewingLineup.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-900/50 font-bold uppercase">{viewingLineup.agent}</span>
                                        <span className="text-xs text-neutral-500">Added by {viewingLineup.addedBy}</span>
                                    </div>
                                </div>
                                <button onClick={() => deleteLineup(viewingLineup.id)} className="text-neutral-500 hover:text-red-500 transition-colors">DELETE</button>
                            </div>
                            <div className="flex-1 bg-black/50 rounded-xl overflow-hidden border border-neutral-800 relative min-h-[200px]">
                                {viewingLineup.url.includes('youtube') || viewingLineup.url.includes('youtu.be') ? (
                                    <iframe src={viewingLineup.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} className="w-full h-full absolute inset-0" allowFullScreen></iframe>
                                ) : (
                                    <img src={viewingLineup.url} className="w-full h-full object-contain" />
                                )}
                            </div>
                            <p className="text-neutral-300 italic text-sm p-4 bg-black/30 rounded-lg border border-white/5">"{viewingLineup.description}"</p>
                            <ButtonSecondary onClick={() => setViewingLineup(null)} className="w-full">Close Viewer</ButtonSecondary>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4">
                            <div className="w-16 h-16 border-2 border-dashed border-neutral-700 rounded-full flex items-center justify-center text-2xl">📍</div>
                            <div className="text-sm font-bold uppercase tracking-widest">Select a pin to view details</div>
                        </div>
                    )}
                </Card>
            </div>

            <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} onConfirm={saveLineup} title="Add New Lineup">
                <div className="space-y-4">
                    <Input placeholder="Lineup Title (e.g., God Dart A Main)" value={newLineup.title} onChange={e => setNewLineup({ ...newLineup, title: e.target.value })} />
                    <Input placeholder="Video/Image URL" value={newLineup.url} onChange={e => setNewLineup({ ...newLineup, url: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={newLineup.agent} onChange={e => setNewLineup({ ...newLineup, agent: e.target.value })}>
                            {AGENT_NAMES.map(a => <option key={a}>{a}</option>)}
                        </Select>
                        <Input placeholder="Description / Tips" value={newLineup.description} onChange={e => setNewLineup({ ...newLineup, description: e.target.value })} />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

function MatchHistory({ currentUser, members }) {
    const [history, setHistory] = useState([]);
    const [pending, setPending] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    // State for Editing/Finalizing
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // State for New Manual Logs - UPDATED WITH ANALYTICS FIELDS
    const [newMatch, setNewMatch] = useState({
        opponent: '', date: '', myScore: '', enemyScore: '',
        atkScore: '', defScore: '', map: 'Ascent', vod: '',
        pistols: '', ecos: '', fb: ''
    });

    const addToast = useToast();

    // Load Events
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'events'), (snap) => {
            const evs = [];
            snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() }));
            setHistory(evs.filter(e => e.result).sort((a, b) => new Date(b.date) - new Date(a.date)));
            setPending(evs.filter(e => !e.result).sort((a, b) => new Date(a.date) - new Date(b.date)));
        });
        return () => unsub();
    }, []);

    const handleManualAdd = async () => {
        if (!newMatch.opponent || !newMatch.myScore) return addToast("Opponent & Score required", "error");

        await addDoc(collection(db, 'events'), {
            type: 'Scrim',
            opponent: newMatch.opponent,
            date: newMatch.date || new Date().toISOString().split('T')[0],
            result: { ...newMatch }
        });
        setIsAdding(false);
        setNewMatch({ opponent: '', date: '', myScore: '', enemyScore: '', atkScore: '', defScore: '', map: 'Ascent', vod: '', pistols: '', ecos: '', fb: '' });
        addToast('Match Analysis Logged');
    };

    const openEditor = (match, isFinalizing = false) => {
        setEditingId(match.id);
        setEditForm({
            opponent: match.opponent,
            date: match.date,
            map: match.map || (match.result ? match.result.map : 'Ascent'),
            vod: match.result?.vod || '',
            myScore: match.result?.myScore || '',
            enemyScore: match.result?.enemyScore || '',
            atkScore: match.result?.atkScore || '',
            defScore: match.result?.defScore || '',
            // Load new stats if they exist, otherwise empty
            pistols: match.result?.pistols || '',
            ecos: match.result?.ecos || '',
            fb: match.result?.fb || '',
            isFinalizing: isFinalizing
        });
    };

    const saveEdit = async () => {
        const { opponent, date, isFinalizing, ...resultData } = editForm;
        await updateDoc(doc(db, 'events', editingId), {
            opponent,
            date,
            result: resultData
        });
        setEditingId(null);
        addToast('Match Stats Updated');
    };

    const deleteEvent = async (id) => {
        if (window.confirm("Delete this match record?")) {
            await deleteDoc(doc(db, 'events', id));
            addToast("Record Deleted");
        }
    }

    const castVote = async (matchId, player) => {
        await setDoc(doc(db, 'events', matchId), {
            mvpVotes: { [currentUser.uid]: player }
        }, { merge: true });
        addToast(`Voted for ${player}`);
    };

    const getVoteLeader = (votes) => {
        if (!votes) return null;
        const tally = {};
        Object.values(votes).forEach(v => tally[v] = (tally[v] || 0) + 1);
        let max = 0; let leader = null;
        Object.entries(tally).forEach(([p, c]) => { if (c > max) { max = c; leader = p; } });
        return { leader, count: max };
    };

    const getResultColor = (my, enemy) => {
        const m = parseInt(my); const e = parseInt(enemy);
        if (m > e) return 'border-l-4 border-l-green-500';
        if (m < e) return 'border-l-4 border-l-red-600';
        return 'border-l-4 border-l-neutral-500';
    };

    return (
        <Card className="min-h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-3"><span className="text-red-600">MATCH</span> HISTORY</h3>
                <ButtonSecondary onClick={() => setIsAdding(!isAdding)} className="text-xs">
                    {isAdding ? 'Cancel' : '+ Log Analysis'}
                </ButtonSecondary>
            </div>

            {/* --- MANUAL ADD FORM --- */}
            {isAdding && (
                <div className="mb-8 bg-black/50 p-6 rounded-2xl border border-white/10 space-y-4 animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                    <h4 className="text-white font-bold uppercase text-sm">Log Unscheduled Match</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Opponent Name" value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} />
                        <Input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="[color-scheme:dark]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value })}>
                            {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Select>
                        <Input placeholder="VOD Link (Optional)" value={newMatch.vod} onChange={e => setNewMatch({ ...newMatch, vod: e.target.value })} />
                    </div>

                    {/* Scores */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 flex gap-2">
                            <Input placeholder="My Score" value={newMatch.myScore} onChange={e => setNewMatch({ ...newMatch, myScore: e.target.value })} type="number" />
                            <Input placeholder="Enemy Score" value={newMatch.enemyScore} onChange={e => setNewMatch({ ...newMatch, enemyScore: e.target.value })} type="number" />
                        </div>
                        <Input placeholder="Atk Wins" value={newMatch.atkScore} onChange={e => setNewMatch({ ...newMatch, atkScore: e.target.value })} type="number" />
                        <Input placeholder="Def Wins" value={newMatch.defScore} onChange={e => setNewMatch({ ...newMatch, defScore: e.target.value })} type="number" />
                    </div>

                    {/* NEW: ADVANCED ANALYTICS ROW */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-900/50 rounded-lg border border-white/5">
                        <div>
                            <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Pistols (0-2)</label>
                            <Input placeholder="#" value={newMatch.pistols} onChange={e => setNewMatch({ ...newMatch, pistols: e.target.value })} type="number" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Eco Wins</label>
                            <Input placeholder="#" value={newMatch.ecos} onChange={e => setNewMatch({ ...newMatch, ecos: e.target.value })} type="number" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">First Blood %</label>
                            <Input placeholder="%" value={newMatch.fb} onChange={e => setNewMatch({ ...newMatch, fb: e.target.value })} type="number" />
                        </div>
                    </div>

                    <ButtonPrimary onClick={handleManualAdd} className="w-full py-3 text-xs">Save to History</ButtonPrimary>
                </div>
            )}

            {/* --- PENDING REPORTS SECTION --- */}
            {pending.length > 0 && (
                <div className="mb-8">
                    <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Pending Reports
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                        {pending.map(p => (
                            <div key={p.id} className="bg-neutral-900/50 border border-yellow-500/20 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <div className="font-bold text-white text-lg">{p.opponent}</div>
                                    <div className="text-xs text-neutral-400">{p.date} • {p.time} • <span className="text-red-400">{p.map}</span></div>
                                </div>
                                {editingId === p.id ? (
                                    <div className="flex-1 w-full bg-black p-4 rounded-lg border border-neutral-700 animate-fade-in">
                                        <div className="text-xs text-yellow-500 font-bold mb-2 uppercase">Input Stats</div>
                                        <div className="grid grid-cols-4 gap-2 mb-2">
                                            <Input placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} type="number" />
                                            <Input placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} type="number" />
                                            <Input placeholder="Atk" value={editForm.atkScore} onChange={e => setEditForm({ ...editForm, atkScore: e.target.value })} type="number" />
                                            <Input placeholder="Def" value={editForm.defScore} onChange={e => setEditForm({ ...editForm, defScore: e.target.value })} type="number" />
                                        </div>
                                        {/* NEW: ANALYTICS FOR PENDING */}
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <Input placeholder="Pistols" value={editForm.pistols} onChange={e => setEditForm({ ...editForm, pistols: e.target.value })} type="number" />
                                            <Input placeholder="Ecos" value={editForm.ecos} onChange={e => setEditForm({ ...editForm, ecos: e.target.value })} type="number" />
                                            <Input placeholder="FB %" value={editForm.fb} onChange={e => setEditForm({ ...editForm, fb: e.target.value })} type="number" />
                                        </div>
                                        <div className="flex gap-2">
                                            <ButtonPrimary onClick={saveEdit} className="text-xs py-2 flex-1">Confirm</ButtonPrimary>
                                            <ButtonSecondary onClick={() => setEditingId(null)} className="text-xs py-2">Cancel</ButtonSecondary>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => openEditor(p, true)} className="bg-yellow-600/20 hover:bg-yellow-600 text-yellow-500 hover:text-white border border-yellow-600/50 px-6 py-2 rounded-lg font-bold text-xs uppercase transition-all shadow-lg">
                                        ✅ Report Score
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MATCH HISTORY LIST --- */}
            <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Completed Operations</h4>
            <div className="space-y-4">
                {history.length === 0 && <div className="text-neutral-600 italic text-center py-8">No match history recorded.</div>}

                {history.map(m => {
                    // --- EDIT MODE FOR EXISTING HISTORY ---
                    if (editingId === m.id) return (
                        <div key={m.id} className="bg-neutral-900 border border-red-600 p-4 rounded-xl space-y-3 animate-fade-in">
                            <div className="flex justify-between items-center border-b border-red-900/30 pb-2">
                                <span className="text-red-500 font-bold text-xs uppercase">Editing Record</span>
                                <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-white text-xs">Cancel</button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input value={editForm.opponent} onChange={e => setEditForm({ ...editForm, opponent: e.target.value })} />
                                <Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="[color-scheme:dark]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={editForm.map} onChange={e => setEditForm({ ...editForm, map: e.target.value })}>
                                    {MAPS.map(map => <option key={map} value={map}>{map}</option>)}
                                </Select>
                                <Input placeholder="VOD Link" value={editForm.vod} onChange={e => setEditForm({ ...editForm, vod: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-2 flex gap-2">
                                    <Input placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} />
                                    <Input placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} />
                                </div>
                                <Input placeholder="Atk" value={editForm.atkScore} onChange={e => setEditForm({ ...editForm, atkScore: e.target.value })} />
                                <Input placeholder="Def" value={editForm.defScore} onChange={e => setEditForm({ ...editForm, defScore: e.target.value })} />
                            </div>
                            {/* NEW: ANALYTICS EDITING */}
                            <div className="grid grid-cols-3 gap-2">
                                <Input placeholder="Pistols" value={editForm.pistols} onChange={e => setEditForm({ ...editForm, pistols: e.target.value })} />
                                <Input placeholder="Ecos" value={editForm.ecos} onChange={e => setEditForm({ ...editForm, ecos: e.target.value })} />
                                <Input placeholder="FB %" value={editForm.fb} onChange={e => setEditForm({ ...editForm, fb: e.target.value })} />
                            </div>
                            <ButtonPrimary onClick={saveEdit} className="w-full py-2 text-xs">Update Record</ButtonPrimary>
                        </div>
                    );

                    // --- VIEW MODE ---
                    const voteData = getVoteLeader(m.mvpVotes);
                    const isWin = parseInt(m.result.myScore) > parseInt(m.result.enemyScore);

                    return (
                        <div key={m.id} onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className={`bg-black/40 border border-neutral-800 p-4 rounded-xl relative overflow-hidden cursor-pointer hover:bg-neutral-900 transition-all ${getResultColor(m.result.myScore, m.result.enemyScore)}`}>
                            {expandedId === m.id && (isWin ? <VictoryStamp /> : <DefeatStamp />)}
                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                        {m.opponent}
                                        {m.result.vod && (
                                            <a href={m.result.vod} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-500 font-black uppercase flex items-center gap-1"><span>▶</span> VOD</a>
                                        )}
                                    </div>
                                    <div className="text-xs text-neutral-500 font-mono mt-0.5">{m.date} • {m.result.map}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={`text-2xl font-black ${isWin ? 'text-green-500' : 'text-red-500'}`}>{m.result.myScore} - {m.result.enemyScore}</div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); openEditor(m); }} className="text-neutral-600 hover:text-white p-1" title="Edit">✏️</button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteEvent(m.id); }} className="text-neutral-600 hover:text-red-500 p-1" title="Delete">🗑️</button>
                                    </div>
                                </div>
                            </div>

                            {/* Details Drawer */}
                            {expandedId === m.id && (
                                <div className="mt-4 pt-4 border-t border-neutral-800 animate-slide-in">
                                    {/* SCORES ROW */}
                                    <div className="grid grid-cols-2 gap-4 text-center mb-4">
                                        <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold">Attack Wins</div>
                                            <div className="text-white font-bold text-lg">{m.result.atkScore || '-'}</div>
                                        </div>
                                        <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold">Defense Wins</div>
                                            <div className="text-white font-bold text-lg">{m.result.defScore || '-'}</div>
                                        </div>
                                    </div>

                                    {/* NEW: ANALYTICS ROW */}
                                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                        <div className="bg-neutral-900/50 p-2 rounded border border-white/5">
                                            <div className="text-[9px] text-neutral-400 uppercase font-bold">Pistols Won</div>
                                            <div className={`text-sm font-black ${m.result.pistols >= 1 ? 'text-green-500' : 'text-neutral-500'}`}>{m.result.pistols || '0'}/2</div>
                                        </div>
                                        <div className="bg-neutral-900/50 p-2 rounded border border-white/5">
                                            <div className="text-[9px] text-neutral-400 uppercase font-bold">Eco Wins</div>
                                            <div className="text-sm font-black text-white">{m.result.ecos || '0'}</div>
                                        </div>
                                        <div className="bg-neutral-900/50 p-2 rounded border border-white/5">
                                            <div className="text-[9px] text-neutral-400 uppercase font-bold">FB %</div>
                                            <div className="text-sm font-black text-white">{m.result.fb || '0'}%</div>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-900/50 p-3 rounded-lg border border-white/5 flex flex-wrap gap-4 items-center justify-between" onClick={e => e.stopPropagation()}>
                                        <div className="text-xs font-bold text-neutral-400 flex items-center gap-2">
                                            <span>⭐ MVP VOTE:</span>
                                            {voteData ? <span className="text-yellow-500 text-sm">{voteData.leader} ({voteData.count})</span> : <span className="text-neutral-600">No votes</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {m.mvpVotes?.[currentUser.uid] ? (
                                                <span className="text-[10px] bg-green-900/30 text-green-500 px-2 py-1 rounded border border-green-900/50">Voted for {m.mvpVotes[currentUser.uid]}</span>
                                            ) : (
                                                <select onChange={(e) => castVote(m.id, e.target.value)} className="bg-black text-white text-xs p-1.5 rounded border border-neutral-700 outline-none focus:border-red-500 cursor-pointer" defaultValue="">
                                                    <option value="" disabled>Select MVP...</option>
                                                    {members.map(mem => <option key={mem} value={mem}>{mem}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
function RosterManager({ members, events }) {
    const [rosterData, setRosterData] = useState({});
    const [mode, setMode] = useState('edit');
    const [compare1, setCompare1] = useState('');
    const [compare2, setCompare2] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [role, setRole] = useState('Tryout');
    const [rank, setRank] = useState('Unranked');
    const [gameId, setGameId] = useState('');
    const [pfp, setPfp] = useState('');
    const [ingameRole, setIngameRole] = useState('Flex'); // New In-Game Role state
    const [notes, setNotes] = useState('');

    const addToast = useToast();
    useEffect(() => { const unsub = onSnapshot(collection(db, 'roster'), (snap) => { const data = {}; snap.forEach(doc => data[doc.id] = doc.data()); setRosterData(data); }); return () => unsub(); }, []);

    const handleSave = async () => {
        if (!selectedMember) return;
        // Updated save to include ingameRole
        await setDoc(doc(db, 'roster', selectedMember), { role, rank, notes, gameId, pfp, ingameRole }, { merge: true });
        addToast('Player Updated');
    };

    const sortedMembers = useMemo(() => {
        return sortRosterByRole(members, rosterData);
    }, [members, rosterData]);

    const mvpCounts = useMemo(() => {
        const counts = {};
        if (!events) return counts;
        events.forEach(ev => {
            if (!ev.mvpVotes) return;
            const voteTally = {};
            Object.values(ev.mvpVotes).forEach(p => voteTally[p] = (voteTally[p] || 0) + 1);
            let max = 0; let winner = null;
            Object.entries(voteTally).forEach(([p, c]) => { if (c > max) { max = c; winner = p; } });
            if (winner) counts[winner] = (counts[winner] || 0) + 1;
        });
        return counts;
    }, [events]);

    return (
        <div className="h-full flex flex-col gap-6"><div className="flex gap-4 border-b border-white/10 pb-4"><button onClick={() => setMode('edit')} className={`text-sm font-bold uppercase ${mode === 'edit' ? 'text-red-500' : 'text-neutral-500'}`}>Edit Mode</button><button onClick={() => setMode('compare')} className={`text-sm font-bold uppercase ${mode === 'compare' ? 'text-red-500' : 'text-neutral-500'}`}>Compare Players</button></div>
            {mode === 'edit' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                    <div className="lg:col-span-1 bg-neutral-900/80 p-6 rounded-3xl border border-white/5 flex flex-col">
                        <h3 className="text-white font-bold mb-4">Members</h3>
                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                            {sortedMembers.length === 0 ?
                                <div className="text-neutral-500 text-xs italic p-4 text-center border border-dashed border-neutral-800 rounded-xl">No members found. Log availability to appear here.</div> :
                                sortedMembers.map(m => (
                                    <div key={m} onClick={() => {
                                        setSelectedMember(m);
                                        setRole(rosterData[m]?.role || 'Tryout');
                                        setRank(rosterData[m]?.rank || 'Unranked');
                                        setNotes(rosterData[m]?.notes || '');
                                        setGameId(rosterData[m]?.gameId || '');
                                        setPfp(rosterData[m]?.pfp || '');
                                        setIngameRole(rosterData[m]?.ingameRole || 'Flex'); // Load ingame role
                                    }} className={`p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center ${selectedMember === m ? 'bg-red-900/20 border-red-600' : 'bg-black border-neutral-800'}`}>
                                        <span className="text-white font-bold flex items-center gap-2">{m} {mvpCounts[m] > 0 && <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1 rounded border border-yellow-500/20">🏆 x{mvpCounts[m]}</span>}</span>
                                        <span className="text-xs text-neutral-500 uppercase">{rosterData[m]?.role}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                    <Card className="lg:col-span-2">
                        {selectedMember ? (
                            <div className="space-y-6">
                                <h3 className="text-2xl font-black text-white">Managing: <span className="text-red-500">{selectedMember}</span></h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Team Role</label>
                                        <Select value={role} onChange={e => setRole(e.target.value)}>{['Captain', 'Main', 'Sub', 'Tryout'].map(r => <option key={r}>{r}</option>)}</Select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Rank</label>
                                        <Select value={rank} onChange={e => setRank(e.target.value)}>{RANKS.map(r => <option key={r}>{r}</option>)}</Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Agent Role</label>
                                        <Select value={ingameRole} onChange={e => setIngameRole(e.target.value)}>
                                            {ROLES.map(r => <option key={r}>{r}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Riot ID</label>
                                        <Input value={gameId} onChange={e => setGameId(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 mb-1">Profile Image URL</label>
                                    <Input value={pfp} onChange={e => setPfp(e.target.value)} placeholder="https://..." />
                                </div>
                                <textarea className="w-full h-40 bg-black border border-neutral-800 rounded-xl p-3 text-white" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." />
                                <ButtonPrimary onClick={handleSave} className="w-full py-3">Save Changes</ButtonPrimary>
                            </div>
                        ) : <div className="h-full flex items-center justify-center text-neutral-500">Select a player</div>}
                    </Card>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-8 h-full">{[setCompare1, setCompare2].map((setter, i) => (<Card key={i} className="h-full"><Select onChange={e => setter(e.target.value)} className="mb-6"><option>Select Player</option>{members.map(m => <option key={m}>{m}</option>)}</Select>{((i === 0 ? compare1 : compare2) && rosterData[i === 0 ? compare1 : compare2]) && (<div className="space-y-4 text-center"><div className="w-24 h-24 mx-auto bg-red-600 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-black shadow-xl">{(i === 0 ? compare1 : compare2)[0]}</div><div className="text-3xl font-black text-white uppercase">{(i === 0 ? compare1 : compare2)}</div><div className="flex justify-center gap-2"><span className="bg-neutral-800 px-3 py-1 rounded text-xs font-bold text-white">{rosterData[i === 0 ? compare1 : compare2]?.rank || 'Unranked'}</span><span className="bg-red-900/50 px-3 py-1 rounded text-xs font-bold text-red-400">{rosterData[i === 0 ? compare1 : compare2]?.role || 'Member'}</span></div>{mvpCounts[(i === 0 ? compare1 : compare2)] > 0 && <div className="text-yellow-500 font-bold text-sm bg-yellow-900/20 py-1 rounded border border-yellow-500/20">🏆 {mvpCounts[(i === 0 ? compare1 : compare2)]} MVP Awards</div>}<div className="p-4 bg-black/50 rounded-xl border border-neutral-800 text-left"><div className="text-[10px] text-neutral-500 uppercase font-bold mb-2">Performance Notes</div><p className="text-sm text-neutral-300 italic">"{rosterData[i === 0 ? compare1 : compare2]?.notes || 'No notes available.'}"</p></div></div>)}</Card>))}</div>
            )}
        </div>
    );
}

function AdminPanel() {
    const [applications, setApplications] = useState([]);
    const [processing, setProcessing] = useState(null); // Track which ID is processing
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'applications'), (snap) => {
            const apps = [];
            snap.forEach(doc => apps.push({ id: doc.id, ...doc.data() }));
            setApplications(apps);
        });
        return () => unsub();
    }, []);

    const acceptApplicant = async (app) => {
        setProcessing(app.id);

        try {
            // --- FIX FOR MISSING USERNAME ---
            let rosterName = app.user;

            // If the application has no username (null/undefined/empty), ask the Admin to type one.
            if (!rosterName) {
                const manualName = window.prompt("⚠️ This application is missing a username.\n\nPlease enter the player's Riot ID or Roster Name manually:");
                if (!manualName) {
                    setProcessing(null);
                    return addToast("Action Cancelled: Name required", "error");
                }
                rosterName = manualName;
            }
            // --------------------------------

            const safeUid = app.uid || "legacy_id_missing";

            const rosterData = {
                rank: app.rank || "Unranked",
                role: 'Tryout',
                ingameRole: app.role || "Flex",
                notes: `Tracker: ${app.tracker || "N/A"}\nWhy: ${app.why || "N/A"}`,
                joinedAt: new Date().toISOString(),
                uid: safeUid,
                pfp: "",
                gameId: ""
            };

            // Use rosterName (which is guaranteed to exist now) as the document ID
            await setDoc(doc(db, 'roster', rosterName), rosterData);
            await deleteDoc(doc(db, 'applications', app.id));

            addToast(`✅ Added ${rosterName} to Roster`);

        } catch (error) {
            console.error("ACCEPT ERROR:", error);
            addToast(`Error: ${error.message}`, "error");
        }
        setProcessing(null);
    };

    const rejectApplicant = async (id) => {
        if (!window.confirm("Are you sure you want to reject this applicant? This cannot be undone.")) return;
        setProcessing(id);
        try {
            await deleteDoc(doc(db, 'applications', id));
            addToast('Applicant Rejected');
        } catch (error) {
            addToast("Error rejecting", "error");
        }
        setProcessing(null);
    };

    return (
        <Card className="h-full">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
                <span className="text-red-600">ADMIN</span> DASHBOARD
            </h2>
            <div className="space-y-6">
                {applications.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-neutral-800 rounded-2xl">
                        <p className="text-neutral-500 italic">No pending applications.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {applications.map(app => (
                            <div key={app.id} className="bg-black/80 border border-neutral-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden group hover:border-red-600/30 transition-all">
                                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
                                <div className="space-y-3 flex-1">
                                    <div className="flex items-center gap-3">
                                        <h4 className="text-2xl font-black text-white">{app.user}</h4>
                                        <span className="bg-neutral-800 text-neutral-300 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">{app.rank}</span>
                                        <span className="bg-red-900/30 text-red-400 text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">{app.role}</span>
                                    </div>

                                    <div className="bg-neutral-900/50 p-3 rounded-lg border border-white/5">
                                        <p className="text-neutral-500 text-xs font-bold uppercase mb-1">Application Statement</p>
                                        <p className="text-neutral-300 text-sm italic">"{app.why}"</p>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs">
                                        <div className="text-neutral-500">Exp: <span className="text-white">{app.exp}</span></div>
                                        <a href={app.tracker} target="_blank" rel="noreferrer" className="text-red-500 font-bold hover:underline flex items-center gap-1">
                                            Tracker Profile ↗
                                        </a>
                                    </div>
                                    <div className="text-[10px] text-neutral-600 font-mono">Applied: {new Date(app.submittedAt).toLocaleDateString()}</div>
                                </div>

                                <div className="flex flex-row md:flex-col gap-3 justify-center min-w-[150px]">
                                    <button
                                        onClick={() => acceptApplicant(app)}
                                        disabled={processing === app.id}
                                        className="bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest py-3 px-4 rounded-xl shadow-lg transition-all flex-1 text-xs disabled:opacity-50"
                                    >
                                        {processing === app.id ? 'Processing...' : 'Accept'}
                                    </button>
                                    <button
                                        onClick={() => rejectApplicant(app.id)}
                                        disabled={processing === app.id}
                                        className="bg-black hover:bg-red-900/20 border border-neutral-700 hover:border-red-500 text-neutral-400 hover:text-white font-bold uppercase tracking-widest py-3 px-4 rounded-xl transition-all flex-1 text-xs disabled:opacity-50"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Card>
    );
}
function PartnerDirectory() {
    const [partners, setPartners] = useState([]); const [newPartner, setNewPartner] = useState({ name: '', contact: '', notes: '' });
    useEffect(() => { const unsub = onSnapshot(collection(db, 'partners'), (s) => { const p = []; s.forEach(d => p.push({ id: d.id, ...d.data() })); setPartners(p); }); return unsub; }, []);
    const add = async () => { await addDoc(collection(db, 'partners'), newPartner); setNewPartner({ name: '', contact: '', notes: '' }); };
    return (
        <Card className="h-full"><h3 className="text-2xl font-black text-white mb-6">PARTNERS</h3><div className="mb-6 space-y-2"><Input placeholder="Team Name" value={newPartner.name} onChange={e => setNewPartner({ ...newPartner, name: e.target.value })} /><div className="flex gap-2"><Input placeholder="Contact" value={newPartner.contact} onChange={e => setNewPartner({ ...newPartner, contact: e.target.value })} /><Input placeholder="Notes" value={newPartner.notes} onChange={e => setNewPartner({ ...newPartner, notes: e.target.value })} /></div><ButtonPrimary onClick={add} className="w-full text-xs py-2">Add</ButtonPrimary></div><div className="space-y-2 h-96 overflow-y-auto custom-scrollbar">{partners.map(p => <div key={p.id} className="p-4 bg-black border border-neutral-800 rounded-xl flex justify-between"><div><div className="font-bold text-white">{p.name}</div><div className="text-xs text-red-500">{p.contact}</div></div><button onClick={() => deleteDoc(doc(db, 'partners', p.id))} className="text-neutral-600 hover:text-red-500">×</button></div>)}</div></Card>
    );
}

function MapVeto() {
    const [vetoState, setVetoState] = useState({}); useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'map_veto'), (snap) => { if (snap.exists()) setVetoState(snap.data()); }); return () => unsub(); }, []);
    const toggleMap = async (map) => { const current = vetoState[map] || 'neutral'; const next = current === 'neutral' ? 'ban' : current === 'ban' ? 'pick' : 'neutral'; await setDoc(doc(db, 'general', 'map_veto'), { ...vetoState, [map]: next }); };
    const resetVeto = async () => { await setDoc(doc(db, 'general', 'map_veto'), {}); };
    return (<Card className="h-full"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white">MAP VETO</h3><ButtonSecondary onClick={resetVeto} className="text-xs px-3 py-1">Reset Board</ButtonSecondary></div><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{MAPS.map(map => { const status = vetoState[map] || 'neutral'; return (<div key={map} onClick={() => toggleMap(map)} className={`aspect-video rounded-xl border-2 cursor-pointer flex items-center justify-center relative group ${status === 'neutral' ? 'border-neutral-800 bg-black/50' : ''} ${status === 'ban' ? 'border-red-600 bg-red-900/20' : ''} ${status === 'pick' ? 'border-green-500 bg-green-900/20' : ''}`}><span className="font-black uppercase text-white">{map}</span><div className="absolute bottom-2 text-[10px] font-bold">{status.toUpperCase()}</div></div>); })}</div></Card>);
}

function ContentManager() {
    // Existing State
    const [news, setNews] = useState([]);
    const [intel, setIntel] = useState([]);
    const [merch, setMerch] = useState([]);
    const [newNews, setNewNews] = useState({ title: '', body: '', date: new Date().toISOString().split('T')[0], type: 'Update', isFeatured: false });
    const [newIntel, setNewIntel] = useState({ title: '', subtitle: '', url: '', date: new Date().toISOString().split('T')[0] });
    const [newMerch, setNewMerch] = useState({ name: '', price: '', link: '' });

    // Achievements State
    const [achievements, setAchievements] = useState([]);
    const [newAchievement, setNewAchievement] = useState({ title: '', subtitle: '', icon: '🏆', highlight: false });

    const addToast = useToast();

    // Fetch Data
    useEffect(() => {
        const unsubNews = onSnapshot(query(collection(db, 'news')), (snap) => {
            const n = []; snap.forEach(doc => n.push({ id: doc.id, ...doc.data() }));
            setNews(n.sort((a, b) => new Date(b.date) - new Date(a.date)));
        });
        const unsubIntel = onSnapshot(query(collection(db, 'intel')), (snap) => {
            const i = []; snap.forEach(doc => i.push({ id: doc.id, ...doc.data() }));
            setIntel(i.sort((a, b) => new Date(b.date) - new Date(a.date)));
        });
        const unsubMerch = onSnapshot(collection(db, 'merch'), (snap) => {
            const m = []; snap.forEach(doc => m.push({ id: doc.id, ...doc.data() }));
            setMerch(m);
        });
        const unsubAchieve = onSnapshot(collection(db, 'achievements'), (snap) => {
            const a = []; snap.forEach(doc => a.push({ id: doc.id, ...doc.data() }));
            setAchievements(a);
        });

        return () => { unsubNews(); unsubIntel(); unsubMerch(); unsubAchieve(); };
    }, []);

    // Handlers
    const addNews = async () => {
        if (!newNews.title || !newNews.body) return addToast('Title and Body required', 'error');
        await addDoc(collection(db, 'news'), newNews);
        setNewNews({ title: '', body: '', date: new Date().toISOString().split('T')[0], type: 'Update', isFeatured: false });
        addToast('News Posted');
    };

    const addIntel = async () => {
        if (!newIntel.title || !newIntel.url) return addToast('Title and URL required', 'error');
        await addDoc(collection(db, 'intel'), newIntel);
        setNewIntel({ title: '', subtitle: '', url: '', date: new Date().toISOString().split('T')[0] });
        addToast('Intel Added');
    };

    const addMerch = async () => {
        if (!newMerch.name || !newMerch.price) return addToast('Name and Price required', 'error');
        await addDoc(collection(db, 'merch'), newMerch);
        setNewMerch({ name: '', price: '', link: '' });
        addToast('Item Added');
    };

    const addAchievement = async () => {
        if (!newAchievement.title || !newAchievement.subtitle) return addToast('Details required', 'error');
        await addDoc(collection(db, 'achievements'), {
            ...newAchievement,
            createdAt: new Date().toISOString()
        });
        setNewAchievement({ title: '', subtitle: '', icon: '🏆', highlight: false });
        addToast('Trophy Added');
    };

    const deleteItem = async (collectionName, id) => {
        await deleteDoc(doc(db, collectionName, id));
        addToast('Item Deleted');
    };

    return (
        // UPDATED GRID CLASS HERE: grid-cols-1 md:grid-cols-2 (Creates 2x2 layout)
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">

            {/* 1. NEWS MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> SITREP</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">Post News</span>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newNews.isFeatured} onChange={e => setNewNews({ ...newNews, isFeatured: e.target.checked })} className="accent-red-600 w-3 h-3" /><span className="text-[10px] font-bold text-red-500 uppercase">Featured</span></label>
                    </div>
                    <Input placeholder="Headline" value={newNews.title} onChange={e => setNewNews({ ...newNews, title: e.target.value })} />
                    <textarea className="w-full bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-xs" rows={2} placeholder="Body..." value={newNews.body} onChange={e => setNewNews({ ...newNews, body: e.target.value })} />
                    <ButtonPrimary onClick={addNews} className="w-full py-2 text-xs">Post</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{news.map(n => (<div key={n.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-start"><div className="w-full"><div className="font-bold text-white text-xs truncate">{n.title}</div></div><button onClick={() => deleteItem('news', n.id)} className="text-neutral-500 hover:text-red-500 ml-2">×</button></div>))}</div>
            </Card>

            {/* 2. INTEL MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> INTEL</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Add VOD</span>
                    <Input placeholder="Title" value={newIntel.title} onChange={e => setNewIntel({ ...newIntel, title: e.target.value })} />
                    <Input placeholder="URL" value={newIntel.url} onChange={e => setNewIntel({ ...newIntel, url: e.target.value })} />
                    <ButtonPrimary onClick={addIntel} className="w-full py-2 text-xs">Add</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{intel.map(i => (<div key={i.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-center"><div className="truncate text-xs text-white font-bold">{i.title}</div><button onClick={() => deleteItem('intel', i.id)} className="text-neutral-500 hover:text-red-500">×</button></div>))}</div>
            </Card>

            {/* 3. ARMORY MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> ARMORY</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">New Item</span>
                    <Input placeholder="Name" value={newMerch.name} onChange={e => setNewMerch({ ...newMerch, name: e.target.value })} />
                    <Input placeholder="Price" value={newMerch.price} onChange={e => setNewMerch({ ...newMerch, price: e.target.value })} />
                    <ButtonPrimary onClick={addMerch} className="w-full py-2 text-xs">Add</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{merch.map(m => (<div key={m.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-center"><div className="truncate text-xs text-white font-bold">{m.name}</div><button onClick={() => deleteItem('merch', m.id)} className="text-neutral-500 hover:text-red-500">×</button></div>))}</div>
            </Card>

            {/* 4. TROPHY MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> TROPHIES</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">New Achievement</span>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newAchievement.highlight} onChange={e => setNewAchievement({ ...newAchievement, highlight: e.target.checked })} className="accent-red-600 w-3 h-3" /><span className="text-[10px] font-bold text-red-500 uppercase">Red Text</span></label>
                    </div>
                    <div className="flex gap-2">
                        <Select value={newAchievement.icon} onChange={e => setNewAchievement({ ...newAchievement, icon: e.target.value })} className="w-16 text-center text-xl">
                            {['🏆', '🥇', '🥈', '🥉', '🎖️', '⭐', '🔥', '👑'].map(icon => <option key={icon}>{icon}</option>)}
                        </Select>
                        <Input placeholder="Title (e.g. PREMIER)" value={newAchievement.title} onChange={e => setNewAchievement({ ...newAchievement, title: e.target.value })} />
                    </div>
                    <Input placeholder="Subtitle (e.g. Winner 2024)" value={newAchievement.subtitle} onChange={e => setNewAchievement({ ...newAchievement, subtitle: e.target.value })} />
                    <ButtonPrimary onClick={addAchievement} className="w-full py-2 text-xs">Add Trophy</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {achievements.map(a => (
                        <div key={a.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{a.icon}</span>
                                <div>
                                    <div className={`text-xs font-black uppercase ${a.highlight ? 'text-red-500' : 'text-white'}`}>{a.title}</div>
                                    <div className="text-[10px] text-neutral-500 font-bold uppercase">{a.subtitle}</div>
                                </div>
                            </div>
                            <button onClick={() => deleteItem('achievements', a.id)} className="text-neutral-600 hover:text-red-500 px-2">×</button>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
function SyrixDashboard({ onBack }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [rosterName, setRosterName] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [availabilities, setAvailabilities] = useState({});
    const [events, setEvents] = useState([]);
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('23:30');
    const [role, setRole] = useState('Flex');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [authLoading, setAuthLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', children: null });
    const [isMember, setIsMember] = useState(false);
    const addToast = useToast();

    useEffect(() => { return onAuthStateChanged(auth, user => { setCurrentUser(user); setAuthLoading(false); }); }, []);
    const signIn = async () => { try { await signInWithPopup(auth, new OAuthProvider('oidc.discord')); } catch (e) { console.error(e); } };
    const handleSignOut = async () => await signOut(auth);

    useEffect(() => {
        if (!currentUser) return;

        // Query roster by UID to find the correct file
        const memberQuery = query(collection(db, 'roster'), where("uid", "==", currentUser.uid));

        const unsub1 = onSnapshot(memberQuery, (snapshot) => {
            if (!snapshot.empty) {
                // FOUND IT!
                const userDoc = snapshot.docs[0];
                setRosterName(userDoc.id); // Save the file name (Riot ID)
                setIsMember(true);
            } else {
                // Not in roster, check if Admin
                setIsMember(ADMIN_UIDS.includes(currentUser.uid));
                setRosterName(currentUser.displayName); // Fallback to Discord name
            }
        });

        const unsub2 = onSnapshot(collection(db, 'availabilities'), (s) => {
            const d = {};
            s.forEach(doc => d[doc.id] = doc.data().slots || []);
            setAvailabilities(d);
        });

        const unsub3 = onSnapshot(collection(db, 'events'), (s) => {
            const e = [];
            s.forEach(d => e.push({ id: d.id, ...d.data() }));
            setEvents(e.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)));
        });

        return () => { unsub1(); unsub2(); unsub3(); };
    }, [currentUser]);    const dynamicMembers = useMemo(() => [...new Set(Object.keys(availabilities))].sort(), [availabilities]);

    // Process Availability for display
    const displayAvail = useMemo(() => {
        const c = {};
        for (const m in availabilities) {
            c[m] = [];
            availabilities[m].forEach(s => {
                const ls = convertFromGMT(s.day, s.start, userTimezone);
                const le = convertFromGMT(s.day, s.end, userTimezone);
                if (ls.day === le.day) {
                    if (timeToMinutes(ls.time) < timeToMinutes(le.time)) c[m].push({ day: ls.day, start: ls.time, end: le.time, role: s.role });
                } else {
                    c[m].push({ day: ls.day, start: ls.time, end: '24:00', role: s.role });
                    if (timeToMinutes(le.time) > 0) c[m].push({ day: le.day, start: '00:00', end: le.time, role: s.role });
                }
            });
        }
        return c;
    }, [availabilities, userTimezone]);

    const openModal = (t, c, f) => { setModalContent({ title: t, children: c, onConfirm: f }); setIsModalOpen(true); };

    const saveAvail = async () => {
        // Use rosterName if valid, otherwise fallback to "Guest"
        const finalName = rosterName || currentUser.displayName || 'Guest';

        if (timeToMinutes(end) <= timeToMinutes(start)) return addToast('End time must be after start time', 'error');
        setSaveStatus('saving');
        const gs = convertToGMT(day, start);
        const ge = convertToGMT(day, end);
        const old = availabilities[finalName] || []; // Use finalName
        const others = old.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day);

        // Save to the correct document
        await setDoc(doc(db, 'availabilities', finalName), { slots: [...others, { day: gs.day, start: gs.time, end: ge.time, role }] });
        setSaveStatus('idle');
        addToast('Availability Slot Saved');
    };
    const clearDay = async () => {
        const finalName = rosterName || currentUser.displayName || 'Guest';
        const old = availabilities[finalName] || [];
        await setDoc(doc(db, 'availabilities', finalName), { slots: old.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day) });
        setIsModalOpen(false);
        addToast(`Cleared ${day}`);
    };
    const schedEvent = async (d) => { await addDoc(collection(db, 'events'), d); addToast('Event Scheduled'); };
    const deleteEvent = async (id) => { await deleteDoc(doc(db, 'events', id)); setIsModalOpen(false); addToast('Event Deleted'); };

    if (authLoading) return <div className="fixed inset-0 bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;

    // If not logged in, show Login Screen
    if (!currentUser) return <LoginScreen signIn={signIn} onBack={onBack} />;

    // If logged in but not a member, show Application
    if (!isMember) return (
        <div className="fixed inset-0 bg-black p-8 overflow-y-auto">
            <div className="absolute top-4 left-4 z-50">
                <button onClick={onBack} className="text-white font-bold uppercase hover:text-red-500 transition">&larr; Home</button>
            </div>
            <div className="relative z-10 pt-12"><ApplicationForm currentUser={currentUser} /></div>
        </div>
    );

    const NavBtn = ({ id, label }) => <button onClick={() => setActiveTab(id)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-200 whitespace-nowrap ${activeTab === id ? 'bg-gradient-to-r from-red-700 to-red-900 text-white shadow-lg shadow-red-900/20 border border-red-500/50' : 'bg-black/30 text-neutral-400 hover:text-white hover:bg-white/10 border border-transparent'}`}>{label}</button>;

    const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);

    return (
        <div className="fixed inset-0 h-full w-full text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden bg-black">
            <Background />

            <header className="flex-none flex flex-col gap-4 px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md z-40">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="text-neutral-500 hover:text-white transition">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                        <h1 className="text-3xl font-black tracking-tighter text-white drop-shadow-lg italic">SYRIX <span className="text-red-600">HUB</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-bold text-white">
                                {rosterName || currentUser.displayName || 'Guest'}
                            </div>
                            <button onClick={handleSignOut} className="text-[10px] text-red-500 font-bold uppercase">Log Out</button>
                        </div>                        <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); }} className="bg-black/50 border border-neutral-800 text-xs rounded p-2 text-neutral-400 backdrop-blur-sm">{timezones.map(t => <option key={t} value={t}>{t}</option>)}</select>
                    </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mask-fade">
                    <NavBtn id="dashboard" label="Dashboard" />
                    <NavBtn id="playbook" label="Playbook" />
                    <NavBtn id="comps" label="Comps" />
                    <NavBtn id="matches" label="Matches" />
                    <NavBtn id="strats" label="Stratbook" />
                    <NavBtn id="lineups" label="Lineups" />
                    <NavBtn id="roster" label="Roster" />
                    {isAdmin && <NavBtn id="partners" label="Partners" />}
                    {isAdmin && <NavBtn id="content" label="Content Mgr" />}
                    <NavBtn id="mapveto" label="Map Veto" />
                    {isAdmin && <NavBtn id="admin" label="Admin" />}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-red-900/50 scrollbar-track-black/20 relative z-10">
                <div className="max-w-[1920px] mx-auto min-h-screen flex flex-col">
                    {activeTab === 'dashboard' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
                        <div className="lg:col-span-4 space-y-8">
                            <CaptainsMessage />
                            <LeaveLogger members={dynamicMembers} />
                            <Card className="border-red-900/20"><div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Set Availability</h2><div className="space-y-4"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Day</label><Select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</Select></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Start</label><Input type="time" value={start} onChange={e => setStart(e.target.value)} className="[color-scheme:dark]" /></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">End</label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="[color-scheme:dark]" /></div></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Pref. Role</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{ROLES.map(r => (<button key={r} onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-black border transition-all whitespace-nowrap flex items-center justify-center ${role === r ? 'bg-red-600 text-white border-red-500' : 'bg-black/50 border-neutral-800 text-neutral-500 hover:text-white'}`}>{ROLE_ABBREVIATIONS[r] || r}</button>))}</div></div><div className="pt-2 flex gap-2"><ButtonPrimary onClick={saveAvail} disabled={saveStatus !== 'idle'} className="flex-1">{saveStatus === 'idle' ? 'Save Slot' : 'Saved!'}</ButtonPrimary><ButtonSecondary onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)}>Clear</ButtonSecondary></div></div></Card>
                            <Card className="border-red-900/20"><div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Event Operations</h2><ScrimScheduler onSchedule={schedEvent} userTimezone={userTimezone} /></Card>
                        </div>
                        <div className="lg:col-span-8 space-y-8">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8"><Card><h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center uppercase tracking-wide"><span>Upcoming Events</span><span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-1 rounded font-bold">{events.length} ACTIVE</span></h2><div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">{events.map(ev => (<div key={ev.id} className="p-3 bg-black/40 rounded-xl border border-neutral-800 flex justify-between items-center group hover:border-red-900/50 transition-colors"><div><div className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{ev.type} <span className="text-neutral-500">vs</span> {ev.opponent || 'TBD'}</div><div className="text-xs text-neutral-400 mt-1">{ev.date} @ <span className="text-white font-mono">{ev.time}</span></div></div><button onClick={() => openModal('Delete Event', 'Remove?', () => deleteEvent(ev.id))} className="text-neutral-600 hover:text-red-500">×</button></div>))}</div></Card><Card><h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wide">Availability Heatmap</h2><AvailabilityHeatmap availabilities={availabilities} members={dynamicMembers} /></Card></div>
                            <PerformanceWidget events={events} />
                            <Card><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Detailed Timeline <span className="text-neutral-500 text-sm normal-case">({userTimezone})</span></h2><div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b border-neutral-800"><th className="p-3 text-xs font-bold text-neutral-500 uppercase tracking-wider w-32">Team Member</th>{SHORT_DAYS.map(day => (<th key={day} className="p-3 text-xs font-bold text-red-600 uppercase tracking-wider text-center border-l border-neutral-800">{day}</th>))}</tr></thead><tbody className="divide-y divide-neutral-800/50">{dynamicMembers.map(member => (<tr key={member} className="hover:bg-neutral-800/30 transition-colors group"><td className="p-4 font-bold text-white text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-red-500/50 shadow-sm"></div>{member}</td>{DAYS.map((day) => { const slots = (displayAvail[member] || []).filter(s => s.day === day); return (<td key={day} className="p-2 align-middle border-l border-neutral-800/50"><div className="flex flex-col gap-1 items-center justify-center">{slots.length > 0 ? slots.map((s, i) => (<div key={i} className="bg-gradient-to-br from-red-600 to-red-700 text-white text-[10px] font-bold px-2 py-1 rounded w-full text-center shadow-md whitespace-nowrap flex items-center justify-center gap-1">{s.start}-{s.end}<span className="opacity-75 ml-1 text-[9px] border border-white/20 px-1 rounded bg-black/20">{ROLE_ABBREVIATIONS[s.role] || s.role}</span></div>)) : <div className="h-1 w-4 bg-neutral-800 rounded-full"></div>}</div></td>); })}</tr>))}</tbody></table></div></Card>
                        </div>
                    </div>}
                    {activeTab === 'playbook' && <div className="animate-fade-in h-[80vh]"><Playbook /></div>}
                    {activeTab === 'comps' && <div className="animate-fade-in h-full"><TeamComps members={dynamicMembers} /></div>}
                    {activeTab === 'matches' && <div className="animate-fade-in"><MatchHistory currentUser={currentUser} members={dynamicMembers} /></div>}
                    {activeTab === 'strats' && <div className="animate-fade-in h-[85vh]"><StratBook /></div>}
                    {activeTab === 'lineups' && <div className="animate-fade-in h-[85vh]"><LineupLibrary /></div>}
                    {activeTab === 'roster' && <div className="animate-fade-in h-full flex-1 flex flex-col"><RosterManager members={dynamicMembers} events={events} /></div>}
                    {activeTab === 'partners' && isAdmin && <div className="animate-fade-in h-full"><PartnerDirectory /></div>}
                    {activeTab === 'content' && isAdmin && <div className="animate-fade-in h-full"><ContentManager /></div>}
                    {activeTab === 'admin' && isAdmin && <div className="animate-fade-in h-full"><AdminPanel /></div>}
                    {activeTab === 'mapveto' && <div className="animate-fade-in h-[80vh]"><MapVeto /></div>}
                </div>
            </main>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>{modalContent.children}</Modal>
        </div>
    );
}

// ==========================================
// ROOT APP COMPONENT (CONTROLLER)
// ==========================================
export default function App() {
    // State to toggle between Landing Page ('landing') and Team Hub ('hub')
    const [currentView, setCurrentView] = useState('landing');

    return (
        <ToastProvider>
            <GlobalStyles />
            {currentView === 'landing' ? (
                <LandingPage onEnterHub={() => setCurrentView('hub')} />
            ) : (
                <SyrixDashboard onBack={() => setCurrentView('landing')} />
            )}
        </ToastProvider>
    );
}-