/*
Syrix Team Availability - v3.2 (AGENT SELECT FIX)
- UX: Replaced native Agent <select> with a custom Visual Grid Menu.
- VISUAL: High-contrast agent picker with Red/Black theme.
- FIX: Player dropdown options now force-styled to black/white for readability.
*/

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc } from 'firebase/firestore';
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
const MAPS = ["Ascent", "Bind", "Breeze", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset", "Abyss"];
const ROLES = ["Flex", "Duelist", "Initiator", "Controller", "Sentinel"];
const RANKS = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];

const AGENTS = [
    "Jett", "Raze", "Reyna", "Yoru", "Phoenix", "Neon", "Iso", // Duelists
    "Omen", "Astra", "Brimstone", "Viper", "Harbor", "Clove",  // Controllers
    "Sova", "Fade", "Skye", "Breach", "KAY/O", "Gekko",        // Initiators
    "Killjoy", "Cypher", "Sage", "Chamber", "Deadlock", "Vyse", "Veto" // Sentinels
];

const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

// --- Utility Functions ---
function timeToMinutes(t) { if (!t || t === '24:00') return 1440; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const minutes = m % 1440; const hh = Math.floor(minutes / 60).toString().padStart(2, '0'); const mm = (minutes % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

const getNextDateForDay = (dayName) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = days.indexOf(dayName);
    const today = new Date();
    const currentDayIndex = today.getDay();
    let distance = targetIndex - currentDayIndex;
    const d = new Date(today);
    d.setDate(today.getDate() + distance);
    return d;
};

const convertToGMT = (day, time) => {
    const targetDate = getNextDateForDay(day);
    const [hours, minutes] = time.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);
    const utcDayIndex = targetDate.getUTCDay();
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const gmtDay = jsDays[utcDayIndex];
    const gmtHours = String(targetDate.getUTCHours()).padStart(2, '0');
    const gmtMinutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
    return { day: gmtDay, time: `${gmtHours}:${gmtMinutes}` };
};

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

// --- SHARED UI COMPONENTS (THEME ENFORCERS) ---

const Card = ({ children, className = "" }) => (
    <div className={`bg-neutral-900/80 backdrop-blur-md border border-white/10 shadow-2xl rounded-3xl p-6 relative overflow-hidden ${className}`}>
        {children}
    </div>
);

const Input = (props) => (
    <input {...props} className={`w-full bg-black border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 ${props.className}`} />
);

const Select = (props) => (
    <select {...props} className={`w-full bg-black border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all ${props.className}`}>
        {props.children}
    </select>
);

