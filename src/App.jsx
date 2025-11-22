/*
Syrix Team Availability - v6.0 (PREMIUM UI OVERHAUL)
- THEME: "Onyx & Crimson" - Deep blacks, glowing reds, animated gradients.
- UI: Added "Grid" textures, cinematic lighting, and smooth hover physics.
- LOGIC: All v5.1 features (Drag/Drop Stratbook, Analytics) preserved.
*/

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, query, where } from 'firebase/firestore';
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

const discordWebhookUrl = "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD";

const ADMINS = ["Nemuxhin", "Tawz", "tawz", "nemuxhin"];

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

const UTILITY_TYPES = [
    { id: 'smoke', color: '#9ca3af', label: 'Smoke', shape: 'circle' },
    { id: 'flash', color: '#facc15', label: 'Flash', shape: 'star' },
    { id: 'molly', color: '#ef4444', label: 'Molly', shape: 'rect' },
    { id: 'recon', color: '#3b82f6', label: 'Recon', shape: 'triangle' }
];

const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

const RoleIcons = {
    Duelist: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5z" /></svg>,
    Initiator: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2l-9 4v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.96-7 10.1-3.87-1.14-7-5.43-7-10.1v-4.7l7-3.12z" /></svg>,
    Controller: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><circle cx="12" cy="12" r="10" opacity="0.3" /><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /></svg>,
    Sentinel: <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.96-7 10.1-3.87-1.14-7-5.43-7-10.1v-4.7l7-3.12z" /><rect x="11" y="7" width="2" height="10" /></svg>,
    Flex: <span className="font-bold text-xs">FLX</span>,
    Unknown: <span className="font-bold text-xs">?</span>
};

// --- Utility Functions ---
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

// --- PREMIUM UI COMPONENTS ---

// 1. The Glass Card
const Card = ({ children, className = "" }) => (
    <div className={`bg-neutral-900/60 backdrop-blur-xl border border-white/5 shadow-2xl rounded-[1.5rem] p-6 relative overflow-hidden group transition-all duration-300 hover:border-white/10 hover:shadow-red-900/10 ${className}`}>
        {/* Inner Glow on Hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/0 via-transparent to-red-600/0 group-hover:from-red-600/5 group-hover:to-blue-600/5 transition-all duration-500 pointer-events-none"></div>
        {children}
    </div>
);

// 2. The Cyberpunk Input
const Input = (props) => (
    <div className="relative group">
        <input {...props} className={`w-full bg-black/50 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all placeholder-neutral-600 backdrop-blur-sm ${props.className}`} />
        <div className="absolute bottom-0 left-2 right-2 h-[1px] bg-gradient-to-r from-transparent via-neutral-700 to-transparent group-hover:via-red-700 transition-all duration-500"></div>
    </div>
);

// 3. The Select Menu
const Select = (props) => (
    <div className="relative">
        <select {...props} className={`w-full bg-black/50 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all appearance-none cursor-pointer backdrop-blur-sm ${props.className}`}>
            {props.children}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 text-[10px]">▼</div>
    </div>
);

// 4. The "Nuclear" Primary Button
const ButtonPrimary = ({ children, onClick, disabled, className = "" }) => (
    <button onClick={onClick} disabled={disabled} className={`relative overflow-hidden bg-gradient-to-r from-red-700 via-red-600 to-red-800 text-white font-black uppercase tracking-[0.15em] py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_25px_rgba(220,38,38,0.7)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none group ${className}`}>
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
        {/* Shine Effect */}
        <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-shine" />
    </button>
);

// 5. The Stealth Secondary Button
const ButtonSecondary = ({ children, onClick, className = "" }) => (
    <button onClick={onClick} className={`bg-black/40 hover:bg-neutral-800 border border-neutral-800 hover:border-red-500/50 text-neutral-400 hover:text-white font-bold uppercase tracking-wider py-2 px-4 rounded-xl transition-all backdrop-blur-sm ${className}`}>
        {children}
    </button>
);

// --- HOOKS ---
const useValorantData = () => {
    const [agentImages, setAgentImages] = useState({});
    const [mapImages, setMapImages] = useState({});

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const agentRes = await fetch('https://valorant-api.com/v1/agents');
                const agentData = await agentRes.json();
                const aMap = {};
                if (agentData.data) agentData.data.forEach(agent => { aMap[agent.displayName] = agent.fullPortrait || agent.displayIcon; });
                setAgentImages(aMap);

                const mapRes = await fetch('https://valorant-api.com/v1/maps');
                const mapData = await mapRes.json();
                const mMap = {};
                if (mapData.data) mapData.data.forEach(map => { mMap[map.displayName] = map.displayIcon; });
                setMapImages(mMap);
            } catch (e) { console.error("Failed to fetch Valorant assets", e); }
        };
        fetchAssets();
    }, []);
    return { agentImages, mapImages };
};

// --- ANIMATED STAMPS ---
const VictoryStamp = () => (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-green-500 text-green-500 font-black text-6xl md:text-8xl p-6 uppercase tracking-tighter -rotate-12 opacity-0 animate-stamp-in pointer-events-none mix-blend-screen shadow-[0_0_50px_rgba(34,197,94,0.5)] backdrop-blur-sm">VICTORY</div>
);
const DefeatStamp = () => (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-red-600 text-red-600 font-black text-6xl md:text-8xl p-6 uppercase tracking-tighter rotate-12 opacity-0 animate-stamp-in pointer-events-none mix-blend-screen shadow-[0_0_50px_rgba(220,38,38,0.5)] backdrop-blur-sm">DEFEAT</div>
);

// --- COMPONENTS ---

function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex justify-center items-center backdrop-blur-xl p-4 overflow-y-auto animate-fade-in">
            <div className="bg-neutral-900 rounded-[2rem] shadow-2xl shadow-red-900/40 p-8 w-full max-w-md border border-red-900/30 animate-scale-in relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
                <h3 className="text-3xl font-black text-white mb-4 uppercase italic tracking-tighter">{title}</h3>
                <div className="text-neutral-400 mb-8 text-sm leading-relaxed font-medium">{children}</div>
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
            <h3 className="text-lg font-black text-white mb-4 border-b border-red-900/30 pb-2 uppercase tracking-widest flex items-center gap-2"><span className="text-2xl">🏖️</span> Absence Log</h3>
            <div className="space-y-3 mb-4"><div className="grid grid-cols-2 gap-2"><Input type="date" value={newLeave.start} onChange={e => setNewLeave({ ...newLeave, start: e.target.value })} className="[color-scheme:dark]" /><Input type="date" value={newLeave.end} onChange={e => setNewLeave({ ...newLeave, end: e.target.value })} className="[color-scheme:dark]" /></div><Input type="text" placeholder="Reason" value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} /><ButtonSecondary onClick={addLeave} className="w-full text-xs py-3">Log Absence</ButtonSecondary></div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">{leaves.length === 0 && <p className="text-neutral-600 italic text-xs text-center py-2">No upcoming absences.</p>}{leaves.map(l => (<div key={l.id} className="p-3 bg-black/40 border border-neutral-800 rounded-lg flex justify-between items-center text-xs hover:border-red-900/50 transition-colors group"><div><span className="font-bold text-red-500 mr-2">{l.user}</span><span className="text-neutral-400">{l.start} - {l.end}</span><div className="text-neutral-500 italic mt-0.5">{l.reason}</div></div>{(l.user === currentUser?.displayName || ADMINS.includes(currentUser?.displayName)) && (<button onClick={() => deleteLeave(l.id)} className="text-neutral-600 hover:text-red-500 font-bold px-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>)}</div>))}</div>
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
        <div className="bg-gradient-to-r from-neutral-950 via-black to-neutral-950 p-8 rounded-[2rem] border border-red-900/30 shadow-2xl shadow-red-900/10 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
            {/* Animated Background Mesh */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            <div className="absolute top-0 right-0 w-[30rem] h-[30rem] bg-red-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none animate-pulse-slow"></div>

            <div className="z-10 text-center md:text-left relative">
                <div className="inline-block px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-black uppercase tracking-[0.2em] mb-3 shadow-[0_0_10px_rgba(220,38,38,0.2)]">Next Match vs {nextEvent.opponent}</div>
                <div className="text-4xl md:text-5xl font-black text-white italic tracking-tighter drop-shadow-lg">{nextEvent.date} @ {nextEvent.time}</div>
                <div className="text-neutral-500 text-sm font-mono mt-2 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span> Type: {nextEvent.type}</div>
            </div>
            <div className="z-10">
                <div className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-200 to-neutral-600 font-mono tracking-tighter tabular-nums drop-shadow-2xl">{timeLeft}</div>
            </div>
        </div>
    );
}

