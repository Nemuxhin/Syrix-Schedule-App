/*
Syrix Team Availability - v12.3 (CLEAN BUILD)
- FIX: Removed all duplicate function declarations.
- CORE: Includes StratBook (ValoPlant), Playbook, Comps, and Dashboard.
*/

import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInWithPopup, signOut, OAuthProvider } from 'firebase/auth';

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

// --- CONFIGURATION ---
const discordWebhookUrl = "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD";

const ADMIN_UIDS = [
    "M9FzRywhRIdUveh5JKUfQgJtlIB3", // Nemuxhin
    "SiPLxB20VzVGBZL3rTM42FsgEy52"  // Tawz
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAPS = ["Ascent", "Bind", "Breeze", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset", "Abyss", "Corrode"];
const ROLES = ["Flex", "Duelist", "Initiator", "Controller", "Sentinel"];
const RANKS = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];

const AGENT_NAMES = [
    "Jett", "Raze", "Reyna", "Yoru", "Phoenix", "Neon", "Iso", "Vyse", "Waylay",
    "Omen", "Astra", "Brimstone", "Viper", "Harbor", "Clove",
    "Sova", "Fade", "Skye", "Breach", "KAY/O", "Gekko",
    "Killjoy", "Cypher", "Sage", "Chamber", "Deadlock", "Veto"
];

const ROLE_ABBREVIATIONS = { Flex: "FLX", Duelist: "DUEL", Initiator: "INIT", Controller: "CTRL", Sentinel: "SENT" };

// --- TOAST SYSTEM ---
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
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto min-w-[240px] backdrop-blur-xl border-l-4 p-4 rounded-r-lg shadow-2xl transform transition-all animate-slide-in flex items-center gap-3 ${t.type === 'success' ? 'bg-green-900/80 border-green-500 text-white' : 'bg-red-900/80 border-red-500 text-white'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${t.type === 'success' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{t.type === 'success' ? '✓' : '!'}</div>
                        <span className="font-bold text-sm">{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

// --- VALOPLANT UTILITIES ---
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

const RoleIcons = {
    Duelist: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5z" /></svg>,
    Initiator: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l-9 4v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.96-7 10.1-3.87-1.14-7-5.43-7-10.1v-4.7l7-3.12z" /></svg>,
    Controller: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><circle cx="12" cy="12" r="10" opacity="0.3" /><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>,
    Sentinel: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.96-7 10.1-3.87-1.14-7-5.43-7-10.1v-4.7l7-3.12z" /><rect x="11" y="7" width="2" height="10" /></svg>,
    Flex: <span className="font-bold text-xs">FLX</span>,
    Unknown: <span className="font-bold text-xs">?</span>
};

const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

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

// --- STYLES ---
const GlobalStyles = () => (
    <style>{`
        .glass-panel {
            background: rgba(15, 15, 15, 0.9);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255,255,255,0.08);
        }
        .card-shine:hover {
            border-color: rgba(220, 38, 38, 0.4);
            background: rgba(20, 20, 20, 0.98);
        }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ef4444; }
    `}</style>
);

// --- BACKGROUND ---
const BackgroundFlare = () => (
    <div className="fixed inset-0 w-full h-full z-0 pointer-events-none bg-black">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(127,29,29,0.25)_0%,rgba(0,0,0,0)_70%)]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(69,10,10,0.25)_0%,rgba(0,0,0,0)_70%)]"></div>
        <div className="absolute top-[20%] right-[20%] w-[40%] h-[40%] rounded-full bg-[radial-gradient(circle,rgba(185,28,28,0.15)_0%,rgba(0,0,0,0)_70%)]"></div>
        <div className="absolute inset-0 opacity-[0.07] bg-[linear-gradient(to_right,#555_1px,transparent_1px),linear-gradient(to_bottom,#555_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_10%,#000_100%)] opacity-80"></div>
    </div>
);

// --- UI COMPONENTS ---
const Card = ({ children, className = "" }) => <div className={`glass-panel rounded-2xl p-6 relative overflow-hidden group card-shine transition-colors duration-200 ${className}`}>{children}</div>;
const Input = (props) => <input {...props} className={`w-full bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 shadow-inner hover:border-neutral-700 ${props.className}`} />;
const Select = (props) => <select {...props} className={`w-full bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all shadow-inner hover:border-neutral-700 ${props.className}`}>{props.children}</select>;
const ButtonPrimary = ({ children, onClick, disabled, className = "" }) => <button onClick={onClick} disabled={disabled} className={`bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow-lg shadow-red-900/20 transition-all transform active:scale-[0.98] disabled:opacity-50 ${className}`}>{children}</button>;
const ButtonSecondary = ({ children, onClick, className = "" }) => <button onClick={onClick} className={`bg-black/40 hover:bg-neutral-900 border border-neutral-800 hover:border-red-900/50 text-neutral-400 hover:text-white font-bold uppercase tracking-wider py-2 px-4 rounded-xl transition-all ${className}`}>{children}</button>;

