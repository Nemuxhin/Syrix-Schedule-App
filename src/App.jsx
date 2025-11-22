/*
Syrix Team Availability - FINAL ULTIMATE BUILD (MOBILE & DESIGN POLISH)
- DESIGN: "Team Comps" completely restyled with "Agent Card" aesthetic + Big Typography.
- MOBILE: Fully responsive grids (2-col mobile, 5-col desktop), touch-friendly buttons.
- THEME: Unified "Syrix Red" borders, shadows, and glassmorphism across all modules.
- FIXED: All previous logic maintained.
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
const MAPS = ["Ascent", "Bind", "Breeze", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset"];
const ROLES = ["Flex", "Duelist", "Initiator", "Controller", "Sentinel"];
const RANKS = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
const AGENTS = ["Jett", "Raze", "Reyna", "Yoru", "Phoenix", "Neon", "Iso", "Omen", "Astra", "Brimstone", "Viper", "Harbor", "Clove", "Sova", "Fade", "Skye", "Breach", "KAY/O", "Gekko", "Killjoy", "Cypher", "Sage", "Chamber", "Deadlock", "Vyse"];
const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

// --- Utility Functions ---
function timeToMinutes(t) { if (!t || typeof t !== 'string') return 0; if (t === '24:00') return 1440; const parts = t.split(":"); if (parts.length !== 2) return 0; return parseInt(parts[0]) * 60 + parseInt(parts[1]); }
function minutesToTime(m) { if (isNaN(m)) return "00:00"; const minutes = m % 1440; const hh = Math.floor(minutes / 60).toString().padStart(2, '0'); const mm = (minutes % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

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
    targetDate.setHours(hours || 0, minutes || 0, 0, 0);
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
    if (targetIndex === -1) return { day: '', time: '' };
    const today = new Date();
    const currentDayIndex = today.getUTCDay();
    const distance = targetIndex - currentDayIndex;
    const gmtDate = new Date(today);
    gmtDate.setUTCDate(today.getUTCDate() + distance);
    const [hours, minutes] = time.split(':').map(Number);
    gmtDate.setUTCHours(hours || 0, minutes || 0, 0, 0);
    try {
        const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23' });
        const parts = formatter.formatToParts(gmtDate);
        const part = (type) => parts.find(p => p.type === type)?.value;
        let localHours = part('hour');
        if (localHours === '24') localHours = '00';
        if (localHours?.length === 1) localHours = '0' + localHours;
        return { day: part('weekday'), time: `${localHours}:${part('minute')}` };
    } catch (e) { return { day: day, time: time }; }
};

// --- COMPONENTS ---

function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex justify-center items-center backdrop-blur-lg p-4 overflow-y-auto">
            <div className="bg-neutral-900 rounded-2xl shadow-2xl shadow-red-900/40 p-6 w-full max-w-md border border-red-900/60 animate-fade-in-up relative">
                <h3 className="text-2xl font-black text-white mb-4 border-b pb-2 border-red-900/50 uppercase tracking-wider italic">{title}</h3>
                <div className="text-neutral-300 mb-8">{children}</div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-black hover:bg-neutral-800 text-neutral-400 font-bold px-6 py-3 rounded-xl transition-all border border-neutral-800 uppercase tracking-widest text-xs">Cancel</button>
                    <button onClick={onConfirm} className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-red-900/50 transition-all uppercase tracking-widest text-xs">Confirm</button>
                </div>
            </div>
        </div>
    );
}

function LoginScreen({ signIn }) {
    return (
        <div className="fixed inset-0 h-full w-full bg-black flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black">
            <div className="text-center space-y-8 max-w-lg w-full p-10 rounded-3xl border border-red-900/30 bg-neutral-900/50 backdrop-blur-lg shadow-2xl shadow-red-900/20">
                <div className="space-y-2"><h1 className="text-6xl font-black text-white tracking-tighter drop-shadow-lg">SYRIX</h1><div className="h-1 w-32 bg-red-600 mx-auto rounded-full"></div><p className="text-neutral-400 text-lg font-medium uppercase tracking-widest">Team Hub</p></div>
                <button onClick={signIn} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 rounded-xl font-bold shadow-lg transition-transform hover:scale-105 flex items-center justify-center gap-3"><span>Login with Discord</span></button>
            </div>
        </div>
    );
}

function LeaveLogger({ members, currentUser }) {
    const [leaves, setLeaves] = useState([]);
    const [newLeave, setNewLeave] = useState({ start: '', end: '', reason: '' });

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
        if (!newLeave.start || !newLeave.end || !currentUser) return;
        await addDoc(collection(db, 'leaves'), {
            ...newLeave,
            user: currentUser.displayName,
            timestamp: new Date().toISOString()
        });
        setNewLeave({ start: '', end: '', reason: '' });
    };

    const deleteLeave = async (id) => await deleteDoc(doc(db, 'leaves', id));

    return (
        <div className="bg-neutral-900/60 p-6 rounded-3xl border border-red-900/20 shadow-xl backdrop-blur-md">
            <h3 className="text-lg font-black text-white mb-4 border-b border-red-900/30 pb-2 uppercase tracking-widest flex items-center gap-2">
                <span className="text-xl">🏖️</span> Absence Log
            </h3>
            <div className="space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={newLeave.start} onChange={e => setNewLeave({ ...newLeave, start: e.target.value })} className="w-full bg-black/50 border border-neutral-800 rounded-lg p-3 text-white text-xs outline-none focus:border-red-600 [color-scheme:dark]" />
                    <input type="date" value={newLeave.end} onChange={e => setNewLeave({ ...newLeave, end: e.target.value })} className="w-full bg-black/50 border border-neutral-800 rounded-lg p-3 text-white text-xs outline-none focus:border-red-600 [color-scheme:dark]" />
                </div>
                <input type="text" placeholder="Reason (e.g. Vacation)" value={newLeave.reason} onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })} className="w-full bg-black/50 border border-neutral-800 rounded-lg p-3 text-white text-xs outline-none focus:border-red-600 placeholder-neutral-600" />
                <button onClick={addLeave} className="w-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold py-3 rounded-lg border border-neutral-700 transition-all uppercase tracking-wider">Log Absence</button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {leaves.length === 0 && <p className="text-neutral-600 italic text-xs text-center py-2">No upcoming absences.</p>}
                {leaves.map(l => (
                    <div key={l.id} className="p-3 bg-black/40 border border-neutral-800 rounded-lg flex justify-between items-center text-xs hover:border-red-900/30 transition-colors group">
                        <div><span className="font-bold text-red-500 mr-2">{l.user}</span><span className="text-neutral-400">{l.start} - {l.end}</span><div className="text-neutral-500 italic mt-0.5">{l.reason}</div></div>
                        {(l.user === currentUser?.displayName || ADMINS.some(a => a.toLowerCase() === currentUser?.displayName?.toLowerCase())) && (
                            <button onClick={() => deleteLeave(l.id)} className="text-neutral-600 hover:text-red-500 font-bold px-2 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function NextMatchCountdown({ events }) {
    const [timeLeft, setTimeLeft] = useState('');
    const nextEvent = useMemo(() => {
        const now = new Date();
        if (!events || events.length === 0) return null;
        return events.find(e => e.date && e.time && new Date(e.date + 'T' + e.time) > now);
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
        <div className="bg-gradient-to-r from-red-950 via-black to-black p-6 rounded-3xl border border-red-600/40 shadow-2xl shadow-red-900/20 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="z-10 text-center md:text-left">
                <div className="text-xs text-red-500 font-black uppercase tracking-[0.2em] mb-2">Next Match vs {nextEvent.opponent}</div>
                <div className="text-3xl md:text-4xl font-black text-white italic tracking-tighter">{nextEvent.date} @ {nextEvent.time}</div>
                <div className="text-neutral-500 text-sm font-mono mt-1 uppercase tracking-widest">Type: {nextEvent.type}</div>
            </div>
            <div className="z-10">
                <div className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-400 font-mono tracking-tighter tabular-nums drop-shadow-sm">{timeLeft}</div>
            </div>
        </div>
    );
}

// --- REDESIGNED: Team Comps (Premium Agent Cards) ---
function TeamComps({ members }) {
    const [comps, setComps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [newComp, setNewComp] = useState({ agents: Array(5).fill(''), players: Array(5).fill('') });
    useEffect(() => { const unsub = onSnapshot(collection(db, 'comps'), (snap) => { const c = []; snap.forEach(doc => c.push({ id: doc.id, ...doc.data() })); setComps(c); }); return () => unsub(); }, []);
    const saveComp = async () => { if (newComp.agents.some(a => !a)) return; await addDoc(collection(db, 'comps'), { map: selectedMap, ...newComp }); setNewComp({ agents: Array(5).fill(''), players: Array(5).fill('') }); };
    const deleteComp = async (id) => await deleteDoc(doc(db, 'comps', id));
    const currentMapComps = comps.filter(c => c.map === selectedMap);

    return (
        <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-2xl h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

            {/* Header */}
            <h3 className="text-3xl font-black text-white mb-8 flex items-center gap-3 italic relative z-10">
                <span className="text-red-600 text-4xl">/</span> TACTICAL COMPS
            </h3>

            {/* Map Selector */}
            <div className="flex overflow-x-auto gap-4 pb-4 mb-8 scrollbar-hide snap-x relative z-10">
                {MAPS.map(m => (
                    <button key={m} onClick={() => setSelectedMap(m)} className={`px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300 snap-start border-2 ${selectedMap === m ? 'bg-red-600 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-105' : 'bg-neutral-900/80 border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 hover:bg-neutral-800'}`}>{m}</button>
                ))}
            </div>

            {/* Builder Section */}
            <div className="bg-gradient-to-b from-neutral-800/50 to-black/50 p-6 rounded-3xl border border-red-900/30 mb-10 relative z-10 backdrop-blur-sm">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4"><h4 className="text-sm font-bold text-red-500 uppercase tracking-[0.2em]">Active Lineup // {selectedMap}</h4><button onClick={saveComp} className="bg-white hover:bg-neutral-200 text-black font-black py-2 px-6 rounded-lg text-xs uppercase tracking-widest transition-all shadow-lg hover:shadow-white/20">Save Strategy</button></div>

                {/* Card Grid - Responsive: 2 cols mobile, 5 cols desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="aspect-[3/4] bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex flex-col justify-between relative group hover:border-red-600/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(220,38,38,0.15)] overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-red-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="text-[10px] font-mono text-neutral-600 mb-2 flex justify-between relative z-10"><span>0{i + 1}</span><span>ROLE</span></div>
                            <div className="flex-1 flex flex-col justify-center gap-2 relative z-10">
                                <select value={newComp.agents[i]} onChange={e => { const a = [...newComp.agents]; a[i] = e.target.value; setNewComp({ ...newComp, agents: a }); }} className="w-full bg-transparent text-xl sm:text-2xl font-black text-white outline-none focus:text-red-500 uppercase text-center appearance-none cursor-pointer hover:text-red-400 transition-colors" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}><option value="" className="bg-neutral-900 text-neutral-500">SELECT</option>{AGENTS.map(ag => <option key={ag} value={ag} className="bg-neutral-900">{ag}</option>)}</select>
                                {newComp.agents[i] ? (<div className="w-full h-1 bg-red-600 rounded-full shadow-[0_0_10px_#dc2626]"></div>) : (<div className="w-full h-1 bg-neutral-800 rounded-full"></div>)}
                                <select value={newComp.players[i]} onChange={e => { const p = [...newComp.players]; p[i] = e.target.value; setNewComp({ ...newComp, players: p }); }} className="w-full bg-transparent text-[10px] font-bold text-neutral-400 outline-none focus:text-white uppercase text-center appearance-none cursor-pointer mt-2"><option value="" className="bg-neutral-900">UNASSIGNED</option>{members.map(m => <option key={m} value={m} className="bg-neutral-900">{m}</option>)}</select>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Saved Comps */}
            <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar relative z-10">
                {currentMapComps.length === 0 && (<div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-neutral-800 rounded-2xl"><p className="text-neutral-600 italic text-sm font-mono">NO TACTICS DEFINED</p></div>)}
                {currentMapComps.map(comp => (
                    <div key={comp.id} className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl relative group hover:border-red-900/50 transition-all hover:bg-neutral-800/30">
                        <div className="absolute top-0 left-0 w-1 h-full bg-neutral-800 group-hover:bg-red-600 transition-colors rounded-l-2xl"></div>
                        <button onClick={() => deleteComp(comp.id)} className="absolute top-4 right-4 text-neutral-600 hover:text-red-500 transition-colors font-bold p-1 opacity-0 group-hover:opacity-100">DELETE</button>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                            {comp.agents.map((agent, i) => (
                                <div key={i} className="text-center relative">
                                    <div className="text-sm font-black text-white uppercase tracking-tight mb-1 group-hover:text-red-400 transition-colors truncate">{agent}</div>
                                    <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest border-t border-neutral-800 pt-1 mt-1 truncate">{comp.players[i] || 'FLEX'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
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
        <div className="bg-neutral-900 p-8 rounded-3xl border border-red-900/50 shadow-2xl">
            <h2 className="text-3xl font-black text-white mb-6 flex items-center gap-3"><span className="text-red-600">ADMIN</span> DASHBOARD</h2>
            <div className="space-y-6"><h3 className="text-xl font-bold text-neutral-400 uppercase tracking-widest border-b border-neutral-800 pb-2">Pending Applications</h3>{applications.length === 0 ? <p className="text-neutral-600 italic">No pending applications.</p> : (<div className="grid grid-cols-1 gap-4">{applications.map(app => (<div key={app.id} className="bg-black/40 border border-neutral-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between gap-6"><div className="space-y-2 flex-1"><div className="flex items-center gap-3"><h4 className="text-xl font-black text-white">{app.user}</h4><span className="bg-neutral-800 text-neutral-400 text-xs px-2 py-1 rounded font-bold uppercase">{app.rank}</span><span className="bg-neutral-800 text-neutral-400 text-xs px-2 py-1 rounded font-bold uppercase">{app.role}</span></div><p className="text-neutral-400 text-sm"><strong className="text-neutral-500">Experience:</strong> {app.exp}</p><p className="text-neutral-300 text-sm italic">"{app.why}"</p><a href={app.tracker} target="_blank" rel="noreferrer" className="text-red-500 text-xs font-bold hover:underline block mt-2">View Tracker Profile &rarr;</a></div><div className="flex flex-row md:flex-col gap-3 justify-center"><button onClick={() => acceptApplicant(app)} className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all">ACCEPT</button><button onClick={() => rejectApplicant(app.id)} className="bg-red-900/50 hover:bg-red-900 text-red-200 font-bold px-6 py-3 rounded-xl transition-all border border-red-900">REJECT</button></div></div>))}</div>)}</div>
        </div>
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
            <div className="bg-neutral-900 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-neutral-800 animate-fade-in-up">
                <h3 className="text-2xl font-black text-white mb-6">Edit Profile</h3>
                <div className="space-y-4"><div><label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Current Rank</label><select value={rank} onChange={e => setRank(e.target.value)} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div><div><label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Main Agents</label><input type="text" value={agents} onChange={e => setAgents(e.target.value)} placeholder="Jett, Raze, Omen..." className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600" /></div></div>
                <div className="mt-6 flex justify-end gap-3"><button onClick={onClose} className="px-4 py-2 text-neutral-400 hover:text-white">Cancel</button><button onClick={handleSave} className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-xl">{status === 'saving' ? 'Saving...' : 'Save Profile'}</button></div>
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
        <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-2xl max-w-3xl mx-auto animate-fade-in-up">
            <h2 className="text-3xl font-black text-white mb-2">Join the Team</h2>
            <p className="text-neutral-400 mb-8">Fill out the details below to apply for the roster.</p>
            <div className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Valorant Tracker URL</label><input type="text" value={form.tracker} onChange={e => setForm({ ...form, tracker: e.target.value })} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600 placeholder-neutral-700" placeholder="https://tracker.gg/valorant/profile/..." /></div><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Current Rank</label><select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600">{RANKS.map(r => <option key={r} value={r}>{r}</option>)}</select></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-5"><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Preferred Role</label><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600">{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></div><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Competitive Experience</label><input type="text" value={form.exp} onChange={e => setForm({ ...form, exp: e.target.value })} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600 placeholder-neutral-700" placeholder="Previous teams, tournaments..." /></div></div><div><label className="text-xs font-bold text-red-500 uppercase mb-1 block">Why do you want to join Syrix?</label><textarea value={form.why} onChange={e => setForm({ ...form, why: e.target.value })} className="w-full h-32 p-3 bg-black border border-neutral-800 rounded-xl text-white outline-none focus:border-red-600 placeholder-neutral-700 resize-none" placeholder="Tell us about yourself and your goals..." /></div><button onClick={submitApp} disabled={status !== 'idle'} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all ${status === 'success' ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-600 text-white'}`}>{status === 'idle' ? 'Submit Application' : 'Sending...'}</button></div>
        </div>
    );
}

function MapVeto() {
    const [vetoState, setVetoState] = useState({});
    useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'map_veto'), (snap) => { if (snap.exists()) setVetoState(snap.data()); }); return () => unsub(); }, []);
    const toggleMap = async (map) => { const current = vetoState[map] || 'neutral'; const next = current === 'neutral' ? 'ban' : current === 'ban' ? 'pick' : 'neutral'; await setDoc(doc(db, 'general', 'map_veto'), { ...vetoState, [map]: next }); };
    const resetVeto = async () => { await setDoc(doc(db, 'general', 'map_veto'), {}); };
    return (
        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-2xl h-full">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white">MAP VETO</h3><button onClick={resetVeto} className="text-xs text-neutral-500 hover:text-red-500 font-bold uppercase border border-neutral-700 px-3 py-1 rounded">Reset Board</button></div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{MAPS.map(map => { const status = vetoState[map] || 'neutral'; return (<div key={map} onClick={() => toggleMap(map)} className={`aspect-video rounded-xl border-2 cursor-pointer flex items-center justify-center relative overflow-hidden transition-all group ${status === 'neutral' ? 'border-neutral-800 bg-black/50 hover:border-neutral-600' : ''} ${status === 'ban' ? 'border-red-600 bg-red-900/20' : ''} ${status === 'pick' ? 'border-green-500 bg-green-900/20' : ''}`}><span className={`font-black uppercase tracking-widest text-lg z-10 transition-transform group-hover:scale-110 ${status === 'neutral' ? 'text-neutral-500' : 'text-white'}`}>{map}</span>{status !== 'neutral' && (<div className={`absolute bottom-2 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${status === 'ban' ? 'bg-red-600 text-white' : 'bg-green-500 text-black'}`}>{status}</div>)}</div>); })}</div>
        </div>
    );
}

// ... (CaptainsMessage, PerformanceWidget, RosterManager, MatchHistory, StratBook, PartnerDirectory, ScrimScheduler, AvailabilityHeatmap, LoginScreen - ALL PRESERVED)
// I will paste the unchanged components below for completeness so the file works instantly.

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
        <div className="bg-gradient-to-br from-red-900/40 to-black p-6 rounded-3xl border border-red-900/50 shadow-xl relative overflow-hidden group">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-red-600/20 rounded-full blur-3xl"></div>
            <div className="flex justify-between items-start mb-3 relative z-10">
                <h2 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2"><span className="text-2xl">📢</span> Captain's Message</h2>
                {!isEditing && <button onClick={() => { setDraft(message.text); setIsEditing(true); }} className="text-xs text-neutral-400 hover:text-white transition-colors bg-black/40 px-2 py-1 rounded border border-neutral-700">Edit</button>}
            </div>
            {isEditing ? (
                <div className="relative z-10 animate-fade-in">
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="w-full bg-black/50 border border-red-900/50 rounded-xl p-3 text-white text-sm focus:border-red-500 outline-none resize-none mb-2 h-24 placeholder-neutral-500" />
                    <div className="flex justify-end gap-2"><button onClick={() => setIsEditing(false)} className="text-xs text-neutral-400 hover:text-white px-3 py-1">Cancel</button><button onClick={handleSave} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg">Post</button></div>
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
            <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col justify-between"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Win Rate</div><div className="text-3xl font-black text-white mt-1">{stats.overallWinRate}%</div><div className="w-full bg-neutral-800 h-1.5 rounded-full mt-3 overflow-hidden"><div className="bg-red-600 h-full rounded-full" style={{ width: `${stats.overallWinRate}%` }}></div></div></div>
            <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col justify-between"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Record</div><div className="flex items-baseline gap-1 mt-1"><span className="text-3xl font-black text-green-500">{stats.wins}</span><span className="text-xl font-bold text-neutral-600">-</span><span className="text-3xl font-black text-red-500">{stats.losses}</span></div><div className="text-[10px] text-neutral-400 font-mono uppercase mt-2">W - L</div></div>
            <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col justify-between md:col-span-2 lg:col-span-1"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Best Map</div><div className="text-2xl font-black text-white mt-1 truncate">{stats.bestMap}</div>{stats.bestMap !== 'N/A' && <div className="text-xs text-green-500 font-bold mt-2">{Math.round((stats.bestMapStats.wins / stats.bestMapStats.played) * 100)}% Win Rate <span className="text-neutral-600 ml-1">({stats.bestMapStats.wins}/{stats.bestMapStats.played})</span></div>}</div>
            <div className="bg-neutral-900/80 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col justify-between hidden lg:flex"><div className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Matches Logged</div><div className="text-3xl font-black text-white mt-1">{stats.wins + stats.losses + stats.draws}</div><div className="text-[10px] text-neutral-500 mt-2">Total Scrims/Games</div></div>
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
            <div className="lg:col-span-1 bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800/50 flex flex-col h-full">
                <h3 className="text-xl font-bold text-white mb-4 border-b border-neutral-800 pb-2">Team Members</h3>
                <div className="space-y-2 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                    {members.map(m => (
                        <div key={m} onClick={() => { setSelectedMember(m); setRole(rosterData[m]?.role || 'Tryout'); setNotes(rosterData[m]?.notes || ''); setGameId(rosterData[m]?.gameId || ''); }} className={`p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center ${selectedMember === m ? 'bg-red-900/20 border-red-600' : 'bg-black/40 border-neutral-800 hover:border-neutral-600'}`}>
                            <div><div className="font-bold text-neutral-200">{m}</div>{rosterData[m]?.gameId && <div className="text-[9px] text-neutral-500 font-mono">{rosterData[m].gameId}</div>}{rosterData[m]?.rank && <div className="text-[9px] text-red-400 font-bold uppercase">{rosterData[m].rank}</div>}</div>
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${(rosterData[m]?.role === 'Captain') ? 'bg-yellow-600/20 text-yellow-500' : (rosterData[m]?.role === 'Main') ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}>{rosterData[m]?.role || 'New'}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-2 bg-neutral-900 p-6 rounded-3xl border border-neutral-800/50 shadow-2xl flex flex-col">
                {selectedMember ? (
                    <div className="h-full flex flex-col">
                        <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-red-600"></span>Managing: <span className="text-red-500">{selectedMember}</span></h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Assign Role</label><div className="grid grid-cols-2 gap-2 mb-4">{['Captain', 'Main', 'Sub', 'Tryout'].map(r => (<button key={r} onClick={() => setRole(r)} className={`p-3 rounded-lg text-sm font-bold border transition-all ${role === r ? 'bg-red-600 text-white border-red-500 shadow-lg' : 'bg-black border-neutral-800 text-neutral-400 hover:bg-neutral-800'}`}>{r}</button>))}</div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">In-Game ID (Riot ID)</label><input type="text" placeholder="Syrix#NA1" value={gameId} onChange={(e) => setGameId(e.target.value)} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none" /></div>
                            <div><label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Performance Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full h-40 p-3 bg-black border border-neutral-800 rounded-xl text-white text-sm focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none resize-none" placeholder="Enter notes about gameplay..." /></div>
                        </div>
                        <div className="mt-auto flex justify-end"><button onClick={handleSave} disabled={status !== 'idle'} className={`px-8 py-3 rounded-xl font-bold shadow-lg transition-all ${status === 'success' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-gray-200'}`}>{status === 'idle' ? 'Save Player Details' : status === 'saving' ? 'Saving...' : 'Saved!'}</button></div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-neutral-600 p-12 text-center"><div className="text-6xl mb-4">🛡️</div><p className="text-xl font-bold">Select a team member to manage</p></div>
                )}
            </div>
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

    return (
        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800/50 shadow-2xl">
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white flex items-center gap-3"><span className="text-red-600">MATCH</span> HISTORY</h3><button onClick={() => setIsAdding(!isAdding)} className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold px-4 py-2 rounded-lg border border-neutral-700 transition-all">{isAdding ? 'Cancel' : '+ LOG PAST MATCH'}</button></div>
            {isAdding && (
                <div className="mb-8 bg-neutral-800/50 p-4 rounded-xl border border-red-900/30 animate-fade-in"><h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Log Unscheduled Match</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3"><input type="text" placeholder="Opponent" value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} className="bg-black text-white text-sm p-2 rounded border border-neutral-700 outline-none focus:border-red-600" /><input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="bg-black text-white text-sm p-2 rounded border border-neutral-700 outline-none focus:border-red-600" /><select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value })} className="bg-black text-white text-sm p-2 rounded border border-neutral-700 outline-none focus:border-red-600">{MAPS.map(map => <option key={map}>{map}</option>)}</select><div className="flex gap-2"><input type="number" placeholder="Us" value={newMatch.myScore} onChange={e => setNewMatch({ ...newMatch, myScore: e.target.value })} className="w-1/2 bg-black text-white text-sm p-2 rounded border border-neutral-700 outline-none focus:border-red-600" /><input type="number" placeholder="Them" value={newMatch.enemyScore} onChange={e => setNewMatch({ ...newMatch, enemyScore: e.target.value })} className="w-1/2 bg-black text-white text-sm p-2 rounded border border-neutral-700 outline-none focus:border-red-600" /></div></div>
                    <div className="flex justify-end"><button onClick={handleManualAdd} className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2 rounded-lg shadow-lg transition-all">Save Log</button></div></div>
            )}
            <div className="space-y-4">{matches.length === 0 && <p className="text-neutral-500 italic">No past matches found.</p>}
                {matches.map(m => (<div key={m.id} className="bg-black/40 border border-neutral-800 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 hover:border-neutral-700 transition-colors"><div className="flex-1"><div className="text-sm font-bold text-red-500 uppercase tracking-wider">{m.type}</div><div className="text-xl font-black text-white">{m.opponent || 'Unknown Opponent'}</div><div className="text-xs text-neutral-500">{m.date}</div></div>{editingId === m.id ? (<div className="flex flex-wrap gap-2 items-center bg-neutral-900 p-2 rounded-lg border border-neutral-700"><select value={editForm.map} onChange={e => setEditForm({ ...editForm, map: e.target.value })} className="bg-black text-white text-xs p-2 rounded border border-neutral-700 outline-none">{MAPS.map(map => <option key={map}>{map}</option>)}</select><input type="number" placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} className="w-12 bg-black text-white text-xs p-2 rounded border border-neutral-700 outline-none" /><span className="text-white">-</span><input type="number" placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} className="w-12 bg-black text-white text-xs p-2 rounded border border-neutral-700 outline-none" /><input type="text" placeholder="VOD Link" value={editForm.vod} onChange={e => setEditForm({ ...editForm, vod: e.target.value })} className="w-32 bg-black text-white text-xs p-2 rounded border border-neutral-700 outline-none" /><button onClick={() => handleUpdate(m.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Save</button></div>) : (<div className="flex items-center gap-6">{m.result ? (<div className="text-center"><div className={`text-2xl font-black ${m.result.myScore > m.result.enemyScore ? 'text-green-500' : 'text-red-500'}`}>{m.result.myScore} - {m.result.enemyScore}</div><div className="text-[10px] uppercase font-bold text-neutral-500">{m.result.map}</div></div>) : (<span className="text-neutral-600 text-sm italic">No result logged</span>)}<div className="flex flex-col gap-2">{m.result?.vod && (<a href={m.result.vod} target="_blank" rel="noreferrer" className="text-xs bg-red-600/20 text-red-400 border border-red-600/50 px-3 py-1 rounded uppercase font-bold hover:bg-red-600 hover:text-white transition-colors text-center">Watch VOD</a>)}<button onClick={() => { setEditingId(m.id); setEditForm(m.result || { myScore: '', enemyScore: '', map: MAPS[0], vod: '' }) }} className="text-xs text-neutral-500 hover:text-white underline">Edit Result</button></div></div>)}</div>))}</div>
        </div>
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
        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800/50 shadow-2xl h-full">
            <h3 className="text-2xl font-black text-white mb-6">STRATBOOK</h3>
            <div className="flex overflow-x-auto gap-2 pb-4 mb-4 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black">{MAPS.map(m => (<button key={m} onClick={() => setSelectedMap(m)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${selectedMap === m ? 'bg-red-600 text-white shadow-lg' : 'bg-black border border-neutral-800 text-neutral-500 hover:text-white'}`}>{m}</button>))}</div>
            <div className="space-y-3 mb-6"><div className="flex gap-2"><input type="text" placeholder="Strat Name (e.g. A Split)" value={newStrat.title} onChange={e => setNewStrat({ ...newStrat, title: e.target.value })} className="flex-1 bg-black border border-neutral-800 rounded-lg p-2 text-white text-sm outline-none focus:border-red-600" /><input type="text" placeholder="Link (Valoplant/Doc)" value={newStrat.link} onChange={e => setNewStrat({ ...newStrat, link: e.target.value })} className="flex-1 bg-black border border-neutral-800 rounded-lg p-2 text-white text-sm outline-none focus:border-red-600" /><button onClick={addStrat} className="bg-white text-black font-bold px-4 rounded-lg hover:bg-gray-200">+</button></div></div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">{filteredStrats.length === 0 && <p className="text-neutral-600 italic text-sm">No strats for {selectedMap} yet.</p>}{filteredStrats.map(s => (<div key={s.id} className="p-3 bg-black/40 border border-neutral-800 rounded-lg flex justify-between items-center group hover:border-red-900/50 transition-colors"><span className="font-bold text-neutral-200">{s.title}</span><div className="flex gap-3">{s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-xs text-red-400 hover:underline">View</a>}<button onClick={() => deleteStrat(s.id)} className="text-neutral-600 hover:text-red-500">×</button></div></div>))}</div>
        </div>
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
        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800/50 shadow-2xl h-full">
            <h3 className="text-2xl font-black text-white mb-6">SCRIM PARTNERS</h3>
            <div className="space-y-3 mb-6 p-4 bg-black/30 rounded-xl border border-neutral-800"><input type="text" placeholder="Team Name" value={newPartner.name} onChange={e => setNewPartner({ ...newPartner, name: e.target.value })} className="w-full bg-black border border-neutral-800 rounded-lg p-2 text-white text-sm outline-none focus:border-red-600 mb-2" /><div className="flex gap-2"><input type="text" placeholder="Contact (Discord)" value={newPartner.contact} onChange={e => setNewPartner({ ...newPartner, contact: e.target.value })} className="flex-1 bg-black border border-neutral-800 rounded-lg p-2 text-white text-sm outline-none focus:border-red-600" /><input type="text" placeholder="Notes" value={newPartner.notes} onChange={e => setNewPartner({ ...newPartner, notes: e.target.value })} className="flex-1 bg-black border border-neutral-800 rounded-lg p-2 text-white text-sm outline-none focus:border-red-600" /></div><button onClick={addPartner} className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-2 rounded-lg text-sm mt-2">Add Partner</button></div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">{partners.map(p => (<div key={p.id} className="p-4 bg-black/40 border border-neutral-800 rounded-xl"><div className="flex justify-between items-start"><div><div className="font-bold text-lg text-white">{p.name}</div><div className="text-xs text-red-400 font-mono">{p.contact}</div></div><button onClick={() => deleteDoc(doc(db, 'partners', p.id))} className="text-neutral-600 hover:text-red-500">×</button></div>{p.notes && <div className="mt-2 text-sm text-neutral-400 bg-neutral-900/50 p-2 rounded">{p.notes}</div>}</div>))}</div>
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

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => {
        const provider = new OAuthProvider('oidc.discord');
        provider.addScope('identify');
        try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
    };

    const handleSignOut = async () => await signOut(auth);

    // Data Listeners & Access Control
    useEffect(() => {
        if (!currentUser) {
            setMembershipLoading(false);
            return;
        }

        setMembershipLoading(true);

        // Strict Access Control: Must have a ROLE in the roster to see dashboard
        const checkMembership = onSnapshot(doc(db, 'roster', currentUser.displayName), (docSnap) => {
            const isAdmin = ADMINS.some(admin => admin.toLowerCase() === currentUser.displayName.toLowerCase());
            const isAuthorized = (docSnap.exists() && docSnap.data().role) || isAdmin;

            setIsMember(isAuthorized);
            setMembershipLoading(false); // Loaded
        });

        // Standard Listeners
        const unsubAvail = onSnapshot(collection(db, 'availabilities'), (snap) => {
            const data = {};
            snap.forEach(doc => data[doc.id] = doc.data().slots || []);
            setAvailabilities(data);
        });

        const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
            const evs = [];
            snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() }));
            evs.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
            setEvents(evs);
        });

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
                if (localStart.day === localEnd.day) {
                    if (timeToMinutes(localStart.time) < timeToMinutes(localEnd.time)) converted[member].push({ day: localStart.day, start: localStart.time, end: localEnd.time, role });
                } else {
                    converted[member].push({ day: localStart.day, start: localStart.time, end: '24:00', role });
                    if (timeToMinutes(localEnd.time) > 0) converted[member].push({ day: localEnd.day, start: '00:00', end: localEnd.time, role });
                }
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

    // Actions
    const openModal = (title, message, onConfirm) => { setModalContent({ title, children: message, onConfirm }); setIsModalOpen(true); };

    const saveAvailability = async () => {
        if (timeToMinutes(end) <= timeToMinutes(start)) return openModal('Error', 'End time must be after start.', () => setIsModalOpen(false));
        setSaveStatus('saving');

        const gmtStart = convertToGMT(day, start);
        const gmtEnd = convertToGMT(day, end);
        const existing = availabilities[currentUser.displayName] || [];
        const others = existing.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day);
        const newSlots = [...others, { day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time, role }];

        try {
            await setDoc(doc(db, 'availabilities', currentUser.displayName), { slots: newSlots });
            setSaveStatus('success');
        } catch (e) { console.error(e); setSaveStatus('idle'); }
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const clearDay = async () => {
        const existing = availabilities[currentUser.displayName] || [];
        const newSlots = existing.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day);
        await setDoc(doc(db, 'availabilities', currentUser.displayName), { slots: newSlots });
        setIsModalOpen(false);
    };

    const clearAll = async () => {
        await deleteDoc(doc(db, 'availabilities', currentUser.displayName));
        setIsModalOpen(false);
    };

    const scheduleEvent = async (eventData) => {
        await addDoc(collection(db, 'events'), eventData);
        const content = {
            embeds: [{
                title: `🔴 New ${eventData.type} Scheduled!`,
                color: 15158332,
                fields: [
                    { name: 'Type', value: eventData.type, inline: true },
                    { name: 'Opponent/Info', value: eventData.opponent || 'N/A', inline: true },
                    { name: 'When', value: `${eventData.date} at ${eventData.time} (${eventData.timezone})` },
                    { name: 'Scheduled By', value: currentUser.displayName }
                ],
                footer: { text: "Syrix Hub" },
                timestamp: new Date().toISOString()
            }]
        };
        try { await fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) }); } catch (e) { console.error(e); }
    };

    const deleteEvent = async (id) => {
        await deleteDoc(doc(db, 'events', id));
        setIsModalOpen(false);
    };

    if (authLoading || (currentUser && membershipLoading)) return <div className="fixed inset-0 h-full w-full bg-black flex items-center justify-center text-red-600 font-bold text-xl animate-pulse">LOADING SYRIX HUB...</div>;
    if (!currentUser) return <LoginScreen signIn={signIn} />;

    // VIEW GUARD: If NOT a member, FORCE Apply View
    if (!isMember) {
        return (
            <div className="fixed inset-0 h-full w-full bg-black text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden">
                <header className="flex-none flex justify-between items-center px-8 py-4 border-b border-red-900/30 bg-black/90 backdrop-blur-md z-40">
                    <h1 className="text-3xl font-black tracking-tighter text-white">SYRIX <span className="text-red-600">HUB</span></h1>
                    <div className="flex items-center gap-4">
                        <img src={getAvatar()} className="w-10 h-10 rounded-full border-2 border-red-600" alt="Profile" />
                        <button onClick={handleSignOut} className="text-[10px] text-neutral-400 hover:text-red-500 font-bold uppercase tracking-wide">Log Out</button>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
                    <ApplicationForm currentUser={currentUser} />
                </main>
            </div>
        );
    }

    // Helper for Main Nav
    const NavBtn = ({ id, label }) => (
        <button onClick={() => setActiveTab(id)} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === id ? 'text-red-500 border-red-500' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
            {label}
        </button>
    );

    return (
        <div className="fixed inset-0 h-full w-full bg-black text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden">
            {/* Header & Nav */}
            <header className="flex-none flex flex-col md:flex-row justify-between items-center px-8 py-4 gap-4 border-b border-red-900/30 bg-black/90 backdrop-blur-md z-40">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-white">SYRIX <span className="text-red-600">HUB</span></h1>
                    <div className="flex gap-6 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                        <NavBtn id="dashboard" label="Dashboard" />
                        <NavBtn id="comps" label="Comps" />
                        <NavBtn id="matches" label="Matches" />
                        <NavBtn id="strats" label="Stratbook" />
                        <NavBtn id="roster" label="Roster" />
                        <NavBtn id="partners" label="Partners" />
                        <NavBtn id="mapveto" label="Map Veto" />
                        {isAdmin && <NavBtn id="admin" label="Admin" />}
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-neutral-900/80 p-2 rounded-2xl border border-neutral-800 backdrop-blur-sm shadow-lg">
                    <img
                        src={getAvatar()}
                        onClick={() => setIsProfileOpen(true)}
                        onError={(e) => { e.target.onerror = null; e.target.src = "https://cdn.discordapp.com/embed/avatars/1.png"; }}
                        className="w-10 h-10 rounded-full border-2 border-red-600 shadow-red-600/50 shadow-sm cursor-pointer hover:scale-105 transition-transform"
                        alt="Profile"
                    />
                    <div className="pr-4 border-r border-neutral-700 mr-2">
                        <div className="text-sm font-bold text-white cursor-pointer" onClick={() => setIsProfileOpen(true)}>{currentUser.displayName}</div>
                        <button onClick={handleSignOut} className="text-[10px] text-neutral-400 hover:text-red-500 transition-colors font-bold uppercase tracking-wide">Log Out</button>
                    </div>
                    <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); localStorage.setItem('timezone', e.target.value); }} className="bg-black border border-neutral-800 text-xs rounded-lg p-2 text-neutral-400 outline-none focus:border-red-600 transition-colors">
                        {timezones.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </header>

            {/* Main Content Area - Scrollable */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black">
                <div className="max-w-[1920px] mx-auto">
                    {/* 1. DASHBOARD (Home) */}
                    {activeTab === 'dashboard' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
                            <div className="lg:col-span-4 space-y-8">
                                <CaptainsMessage />
                                <LeaveLogger members={dynamicMembers} currentUser={currentUser} />
                                <div className="bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800 shadow-xl backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50 group-hover:bg-red-600 transition-colors"></div>
                                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide flex items-center gap-2">Set Availability</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Day</label>
                                            <select value={day} onChange={e => setDay(e.target.value)} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all">
                                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Start</label>
                                                <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none [color-scheme:dark]" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">End</label>
                                                <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full p-3 bg-black border border-neutral-800 rounded-xl text-white focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none [color-scheme:dark]" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Pref. Role</label>
                                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                {ROLES.map(r => (
                                                    <button key={r} onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${role === r ? 'bg-red-600 text-white border-red-500' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white'}`}>
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="pt-2 flex gap-2">
                                            <button onClick={saveAvailability} disabled={saveStatus !== 'idle'} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-wider shadow-lg transition-all transform active:scale-95 ${saveStatus === 'success' ? 'bg-green-600 text-white' : 'bg-red-700 hover:bg-red-600 text-white shadow-red-900/30'}`}>
                                                {saveStatus === 'idle' ? 'Save Slot' : saveStatus === 'saving' ? '...' : 'Saved!'}
                                            </button>
                                            <button onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)} className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300 font-bold transition-colors border border-neutral-700">Clear</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800 shadow-xl backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50 group-hover:bg-red-600 transition-colors"></div>
                                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Event Operations</h2>
                                    <ScrimScheduler onSchedule={scheduleEvent} userTimezone={userTimezone} />
                                </div>
                            </div>

                            {/* Right Column: Data Visualization */}
                            <div className="lg:col-span-8 space-y-8">
                                <div className="space-y-8">
                                    <NextMatchCountdown events={events} />
                                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                        <div className="bg-neutral-900/80 p-6 rounded-3xl border border-neutral-800 shadow-2xl">
                                            <h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center uppercase tracking-wide">
                                                <span>Upcoming Events</span>
                                                <span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-1 rounded font-bold">{events.length} ACTIVE</span>
                                            </h2>
                                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">
                                                {events.length === 0 ? <p className="text-neutral-600 text-sm italic p-4 text-center">No scheduled events.</p> : events.map(ev => (
                                                    <div key={ev.id} className="p-3 bg-black/40 rounded-xl border border-neutral-800 flex justify-between items-center group hover:border-red-900/50 transition-colors">
                                                        <div>
                                                            <div className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{ev.type} <span className="text-neutral-500">vs</span> {ev.opponent || 'TBD'}</div>
                                                            <div className="text-xs text-neutral-400 mt-1">{ev.date} @ <span className="text-white font-mono">{ev.time}</span></div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded uppercase font-bold tracking-wider">By {ev.scheduledBy || 'Admin'}</div>
                                                            <button onClick={() => openModal('Delete Event', 'Are you sure you want to remove this event?', () => deleteEvent(ev.id))} className="text-neutral-600 hover:text-red-500 p-1 rounded transition-colors">×</button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800">
                                            <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wide">Availability Heatmap</h2>
                                            <AvailabilityHeatmap availabilities={availabilities} members={dynamicMembers} />
                                        </div>
                                    </div>
                                    <PerformanceWidget events={events} />
                                </div>
                                <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-2xl">
                                    <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Detailed Timeline <span className="text-neutral-500 text-sm normal-case">({userTimezone})</span></h2>
                                    <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700">
                                        <table className="w-full text-left border-collapse min-w-[600px]">
                                            <thead>
                                                <tr className="border-b border-neutral-800">
                                                    <th className="p-3 text-xs font-bold text-neutral-500 uppercase tracking-wider w-32">Team Member</th>
                                                    {SHORT_DAYS.map(day => (
                                                        <th key={day} className="p-3 text-xs font-bold text-red-600 uppercase tracking-wider text-center border-l border-neutral-800">{day}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-neutral-800/50">
                                                {dynamicMembers.map(member => (
                                                    <tr key={member} className="hover:bg-neutral-800/30 transition-colors group">
                                                        <td className="p-4 font-bold text-white text-sm flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-red-500/50 shadow-sm"></div>
                                                            {member}
                                                        </td>
                                                        {DAYS.map((day) => {
                                                            const slots = (displayAvailabilities[member] || []).filter(s => s.day === day);
                                                            return (
                                                                <td key={day} className="p-2 align-middle border-l border-neutral-800/50">
                                                                    <div className="flex flex-col gap-1 items-center justify-center">
                                                                        {slots.length > 0 ? slots.map((s, i) => (
                                                                            <div key={i} className="bg-gradient-to-br from-red-600 to-red-700 text-white text-[10px] font-bold px-2 py-1 rounded w-full text-center shadow-md whitespace-nowrap">
                                                                                {s.start}-{s.end}
                                                                                {s.role && <div className="text-[8px] opacity-75 font-normal uppercase tracking-wider mt-0.5">{s.role}</div>}
                                                                            </div>
                                                                        )) : <div className="h-1 w-4 bg-neutral-800 rounded-full"></div>}
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. TEAM COMPS View */}
                    {activeTab === 'comps' && (
                        <div className="animate-fade-in-up h-full"><TeamComps members={dynamicMembers} /></div>
                    )}

                    {/* 3. MATCH HISTORY View */}
                    {activeTab === 'matches' && (
                        <div className="animate-fade-in-up"><MatchHistory /></div>
                    )}

                    {/* 4. STRATBOOK View */}
                    {activeTab === 'strats' && (
                        <div className="animate-fade-in-up h-[70vh]"><StratBook /></div>
                    )}

                    {/* 5. ROSTER View */}
                    {activeTab === 'roster' && (
                        <div className="animate-fade-in-up h-full">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">Roster Management</h2>
                                <p className="text-neutral-400">Manage team roles and track tryout performance notes.</p>
                            </div>
                            <RosterManager members={dynamicMembers} />
                        </div>
                    )}

                    {/* 6. PARTNERS View */}
                    {activeTab === 'partners' && (
                        <div className="animate-fade-in-up h-full">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-white mb-2">Scrim Partners</h2>
                                <p className="text-neutral-400">Directory of other teams for scheduling.</p>
                            </div>
                            <PartnerDirectory />
                        </div>
                    )}

                    {/* 7. ADMIN */}
                    {activeTab === 'admin' && isAdmin && (
                        <div className="animate-fade-in-up h-full"><AdminPanel /></div>
                    )}

                    {/* 8. MAP VETO */}
                    {activeTab === 'mapveto' && isMember && (
                        <div className="animate-fade-in-up h-[80vh]"><MapVeto /></div>
                    )}

                </div>
            </main>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>
                {modalContent.children}
            </Modal>

            <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} currentUser={currentUser} />
        </div>
    );
}