function TeamComps({ members }) {
    const [comps, setComps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [newComp, setNewComp] = useState({ agents: Array(5).fill(''), players: Array(5).fill('') });
    const [activeDropdown, setActiveDropdown] = useState(null);
    const { agentImages } = useValorantData();

    useEffect(() => { const unsub = onSnapshot(collection(db, 'comps'), (snap) => { const c = []; snap.forEach(doc => c.push({ id: doc.id, ...doc.data() })); setComps(c); }); return () => unsub(); }, []);
    const saveComp = async () => { if (newComp.agents.some(a => !a)) return; await addDoc(collection(db, 'comps'), { map: selectedMap, ...newComp }); setNewComp({ agents: Array(5).fill(''), players: Array(5).fill('') }); };
    const deleteComp = async (id) => await deleteDoc(doc(db, 'comps', id));
    const currentMapComps = comps.filter(c => c.map === selectedMap);

    const AgentCard = ({ index }) => {
        const isOpen = activeDropdown === index;
        const selectedAgent = newComp.agents[index];
        const agentImage = agentImages[selectedAgent];

        return (
            <div className="relative group h-72 bg-neutral-900/80 border border-white/5 rounded-[1.5rem] overflow-hidden transition-all hover:border-red-500/50 hover:shadow-[0_0_40px_rgba(220,38,38,0.2)] flex flex-col shadow-xl">
                {/* Agent Background Image */}
                {selectedAgent && agentImage && (
                    <div className="absolute inset-0 z-0">
                        <img src={agentImage} alt={selectedAgent} className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-all duration-500 scale-110 group-hover:scale-100" style={{ objectPosition: 'center 20%' }} />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-neutral-900/60 to-black"></div>
                        <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay"></div>
                    </div>
                )}

                <div onClick={() => setActiveDropdown(isOpen ? null : index)} className="flex-1 relative flex flex-col justify-center items-center p-4 z-10 cursor-pointer">
                    {/* Role Label */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em]">Role {index + 1}</span>
                    </div>

                    {selectedAgent ? (
                        <div className="flex flex-col items-center animate-fade-in-up z-20 mt-auto mb-4">
                            <div className="text-4xl font-black text-white uppercase tracking-tighter drop-shadow-[0_5px_10px_rgba(0,0,0,1)]">{selectedAgent}</div>
                            <div className="mt-2 h-0.5 w-12 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 rounded-2xl p-6 w-full h-32 hover:border-red-500/50 transition-all opacity-50 hover:opacity-100 hover:bg-white/5">
                            <span className="text-3xl text-neutral-400 mb-2 font-thin">+</span>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Select Agent</span>
                        </div>
                    )}
                </div>

                {isOpen && (
                    <div className="absolute inset-0 bg-neutral-950/95 backdrop-blur-xl z-50 flex flex-col animate-fade-in">
                        <div className="flex justify-between items-center p-4 border-b border-white/10 bg-black/50">
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Tactical Selection</span>
                            <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }} className="text-neutral-500 hover:text-red-500 text-xl leading-none transition-colors">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 custom-scrollbar">
                            {AGENT_NAMES.map(agent => (
                                <button key={agent} onClick={(e) => { e.stopPropagation(); const a = [...newComp.agents]; a[index] = agent; setNewComp({ ...newComp, agents: a }); setActiveDropdown(null); }} className={`text-[10px] font-bold uppercase py-3 rounded-lg border transition-all ${newComp.agents[index] === agent ? 'bg-red-600 text-white border-red-500' : 'bg-neutral-900/50 border-white/5 text-neutral-400 hover:text-white hover:border-red-500/50'}`}>{agent}</button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="h-20 relative bg-black/90 backdrop-blur flex items-center justify-center z-20 border-t border-white/10">
                    <select value={newComp.players[index]} onChange={e => { const p = [...newComp.players]; p[index] = e.target.value; setNewComp({ ...newComp, players: p }); }} className="appearance-none bg-transparent text-center text-sm font-bold text-neutral-400 uppercase outline-none cursor-pointer w-full h-full hover:text-white transition-all tracking-widest hover:bg-white/5 focus:text-red-500" style={{ textAlignLast: 'center' }}>
                        <option value="" className="bg-neutral-900">Assign Player</option>
                        {members.map(m => <option key={m} value={m} className="bg-neutral-900">{m}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-600 text-[8px]">▼</div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-white/10 pb-6"><h3 className="text-5xl font-black text-white italic tracking-tighter flex items-center gap-3 drop-shadow-2xl"><span className="text-red-600 text-6xl">/</span> TACTICAL COMPS</h3></div>
            <div className="flex flex-wrap gap-3">{MAPS.map(m => (<button key={m} onClick={() => setSelectedMap(m)} className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all transform duration-300 ${selectedMap === m ? 'bg-gradient-to-r from-red-600 to-red-800 text-white shadow-[0_0_25px_rgba(220,38,38,0.5)] scale-110 border border-red-400' : 'bg-black/60 border border-white/10 text-neutral-500 hover:bg-neutral-900 hover:text-white hover:border-red-900'}`}>{m}</button>))}</div>
            <div className="bg-neutral-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="flex justify-between items-center mb-10 relative z-10"><div className="flex items-center gap-4"><span className="flex h-4 w-4 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 shadow-[0_0_15px_red]"></span></span><h4 className="text-lg font-bold text-neutral-200 uppercase tracking-widest">Design {selectedMap} Strategy</h4></div><ButtonPrimary onClick={saveComp} className="text-xs py-3 px-8">Save Loadout</ButtonPrimary></div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6" onClick={() => setActiveDropdown(null)}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} onClick={e => e.stopPropagation()}><AgentCard index={i} /></div>))}</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {currentMapComps.map(comp => (
                    <div key={comp.id} className="bg-neutral-900/60 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden relative group hover:border-red-600/40 transition-all shadow-lg hover:shadow-red-900/20">
                        <div className="bg-black/40 px-6 py-4 flex justify-between items-center border-b border-white/5 group-hover:bg-red-900/10 transition-colors"><div className="flex items-center gap-3"><div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_10px_red]"></div><div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">ID: {comp.id.substring(0, 6)}</div></div><button onClick={() => deleteComp(comp.id)} className="text-neutral-600 hover:text-white font-bold text-[10px] bg-neutral-950 border border-neutral-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-all">DELETE</button></div>
                        <div className="p-6 grid grid-cols-5 gap-4 divide-x divide-white/5">{comp.agents.map((agent, i) => (<div key={i} className="text-center flex flex-col justify-center items-center gap-2"><div className="text-xs sm:text-sm font-black text-white uppercase tracking-tight drop-shadow-sm">{agent}</div><div className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest truncate w-full px-1 bg-white/5 rounded py-1">{comp.players[i] || '-'}</div></div>))}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function StratBook() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const { mapImages, agentImages } = useValorantData();
    const [color, setColor] = useState('#ef4444');

    const [mapIcons, setMapIcons] = useState([]);
    const [dragItem, setDragItem] = useState(null);
    const [movingIcon, setMovingIcon] = useState(null);

    const [links, setLinks] = useState([]);
    const [savedStrats, setSavedStrats] = useState([]);
    const [viewingStrat, setViewingStrat] = useState(null);
    const [newLink, setNewLink] = useState({ title: '', url: '' });

    useEffect(() => {
        const qLinks = query(collection(db, 'strat_links'), where("map", "==", selectedMap));
        const unsubLinks = onSnapshot(qLinks, (snap) => { const l = []; snap.forEach(doc => l.push({ id: doc.id, ...doc.data() })); setLinks(l); });
        const qStrats = query(collection(db, 'strats'), where("map", "==", selectedMap));
        const unsubStrats = onSnapshot(qStrats, (snap) => { const s = []; snap.forEach(doc => s.push({ id: doc.id, ...doc.data() })); s.sort((a, b) => new Date(b.date) - new Date(a.date)); setSavedStrats(s); });
        return () => { unsubLinks(); unsubStrats(); };
    }, [selectedMap]);

    const getPos = (e) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.nativeEvent ? e.nativeEvent.clientX : e.touches[0].clientX;
        const clientY = e.nativeEvent ? e.nativeEvent.clientY : e.touches[0].clientY;
        return { x: (clientX - rect.left) * (canvasRef.current.width / rect.width), y: (clientY - rect.top) * (canvasRef.current.height / rect.height) };
    };

    const startDraw = (e) => {
        if (movingIcon !== null) return;
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
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (dragItem) {
            setMapIcons([...mapIcons, { id: Date.now(), ...dragItem, x, y }]);
            setDragItem(null);
        } else if (movingIcon !== null) {
            const updated = [...mapIcons];
            updated[movingIcon] = { ...updated[movingIcon], x, y };
            setMapIcons(updated);
            setMovingIcon(null);
        }
    };

    const saveStrat = async () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1280; tempCanvas.height = 720;
        const ctx = tempCanvas.getContext('2d');

        if (mapImages[selectedMap]) {
            const img = new Image();
            img.src = mapImages[selectedMap];
            img.crossOrigin = "anonymous";
            await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; img.src = mapImages[selectedMap]; });
            ctx.drawImage(img, 0, 0, 1280, 720);
        }

        ctx.drawImage(canvasRef.current, 0, 0);

        for (const icon of mapIcons) {
            const px = (icon.x / 100) * 1280;
            const py = (icon.y / 100) * 720;

            if (icon.type === 'agent' && agentImages[icon.name]) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = agentImages[icon.name];
                await new Promise(r => { img.onload = r; img.onerror = r; });
                ctx.drawImage(img, px - 25, py - 25, 50, 50);
            } else {
                ctx.fillStyle = icon.color;
                ctx.beginPath();
                ctx.arc(px, py, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const dataUrl = tempCanvas.toDataURL();
        await addDoc(collection(db, 'strats'), { map: selectedMap, image: dataUrl, date: new Date().toISOString() });
        alert('Strat Saved!');
    };

    const addLink = async () => { if (!newLink.title || !newLink.url) return; await addDoc(collection(db, 'strat_links'), { ...newLink, map: selectedMap }); setNewLink({ title: '', url: '' }); };
    const deleteLink = async (id) => await deleteDoc(doc(db, 'strat_links', id));
    const deleteStrat = async (id) => { if (viewingStrat) setViewingStrat(null); await deleteDoc(doc(db, 'strats', id)); };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex gap-6 h-[75vh]">
                {/* SIDEBAR */}
                <Card className="w-28 flex flex-col gap-4 overflow-y-auto custom-scrollbar !p-4 bg-neutral-950/80 border-red-900/20">
                    <div className="text-[9px] font-black text-red-500 text-center uppercase tracking-widest mb-2">Utility</div>
                    {UTILITY_TYPES.map(u => (
                        <div key={u.id} draggable onDragStart={() => setDragItem({ type: 'util', ...u })} className="w-12 h-12 rounded-xl mx-auto cursor-grab active:cursor-grabbing border border-white/10 hover:scale-110 transition-transform shadow-lg flex items-center justify-center bg-neutral-900" title={u.label}>
                            <div className="w-6 h-6 rounded-full" style={{ backgroundColor: u.color }}></div>
                        </div>
                    ))}
                    <div className="text-[9px] font-black text-red-500 text-center uppercase mt-6 mb-2">Agents</div>
                    {AGENT_NAMES.map(a => (
                        <img key={a} src={agentImages[a]} alt={a} draggable onDragStart={() => setDragItem({ type: 'agent', name: a })} className="w-14 h-14 rounded-xl mx-auto border border-neutral-800 bg-neutral-900/50 p-1 cursor-grab active:cursor-grabbing hover:border-red-500 transition-colors shadow-lg hover:shadow-red-500/20" />
                    ))}
                </Card>

                {/* MAIN BOARD */}
                <Card className="flex-1 flex flex-col relative !p-0 overflow-hidden border-neutral-800 bg-[#0a0a0a]">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center p-4 border-b border-white/5 bg-neutral-900/80 backdrop-blur">
                        <h3 className="text-xl font-black text-white tracking-wide flex items-center gap-2">STRATBOOK {viewingStrat && <span className="text-red-500 text-xs bg-red-950/50 px-2 py-1 rounded border border-red-900/50">VIEWING MODE</span>}</h3>
                        <div className="flex gap-3 items-center">
                            {!viewingStrat ? (<><button onClick={() => setColor('#ef4444')} className={`w-6 h-6 rounded-full bg-red-500 border-2 ${color === '#ef4444' ? 'border-white scale-110' : 'border-transparent'}`}></button><button onClick={() => setColor('#3b82f6')} className={`w-6 h-6 rounded-full bg-blue-500 border-2 ${color === '#3b82f6' ? 'border-white scale-110' : 'border-transparent'}`}></button><button onClick={() => setColor('#ffffff')} className={`w-6 h-6 rounded-full bg-white border-2 ${color === '#ffffff' ? 'border-black scale-110' : 'border-transparent'}`}></button><div className="h-6 w-px bg-white/10 mx-2"></div><ButtonSecondary onClick={clearCanvas} className="text-[10px] py-1.5 px-4">Clear All</ButtonSecondary><ButtonPrimary onClick={saveStrat} className="text-[10px] py-1.5 px-4">Save Snapshot</ButtonPrimary></>) : <ButtonSecondary onClick={() => setViewingStrat(null)} className="text-xs bg-red-900/50 border-red-500 text-white">Exit View Mode</ButtonSecondary>}
                        </div>
                    </div>

                    {/* Map Tabs */}
                    <div className="flex overflow-x-auto gap-2 px-4 py-3 bg-black/40 border-b border-white/5 scrollbar-hide">{MAPS.map(m => <button key={m} onClick={() => { setSelectedMap(m); clearCanvas(); setViewingStrat(null); }} className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${selectedMap === m ? 'bg-red-600 text-white shadow-lg shadow-red-900/40' : 'bg-neutral-900 text-neutral-500 hover:text-white'}`}>{m}</button>)}</div>

                    {/* Drawing Area */}
                    <div ref={containerRef} className="relative flex-1 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-neutral-950" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
                        {/* Grid Pattern */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

                        {mapImages[selectedMap] && <img src={mapImages[selectedMap]} alt="Map" className="absolute inset-0 w-full h-full object-contain opacity-90 pointer-events-none" />}
                        {!viewingStrat && mapIcons.map((icon, i) => (
                            <div key={icon.id} className="absolute cursor-move hover:scale-110 transition-transform z-20 drop-shadow-2xl" style={{ left: `${icon.x}%`, top: `${icon.y}%`, transform: 'translate(-50%, -50%)' }} draggable onDragStart={(e) => { e.stopPropagation(); setMovingIcon(i); }} onDoubleClick={(e) => { e.stopPropagation(); const u = [...mapIcons]; u.splice(i, 1); setMapIcons(u); }}>
                                {icon.type === 'agent' ? <img src={agentImages[icon.name]} alt={icon.name} className="w-12 h-12 rounded-full border-2 border-white shadow-lg pointer-events-none" /> : <div className="w-8 h-8 rounded-full shadow-lg border-2 border-white" style={{ backgroundColor: icon.color }}></div>}
                            </div>
                        ))}
                        <canvas ref={canvasRef} width={1280} height={720} className={`absolute inset-0 w-full h-full z-10 touch-none ${viewingStrat ? 'hidden' : 'cursor-crosshair'}`} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                        {viewingStrat && <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-sm flex items-center justify-center p-10"><img src={viewingStrat} alt="Saved Strat" className="max-w-full max-h-full rounded-xl border-2 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.3)]" /></div>}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h4 className="text-sm font-black text-neutral-400 mb-4 uppercase tracking-widest">External Resources</h4>
                    <div className="flex gap-2 mb-4"><Input placeholder="Title" value={newLink.title} onChange={e => setNewLink({ ...newLink, title: e.target.value })} className="flex-1" /><Input placeholder="URL" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} className="flex-1" /><ButtonPrimary onClick={addLink} className="text-[10px] py-3 px-4">Add</ButtonPrimary></div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">{links.map(l => <div key={l.id} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 hover:border-red-500/50 transition-colors"><a href={l.url} target="_blank" rel="noreferrer" className="text-red-400 font-bold hover:text-white hover:underline text-sm transition-colors">{l.title}</a><button onClick={() => deleteLink(l.id)} className="text-neutral-600 hover:text-red-500 text-lg font-bold px-2">×</button></div>)}</div>
                </Card>
                <Card>
                    <h4 className="text-sm font-black text-neutral-400 mb-4 uppercase tracking-widest">Saved Blueprints</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">{savedStrats.length === 0 && <p className="text-neutral-600 italic text-sm p-4 text-center">No saved strats for this map.</p>}{savedStrats.map((s, i) => <div key={s.id} onClick={() => setViewingStrat(s.image)} className="flex justify-between items-center bg-black/40 p-3 rounded-xl border border-white/5 hover:border-red-500 cursor-pointer group transition-all hover:bg-red-950/10"><span className="text-xs text-neutral-300 font-mono group-hover:text-white"><span className="text-red-600 font-bold mr-2">#{savedStrats.length - i}</span> {new Date(s.date).toLocaleDateString()}</span><button onClick={(e) => { e.stopPropagation(); deleteStrat(s.id) }} className="text-neutral-600 hover:text-red-500 font-bold text-[10px] border border-transparent hover:border-red-900 px-2 py-1 rounded transition-all">DELETE</button></div>)}</div>
                </Card>
            </div>
        </div>
    );
}

function MatchHistory() {
    const [matches, setMatches] = useState([]); const [isAdding, setIsAdding] = useState(false); const [expandedId, setExpandedId] = useState(null); const [editingId, setEditingId] = useState(null); const [editForm, setEditForm] = useState({}); const [newMatch, setNewMatch] = useState({ opponent: '', date: '', myScore: '', enemyScore: '', atkScore: '', defScore: '', map: MAPS[0], vod: '' });
    useEffect(() => { const unsub = onSnapshot(collection(db, 'events'), (snap) => { const evs = []; snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() })); setMatches(evs.filter(e => e.result).sort((a, b) => new Date(b.date) - new Date(a.date))); }); return () => unsub(); }, []);
    const handleAdd = async () => { await addDoc(collection(db, 'events'), { type: 'Scrim', opponent: newMatch.opponent, date: newMatch.date, result: { ...newMatch } }); setIsAdding(false); setNewMatch({ opponent: '', date: '', myScore: '', enemyScore: '', atkScore: '', defScore: '', map: MAPS[0], vod: '' }); };
    const startEdit = (m) => { setEditingId(m.id); setEditForm({ opponent: m.opponent, date: m.date, ...m.result }); };
    const saveEdit = async () => { const { opponent, date, ...resultData } = editForm; await updateDoc(doc(db, 'events', editingId), { opponent, date, result: resultData }); setEditingId(null); };
    const getResultColor = (my, enemy) => { const m = parseInt(my); const e = parseInt(enemy); if (m > e) return 'border-l-4 border-l-green-500 bg-green-900/10'; if (m < e) return 'border-l-4 border-l-red-600 bg-red-900/10'; return 'border-l-4 border-l-neutral-500'; };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white flex items-center gap-3"><span className="text-red-600">MATCH</span> HISTORY</h3><ButtonSecondary onClick={() => setIsAdding(!isAdding)} className="text-xs">{isAdding ? 'Cancel' : '+ Log Match'}</ButtonSecondary></div>
            {isAdding && (<div className="mb-6 bg-black/50 p-6 rounded-2xl border border-white/10 space-y-4 animate-fade-in shadow-inner"><div className="grid grid-cols-2 gap-4"><Input placeholder="Opponent Name" value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} /><Input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="[color-scheme:dark]" /></div><div className="grid grid-cols-2 gap-4"><Select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value })}>{MAPS.map(m => <option key={m}>{m}</option>)}</Select><Input placeholder="VOD Link" value={newMatch.vod} onChange={e => setNewMatch({ ...newMatch, vod: e.target.value })} /></div><div className="grid grid-cols-4 gap-4"><Input placeholder="Us" value={newMatch.myScore} onChange={e => setNewMatch({ ...newMatch, myScore: e.target.value })} /><Input placeholder="Them" value={newMatch.enemyScore} onChange={e => setNewMatch({ ...newMatch, enemyScore: e.target.value })} /><Input placeholder="Atk Wins" value={newMatch.atkScore} onChange={e => setNewMatch({ ...newMatch, atkScore: e.target.value })} /><Input placeholder="Def Wins" value={newMatch.defScore} onChange={e => setNewMatch({ ...newMatch, defScore: e.target.value })} /></div><ButtonPrimary onClick={handleAdd} className="w-full py-3 text-xs">Save Match Result</ButtonPrimary></div>)}
            <div className="space-y-4">
                {matches.map(m => {
                    if (editingId === m.id) return (<div key={m.id} className="bg-neutral-950 border border-red-600/50 p-6 rounded-2xl space-y-4 shadow-[0_0_30px_rgba(220,38,38,0.1)]"><div className="flex justify-between mb-2"><span className="text-red-500 font-bold text-xs uppercase tracking-widest">Editing Match Log</span><button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-white text-xs uppercase font-bold">Cancel</button></div><div className="grid grid-cols-2 gap-4"><Input value={editForm.opponent} onChange={e => setEditForm({ ...editForm, opponent: e.target.value })} /><Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="[color-scheme:dark]" /></div><div className="grid grid-cols-2 gap-4"><Select value={editForm.map} onChange={e => setEditForm({ ...editForm, map: e.target.value })}>{MAPS.map(map => <option key={map}>{map}</option>)}</Select><Input placeholder="VOD Link" value={editForm.vod} onChange={e => setEditForm({ ...editForm, vod: e.target.value })} /></div><div className="grid grid-cols-4 gap-4"><Input placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} /><Input placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} /><Input placeholder="Atk" value={editForm.atkScore} onChange={e => setEditForm({ ...editForm, atkScore: e.target.value })} /><Input placeholder="Def" value={editForm.defScore} onChange={e => setEditForm({ ...editForm, defScore: e.target.value })} /></div><ButtonPrimary onClick={saveEdit} className="w-full py-3 text-xs">Save Changes</ButtonPrimary></div>);
                    return (<div key={m.id} onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className={`bg-black/40 border border-white/5 p-5 rounded-2xl relative overflow-hidden cursor-pointer hover:bg-neutral-900/80 transition-all group ${m.result ? getResultColor(m.result.myScore, m.result.enemyScore) : ''}`}>{expandedId === m.id && (parseInt(m.result.myScore) > parseInt(m.result.enemyScore) ? <VictoryStamp /> : <DefeatStamp />)}<div className="flex justify-between items-center relative z-10"><div><div className="text-lg font-black text-white flex items-center gap-3 uppercase tracking-tight">{m.opponent} {m.result.vod && <a href={m.result.vod} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-red-600 text-white px-3 py-1 rounded-full hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all transform hover:scale-105">▶ WATCH VOD</a>}</div><div className="text-xs text-neutral-500 font-mono mt-1">{m.date} • {m.result.map}</div></div><div className="flex items-center gap-6"><div className={`text-3xl font-black italic tracking-tighter ${parseInt(m.result.myScore) > parseInt(m.result.enemyScore) ? 'text-green-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'text-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]'}`}>{m.result.myScore} - {m.result.enemyScore}</div><button onClick={(e) => { e.stopPropagation(); startEdit(m); }} className="text-neutral-600 hover:text-white p-2 rounded-full hover:bg-white/5 transition-colors">✏️</button></div></div>{expandedId === m.id && (<div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-6 text-center animate-slide-down"><div className="bg-neutral-950/50 p-3 rounded-xl border border-white/5"><div className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mb-1">Attack</div><div className="text-2xl text-white font-black">{m.result.atkScore || '-'}</div></div><div className="bg-neutral-950/50 p-3 rounded-xl border border-white/5"><div className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mb-1">Defense</div><div className="text-2xl text-white font-black">{m.result.defScore || '-'}</div></div></div>)}</div>);
                })}
            </div>
        </Card>
    );
}