// --- HOOKS ---
const useValorantData = () => {
    const [agentData, setAgentData] = useState({}); // Maps Name -> { icon, abilities: [] }
    const [mapImages, setMapImages] = useState({});

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const agentRes = await fetch('https://valorant-api.com/v1/agents');
                const agentJson = await agentRes.json();
                const aMap = {};
                if (agentJson.data) {
                    agentJson.data.forEach(agent => {
                        aMap[agent.displayName] = {
                            icon: agent.displayIcon,
                            abilities: agent.abilities.map(a => ({
                                name: a.displayName,
                                icon: a.displayIcon,
                                slot: a.slot
                            })).filter(a => a.slot !== "Passive" && a.icon)
                        };
                    });
                }
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

// --- ANIMATED STAMPS ---
const VictoryStamp = () => <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-green-500 text-green-500 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter -rotate-12 pointer-events-none mix-blend-screen shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-fade-in">VICTORY</div>;
const DefeatStamp = () => <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-red-600 text-red-600 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter rotate-12 pointer-events-none mix-blend-screen shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-fade-in">DEFEAT</div>;

// --- COMPONENTS ---

function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex justify-center items-center backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-neutral-900 rounded-2xl shadow-2xl shadow-red-900/20 p-6 w-full max-w-md border border-red-900/40 animate-fade-in relative">
                <h3 className="text-2xl font-black text-white mb-4 border-b pb-2 border-red-900/50 uppercase tracking-wider italic">{title}</h3>
                <div className="text-neutral-300 mb-8">{children}</div>
                <div className="flex justify-end gap-4">
                    <ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary>
                    <ButtonPrimary onClick={onConfirm}>Confirm</ButtonPrimary>
                </div>
            </div>
        </div>
    );
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
    const addLeave = async () => { if (!newLeave.start || !newLeave.end) return; await addDoc(collection(db, 'leaves'), { ...newLeave, user: currentUser.displayName, timestamp: new Date().toISOString() }); setNewLeave({ start: '', end: '', reason: '' }); };
    const deleteLeave = async (id) => await deleteDoc(doc(db, 'leaves', id));
    return (
        <Card className="border-red-900/20">
            <h3 className="text-lg font-black text-white mb-4 border-b border-red-900/30 pb-2 uppercase tracking-widest flex items-center gap-2"><span className="text-xl">🏖️</span> Absence Log</h3>
            <div className="space-y-3 mb-4"><div className="grid grid-cols-2 gap-2"><Input type="date" value={newLeave.start} onChange={e => setNewLeave({ ...newLeave, start: e.target.value })} className="[color-scheme:dark]" /><Input type="date" value={newLeave.end} onChange={e => setNewLeave({ ...newLeave, end: e.target.value })} className="[color-scheme:dark]" /></div><Input type="text" placeholder="Reason" value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} /><ButtonSecondary onClick={addLeave} className="w-full text-xs py-3">Log Absence</ButtonSecondary></div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{leaves.length === 0 && <p className="text-neutral-600 italic text-xs text-center py-2">No upcoming absences.</p>}{leaves.map(l => (<div key={l.id} className="p-3 bg-black/50 border border-neutral-800 rounded-lg flex justify-between items-center text-xs hover:border-red-900/50 transition-colors group"><div><span className="font-bold text-red-500 mr-2">{l.user}</span><span className="text-neutral-400">{l.start} - {l.end}</span><div className="text-neutral-500 italic mt-0.5">{l.reason}</div></div>{(l.user === currentUser?.displayName || ADMIN_UIDS.includes(currentUser?.uid)) && (<button onClick={() => deleteLeave(l.id)} className="text-neutral-600 hover:text-red-500 font-bold px-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>)}</div>))}</div>
        </Card>
    );
}

function NextMatchCountdown({ events }) {
    const [timeLeft, setTimeLeft] = useState('');
    const nextEvent = useMemo(() => { const now = new Date(); return events.find(e => new Date(e.date + 'T' + e.time) > now); }, [events]);
    useEffect(() => {
        if (!nextEvent) { setTimeLeft(''); return; }
        const target = new Date(nextEvent.date + 'T' + nextEvent.time);
        const interval = setInterval(() => {
            const now = new Date(); const diff = target - now;
            if (diff <= 0) { setTimeLeft('NOW'); return; }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24)); const h = Math.floor((diff / (1000 * 60 * 60)) % 24); const m = Math.floor((diff / 1000 / 60) % 60); const s = Math.floor((diff / 1000) % 60);
            setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [nextEvent]);
    if (!nextEvent) return null;
    return (
        <div className="bg-gradient-to-r from-black via-neutral-950 to-black p-6 rounded-3xl border border-red-900/40 shadow-2xl shadow-red-900/20 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
            <div className="z-10 text-center md:text-left"><div className="text-xs text-red-500 font-black uppercase tracking-[0.2em] mb-2">Next Match vs {nextEvent.opponent}</div><div className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">{nextEvent.date} @ {nextEvent.time}</div><div className="text-neutral-500 text-sm font-mono mt-1 uppercase tracking-widest">Type: {nextEvent.type}</div></div>
            <div className="z-10"><div className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 font-mono tracking-tighter tabular-nums drop-shadow-sm">{timeLeft}</div></div>
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

    useEffect(() => { const unsub = onSnapshot(collection(db, 'comps'), (snap) => { const c = []; snap.forEach(doc => c.push({ id: doc.id, ...doc.data() })); setComps(c); }); return () => unsub(); }, []);
    const saveComp = async () => { if (newComp.agents.some(a => !a)) return addToast('Please select all 5 agents', 'error'); await addDoc(collection(db, 'comps'), { map: selectedMap, ...newComp }); setNewComp({ agents: Array(5).fill(''), players: Array(5).fill('') }); addToast('Composition Saved'); };
    const deleteComp = async (id) => { await deleteDoc(doc(db, 'comps', id)); addToast('Composition Deleted'); };
    const currentMapComps = comps.filter(c => c.map === selectedMap);

    const AgentCard = ({ index }) => {
        const isOpen = activeDropdown === index;
        const selectedAgent = newComp.agents[index];
        const agentImage = agentData[selectedAgent]?.icon;

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

    const [links, setLinks] = useState([]);
    const [savedStrats, setSavedStrats] = useState([]);
    const [viewingStrat, setViewingStrat] = useState(null);
    const [newLink, setNewLink] = useState({ title: '', url: '' });

    useEffect(() => {
        const qStrats = query(collection(db, 'strats'), where("map", "==", selectedMap));
        const unsubStrats = onSnapshot(qStrats, (snap) => { const s = []; snap.forEach(doc => s.push({ id: doc.id, ...doc.data() })); s.sort((a, b) => new Date(b.date) - new Date(a.date)); setSavedStrats(s); });
        const qLinks = query(collection(db, 'strat_links'), where("map", "==", selectedMap));
        const unsubLinks = onSnapshot(qLinks, (snap) => { const l = []; snap.forEach(doc => l.push({ id: doc.id, ...doc.data() })); setLinks(l); });
        return () => { unsubStrats(); unsubLinks(); };
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
                // Geometric shapes
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

    const addLink = async () => { if (!newLink.title || !newLink.url) return; await addDoc(collection(db, 'strat_links'), { ...newLink, map: selectedMap }); setNewLink({ title: '', url: '' }); addToast('Link Added'); };
    const deleteLink = async (id) => { await deleteDoc(doc(db, 'strat_links', id)); addToast('Link Removed'); };
    const deleteStrat = async (id) => { if (viewingStrat) setViewingStrat(null); await deleteDoc(doc(db, 'strats', id)); addToast('Strategy Deleted'); };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex gap-4 h-[75vh]">
                <Card className="w-64 flex flex-col gap-4 overflow-hidden !p-0">
                    <div className="bg-neutral-900 p-4 border-b border-white/10">
                        <h4 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">1. Map Markers</h4>
                        <div className="flex gap-2 justify-center">
                            {['A', 'B', 'C', 'Spawn'].map(l => (
                                <div key={l} draggable onDragStart={() => setDragItem({ type: 'site_label', label: l })} className="w-8 h-8 bg-white/10 rounded flex items-center justify-center text-xs font-bold cursor-grab hover:bg-white/20 border border-white/20">{l[0]}</div>
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