const ButtonPrimary = ({ children, onClick, disabled, className = "" }) => (
    <button onClick={onClick} disabled={disabled} className={`bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black uppercase tracking-widest py-3 px-6 rounded-xl shadow-lg shadow-red-900/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
        {children}
    </button>
);

const ButtonSecondary = ({ children, onClick, className = "" }) => (
    <button onClick={onClick} className={`bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-red-900/50 text-neutral-400 hover:text-white font-bold uppercase tracking-wider py-2 px-4 rounded-xl transition-all ${className}`}>
        {children}
    </button>
);

// --- COMPONENTS ---

function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex justify-center items-center backdrop-blur-xl p-4 overflow-y-auto">
            <div className="bg-neutral-900 rounded-2xl shadow-2xl shadow-red-900/40 p-6 w-full max-w-md border border-red-900/60 animate-fade-in-up relative">
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
            const l = [];
            snap.forEach(doc => l.push({ id: doc.id, ...doc.data() }));
            l.sort((a, b) => new Date(a.start) - new Date(b.start));
            setLeaves(l.filter(leave => new Date(leave.end) >= new Date()));
        });
        return () => unsub();
    }, []);

    const addLeave = async () => {
        if (!newLeave.start || !newLeave.end) return;
        await addDoc(collection(db, 'leaves'), { ...newLeave, user: currentUser.displayName, timestamp: new Date().toISOString() });
        setNewLeave({ start: '', end: '', reason: '' });
    };

    const deleteLeave = async (id) => await deleteDoc(doc(db, 'leaves', id));

    return (
        <Card className="border-red-900/20">
            <h3 className="text-lg font-black text-white mb-4 border-b border-red-900/30 pb-2 uppercase tracking-widest flex items-center gap-2">
                <span className="text-xl">🏖️</span> Absence Log
            </h3>
            <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={newLeave.start} onChange={e => setNewLeave({ ...newLeave, start: e.target.value })} className="[color-scheme:dark]" />
                    <Input type="date" value={newLeave.end} onChange={e => setNewLeave({ ...newLeave, end: e.target.value })} className="[color-scheme:dark]" />
                </div>
                <Input type="text" placeholder="Reason (e.g. Vacation)" value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} />
                <ButtonSecondary onClick={addLeave} className="w-full text-xs py-3">Log Absence</ButtonSecondary>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {leaves.length === 0 && <p className="text-neutral-600 italic text-xs text-center py-2">No upcoming absences.</p>}
                {leaves.map(l => (
                    <div key={l.id} className="p-3 bg-black border border-neutral-800 rounded-lg flex justify-between items-center text-xs hover:border-red-900/50 transition-colors group">
                        <div>
                            <span className="font-bold text-red-500 mr-2">{l.user}</span>
                            <span className="text-neutral-400">{l.start} - {l.end}</span>
                            <div className="text-neutral-500 italic mt-0.5">{l.reason}</div>
                        </div>
                        {(l.user === currentUser?.displayName || ADMINS.includes(currentUser?.displayName)) && (
                            <button onClick={() => deleteLeave(l.id)} className="text-neutral-600 hover:text-red-500 font-bold px-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
}

function NextMatchCountdown({ events }) {
    const [timeLeft, setTimeLeft] = useState('');
    const nextEvent = useMemo(() => {
        const now = new Date();
        return events.find(e => new Date(e.date + 'T' + e.time) > now);
    }, [events]);
    useEffect(() => {
        if (!nextEvent) { setTimeLeft(''); return; }
        const target = new Date(nextEvent.date + 'T' + nextEvent.time);
        const interval = setInterval(() => {
            const now = new Date();
            const diff = target - now;
            if (diff <= 0) { setTimeLeft('NOW'); return; }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);
            setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
        }, 1000);
        return () => clearInterval(interval);
    }, [nextEvent]);
    if (!nextEvent) return null;
    return (
        <div className="bg-gradient-to-r from-black via-neutral-950 to-black p-6 rounded-3xl border border-red-900/40 shadow-2xl shadow-red-900/20 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none animate-pulse"></div>
            <div className="z-10 text-center md:text-left">
                <div className="text-xs text-red-500 font-black uppercase tracking-[0.2em] mb-2">Next Match vs {nextEvent.opponent}</div>
                <div className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">{nextEvent.date} @ {nextEvent.time}</div>
                <div className="text-neutral-500 text-sm font-mono mt-1 uppercase tracking-widest">Type: {nextEvent.type}</div>
            </div>
            <div className="z-10">
                <div className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 font-mono tracking-tighter tabular-nums drop-shadow-sm">
                    {timeLeft}
                </div>
            </div>
        </div>
    );
}

function TeamComps({ members }) {
    const [comps, setComps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [newComp, setNewComp] = useState({ agents: Array(5).fill(''), players: Array(5).fill('') });
    const [activeDropdown, setActiveDropdown] = useState(null); // Track which card's menu is open

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'comps'), (snap) => {
            const c = [];
            snap.forEach(doc => c.push({ id: doc.id, ...doc.data() }));
            setComps(c);
        });
        return () => unsub();
    }, []);

    const saveComp = async () => {
        if (newComp.agents.some(a => !a)) return;
        await addDoc(collection(db, 'comps'), { map: selectedMap, ...newComp });
        setNewComp({ agents: Array(5).fill(''), players: Array(5).fill('') });
    };

    const deleteComp = async (id) => await deleteDoc(doc(db, 'comps', id));
    const currentMapComps = comps.filter(c => c.map === selectedMap);

    // --- CUSTOM AGENT CARD COMPONENT ---
    const AgentCard = ({ index }) => {
        const isOpen = activeDropdown === index;

        const handleAgentSelect = (agent) => {
            const a = [...newComp.agents];
            a[index] = agent;
            setNewComp({ ...newComp, agents: a });
            setActiveDropdown(null);
        };

        return (
            <div className="relative group h-64 bg-neutral-900/80 border border-white/10 rounded-2xl overflow-hidden transition-all hover:border-red-600 hover:shadow-[0_0_30px_rgba(220,38,38,0.3)] flex flex-col">

                {/* --- AGENT SELECTION AREA (CLICK TO OPEN MENU) --- */}
                <div
                    onClick={() => setActiveDropdown(isOpen ? null : index)}
                    className="flex-1 relative flex flex-col justify-center items-center p-4 z-10 border-b border-white/5 cursor-pointer group-hover:bg-white/5 transition-colors"
                >
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-3">Role {index + 1}</label>

                    {newComp.agents[index] ? (
                        <div className="flex flex-col items-center animate-fade-in-up">
                            <div className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                                {newComp.agents[index]}
                            </div>
                            <div className="mt-2 h-0.5 w-8 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-xl p-4 w-full h-full hover:border-red-500/50 transition-all opacity-60 hover:opacity-100">
                            <span className="text-2xl text-neutral-400 mb-1">+</span>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Select Agent</span>
                        </div>
                    )}
                </div>

                {/* --- CUSTOM DROPDOWN MENU (OVERLAY) --- */}
                {isOpen && (
                    <div className="absolute inset-0 bg-neutral-950 z-50 flex flex-col animate-fade-in">
                        <div className="flex justify-between items-center p-3 border-b border-white/10 bg-neutral-900">
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Pick Agent</span>
                            <button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }} className="text-neutral-500 hover:text-red-500 text-lg leading-none">×</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1 custom-scrollbar">
                            {AGENTS.map(agent => (
                                <button
                                    key={agent}
                                    onClick={(e) => { e.stopPropagation(); handleAgentSelect(agent); }}
                                    className={`text-[10px] font-bold uppercase py-2 rounded border border-transparent hover:border-red-900 transition-all ${newComp.agents[index] === agent ? 'bg-red-700 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                                >
                                    {agent}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- PLAYER SELECTOR (BOTTOM) --- */}
                <div className="h-16 relative bg-black flex items-center justify-center z-20 border-t border-white/5">
                    <select
                        value={newComp.players[index]}
                        onChange={e => { const p = [...newComp.players]; p[index] = e.target.value; setNewComp({ ...newComp, players: p }); }}
                        className="appearance-none bg-transparent text-center text-xs font-bold text-neutral-500 uppercase outline-none cursor-pointer w-full h-full hover:text-white transition-all tracking-wider hover:bg-white/5"
                        style={{ textAlignLast: 'center' }}
                    >
                        <option value="" className="bg-black text-neutral-500">Assign Player</option>
                        {members.map(m => <option key={m} value={m} className="bg-neutral-900 text-white">{m}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-700 text-[10px]">▼</div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-white/10 pb-6">
                <h3 className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3"><span className="text-red-600 text-5xl">/</span> TACTICAL COMPS</h3>
            </div>
            <div className="flex flex-wrap gap-2">
                {MAPS.map(m => (
                    <button key={m} onClick={() => setSelectedMap(m)} className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all transform ${selectedMap === m ? 'bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] scale-105 border border-red-500' : 'bg-black border border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:text-white hover:border-white/20'}`}>{m}</button>
                ))}
            </div>
            <div className="bg-neutral-900/50 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="flex justify-between items-center mb-8 relative z-10">
                    <div className="flex items-center gap-3"><span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span></span><h4 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Design {selectedMap} Strategy</h4></div>
                    <ButtonPrimary onClick={saveComp} className="text-xs py-2">Save Loadout</ButtonPrimary>
                </div>
                {/* Close dropdowns if clicking background */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4" onClick={() => setActiveDropdown(null)}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} onClick={e => e.stopPropagation()}><AgentCard index={i} /></div>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {currentMapComps.map(comp => (
                    <div key={comp.id} className="bg-neutral-900/80 rounded-2xl border border-white/5 overflow-hidden relative group hover:border-red-600/40 transition-all shadow-lg">
                        <div className="bg-black/50 px-5 py-3 flex justify-between items-center border-b border-neutral-800 group-hover:bg-red-900/10 transition-colors"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div><div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">ID: {comp.id.substring(0, 6)}</div></div><button onClick={() => deleteComp(comp.id)} className="text-neutral-600 hover:text-white font-bold text-[10px] bg-neutral-800 hover:bg-red-600 px-2 py-1 rounded transition-all">DELETE</button></div>
                        <div className="p-5 grid grid-cols-5 gap-2 divide-x divide-neutral-800/50">{comp.agents.map((agent, i) => (<div key={i} className="text-center flex flex-col justify-center items-center gap-1"><div className="text-xs sm:text-sm font-black text-white uppercase tracking-tight drop-shadow-sm">{agent}</div><div className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest truncate w-full">{comp.players[i] || '-'}</div></div>))}</div>
                    </div>
                ))}
                {currentMapComps.length === 0 && (<div className="col-span-full py-12 border border-dashed border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-600"><span className="text-3xl mb-2 opacity-30">📋</span><p className="text-sm italic font-medium">No saved compositions for {selectedMap}.</p></div>)}
            </div>
        </div>
    );
}

function AdminPanel() {
    const [applications, setApplications] = useState([]);
    useEffect(() => { const unsub = onSnapshot(collection(db, 'applications'), (snap) => { const apps = []; snap.forEach(doc => apps.push({ id: doc.id, ...doc.data() })); setApplications(apps); }); return () => unsub(); }, []);
    const acceptApplicant = async (app) => { await setDoc(doc(db, 'roster', app.user), { rank: app.rank, role: 'Tryout', notes: `Tracker: ${app.tracker}\nWhy: ${app.why}`, joinedAt: new Date().toISOString() }); await deleteDoc(doc(db, 'applications', app.id)); };
    const rejectApplicant = async (id) => { await deleteDoc(doc(db, 'applications', id)); };
    return (
        <Card>
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3"><span className="text-red-600">ADMIN</span> DASHBOARD</h2>
            <div className="space-y-6"><h3 className="text-xl font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-2">Pending Applications</h3>{applications.length === 0 ? <p className="text-neutral-600 italic">No pending applications.</p> : (<div className="grid grid-cols-1 gap-4">{applications.map(app => (<div key={app.id} className="bg-black border border-neutral-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6"><div className="space-y-2 flex-1"><div className="flex items-center gap-3"><h4 className="text-xl font-black text-white">{app.user}</h4><span className="bg-neutral-900 text-neutral-400 text-xs px-2 py-1 rounded font-bold uppercase border border-neutral-800">{app.rank}</span><span className="bg-neutral-900 text-neutral-400 text-xs px-2 py-1 rounded font-bold uppercase border border-neutral-800">{app.role}</span></div><p className="text-neutral-400 text-sm"><strong className="text-neutral-500">Experience:</strong> {app.exp}</p><p className="text-neutral-300 text-sm italic">"{app.why}"</p><a href={app.tracker} target="_blank" rel="noreferrer" className="text-red-500 text-xs font-bold hover:underline block mt-2">View Tracker Profile &rarr;</a></div><div className="flex flex-row md:flex-col gap-3 justify-center"><button onClick={() => acceptApplicant(app)} className="bg-green-900/20 hover:bg-green-600 border border-green-900 text-green-500 hover:text-white font-bold px-6 py-3 rounded-xl transition-all">ACCEPT</button><button onClick={() => rejectApplicant(app.id)} className="bg-red-900/20 hover:bg-red-900 text-red-500 hover:text-white font-bold px-6 py-3 rounded-xl transition-all border border-red-900">REJECT</button></div></div>))}</div>)}</div>
        </Card>
    );
}

function ProfileModal({ isOpen, onClose, currentUser }) {
    const [rank, setRank] = useState("Unranked");
    const [agents, setAgents] = useState("");
    const [status, setStatus] = useState("idle");
    const handleSave = async () => { setStatus("saving"); try { await setDoc(doc(db, 'roster', currentUser.displayName), { rank, agents }, { merge: true }); setStatus("success"); setTimeout(() => { setStatus("idle"); onClose(); }, 1000); } catch (e) { console.error(e); setStatus("idle"); } };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/90 z-[100] flex justify-center items-center backdrop-blur-md p-4">
            <div className="bg-neutral-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/10 animate-fade-in-up">
                <h3 className="text-2xl font-black text-white mb-6">Edit Profile</h3>
                <div className="space-y-4"><div><label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Current Rank</label><Select value={rank} onChange={e => setRank(e.target.value)}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</Select></div><div><label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Main Agents</label><Input type="text" value={agents} onChange={e => setAgents(e.target.value)} placeholder="Jett, Raze, Omen..." /></div></div>
                <div className="mt-6 flex justify-end gap-3"><ButtonSecondary onClick={onClose}>Cancel</ButtonSecondary><ButtonPrimary onClick={handleSave}>{status === 'saving' ? 'Saving...' : 'Save Profile'}</ButtonPrimary></div>
            </div>
        </div>
    );
}

function ApplicationForm({ currentUser }) {
    const [form, setForm] = useState({ tracker: '', rank: 'Unranked', role: 'Flex', exp: '', why: '' });
    const [status, setStatus] = useState('idle');
    const submitApp = async () => { if (!form.tracker || !form.why) return; setStatus('saving'); const appData = { ...form, user: currentUser.displayName, uid: currentUser.uid, submittedAt: new Date().toISOString() }; await addDoc(collection(db, 'applications'), appData); const content = { embeds: [{ title: `📄 New Team Application: ${currentUser.displayName}`, color: 16776960, fields: [{ name: 'Rank', value: form.rank, inline: true }, { name: 'Role', value: form.role, inline: true }, { name: 'Tracker', value: form.tracker }, { name: 'Experience', value: form.exp || 'None provided' }, { name: 'Why Join?', value: form.why }], timestamp: new Date().toISOString() }] }; try { await fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) }); } catch (e) { console.error(e); } setStatus('success'); setForm({ tracker: '', rank: 'Unranked', role: 'Flex', exp: '', why: '' }); };
    if (status === 'success') return <div className="h-full flex flex-col items-center justify-center text-center p-10 animate-fade-in"><div className="text-6xl mb-4">✅</div><h2 className="text-3xl font-black text-white mb-2">Application Received</h2><p className="text-neutral-400 max-w-md">Thank you for applying to Syrix. Your application has been sent to the captains.</p></div>;
    return (
        <div className="bg-neutral-900/80 p-8 rounded-3xl border border-white/10 shadow-2xl max-w-3xl mx-auto animate-fade-in-up">
            <h2 className="text-3xl font-black text-white mb-2">Join the Team</h2>
            <p className="text-neutral-400 mb-8">Fill out the details below to apply for the roster.</p>
            <div className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Valorant Tracker URL</label><Input type="text" value={form.tracker} onChange={e => setForm({ ...form, tracker: e.target.value })} placeholder="https://tracker.gg/valorant/profile/..." /></div><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Current Rank</label><Select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}>{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</Select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Preferred Role</label><Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</Select></div><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Competitive Experience</label><Input type="text" value={form.exp} onChange={e => setForm({ ...form, exp: e.target.value })} placeholder="Previous teams, tournaments..." /></div></div><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Why do you want to join Syrix?</label><textarea value={form.why} onChange={e => setForm({ ...form, why: e.target.value })} className="w-full h-32 bg-black border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 resize-none placeholder-neutral-600" placeholder="Tell us about yourself and your goals..." /></div><ButtonPrimary onClick={submitApp} disabled={status !== 'idle'} className="w-full py-4">{status === 'idle' ? 'Submit Application' : 'Sending...'}</ButtonPrimary></div>
        </div>
    );
}

function MapVeto() {
    const [vetoState, setVetoState] = useState({});
    useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'map_veto'), (snap) => { if (snap.exists()) setVetoState(snap.data()); }); return () => unsub(); }, []);
    const toggleMap = async (map) => { const current = vetoState[map] || 'neutral'; const next = current === 'neutral' ? 'ban' : current === 'ban' ? 'pick' : 'neutral'; await setDoc(doc(db, 'general', 'map_veto'), { ...vetoState, [map]: next }); };
    const resetVeto = async () => { await setDoc(doc(db, 'general', 'map_veto'), {}); };
    return (
        <Card className="h-full">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white">MAP VETO</h3><ButtonSecondary onClick={resetVeto} className="text-xs px-3 py-1">Reset Board</ButtonSecondary></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{MAPS.map(map => { const status = vetoState[map] || 'neutral'; return (<div key={map} onClick={() => toggleMap(map)} className={`aspect-video rounded-xl border-2 cursor-pointer flex items-center justify-center relative overflow-hidden transition-all group ${status === 'neutral' ? 'border-neutral-800 bg-black/50 hover:border-neutral-600' : ''} ${status === 'ban' ? 'border-red-600 bg-red-900/20' : ''} ${status === 'pick' ? 'border-green-500 bg-green-900/20' : ''}`}><span className={`font-black uppercase tracking-widest text-lg z-10 transition-transform group-hover:scale-110 ${status === 'neutral' ? 'text-neutral-500' : 'text-white'}`}>{map}</span>{status !== 'neutral' && (<div className={`absolute bottom-2 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${status === 'ban' ? 'bg-red-600 text-white' : 'bg-green-500 text-black'}`}>{status}</div>)}</div>); })}</div>
        </Card>
    );
}

function CaptainsMessage() {
    const [message, setMessage] = useState({ text: "Welcome to the team hub!", updatedBy: "System" });
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const auth = getAuth();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'general', 'captain_message'), (docSnap) => {
            if (docSnap.exists()) setMessage(docSnap.data());
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!draft.trim()) return;
        const user = auth.currentUser;
        await setDoc(doc(db, 'general', 'captain_message'), { text: draft, updatedBy: user ? user.displayName : "Unknown", updatedAt: new Date().toISOString() });
        setIsEditing(false);
    };

    return (
        <div className="bg-gradient-to-br from-red-950 to-black p-6 rounded-3xl border border-red-900/50 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-red-600/20 rounded-full blur-3xl"></div>
            <div className="flex justify-between items-start mb-3 relative z-10">
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2"><span className="text-2xl">📢</span> Captain's Message</h2>
                {!isEditing && <button onClick={() => { setDraft(message.text); setIsEditing(true); }} className="text-xs text-neutral-400 hover:text-white transition-colors bg-black/40 px-2 py-1 rounded border border-neutral-700">Edit</button>}
            </div>
            {isEditing ? (
                <div className="relative z-10 animate-fade-in">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full bg-black/50 border border-red-900/50 rounded-xl p-3 text-white text-sm focus:border-red-500 outline-none resize-none mb-2 h-24 placeholder-neutral-500" />
                    <div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs text-neutral-400 hover:text-white px-3 py-1">Cancel</button><ButtonPrimary onClick={handleSave} className="text-xs px-4 py-2">Post</ButtonPrimary></div>
                </div>
            ) : (
                <div className="relative z-10">
                    <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium tracking-wide">"{message.text}"</p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-500 font-mono uppercase"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>Posted by {message.updatedBy}</div>
                </div>
            )}
        </div>
    );
}

function PerformanceWidget({ events }) {
    const stats = useMemo(() => {
        let wins = 0; let losses = 0; let draws = 0; const mapStats = {};
        const playedMatches = events.filter(e => e.result && e.result.myScore !== '');
        playedMatches.forEach(m => {
            const my = parseInt(m.result.myScore); const enemy = parseInt(m.result.enemyScore); const map = m.result.map;
            if (!mapStats[map]) mapStats[map] = { played: 0, wins: 0 };
            mapStats[map].played++;
            if (my > enemy) { wins++; mapStats[map].wins++; } else if (my < enemy) { losses++; } else { draws++; }
        });
        let bestMap = 'N/A'; let bestWinRate = -1;
        Object.keys(mapStats).forEach(map => {
            const rate = mapStats[map].wins / mapStats[map].played;
            if (rate > bestWinRate || (rate === bestWinRate && mapStats[map].played > mapStats[bestMap]?.played)) { bestWinRate = rate; bestMap = map; }
        });
        const totalGames = wins + losses + draws;
        const overallWinRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        return { wins, losses, draws, overallWinRate, bestMap, bestMapStats: mapStats[bestMap] };
    }, [events]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="flex flex-col justify-between !p-4"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Win Rate</div><div className="text-3xl font-black text-white mt-1">{stats.overallWinRate}%</div><div className="w-full bg-neutral-800 h-1.5 rounded-full mt-3 overflow-hidden"><div className="bg-red-600 h-full rounded-full" style={{ width: `${stats.overallWinRate}%` }}></div></div></Card>
            <Card className="flex flex-col justify-between !p-4"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Record</div><div className="flex items-baseline gap-1 mt-1"><span className="text-3xl font-black text-green-500">{stats.wins}</span><span className="text-xl font-bold text-neutral-600">-</span><span className="text-3xl font-black text-red-500">{stats.losses}</span></div><div className="text-[10px] text-neutral-400 font-mono uppercase mt-2">W - L</div></Card>
            <Card className="flex flex-col justify-between md:col-span-2 lg:col-span-1 !p-4"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Best Map</div><div className="text-2xl font-black text-white mt-1 truncate">{stats.bestMap}</div>{stats.bestMap !== 'N/A' && <div className="text-xs text-green-500 font-bold mt-2">{Math.round((stats.bestMapStats.wins / stats.bestMapStats.played) * 100)}% Win Rate <span className="text-neutral-600 ml-1">({stats.bestMapStats.wins}/{stats.bestMapStats.played})</span></div>}</Card>
            <Card className="flex flex-col justify-between hidden lg:flex !p-4"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Matches Logged</div><div className="text-3xl font-black text-white mt-1">{stats.wins + stats.losses + stats.draws}</div><div className="text-[10px] text-neutral-500 mt-2">Total Scrims/Games</div></Card>
        </div>
    );
}

function RosterManager({ members }) {
    const [rosterData, setRosterData] = useState({});
    const [selectedMember, setSelectedMember] = useState(null);
    const [role, setRole] = useState('Tryout');
    const [gameId, setGameId] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('idle');

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'roster'), (snap) => {
            const data = {};
            snap.forEach(doc => data[doc.id] = doc.data());
            setRosterData(data);
        });
        return () => unsub();
    }, []);

    const handleSave = async () => {
        if (!selectedMember) return;
        setStatus('saving');
        await setDoc(doc(db, 'roster', selectedMember), { role, notes, gameId }, { merge: true });
        setStatus('success');
        setTimeout(() => setStatus('idle'), 1500);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            <div className="lg:col-span-1 bg-neutral-900/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 flex flex-col h-full">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-neutral-800 pb-2">Team Members</h3>
                <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                    {members.map(m => (
                        <div key={m} onClick={() => { setSelectedMember(m); setRole(rosterData[m]?.role || 'Tryout'); setNotes(rosterData[m]?.notes || ''); setGameId(rosterData[m]?.gameId || ''); }} className={`p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center ${selectedMember === m ? 'bg-red-900/20 border-red-600' : 'bg-black border-neutral-800 hover:border-neutral-600'}`}>
                            <div><div className="font-bold text-neutral-200">{m}</div>{rosterData[m]?.gameId && <div className="text-[9px] text-neutral-500 font-mono">{rosterData[m].gameId}</div>}{rosterData[m]?.rank && <div className="text-[9px] text-red-400 font-bold uppercase">{rosterData[m].rank}</div>}</div>
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${(rosterData[m]?.role === 'Captain') ? 'bg-yellow-600/20 text-yellow-500' : (rosterData[m]?.role === 'Main') ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}>{rosterData[m]?.role || 'New'}</span>
                        </div>
                    ))}
                </div>
            </div>
            <Card className="lg:col-span-2 flex flex-col">
                {selectedMember ? (
                    <div className="h-full flex flex-col">
                        <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-red-600"></span>Managing: <span className="text-red-500">{selectedMember}</span></h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Assign Role</label><div className="grid grid-cols-2 gap-2 mb-4">{['Captain', 'Main', 'Sub', 'Tryout'].map(r => (<button key={r} onClick={() => setRole(r)} className={`p-3 rounded-lg text-sm font-bold border transition-all ${role === r ? 'bg-red-600 text-white border-red-500 shadow-lg' : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-800'}`}>{r}</button>))}</div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">In-Game ID (Riot ID)</label><Input type="text" placeholder="Syrix#NA1" value={gameId} onChange={(e) => setGameId(e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Performance Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-40 bg-black border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 resize-none" placeholder="Enter notes about gameplay..." /></div>
                        </div>
                        <div className="mt-auto flex justify-end"><ButtonPrimary onClick={handleSave} disabled={status !== 'idle'}>{status === 'idle' ? 'Save Player Details' : status === 'saving' ? 'Saving...' : 'Saved!'}</ButtonPrimary></div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 p-12 text-center"><div className="text-6xl mb-4">🛡️</div><p className="text-xl font-bold">Select a team member to manage</p></div>
                )}
            </Card>
        </div>
    );
}

function MatchHistory() {
    const [matches, setMatches] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ myScore: '', enemyScore: '', map: MAPS[0], vod: '' });
    const [isAdding, setIsAdding] = useState(false);
    const [newMatch, setNewMatch] = useState({ type: 'Scrim', opponent: '', date: new Date().toISOString().split('T')[0], time: '20:00', myScore: '', enemyScore: '', map: MAPS[0], vod: '' });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'events'), (snap) => {
            const evs = [];
            snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() }));
            const past = evs.filter(e => { if (e.result) return true; return new Date(e.date + 'T' + e.time) < new Date(); });
            past.sort((a, b) => new Date(b.date) - new Date(a.date));
            setMatches(past);
        });
        return () => unsub();
    }, []);

    const handleUpdate = async (id) => { await updateDoc(doc(db, 'events', id), { result: { ...editForm } }); setEditingId(null); };
    const handleManualAdd = async () => { if (!newMatch.opponent || !newMatch.date) return; await addDoc(collection(db, 'events'), { type: newMatch.type, opponent: newMatch.opponent, date: newMatch.date, time: newMatch.time, scheduledBy: "Manual Log", result: { myScore: newMatch.myScore, enemyScore: newMatch.enemyScore, map: newMatch.map, vod: newMatch.vod } }); setIsAdding(false); setNewMatch({ type: 'Scrim', opponent: '', date: '', time: '20:00', myScore: '', enemyScore: '', map: MAPS[0], vod: '' }); };

    const getResultColor = (my, enemy) => {
        const m = parseInt(my); const e = parseInt(enemy);
        if (m > e) return 'border-l-4 border-l-green-500';
        if (m < e) return 'border-l-4 border-l-red-600';
        return 'border-l-4 border-l-neutral-500';
    };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white flex items-center gap-3"><span className="text-red-600">MATCH</span> HISTORY</h3><ButtonSecondary onClick={() => setIsAdding(!isAdding)} className="text-xs">{isAdding ? 'Cancel' : '+ LOG PAST MATCH'}</ButtonSecondary></div>
            {isAdding && (
                <div className="mb-8 bg-black/40 p-4 rounded-xl border border-red-900/30 animate-fade-in"><h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Log Unscheduled Match</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3"><Input type="text" placeholder="Opponent" value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} /><Input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="[color-scheme:dark]" /><Select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value })}>{MAPS.map(map => <option key={map}>{map}</option>)}</Select><div className="flex gap-2"><Input type="number" placeholder="Us" value={newMatch.myScore} onChange={e => setNewMatch({ ...newMatch, myScore: e.target.value })} className="w-1/2" /><Input type="number" placeholder="Them" value={newMatch.enemyScore} onChange={e => setNewMatch({ ...newMatch, enemyScore: e.target.value })} className="w-1/2" /></div></div>
                    <div className="flex justify-end"><ButtonPrimary onClick={handleManualAdd} className="text-xs py-2">Save Log</ButtonPrimary></div></div>
            )}
            <div className="space-y-4">{matches.length === 0 && <p className="text-neutral-500 italic">No past matches found.</p>}
                {matches.map(m => (
                    <div key={m.id} className={`bg-black/40 border border-neutral-800 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 hover:bg-neutral-900/50 transition-colors ${m.result ? getResultColor(m.result.myScore, m.result.enemyScore) : ''}`}>
                        <div className="flex-1">
                            <div className="text-sm font-bold text-red-500 uppercase tracking-wider">{m.type}</div>
                            <div className="text-xl font-black text-white">{m.opponent || 'Unknown Opponent'}</div>
                            <div className="text-xs text-neutral-500">{m.date}</div>
                        </div>
                        {editingId === m.id ? (
                            <div className="flex flex-wrap gap-2 items-center bg-neutral-900 p-2 rounded-lg border border-neutral-700"><Select value={editForm.map} onChange={e => setEditForm({ ...editForm, map: e.target.value })} className="!p-2 text-xs w-32">{MAPS.map(map => <option key={map}>{map}</option>)}</Select><Input type="number" placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} className="w-12 !p-2 text-xs" /><span className="text-white">-</span><Input type="number" placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} className="w-12 !p-2 text-xs" /><Input type="text" placeholder="VOD Link" value={editForm.vod} onChange={e => setEditForm({ ...editForm, vod: e.target.value })} className="w-32 !p-2 text-xs" /><ButtonPrimary onClick={() => handleUpdate(m.id)} className="text-xs py-2 px-3">Save</ButtonPrimary></div>
                        ) : (
                            <div className="flex items-center gap-6">
                                {m.result ? (
                                    <div className="text-center">
                                        <div className={`text-2xl font-black ${m.result.myScore > m.result.enemyScore ? 'text-green-500' : m.result.myScore < m.result.enemyScore ? 'text-red-500' : 'text-white'}`}>
                                            {m.result.myScore} - {m.result.enemyScore}
                                        </div>
                                        <div className="text-[10px] uppercase font-bold text-neutral-500">{m.result.map}</div>
                                    </div>
                                ) : (<span className="text-neutral-600 text-sm italic">No result logged</span>)}
                                <div className="flex flex-col gap-2">
                                    {m.result?.vod && (<a href={m.result.vod} target="_blank" rel="noreferrer" className="text-xs bg-red-600/20 text-red-400 border border-red-600/50 px-3 py-1 rounded uppercase font-bold hover:bg-red-600 hover:text-white transition-colors text-center">Watch VOD</a>)}
                                    <button onClick={() => { setEditingId(m.id); setEditForm(m.result || { myScore: '', enemyScore: '', map: MAPS[0], vod: '' }) }} className="text-xs text-neutral-500 hover:text-white underline">Edit Result</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
}

function StratBook() {
    const [strats, setStrats] = useState([]);
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [newStrat, setNewStrat] = useState({ title: '', link: '' });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'strats'), (snap) => {
            const s = [];
            snap.forEach(doc => s.push({ id: doc.id, ...doc.data() }));
            setStrats(s);
        });
        return () => unsub();
    }, []);

    const addStrat = async () => {
        if (!newStrat.title) return;
        await addDoc(collection(db, 'strats'), { ...newStrat, map: selectedMap });
        setNewStrat({ title: '', link: '' });
    };

    const deleteStrat = async (id) => await deleteDoc(doc(db, 'strats', id));
    const filteredStrats = strats.filter(s => s.map === selectedMap);

    return (
        <Card className="h-full">
            <h3 className="text-2xl font-black text-white mb-6">STRATBOOK</h3>
            <div className="flex overflow-x-auto gap-2 pb-4 mb-4 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black">{MAPS.map(m => (<button key={m} onClick={() => setSelectedMap(m)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${selectedMap === m ? 'bg-red-700 text-white shadow-lg' : 'bg-black border border-neutral-800 text-neutral-500 hover:text-white hover:border-white/20'}`}>{m}</button>))}</div>
            <div className="space-y-3 mb-6"><div className="flex gap-2"><Input type="text" placeholder="Strat Name (e.g. A Split)" value={newStrat.title} onChange={e => setNewStrat({ ...newStrat, title: e.target.value })} className="flex-1" /><Input type="text" placeholder="Link (Valoplant/Doc)" value={newStrat.link} onChange={e => setNewStrat({ ...newStrat, link: e.target.value })} className="flex-1" /><ButtonSecondary onClick={addStrat} className="py-2 px-4">+</ButtonSecondary></div></div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">{filteredStrats.length === 0 && <p className="text-neutral-600 italic text-sm">No strats for {selectedMap} yet.</p>}{filteredStrats.map(s => (<div key={s.id} className="p-3 bg-black/40 border border-neutral-800 rounded-lg flex justify-between items-center group hover:border-red-900/50 transition-colors"><span className="font-bold text-neutral-200">{s.title}</span><div className="flex gap-3">{s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-xs text-red-400 hover:underline">View</a>}<button onClick={() => deleteStrat(s.id)} className="text-neutral-600 hover:text-red-500">×</button></div></div>))}</div>
        </Card>
    );
}

function PartnerDirectory() {
    const [partners, setPartners] = useState([]);
    const [newPartner, setNewPartner] = useState({ name: '', contact: '', notes: '' });

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'partners'), (snap) => {
            const p = [];
            snap.forEach(doc => p.push({ id: doc.id, ...doc.data() }));
            setPartners(p);
        });
        return () => unsub();
    }, []);

    const addPartner = async () => {
        if (!newPartner.name) return;
        await addDoc(collection(db, 'partners'), newPartner);
        setNewPartner({ name: '', contact: '', notes: '' });
    };

    return (
        <Card className="h-full">
            <h3 className="text-2xl font-black text-white mb-6">SCRIM PARTNERS</h3>
            <div className="space-y-3 mb-6 p-4 bg-black/30 rounded-xl border border-neutral-800"><Input type="text" placeholder="Team Name" value={newPartner.name} onChange={e => setNewPartner({ ...newPartner, name: e.target.value })} className="mb-2" /><div className="flex gap-2"><Input type="text" placeholder="Contact (Discord)" value={newPartner.contact} onChange={e => setNewPartner({ ...newPartner, contact: e.target.value })} className="flex-1" /><Input type="text" placeholder="Notes" value={newPartner.notes} onChange={e => setNewPartner({ ...newPartner, notes: e.target.value })} className="flex-1" /></div><ButtonPrimary onClick={addPartner} className="w-full text-xs py-3 mt-2">Add Partner</ButtonPrimary></div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">{partners.map(p => (<div key={p.id} className="p-4 bg-black/40 border border-neutral-800 rounded-xl"><div className="flex justify-between items-start"><div><div className="font-bold text-lg text-white">{p.name}</div><div className="text-xs text-red-400 font-mono">{p.contact}</div></div><button onClick={() => deleteDoc(doc(db, 'partners', p.id))} className="text-neutral-600 hover:text-red-500">×</button></div>{p.notes && <div className="mt-2 text-sm text-neutral-400 bg-neutral-900/50 p-2 rounded">{p.notes}</div>}</div>))}</div>
        </Card>
    );
}

function ScrimScheduler({ onSchedule, userTimezone }) {
    const [type, setType] = useState('Scrim');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [opponent, setOpponent] = useState('');
    const [status, setStatus] = useState('idle');

    const handleSubmit = async () => {
        if (!date || !time) return;
        setStatus('saving');
        await onSchedule({ type, date, time, opponent, timezone: userTimezone });
        setStatus('success');
        setTimeout(() => { setStatus('idle'); setOpponent(''); setDate(''); setTime(''); }, 2000);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-red-500 mb-1 uppercase tracking-wider">Type</label><Select value={type} onChange={e => setType(e.target.value)}><option>Scrim</option><option>Tournament</option><option>Practice</option><option>VOD Review</option></Select></div>
                <div><label className="block text-xs font-bold text-red-500 mb-1 uppercase tracking-wider">Opponent / Notes</label><Input type="text" placeholder="e.g. Team Liquid" value={opponent} onChange={e => setOpponent(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-red-500 mb-1 uppercase tracking-wider">Date</label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="[color-scheme:dark]" /></div>
                <div><label className="block text-xs font-bold text-red-500 mb-1 uppercase tracking-wider">Time ({userTimezone})</label><Input type="time" value={time} onChange={e => setTime(e.target.value)} className="[color-scheme:dark]" /></div>
            </div>
            <ButtonPrimary onClick={handleSubmit} disabled={status !== 'idle'} className="w-full">{status === 'idle' && '📅 Schedule & Post'}{status === 'saving' && 'Scheduling...'}{status === 'success' && 'Event Scheduled!'}</ButtonPrimary>
        </div>
    );
}

function AvailabilityHeatmap({ availabilities, members }) {
    const bucketSize = 60;
    const numBuckets = (24 * 60) / bucketSize;
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);
    const maxCount = activeMembers.length || 1;

    const heatmapData = useMemo(() => {
        const data = {};
        for (const day of DAYS) {
            const buckets = new Array(numBuckets).fill(0);
            for (const member of activeMembers) {
                const slots = availabilities[member]?.filter(s => s.day === day) || [];
                for (const slot of slots) {
                    const startBucket = Math.floor(timeToMinutes(slot.start) / bucketSize);
                    const endBucket = Math.ceil(timeToMinutes(slot.end) / bucketSize);
                    for (let i = startBucket; i < endBucket && i < numBuckets; i++) buckets[i]++;
                }
            }
            data[day] = buckets;
        }
        return data;
    }, [availabilities, activeMembers, numBuckets]);

    return (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 shadow-inner bg-black">
            <div className="min-w-[600px]"><div className="flex border-b border-neutral-800"><div className="w-24 p-2 text-xs font-bold text-red-500 bg-black sticky left-0 border-r border-neutral-800">DAY</div>{Array.from({ length: 24 }).map((_, i) => (<div key={i} className="flex-1 text-[10px] text-center text-neutral-500 border-l border-neutral-800/50 py-1">{i}</div>))}</div>{DAYS.map(day => (<div key={day} className="flex border-b border-neutral-800/50 last:border-0"><div className="w-24 p-2 text-xs font-bold text-neutral-400 bg-black sticky left-0 border-r border-neutral-800">{day.substring(0, 3).toUpperCase()}</div>{heatmapData[day]?.map((count, i) => (<div key={i} className={`flex-1 h-8 border-l border-neutral-800/30 transition-all hover:brightness-125 relative group ${count > 0 ? 'bg-red-600' : ''}`} style={{ opacity: count > 0 ? (count / maxCount) * 0.9 + 0.1 : 1, backgroundColor: count === 0 ? 'transparent' : undefined }}>{count > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white group-hover:scale-125 transition-transform">{count}</span>}</div>))}</div>))}</div>
        </div>
    );
}

function LoginScreen({ signIn }) {
    return (
        <div className="fixed inset-0 h-full w-full bg-black flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black">
            <div className="text-center space-y-8 max-w-lg w-full p-12 rounded-[3rem] border border-white/10 bg-neutral-900/80 backdrop-blur-xl shadow-2xl shadow-red-900/40">
                <div className="space-y-2"><h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">SYRIX</h1><div className="h-1.5 w-32 bg-red-600 mx-auto rounded-full shadow-[0_0_15px_rgba(220,38,38,1)]"></div><p className="text-neutral-400 text-lg font-medium uppercase tracking-[0.3em]">Team Hub</p></div>
                <button onClick={signIn} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 rounded-2xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-3 uppercase tracking-wide text-sm border border-[#5865F2]"><span>Login with Discord</span></button>
            </div>
        </div>
    );
}

// --- Main Application ---

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [availabilities, setAvailabilities] = useState({});
    const [events, setEvents] = useState([]);
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('23:30');
    const [role, setRole] = useState('Flex');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [userTimezone, setUserTimezone] = useState(localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [authLoading, setAuthLoading] = useState(true);
    const [membershipLoading, setMembershipLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', children: null });
    const [isMember, setIsMember] = useState(false);

    useEffect(() => { const unsubscribe = onAuthStateChanged(auth, user => { setCurrentUser(user); setAuthLoading(false); }); return unsubscribe; }, []);
    const signIn = async () => { const provider = new OAuthProvider('oidc.discord'); provider.addScope('identify'); try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); } };
    const handleSignOut = async () => await signOut(auth);

    useEffect(() => {
        if (!currentUser) { setMembershipLoading(false); return; }
        setMembershipLoading(true);
        const checkMembership = onSnapshot(doc(db, 'roster', currentUser.displayName), (docSnap) => { const isAdmin = ADMINS.some(admin => admin.toLowerCase() === currentUser.displayName.toLowerCase()); const isAuthorized = (docSnap.exists() && docSnap.data().role) || isAdmin; setIsMember(isAuthorized); setMembershipLoading(false); });
        const unsubAvail = onSnapshot(collection(db, 'availabilities'), (snap) => { const data = {}; snap.forEach(doc => data[doc.id] = doc.data().slots || []); setAvailabilities(data); });
        const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => { const evs = []; snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() })); evs.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)); setEvents(evs); });
        return () => { checkMembership(); unsubAvail(); unsubEvents(); };
    }, [currentUser]);

    useEffect(() => { document.documentElement.classList.add('dark'); }, []);
    const dynamicMembers = useMemo(() => [...new Set(Object.keys(availabilities))].sort(), [availabilities]);
    const displayAvailabilities = useMemo(() => {
        const converted = {};
        for (const member in availabilities) {
            converted[member] = [];
            availabilities[member].forEach(slot => {
                const localStart = convertFromGMT(slot.day, slot.start, userTimezone);
                const localEnd = convertFromGMT(slot.day, slot.end, userTimezone);
                const role = slot.role;
                if (localStart.day === localEnd.day) { if (timeToMinutes(localStart.time) < timeToMinutes(localEnd.time)) converted[member].push({ day: localStart.day, start: localStart.time, end: localEnd.time, role }); }
                else { converted[member].push({ day: localStart.day, start: localStart.time, end: '24:00', role }); if (timeToMinutes(localEnd.time) > 0) converted[member].push({ day: localEnd.day, start: '00:00', end: localEnd.time, role }); }
            });
        }
        return converted;
    }, [availabilities, userTimezone]);

    const getAvatar = () => {
        if (!currentUser) return null;
        const discordData = currentUser.providerData.find(p => p.providerId === 'oidc.discord');
        if (discordData && discordData.photoURL) return discordData.photoURL;
        if (currentUser.photoURL && currentUser.photoURL.startsWith('http')) return currentUser.photoURL;
        if (currentUser.photoURL) return `https://cdn.discordapp.com/avatars/${currentUser.uid}/${currentUser.photoURL}.png`;
        return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
    };

    const isAdmin = useMemo(() => currentUser && ADMINS.some(a => a.toLowerCase() === currentUser.displayName.toLowerCase()), [currentUser]);
    const openModal = (title, message, onConfirm) => { setModalContent({ title, children: message, onConfirm }); setIsModalOpen(true); };
    const saveAvailability = async () => {
        if (timeToMinutes(end) <= timeToMinutes(start)) return openModal('Error', 'End time must be after start.', () => setIsModalOpen(false));
        setSaveStatus('saving');
        const gmtStart = convertToGMT(day, start); const gmtEnd = convertToGMT(day, end);
        const existing = availabilities[currentUser.displayName] || [];
        const others = existing.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day);
        const newSlots = [...others, { day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time, role }];
        try { await setDoc(doc(db, 'availabilities', currentUser.displayName), { slots: newSlots }); setSaveStatus('success'); } catch (e) { console.error(e); setSaveStatus('idle'); }
        setTimeout(() => setSaveStatus('idle'), 2000);
    };
    const clearDay = async () => { const existing = availabilities[currentUser.displayName] || []; const newSlots = existing.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day); await setDoc(doc(db, 'availabilities', currentUser.displayName), { slots: newSlots }); setIsModalOpen(false); };
    const clearAll = async () => { await deleteDoc(doc(db, 'availabilities', currentUser.displayName)); setIsModalOpen(false); };
    const scheduleEvent = async (eventData) => {
        await addDoc(collection(db, 'events'), eventData);
        const content = { embeds: [{ title: `🔴 New ${eventData.type} Scheduled!`, color: 15158332, fields: [{ name: 'Type', value: eventData.type, inline: true }, { name: 'Opponent/Info', value: eventData.opponent || 'N/A', inline: true }, { name: 'When', value: `${eventData.date} at ${eventData.time} (${eventData.timezone})` }, { name: 'Scheduled By', value: currentUser.displayName }], footer: { text: "Syrix Hub" }, timestamp: new Date().toISOString() }] };
        try { await fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) }); } catch (e) { console.error(e); }
    };
    const deleteEvent = async (id) => { await deleteDoc(doc(db, 'events', id)); setIsModalOpen(false); };

    if (authLoading || (currentUser && membershipLoading)) return <div className="fixed inset-0 h-full w-full bg-black flex items-center justify-center text-red-600 font-bold text-xl animate-pulse">LOADING SYRIX HUB...</div>;
    if (!currentUser) return <LoginScreen signIn={signIn} />;

    if (!isMember) return (
        <div className="fixed inset-0 h-full w-full bg-black text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden">
            <header className="flex-none flex justify-between items-center px-8 py-4 border-b border-red-900/30 bg-black/90 backdrop-blur-md z-40">
                <h1 className="text-3xl font-black tracking-tighter text-white">SYRIX <span className="text-red-600">HUB</span></h1>
                <div className="flex items-center gap-4"><img src={getAvatar()} className="w-10 h-10 rounded-full border-2 border-red-600" alt="Profile" /><button onClick={handleSignOut} className="text-[10px] text-neutral-400 hover:text-red-500 font-bold uppercase tracking-wide">Log Out</button></div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center"><ApplicationForm currentUser={currentUser} /></main>
        </div>
    );

    const NavBtn = ({ id, label }) => (
        <button onClick={() => setActiveTab(id)} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === id ? 'text-red-600 border-red-600 shadow-[0_10px_20px_-5px_rgba(220,38,38,0.5)]' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>{label}</button>
    );

    return (
        <div className="fixed inset-0 h-full w-full bg-black text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black">
            <header className="flex-none flex flex-col md:flex-row justify-between items-center px-8 py-4 gap-4 border-b border-white/10 bg-black/80 backdrop-blur-md z-40">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-white">SYRIX <span className="text-red-600">HUB</span></h1>
                    <div className="flex gap-6 mt-2 overflow-x-auto pb-2 scrollbar-hide">
                        <NavBtn id="dashboard" label="Dashboard" /><NavBtn id="comps" label="Comps" /><NavBtn id="matches" label="Matches" /><NavBtn id="strats" label="Stratbook" /><NavBtn id="roster" label="Roster" /><NavBtn id="partners" label="Partners" /><NavBtn id="mapveto" label="Map Veto" />{isAdmin && <NavBtn id="admin" label="Admin" />}
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-neutral-900/80 p-2 rounded-2xl border border-neutral-800 backdrop-blur-sm shadow-lg">
                    <img src={getAvatar()} onClick={() => setIsProfileOpen(true)} onError={(e) => { e.target.onerror = null; e.target.src = "https://cdn.discordapp.com/embed/avatars/1.png"; }} className="w-10 h-10 rounded-full border-2 border-red-600 shadow-red-600/50 shadow-sm cursor-pointer hover:scale-105 transition-transform" alt="Profile" />
                    <div className="pr-4 border-r border-neutral-700 mr-2"><div className="text-sm font-bold text-white cursor-pointer" onClick={() => setIsProfileOpen(true)}>{currentUser.displayName}</div><button onClick={handleSignOut} className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors font-bold uppercase tracking-wide">Log Out</button></div>
                    <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); localStorage.setItem('timezone', e.target.value); }} className="bg-black border border-neutral-800 text-xs rounded-lg p-2 text-neutral-400 outline-none focus:border-red-600 transition-colors">{timezones.map(t => <option key={t} value={t}>{t}</option>)}</select>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black">
                <div className="max-w-[1920px] mx-auto">
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
                            <div className="lg:col-span-4 space-y-8">
                                <CaptainsMessage />
                                <LeaveLogger members={dynamicMembers} />
                                <Card className="border-red-900/20">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div>
                                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide flex items-center gap-2">Set Availability</h2>
                                    <div className="space-y-4">
                                        <div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Day</label><Select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</Select></div>
                                        <div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Start</label><Input type="time" value={start} onChange={e => setStart(e.target.value)} className="[color-scheme:dark]" /></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">End</label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="[color-scheme:dark]" /></div></div>
                                        <div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Pref. Role</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{ROLES.map(r => (<button key={r} onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${role === r ? 'bg-red-600 text-white border-red-500' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white'}`}>{r}</button>))}</div></div>
                                        <div className="pt-2 flex gap-2"><ButtonPrimary onClick={saveAvailability} disabled={saveStatus !== 'idle'} className="flex-1">{saveStatus === 'idle' ? 'Save Slot' : saveStatus === 'saving' ? '...' : 'Saved!'}</ButtonPrimary><ButtonSecondary onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)}>Clear</ButtonSecondary></div>
                                    </div>
                                </Card>
                                <Card className="border-red-900/20">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div>
                                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Event Operations</h2>
                                    <ScrimScheduler onSchedule={scheduleEvent} userTimezone={userTimezone} />
                                </Card>
                            </div>
                            <div className="lg:col-span-8 space-y-8">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                        <Card>
                                            <h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center uppercase tracking-wide"><span>Upcoming Events</span><span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-1 rounded font-bold">{events.length} ACTIVE</span></h2>
                                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">
                                                {events.length === 0 ? <p className="text-neutral-600 text-sm italic p-4 text-center">No scheduled events.</p> : events.map(ev => (
                                                    <div key={ev.id} className="p-3 bg-black/40 rounded-xl border border-neutral-800 flex justify-between items-center group hover:border-red-900/50 transition-colors">
                                                        <div><div className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{ev.type} <span className="text-neutral-500">vs</span> {ev.opponent || 'TBD'}</div><div className="text-xs text-neutral-400 mt-1">{ev.date} @ <span className="text-white font-mono">{ev.time}</span></div></div>
                                                        <div className="flex items-center gap-2"><div className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded uppercase font-bold tracking-wider">By {ev.scheduledBy || 'Admin'}</div><button onClick={() => openModal('Delete Event', 'Are you sure you want to remove this event?', () => deleteEvent(ev.id))} className="text-neutral-600 hover:text-red-500 p-1 rounded transition-colors">×</button></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                        <Card>
                                            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wide">Availability Heatmap</h2>
                                            <AvailabilityHeatmap availabilities={availabilities} members={dynamicMembers} />
                                        </Card>
                                    </div>
                                    <PerformanceWidget events={events} />
                                </div>
                                <Card>
                                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Detailed Timeline <span className="text-neutral-500 text-sm normal-case">({userTimezone})</span></h2>
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700">
                                        <table className="w-full text-left border-collapse min-w-[600px]">
                                            <thead>
                                                <tr className="border-b border-neutral-800">
                                                    <th className="p-3 text-xs font-bold text-neutral-500 uppercase tracking-wider w-32">Team Member</th>
                                                    {SHORT_DAYS.map(day => (<th key={day} className="p-3 text-xs font-bold text-red-600 uppercase tracking-wider text-center border-l border-neutral-800">{day}</th>))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-800/50">
                                                {dynamicMembers.map(member => (
                                                    <tr key={member} className="hover:bg-neutral-800/30 transition-colors group">
                                                        <td className="p-4 font-bold text-white text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-red-500/50 shadow-sm"></div>{member}</td>
                                                        {DAYS.map((day) => {
                                                            const slots = (displayAvailabilities[member] || []).filter(s => s.day === day);
                                                            return (<td key={day} className="p-2 align-middle border-l border-neutral-800/50"><div className="flex flex-col gap-1 items-center justify-center">{slots.length > 0 ? slots.map((s, i) => (<div key={i} className="bg-gradient-to-br from-red-600 to-red-700 text-white text-[10px] font-bold px-2 py-1 rounded w-full text-center shadow-md whitespace-nowrap">{s.start}-{s.end}{s.role && <div className="text-[8px] opacity-75 font-normal uppercase tracking-wider mt-0.5">{s.role}</div>}</div>)) : <div className="h-1 w-4 bg-neutral-800 rounded-full"></div>}</div></td>);
                                                        })}
                                                    </tr>
                                                ))}
                                                {dynamicMembers.length === 0 && (<tr><td colSpan="8" className="p-8 text-center text-neutral-500 italic">No availability data submitted yet.</td></tr>)}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}
                    {activeTab === 'comps' && (<div className="animate-fade-in-up h-full"><TeamComps members={dynamicMembers} /></div>)}
                    {activeTab === 'matches' && (<div className="animate-fade-in-up"><MatchHistory /></div>)}
                    {activeTab === 'strats' && (<div className="animate-fade-in-up h-[70vh]"><StratBook /></div>)}
                    {activeTab === 'roster' && (<div className="animate-fade-in-up h-full"><div className="mb-6"><h2 className="text-2xl font-bold text-white mb-2">Roster Management</h2><p className="text-neutral-400">Manage team roles and track tryout performance notes.</p></div><RosterManager members={dynamicMembers} /></div>)}
                    {activeTab === 'partners' && (<div className="animate-fade-in-up h-full"><div className="mb-6"><h2 className="text-2xl font-bold text-white mb-2">Scrim Partners</h2><p className="text-neutral-400">Directory of other teams for scheduling.</p></div><PartnerDirectory /></div>)}
                    {activeTab === 'admin' && isAdmin && (<div className="animate-fade-in-up h-full"><AdminPanel /></div>)}
                    {activeTab === 'mapveto' && (<div className="animate-fade-in-up h-[80vh]"><MapVeto /></div>)}
                </div>
            </main>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>{modalContent.children}</Modal>
            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} currentUser={currentUser} />
        </div>
    );
}