function AdminPanel() {
    const [applications, setApplications] = useState([]);
    useEffect(() => { const unsub = onSnapshot(collection(db, 'applications'), (snap) => { const apps = []; snap.forEach(doc => apps.push({ id: doc.id, ...doc.data() })); setApplications(apps); }); return () => unsub(); }, []);
    const acceptApplicant = async (app) => { await setDoc(doc(db, 'roster', app.user), { rank: app.rank, role: 'Tryout', notes: `Tracker: ${app.tracker}\nWhy: ${app.why}`, joinedAt: new Date().toISOString() }); await deleteDoc(doc(db, 'applications', app.id)); };
    const rejectApplicant = async (id) => { await deleteDoc(doc(db, 'applications', id)); };
    return (<Card><h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3"><span className="text-red-600">ADMIN</span> DASHBOARD</h2><div className="space-y-6">{applications.length === 0 ? <p className="text-neutral-600 italic">No pending applications.</p> : (<div className="grid grid-cols-1 gap-4">{applications.map(app => (<div key={app.id} className="bg-black border border-neutral-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6"><div className="space-y-2 flex-1"><div className="flex items-center gap-3"><h4 className="text-xl font-black text-white">{app.user}</h4><span className="bg-neutral-900 text-neutral-400 text-xs px-2 py-1 rounded font-bold uppercase border border-neutral-800">{app.rank}</span><span className="bg-neutral-900 text-neutral-400 text-xs px-2 py-1 rounded font-bold uppercase border border-neutral-800">{app.role}</span></div><p className="text-neutral-400 text-sm"><strong className="text-neutral-500">Experience:</strong> {app.exp}</p><p className="text-neutral-300 text-sm italic">"{app.why}"</p><a href={app.tracker} target="_blank" rel="noreferrer" className="text-red-500 text-xs font-bold hover:underline block mt-2">View Tracker Profile &rarr;</a></div><div className="flex flex-row md:flex-col gap-3 justify-center"><button onClick={() => acceptApplicant(app)} className="bg-green-900/20 hover:bg-green-600 border border-green-900 text-green-500 hover:text-white font-bold px-6 py-3 rounded-xl transition-all">ACCEPT</button><button onClick={() => rejectApplicant(app.id)} className="bg-red-900/20 hover:bg-red-900 text-red-500 hover:text-white font-bold px-6 py-3 rounded-xl transition-all border border-red-900">REJECT</button></div></div>))}</div>)}</div></Card>);
}

function ProfileModal({ isOpen, onClose, currentUser }) {
    const [rank, setRank] = useState("Unranked"); const [agents, setAgents] = useState(""); const [status, setStatus] = useState("idle");
    const handleSave = async () => { setStatus("saving"); try { await setDoc(doc(db, 'roster', currentUser.displayName), { rank, agents }, { merge: true }); setStatus("success"); setTimeout(() => { setStatus("idle"); onClose(); }, 1000); } catch (e) { console.error(e); setStatus("idle"); } };
    if (!isOpen) return null;
    return (<div className="fixed inset-0 bg-black/90 z-[100] flex justify-center items-center backdrop-blur-md p-4"><div className="bg-neutral-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/10 animate-fade-in-up"><h3 className="text-2xl font-black text-white mb-6">Edit Profile</h3><div className="space-y-4"><div><label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Current Rank</label><Select value={rank} onChange={e => setRank(e.target.value)}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</Select></div><div><label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Main Agents</label><Input type="text" value={agents} onChange={e => setAgents(e.target.value)} placeholder="Jett, Raze, Omen..." /></div></div><div className="mt-6 flex justify-end gap-3"><ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary><ButtonPrimary onClick={handleSave}>{status === 'saving' ? 'Saving...' : 'Save Profile'}</ButtonPrimary></div></div></div>);
}

function ApplicationForm({ currentUser }) {
    const [form, setForm] = useState({ tracker: '', rank: 'Unranked', role: 'Flex', exp: '', why: '' });
    const [status, setStatus] = useState('idle');
    const submitApp = async () => { if (!form.tracker || !form.why) return; setStatus('saving'); const appData = { ...form, user: currentUser.displayName, uid: currentUser.uid, submittedAt: new Date().toISOString() }; await addDoc(collection(db, 'applications'), appData); const content = { embeds: [{ title: `New App: ${currentUser.displayName}`, color: 16776960, fields: [{ name: 'Rank', value: form.rank }, { name: 'Role', value: form.role }, { name: 'Tracker', value: form.tracker }] }] }; try { await fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) }); } catch (e) { } setStatus('success'); };
    if (status === 'success') return <div className="h-full flex items-center justify-center text-white font-black text-2xl">Application Sent.</div>;
    return (<div className="bg-neutral-900 p-8 rounded-3xl border border-white/10 max-w-3xl mx-auto"><h2 className="text-3xl font-black text-white mb-4">Apply</h2><div className="space-y-4"><Input value={form.tracker} onChange={e => setForm({ ...form, tracker: e.target.value })} placeholder="Tracker URL" /><Select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</Select><Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</Select><textarea className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-white" value={form.why} onChange={e => setForm({ ...form, why: e.target.value })} placeholder="Why join?" /><ButtonPrimary onClick={submitApp} disabled={status !== 'idle'}>Submit</ButtonPrimary></div></div>);
}

function MapVeto() {
    const [vetoState, setVetoState] = useState({}); useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'map_veto'), (snap) => { if (snap.exists()) setVetoState(snap.data()); }); return () => unsub(); }, []);
    const toggleMap = async (map) => { const current = vetoState[map] || 'neutral'; const next = current === 'neutral' ? 'ban' : current === 'ban' ? 'pick' : 'neutral'; await setDoc(doc(db, 'general', 'map_veto'), { ...vetoState, [map]: next }); };
    const resetVeto = async () => { await setDoc(doc(db, 'general', 'map_veto'), {}); };
    return (<Card className="h-full"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white">MAP VETO</h3><ButtonSecondary onClick={resetVeto} className="text-xs px-3 py-1">Reset Board</ButtonSecondary></div><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{MAPS.map(map => { const status = vetoState[map] || 'neutral'; return (<div key={map} onClick={() => toggleMap(map)} className={`aspect-video rounded-xl border-2 cursor-pointer flex items-center justify-center relative group overflow-hidden transition-all duration-500 ${status === 'neutral' ? 'border-neutral-800 bg-black/50 hover:border-neutral-600' : ''} ${status === 'ban' ? 'border-red-600 bg-red-900/20 shadow-[0_0_20px_rgba(220,38,38,0.2)] grayscale' : ''} ${status === 'pick' ? 'border-green-500 bg-green-900/20 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : ''}`}><span className="font-black uppercase text-white text-xl z-10 drop-shadow-lg">{map}</span><div className={`absolute inset-0 opacity-20 ${status === 'ban' ? 'bg-red-600' : status === 'pick' ? 'bg-green-600' : 'bg-transparent'}`}></div><div className="absolute bottom-2 text-[10px] font-bold px-2 py-1 bg-black/50 backdrop-blur rounded">{status.toUpperCase()}</div></div>); })}</div></Card>);
}

function CaptainsMessage() {
    const [message, setMessage] = useState({ text: "Welcome", updatedBy: "System" }); const [isEditing, setIsEditing] = useState(false); const [draft, setDraft] = useState(""); const auth = getAuth();
    useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'captain_message'), (s) => { if (s.exists()) setMessage(s.data()); }); return () => unsub(); }, []);
    const handleSave = async () => { await setDoc(doc(db, 'general', 'captain_message'), { text: draft, updatedBy: auth.currentUser.displayName }); setIsEditing(false); };
    return (<div className="bg-gradient-to-br from-red-950/50 to-black p-8 rounded-[2rem] border border-red-900/50 shadow-2xl shadow-red-900/10 relative overflow-hidden group"><div className="absolute -right-10 -top-10 w-64 h-64 bg-red-600/10 rounded-full blur-[80px] pointer-events-none animate-pulse-slow"></div><div className="flex justify-between items-center mb-4 relative z-10"><h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2"><span className="text-2xl">📢</span> Captain's Message</h2>{!isEditing && <button onClick={() => { setDraft(message.text); setIsEditing(true) }} className="text-xs text-neutral-400 hover:text-white transition-colors">Edit</button>}</div>{isEditing ? <div className="relative z-10"><textarea value={draft} onChange={e => setDraft(e.target.value)} className="w-full bg-black/50 border border-red-900/30 rounded-xl p-4 text-white mb-4 focus:border-red-600 outline-none transition-all" /><div className="flex justify-end gap-2"><ButtonSecondary onClick={() => setIsEditing(false)} className="text-xs">Cancel</ButtonSecondary><ButtonPrimary onClick={handleSave} className="text-xs px-6 py-2">Post Update</ButtonPrimary></div></div> : <p className="text-slate-200 text-sm leading-loose whitespace-pre-wrap font-medium relative z-10">"{message.text}"</p>}</div>);
}

function PerformanceWidget({ events }) {
    const stats = useMemo(() => {
        let wins = 0, losses = 0; let atkWins = 0, atkPlayed = 0, defWins = 0, defPlayed = 0; const mapStats = {};
        events.filter(e => e.result && e.result.myScore).forEach(m => {
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
        return { wins, losses, overallWinRate, bestMap, atkWinRate, defWinRate };
    }, [events]);
    return (<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><Card className="!p-5 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Win Rate</div><div className="text-4xl font-black text-white my-2 drop-shadow-lg">{stats.overallWinRate}%</div><div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_10px_red]" style={{ width: `${stats.overallWinRate}%` }}></div></div></Card><Card className="!p-5 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Record</div><div className="text-3xl font-black text-white flex items-baseline gap-1"><span className="text-green-500">{stats.wins}</span><span className="text-neutral-700">-</span><span className="text-red-500">{stats.losses}</span></div></Card><Card className="!p-5 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">ATK / DEF</div><div className="flex gap-4 text-xs font-bold text-white"><div><span className="text-red-500 mr-1">⚔️</span> {stats.atkWinRate}%</div><div><span className="text-blue-500 mr-1">🛡️</span> {stats.defWinRate}%</div></div></Card><Card className="!p-5 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Best Map</div><div className="text-2xl font-black text-white truncate">{stats.bestMap}</div></Card></div>);
}

function RosterManager({ members }) {
    const [rosterData, setRosterData] = useState({}); const [mode, setMode] = useState('edit'); const [compare1, setCompare1] = useState(''); const [compare2, setCompare2] = useState(''); const [selectedMember, setSelectedMember] = useState(null); const [role, setRole] = useState('Tryout'); const [gameId, setGameId] = useState(''); const [notes, setNotes] = useState('');
    useEffect(() => { const unsub = onSnapshot(collection(db, 'roster'), (snap) => { const data = {}; snap.forEach(doc => data[doc.id] = doc.data()); setRosterData(data); }); return () => unsub(); }, []);
    const handleSave = async () => { if (!selectedMember) return; await setDoc(doc(db, 'roster', selectedMember), { role, notes, gameId }, { merge: true }); };
    return (
        <div className="h-full flex flex-col gap-6"><div className="flex gap-6 border-b border-white/5 pb-4"><button onClick={() => setMode('edit')} className={`text-sm font-black uppercase tracking-widest transition-colors ${mode === 'edit' ? 'text-red-500 drop-shadow-[0_0_5px_red]' : 'text-neutral-600 hover:text-white'}`}>Edit Mode</button><button onClick={() => setMode('compare')} className={`text-sm font-black uppercase tracking-widest transition-colors ${mode === 'compare' ? 'text-red-500 drop-shadow-[0_0_5px_red]' : 'text-neutral-600 hover:text-white'}`}>Compare Players</button></div>
            {mode === 'edit' ? (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full"><div className="lg:col-span-1 bg-neutral-900/60 backdrop-blur-md p-6 rounded-[2rem] border border-white/5"><h3 className="text-white font-bold mb-6 text-xl">Members</h3><div className="space-y-2 overflow-y-auto h-[500px] custom-scrollbar">{members.map(m => (<div key={m} onClick={() => { setSelectedMember(m); setRole(rosterData[m]?.role || 'Tryout'); setNotes(rosterData[m]?.notes || ''); setGameId(rosterData[m]?.gameId || ''); }} className={`p-4 rounded-2xl cursor-pointer border transition-all flex justify-between items-center group ${selectedMember === m ? 'bg-red-600/10 border-red-600/50 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-black/40 border-white/5 hover:bg-white/5 hover:border-white/10'}`}><span className="text-white font-bold group-hover:text-red-400 transition-colors">{m}</span><span className="text-[10px] text-neutral-500 uppercase font-bold bg-black/30 px-2 py-1 rounded">{rosterData[m]?.role}</span></div>))}</div></div><Card className="lg:col-span-2">{selectedMember ? (<div className="space-y-8"><h3 className="text-4xl font-black text-white uppercase tracking-tighter">Managing: <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-800">{selectedMember}</span></h3><div className="grid grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Role</label><Select value={role} onChange={e => setRole(e.target.value)}>{['Captain', 'Main', 'Sub', 'Tryout'].map(r => <option key={r}>{r}</option>)}</Select></div><div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Riot ID</label><Input value={gameId} onChange={e => setGameId(e.target.value)} /></div></div><div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Performance Notes</label><textarea className="w-full h-48 bg-black/50 border border-neutral-800 rounded-2xl p-4 text-white text-sm outline-none focus:border-red-600 resize-none shadow-inner" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Enter gameplay analysis..." /></div><ButtonPrimary onClick={handleSave} className="w-full py-4">Save Changes</ButtonPrimary></div>) : <div className="h-full flex flex-col items-center justify-center text-neutral-600 gap-4"><div className="text-6xl opacity-20">🛡️</div><p className="text-xl font-bold uppercase tracking-widest">Select a player to manage</p></div>}</Card></div>) : (<div className="grid grid-cols-2 gap-8 h-full">{[setCompare1, setCompare2].map((setter, i) => (<Card key={i} className="h-full"><Select onChange={e => setter(e.target.value)} className="mb-8"><option>Select Player</option>{members.map(m => <option key={m}>{m}</option>)}</Select>{((i === 0 ? compare1 : compare2) && rosterData[i === 0 ? compare1 : compare2]) && (<div className="space-y-6 text-center animate-fade-in-up"><div className="w-32 h-32 mx-auto bg-gradient-to-br from-red-600 to-black rounded-full flex items-center justify-center text-5xl font-black text-white border-4 border-neutral-900 shadow-2xl shadow-red-900/50">{(i === 0 ? compare1 : compare2)[0]}</div><div className="text-4xl font-black text-white uppercase tracking-tighter">{(i === 0 ? compare1 : compare2)}</div><div className="flex justify-center gap-3"><span className="bg-neutral-950 border border-neutral-800 px-4 py-1.5 rounded-full text-xs font-bold text-white uppercase tracking-wider shadow-lg">{rosterData[i === 0 ? compare1 : compare2]?.rank || 'Unranked'}</span><span className="bg-red-950/50 border border-red-900 px-4 py-1.5 rounded-full text-xs font-bold text-red-400 uppercase tracking-wider shadow-lg shadow-red-900/20">{rosterData[i === 0 ? compare1 : compare2]?.role || 'Member'}</span></div><div className="p-6 bg-black/40 rounded-2xl border border-white/5 text-left relative overflow-hidden"><div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div><div className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mb-3">Performance Notes</div><p className="text-sm text-neutral-300 italic leading-relaxed">"{rosterData[i === 0 ? compare1 : compare2]?.notes || 'No notes available.'}"</p></div></div>)}</Card>))}</div>)}
        </div>
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

function ScrimScheduler({ onSchedule, userTimezone }) {
    const [form, setForm] = useState({ type: 'Scrim', date: '', time: '', opponent: '' });
    const submit = async () => { await onSchedule({ ...form, timezone: userTimezone }); setForm({ ...form, opponent: '' }); };
    return (<div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-red-500 block mb-2 uppercase tracking-widest">TYPE</label><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Scrim</option><option>Tournament</option><option>Practice</option><option>VOD Review</option></Select></div><div><label className="text-[10px] font-black text-red-500 block mb-2 uppercase tracking-widest">OPPONENT</label><Input value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-red-500 block mb-2 uppercase tracking-widest">DATE</label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="[color-scheme:dark]" /></div><div><label className="text-[10px] font-black text-red-500 block mb-2 uppercase tracking-widest">TIME</label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="[color-scheme:dark]" /></div></div><ButtonPrimary onClick={submit} className="w-full py-4 mt-2">SCHEDULE EVENT</ButtonPrimary></div>);
}

function AvailabilityHeatmap({ availabilities, members }) {
    const bucketSize = 60; const numBuckets = (24 * 60) / bucketSize;
    const data = useMemo(() => { const d = {}; for (const day of DAYS) { const b = new Array(numBuckets).fill(0); members.forEach(m => { (availabilities[m] || []).filter(s => s.day === day).forEach(s => { const start = Math.floor(timeToMinutes(s.start) / bucketSize); const end = Math.ceil(timeToMinutes(s.end) / bucketSize); for (let i = start; i < end && i < numBuckets; i++) b[i]++; }); }); d[day] = b; } return d; }, [availabilities, members]);
    return (<div className="overflow-x-auto rounded-xl border border-white/5 bg-black/50 shadow-inner"><div className="min-w-[600px]"><div className="flex border-b border-white/5"><div className="w-24 bg-black/50 backdrop-blur sticky left-0 p-3 text-[10px] font-black text-red-500 border-r border-white/5">DAY</div>{Array.from({ length: 24 }).map((_, i) => <div key={i} className="flex-1 text-[10px] text-center text-neutral-600 py-2 border-l border-white/5 font-mono">{i}</div>)}</div>{DAYS.map(day => <div key={day} className="flex border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"><div className="w-24 bg-black/50 backdrop-blur sticky left-0 p-3 text-[10px] font-bold text-neutral-400 border-r border-white/5 uppercase tracking-wider">{day.substring(0, 3)}</div>{data[day]?.map((c, i) => <div key={i} className="flex-1 h-10 border-l border-white/5 relative group" style={{ backgroundColor: c > 0 ? `rgba(220, 38, 38, ${(c / members.length)})` : 'transparent' }}>{c > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">{c}</span>}</div>)}</div>)}</div></div>);
}

function LoginScreen({ signIn }) {
    return (
        <div className="fixed inset-0 h-full w-full bg-black flex items-center justify-center p-4 overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black animate-pulse-slow"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>

            <div className="relative z-10 text-center p-16 rounded-[3rem] border border-white/10 bg-neutral-900/60 backdrop-blur-2xl shadow-2xl shadow-red-900/30 max-w-lg w-full">
                <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] mb-2">SYRIX</h1>
                <div className="h-1 w-32 bg-gradient-to-r from-transparent via-red-600 to-transparent mx-auto rounded-full shadow-[0_0_20px_red] mb-8"></div>
                <p className="text-neutral-400 text-sm font-bold uppercase tracking-[0.4em] mb-10">Elite Team Command Center</p>
                <button onClick={signIn} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(88,101,242,0.4)] hover:shadow-[0_0_30px_rgba(88,101,242,0.6)] transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 text-sm">
                    Authenticate with Discord
                </button>
            </div>
        </div>
    );
}

// --- MAIN APP ---
export default function App() {
    const [currentUser, setCurrentUser] = useState(null); const [activeTab, setActiveTab] = useState('dashboard'); const [availabilities, setAvailabilities] = useState({}); const [events, setEvents] = useState([]); const [day, setDay] = useState(DAYS[0]); const [start, setStart] = useState('12:00'); const [end, setEnd] = useState('23:30'); const [role, setRole] = useState('Flex'); const [saveStatus, setSaveStatus] = useState('idle'); const [userTimezone, setUserTimezone] = useState(localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone); const [authLoading, setAuthLoading] = useState(true); const [isModalOpen, setIsModalOpen] = useState(false); const [modalContent, setModalContent] = useState({ title: '', children: null }); const [isMember, setIsMember] = useState(false);
    useEffect(() => { return onAuthStateChanged(auth, user => { setCurrentUser(user); setAuthLoading(false); }); }, []);
    const signIn = async () => { try { await signInWithPopup(auth, new OAuthProvider('oidc.discord')); } catch (e) { console.error(e); } };
    const handleSignOut = async () => await signOut(auth);
    useEffect(() => { if (!currentUser) return; const unsub1 = onSnapshot(doc(db, 'roster', currentUser.displayName), (s) => setIsMember((s.exists() && s.data().role) || ADMINS.includes(currentUser.displayName))); const unsub2 = onSnapshot(collection(db, 'availabilities'), (s) => { const d = {}; s.forEach(doc => d[doc.id] = doc.data().slots || []); setAvailabilities(d); }); const unsub3 = onSnapshot(collection(db, 'events'), (s) => { const e = []; s.forEach(d => e.push({ id: d.id, ...d.data() })); setEvents(e.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time))); }); return () => { unsub1(); unsub2(); unsub3(); }; }, [currentUser]);
    useEffect(() => { document.documentElement.classList.add('dark'); }, []);
    const dynamicMembers = useMemo(() => [...new Set(Object.keys(availabilities))].sort(), [availabilities]);
    const displayAvail = useMemo(() => { const c = {}; for (const m in availabilities) { c[m] = []; availabilities[m].forEach(s => { const ls = convertFromGMT(s.day, s.start, userTimezone); const le = convertFromGMT(s.day, s.end, userTimezone); if (ls.day === le.day) { if (timeToMinutes(ls.time) < timeToMinutes(le.time)) c[m].push({ day: ls.day, start: ls.time, end: le.time, role: s.role }); } else { c[m].push({ day: ls.day, start: ls.time, end: '24:00', role: s.role }); if (timeToMinutes(le.time) > 0) c[m].push({ day: le.day, start: '00:00', end: le.time, role: s.role }); } }); } return c; }, [availabilities, userTimezone]);
    const openModal = (t, c, f) => { setModalContent({ title: t, children: c, onConfirm: f }); setIsModalOpen(true); };
    const saveAvail = async () => { if (timeToMinutes(end) <= timeToMinutes(start)) return openModal('Error', 'Invalid time.', () => setIsModalOpen(false)); setSaveStatus('saving'); const gs = convertToGMT(day, start); const ge = convertToGMT(day, end); const old = availabilities[currentUser.displayName] || []; const others = old.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day); await setDoc(doc(db, 'availabilities', currentUser.displayName), { slots: [...others, { day: gs.day, start: gs.time, end: ge.time, role }] }); setSaveStatus('idle'); };
    const clearDay = async () => { const old = availabilities[currentUser.displayName] || []; await setDoc(doc(db, 'availabilities', currentUser.displayName), { slots: old.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day) }); setIsModalOpen(false); };
    const schedEvent = async (d) => { await addDoc(collection(db, 'events'), d); try { await fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [{ title: `New Event: ${d.type}`, description: `vs ${d.opponent} on ${d.date} @ ${d.time}` }] }) }); } catch (e) { } };
    const deleteEvent = async (id) => { await deleteDoc(doc(db, 'events', id)); setIsModalOpen(false); };

    if (authLoading) return <div className="fixed inset-0 bg-black flex items-center justify-center text-red-600 font-black text-2xl animate-pulse">LOADING SYRIX...</div>;
    if (!currentUser) return <LoginScreen signIn={signIn} />;
    if (!isMember) return <div className="fixed inset-0 bg-black p-8 overflow-y-auto"><ApplicationForm currentUser={currentUser} /></div>;

    const NavBtn = ({ id, label }) => <button onClick={() => setActiveTab(id)} className={`text-[10px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all duration-300 ${activeTab === id ? 'text-red-500 border-red-500 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)] scale-105' : 'text-neutral-500 border-transparent hover:text-white hover:border-white/20'}`}>{label}</button>;

    return (
        <div className="fixed inset-0 h-full w-full bg-black text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden">
            {/* BACKGROUND FOG */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none z-0"></div>
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black animate-pulse-slow z-0"></div>

            {/* HEADER */}
            <header className="flex-none flex justify-between items-center px-8 py-5 border-b border-white/5 bg-black/60 backdrop-blur-xl z-40 relative">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-neutral-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">SYRIX <span className="text-red-600 drop-shadow-[0_0_15px_red]">HUB</span></h1>
                    <div className="flex gap-8 mt-3 overflow-x-auto pb-1 scrollbar-hide"><NavBtn id="dashboard" label="Dashboard" /><NavBtn id="comps" label="Comps" /><NavBtn id="matches" label="Matches" /><NavBtn id="strats" label="Stratbook" /><NavBtn id="roster" label="Roster" /><NavBtn id="partners" label="Partners" /><NavBtn id="mapveto" label="Map Veto" />{ADMINS.includes(currentUser.displayName) && <NavBtn id="admin" label="Admin" />}</div>
                </div>
                <div className="flex items-center gap-5 bg-neutral-900/40 p-2 pr-6 rounded-full border border-white/5 backdrop-blur-md shadow-lg">
                    <img src={getAvatar()} onClick={() => setIsProfileOpen(true)} onError={(e) => { e.target.onerror = null; e.target.src = "https://cdn.discordapp.com/embed/avatars/1.png"; }} className="w-10 h-10 rounded-full border-2 border-red-600 shadow-[0_0_15px_red] cursor-pointer hover:scale-110 transition-transform" alt="Profile" />
                    <div className="text-right"><div className="text-sm font-bold text-white cursor-pointer hover:text-red-400 transition-colors" onClick={() => setIsProfileOpen(true)}>{currentUser.displayName}</div><button onClick={handleSignOut} className="text-[9px] text-neutral-500 hover:text-red-500 font-black uppercase tracking-widest transition-colors">Log Out</button></div>
                    <div className="h-8 w-px bg-white/10 mx-2"></div>
                    <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); localStorage.setItem('timezone', e.target.value) }} className="bg-transparent text-[10px] font-bold text-neutral-400 outline-none uppercase tracking-widest cursor-pointer hover:text-white transition-colors text-right">{timezones.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}</select>
                </div>
            </header>

            {/* CONTENT */}
            <main className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black relative z-10">
                <div className="max-w-[1920px] mx-auto">
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
                            <div className="lg:col-span-4 space-y-8">
                                <CaptainsMessage />
                                <LeaveLogger members={dynamicMembers} />
                                <Card>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600 shadow-[0_0_20px_red]"></div>
                                    <h2 className="text-xl font-black text-white mb-6 uppercase tracking-wide flex items-center gap-3"><span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span> Set Availability</h2>
                                    <div className="space-y-5">
                                        <div><label className="text-[10px] font-black text-neutral-500 uppercase mb-2 block tracking-widest">Select Day</label><Select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</Select></div>
                                        <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-neutral-500 uppercase mb-2 block tracking-widest">Start Time</label><Input type="time" value={start} onChange={e => setStart(e.target.value)} className="[color-scheme:dark]" /></div><div><label className="text-[10px] font-black text-neutral-500 uppercase mb-2 block tracking-widest">End Time</label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="[color-scheme:dark]" /></div></div>
                                        <div><label className="text-[10px] font-black text-neutral-500 uppercase mb-2 block tracking-widest">Preferred Role</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{ROLES.map(r => (<button key={r} onClick={() => setRole(r)} className={`px-4 py-2 rounded-lg text-[10px] font-bold border transition-all whitespace-nowrap flex items-center gap-2 uppercase tracking-wider ${role === r ? 'bg-red-600 text-white border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-black/40 border-white/5 text-neutral-500 hover:text-white hover:bg-neutral-800'}`}>{RoleIcons[r] || RoleIcons.Unknown}{r}</button>))}</div></div>
                                        <div className="pt-4 flex gap-3"><ButtonPrimary onClick={saveAvail} disabled={saveStatus !== 'idle'} className="flex-1">{saveStatus === 'idle' ? 'CONFIRM SLOT' : 'SAVED!'}</ButtonPrimary><ButtonSecondary onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)}>CLEAR DAY</ButtonSecondary></div>
                                    </div>
                                </Card>
                                <Card>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 shadow-[0_0_20px_blue]"></div>
                                    <h2 className="text-xl font-black text-white mb-6 uppercase tracking-wide">Quick Actions</h2>
                                    <ScrimScheduler onSchedule={schedEvent} userTimezone={userTimezone} />
                                </Card>
                            </div>
                            <div className="lg:col-span-8 space-y-8">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                    <Card>
                                        <h2 className="text-lg font-black text-white mb-6 flex justify-between items-center uppercase tracking-wide"><span>Upcoming Events</span><span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-3 py-1 rounded-full font-bold shadow-[0_0_10px_rgba(220,38,38,0.2)]">{events.length} ACTIVE</span></h2>
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">
                                            {events.map(ev => (
                                                <div key={ev.id} className="p-4 bg-black/40 rounded-xl border border-white/5 flex justify-between items-center group hover:border-red-600/50 hover:bg-red-900/5 transition-all duration-300">
                                                    <div><div className="font-bold text-white text-sm group-hover:text-red-400 transition-colors uppercase tracking-wide">{ev.type} <span className="text-neutral-600 mx-1">vs</span> {ev.opponent || 'TBD'}</div><div className="text-[10px] text-neutral-500 mt-1 font-mono">{ev.date} @ <span className="text-white">{ev.time}</span></div></div>
                                                    <button onClick={() => openModal('Delete Event', 'Remove?', () => deleteDoc(doc(db, 'events', ev.id)))} className="text-neutral-700 hover:text-red-500 text-xl px-2">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                    <Card>
                                        <h2 className="text-lg font-black text-white mb-6 uppercase tracking-wide">Squad Availability</h2>
                                        <AvailabilityHeatmap availabilities={availabilities} members={dynamicMembers} />
                                    </Card>
                                </div>
                                <PerformanceWidget events={events} />
                                <Card>
                                    <h2 className="text-xl font-black text-white mb-6 uppercase tracking-wide">Detailed Timeline <span className="text-neutral-500 text-xs normal-case font-normal ml-2">({userTimezone})</span></h2>
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black">
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead>
                                                <tr className="border-b border-white/10">
                                                    <th className="p-4 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] w-48">Team Member</th>
                                                    {SHORT_DAYS.map(day => (<th key={day} className="p-4 text-[10px] font-black text-red-600 uppercase tracking-widest text-center border-l border-white/5">{day}</th>))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {dynamicMembers.map(member => (
                                                    <tr key={member} className="hover:bg-white/5 transition-colors group">
                                                        <td className="p-4 font-bold text-white text-xs flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_red]"></div>{member}</td>
                                                        {DAYS.map((day) => {
                                                            const slots = (displayAvail[member] || []).filter(s => s.day === day);
                                                            return (
                                                                <td key={day} className="p-2 align-middle border-l border-white/5">
                                                                    <div className="flex flex-col gap-2 items-center justify-center">
                                                                        {slots.length > 0 ? slots.map((s, i) => (
                                                                            <div key={i} className="bg-gradient-to-r from-red-900 to-red-800 border border-red-700 text-white text-[9px] font-bold px-3 py-1.5 rounded-md w-full text-center shadow-lg shadow-red-900/20 whitespace-nowrap flex items-center justify-center gap-2 hover:scale-105 transition-transform cursor-default">
                                                                                <span>{s.start}-{s.end}</span>
                                                                                <span className="opacity-50 border-l border-white/20 pl-2">{RoleIcons[s.role] || RoleIcons.Unknown}</span>
                                                                            </div>
                                                                        )) : <div className="h-1.5 w-1.5 bg-neutral-800 rounded-full group-hover:bg-neutral-700 transition-colors"></div>}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {dynamicMembers.length === 0 && (<tr><td colSpan="8" className="p-12 text-center text-neutral-600 italic text-sm">Awaiting roster data...</td></tr>)}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}
                    {activeTab === 'comps' && <div className="animate-fade-in-up h-full"><TeamComps members={dynamicMembers} /></div>}
                    {activeTab === 'matches' && <div className="animate-fade-in-up"><MatchHistory /></div>}
                    {activeTab === 'strats' && <div className="animate-fade-in-up h-[85vh]"><StratBook /></div>}
                    {activeTab === 'roster' && <div className="animate-fade-in-up h-full"><RosterManager members={dynamicMembers} /></div>}
                    {activeTab === 'partners' && <div className="animate-fade-in-up h-full"><PartnerDirectory /></div>}
                    {activeTab === 'admin' && <div className="animate-fade-in-up h-full"><AdminPanel /></div>}
                    {activeTab === 'mapveto' && <div className="animate-fade-in-up h-[80vh]"><MapVeto /></div>}
                </div>
            </main>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>{modalContent.children}</Modal>

            {/* GLOBAL ANIMATION STYLES */}
            <style jsx global>{`
                @keyframes pulse-slow { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } }
                .animate-pulse-slow { animation: pulse-slow 8s infinite ease-in-out; }
                @keyframes stamp-in { 0% { transform: translate(-50%, -50%) scale(3) rotate(0deg); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(1) rotate(-12deg); opacity: 1; } }
                .animate-stamp-in { animation: stamp-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                @keyframes shine { 100% { left: 125%; } }
                .animate-shine { animation: shine 1s; }
                @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.6s ease-out forwards; }
                @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
                .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #7f1d1d; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #dc2626; }
            `}</style>
        </div>
    );
}