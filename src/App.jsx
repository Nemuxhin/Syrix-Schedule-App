/*
Syrix Team Availability - v5.0 (VALOPLANT UPDATE)
- STRATBOOK 2.0: Full "Tactical Planner" functionality.
- DRAG & DROP: Drag Agents and Utility icons onto the map.
- SMART LAYERS: Draw lines AND move icons simultaneously.
- EXPORT: Merges Map, Drawings, and Icons into one saved image.
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
    Flex: <span className="font-bold text-xs">FLX</span>
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

// --- SHARED UI COMPONENTS ---
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
                agentData.data.forEach(agent => { aMap[agent.displayName] = agent.displayIcon; });
                setAgentImages(aMap);

                const mapRes = await fetch('https://valorant-api.com/v1/maps');
                const mapData = await mapRes.json();
                const mMap = {};
                mapData.data.forEach(map => { mMap[map.displayName] = map.displayIcon; });
                setMapImages(mMap);
            } catch (e) { console.error("Failed to fetch Valorant assets", e); }
        };
        fetchAssets();
    }, []);
    return { agentImages, mapImages };
};

// --- ANIMATED STAMPS ---
const VictoryStamp = () => (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-green-500 text-green-500 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter -rotate-12 opacity-0 animate-stamp-in pointer-events-none mix-blend-screen">VICTORY</div>
);
const DefeatStamp = () => (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-red-600 text-red-600 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter rotate-12 opacity-0 animate-stamp-in pointer-events-none mix-blend-screen">DEFEAT</div>
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

function StratBook() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const { mapImages, agentImages } = useValorantData();
    const [color, setColor] = useState('#ef4444');

    // ValoPlant Features: Icons & Links
    const [mapIcons, setMapIcons] = useState([]); // { id, type, name, x, y }
    const [dragItem, setDragItem] = useState(null); // Item being dragged from sidebar
    const [movingIcon, setMovingIcon] = useState(null); // Icon being moved on map

    const [links, setLinks] = useState([]);
    const [savedStrats, setSavedStrats] = useState([]);
    const [viewingStrat, setViewingStrat] = useState(null);
    const [newLink, setNewLink] = useState({ title: '', url: '' });

    useEffect(() => {
        const qLinks = query(collection(db, 'strat_links'), where("map", "==", selectedMap));
        const unsubLinks = onSnapshot(qLinks, (snap) => {
            const l = []; snap.forEach(doc => l.push({ id: doc.id, ...doc.data() })); setLinks(l);
        });
        const qStrats = query(collection(db, 'strats'), where("map", "==", selectedMap));
        const unsubStrats = onSnapshot(qStrats, (snap) => {
            const s = []; snap.forEach(doc => s.push({ id: doc.id, ...doc.data() }));
            s.sort((a, b) => new Date(b.date) - new Date(a.date));
            setSavedStrats(s);
        });
        return () => { unsubLinks(); unsubStrats(); };
    }, [selectedMap]);

    // --- CANVAS DRAWING ---
    const getPos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.nativeEvent ? e.nativeEvent.clientX : e.touches[0].clientX;
        const clientY = e.nativeEvent ? e.nativeEvent.clientY : e.touches[0].clientY;
        return { x: (clientX - rect.left) * (canvasRef.current.width / rect.width), y: (clientY - rect.top) * (canvasRef.current.height / rect.height) };
    };

    const startDraw = (e) => {
        if (movingIcon) return; // Don't draw if moving an icon
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
        setMapIcons([]); // Clear icons too
    };

    // --- DRAG & DROP ---
    const handleDrop = (e) => {
        e.preventDefault();
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100; // Store as %
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        if (dragItem) {
            // New Item from Sidebar
            setMapIcons([...mapIcons, { id: Date.now(), ...dragItem, x, y }]);
            setDragItem(null);
        } else if (movingIcon !== null) {
            // Moving Existing Item
            const updated = [...mapIcons];
            updated[movingIcon] = { ...updated[movingIcon], x, y };
            setMapIcons(updated);
            setMovingIcon(null);
        }
    };

    const removeIcon = (index) => {
        const updated = [...mapIcons];
        updated.splice(index, 1);
        setMapIcons(updated);
    };

    // --- SAVING ---
    const saveStrat = async () => {
        // Merge Icons onto Canvas for Snapshot
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 1280; tempCanvas.height = 720;
        const ctx = tempCanvas.getContext('2d');

        // 1. Draw Background Map (if exists)
        if (mapImages[selectedMap]) {
            const img = new Image();
            img.src = mapImages[selectedMap];
            img.crossOrigin = "anonymous";
            await new Promise(r => { img.onload = r; img.onerror = r; }); // Wait for load
            ctx.drawImage(img, 0, 0, 1280, 720);
        }

        // 2. Draw Drawings
        ctx.drawImage(canvasRef.current, 0, 0);

        // 3. Draw Icons
        for (const icon of mapIcons) {
            const img = new Image();
            if (icon.type === 'agent') img.src = agentImages[icon.name];
            // For generic util, we draw shapes
            await new Promise(r => { img.onload = r; img.onerror = r; });

            const px = (icon.x / 100) * 1280;
            const py = (icon.y / 100) * 720;

            if (icon.type === 'agent') {
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
            <div className="flex gap-4 h-[75vh]">
                {/* --- SIDEBAR: ASSETS --- */}
                <Card className="w-24 flex flex-col gap-4 overflow-y-auto custom-scrollbar !p-3">
                    <div className="text-[10px] font-bold text-neutral-500 text-center uppercase">Util</div>
                    {UTILITY_TYPES.map(u => (
                        <div
                            key={u.id} draggable
                            onDragStart={() => setDragItem({ type: 'util', ...u })}
                            className="w-10 h-10 rounded-full mx-auto cursor-grab active:cursor-grabbing border-2 border-white/20 hover:scale-110 transition-transform shadow-lg"
                            style={{ backgroundColor: u.color }}
                            title={u.label}
                        ></div>
                    ))}
                    <div className="text-[10px] font-bold text-neutral-500 text-center uppercase mt-4">Agents</div>
                    {AGENT_NAMES.map(a => (
                        <img
                            key={a} src={agentImages[a]} alt={a} draggable
                            onDragStart={() => setDragItem({ type: 'agent', name: a })}
                            className="w-12 h-12 rounded-full mx-auto border border-neutral-700 bg-neutral-900 p-1 cursor-grab active:cursor-grabbing hover:border-red-500 transition-colors"
                        />
                    ))}
                </Card>

                {/* --- MAIN BOARD --- */}
                <Card className="flex-1 flex flex-col relative">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-black text-white">STRATBOOK {viewingStrat && <span className="text-red-500 text-sm ml-2">(VIEWING)</span>}</h3>
                        <div className="flex gap-2">
                            {!viewingStrat ? (
                                <>
                                    <button onClick={() => setColor('#ef4444')} className="w-6 h-6 rounded-full bg-red-500 border border-white"></button>
                                    <button onClick={() => setColor('#3b82f6')} className="w-6 h-6 rounded-full bg-blue-500 border border-white"></button>
                                    <button onClick={() => setColor('#ffffff')} className="w-6 h-6 rounded-full bg-white border border-white"></button>
                                    <ButtonSecondary onClick={clearCanvas} className="text-xs py-1 px-3">Clear</ButtonSecondary>
                                    <ButtonPrimary onClick={saveStrat} className="text-xs py-1 px-3">Save</ButtonPrimary>
                                </>
                            ) : <ButtonSecondary onClick={() => setViewingStrat(null)} className="text-xs bg-red-900/50 border-red-500 text-white">Close</ButtonSecondary>}
                        </div>
                    </div>
                    <div className="flex overflow-x-auto gap-2 pb-4 mb-2">{MAPS.map(m => <button key={m} onClick={() => { setSelectedMap(m); clearCanvas(); setViewingStrat(null); }} className={`px-3 py-1 rounded-full text-xs font-bold ${selectedMap === m ? 'bg-red-600 text-white' : 'bg-black text-neutral-500'}`}>{m}</button>)}</div>

                    <div
                        ref={containerRef}
                        className="relative flex-1 bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800"
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        {/* 1. Map Background */}
                        {mapImages[selectedMap] && <img src={mapImages[selectedMap]} alt="Map" className="absolute inset-0 w-full h-full object-contain opacity-90 pointer-events-none" />}

                        {/* 2. Icons Layer (Draggable) */}
                        {!viewingStrat && mapIcons.map((icon, i) => (
                            <div
                                key={icon.id}
                                className="absolute cursor-move hover:scale-110 transition-transform z-20"
                                style={{ left: `${icon.x}%`, top: `${icon.y}%`, transform: 'translate(-50%, -50%)' }}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); setMovingIcon(i); }}
                                onDoubleClick={(e) => { e.stopPropagation(); removeIcon(i); }}
                            >
                                {icon.type === 'agent' ? (
                                    <img src={agentImages[icon.name]} alt={icon.name} className="w-10 h-10 rounded-full border-2 border-white shadow-md pointer-events-none" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full shadow-md border border-white" style={{ backgroundColor: icon.color }}></div>
                                )}
                            </div>
                        ))}

                        {/* 3. Canvas Layer (Drawing) */}
                        <canvas
                            ref={canvasRef} width={1280} height={720}
                            className={`absolute inset-0 w-full h-full z-10 touch-none ${viewingStrat ? 'hidden' : 'cursor-crosshair'}`}
                            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                        />

                        {/* 4. Viewing Overlay */}
                        {viewingStrat && <div className="absolute inset-0 z-30 bg-black/50 flex items-center justify-center"><img src={viewingStrat} alt="Saved Strat" className="max-w-full max-h-full rounded-xl border border-red-500 shadow-2xl" /></div>}
                    </div>
                </Card>
            </div>

            {/* Bottom: Links & Saved */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h4 className="text-lg font-bold text-white mb-4">EXTERNAL LINKS</h4>
                    <div className="flex gap-2 mb-4"><Input placeholder="Title" value={newLink.title} onChange={e => setNewLink({ ...newLink, title: e.target.value })} className="flex-1" /><Input placeholder="URL" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} className="flex-1" /><ButtonPrimary onClick={addLink} className="text-xs py-2">Add</ButtonPrimary></div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">{links.map(l => <div key={l.id} className="flex justify-between items-center bg-black/50 p-3 rounded-lg border border-neutral-800"><a href={l.url} target="_blank" rel="noreferrer" className="text-red-500 font-bold hover:underline text-sm">{l.title}</a><button onClick={() => deleteLink(l.id)} className="text-neutral-600 hover:text-red-500">×</button></div>)}</div>
                </Card>
                <Card>
                    <h4 className="text-lg font-bold text-white mb-4">SAVED STRATS</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">{savedStrats.length === 0 && <p className="text-neutral-500 italic text-sm">No saved strats.</p>}{savedStrats.map((s, i) => <div key={s.id} onClick={() => setViewingStrat(s.image)} className="flex justify-between items-center bg-black/50 p-3 rounded-lg border border-neutral-800 hover:border-red-500 cursor-pointer group"><span className="text-xs text-white font-mono">Strat #{savedStrats.length - i} - {new Date(s.date).toLocaleDateString()}</span><button onClick={(e) => { e.stopPropagation(); deleteStrat(s.id) }} className="text-neutral-600 hover:text-red-500 font-bold">DEL</button></div>)}</div>
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
    const getResultColor = (my, enemy) => { const m = parseInt(my); const e = parseInt(enemy); if (m > e) return 'border-l-4 border-l-green-500'; if (m < e) return 'border-l-4 border-l-red-600'; return 'border-l-4 border-l-neutral-500'; };

    return (
        <Card>
            <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white flex items-center gap-3"><span className="text-red-600">MATCH</span> HISTORY</h3><ButtonSecondary onClick={() => setIsAdding(!isAdding)} className="text-xs">{isAdding ? 'Cancel' : '+ Log Match'}</ButtonSecondary></div>
            {isAdding && (<div className="mb-6 bg-black/50 p-4 rounded-xl border border-white/10 space-y-2 animate-fade-in"><div className="grid grid-cols-2 gap-2"><Input placeholder="Opponent" value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} /><Input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="[color-scheme:dark]" /></div><div className="grid grid-cols-2 gap-2"><Select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value })}>{MAPS.map(m => <option key={m}>{m}</option>)}</Select><Input placeholder="VOD Link" value={newMatch.vod} onChange={e => setNewMatch({ ...newMatch, vod: e.target.value })} /></div><div className="grid grid-cols-4 gap-2"><Input placeholder="Us" value={newMatch.myScore} onChange={e => setNewMatch({ ...newMatch, myScore: e.target.value })} /><Input placeholder="Them" value={newMatch.enemyScore} onChange={e => setNewMatch({ ...newMatch, enemyScore: e.target.value })} /><Input placeholder="Atk" value={newMatch.atkScore} onChange={e => setNewMatch({ ...newMatch, atkScore: e.target.value })} /><Input placeholder="Def" value={newMatch.defScore} onChange={e => setNewMatch({ ...newMatch, defScore: e.target.value })} /></div><ButtonPrimary onClick={handleAdd} className="w-full py-2 text-xs">Save Result</ButtonPrimary></div>)}
            <div className="space-y-4">
                {matches.map(m => {
                    if (editingId === m.id) return (<div key={m.id} className="bg-neutral-900 border border-red-600 p-4 rounded-xl space-y-2"><div className="flex justify-between mb-2"><span className="text-red-500 font-bold text-xs uppercase">Editing Match</span><button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-white">Cancel</button></div><div className="grid grid-cols-2 gap-2"><Input value={editForm.opponent} onChange={e => setEditForm({ ...editForm, opponent: e.target.value })} /><Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="[color-scheme:dark]" /></div><div className="grid grid-cols-2 gap-2"><Select value={editForm.map} onChange={e => setEditForm({ ...editForm, map: e.target.value })}>{MAPS.map(map => <option key={map}>{map}</option>)}</Select><Input placeholder="VOD Link" value={editForm.vod} onChange={e => setEditForm({ ...editForm, vod: e.target.value })} /></div><div className="grid grid-cols-4 gap-2"><Input placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} /><Input placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} /><Input placeholder="Atk" value={editForm.atkScore} onChange={e => setEditForm({ ...editForm, atkScore: e.target.value })} /><Input placeholder="Def" value={editForm.defScore} onChange={e => setEditForm({ ...editForm, defScore: e.target.value })} /></div><ButtonPrimary onClick={saveEdit} className="w-full py-2 text-xs">Save Changes</ButtonPrimary></div>);
                    return (<div key={m.id} onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className={`bg-black/40 border border-neutral-800 p-4 rounded-xl relative overflow-hidden cursor-pointer hover:bg-neutral-900 transition-all ${m.result ? getResultColor(m.result.myScore, m.result.enemyScore) : ''}`}>{expandedId === m.id && (parseInt(m.result.myScore) > parseInt(m.result.enemyScore) ? <VictoryStamp /> : <DefeatStamp />)}<div className="flex justify-between items-center relative z-10"><div><div className="text-sm font-bold text-white flex items-center gap-2">{m.opponent} {m.result.vod && <a href={m.result.vod} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-500">▶ WATCH VOD</a>}</div><div className="text-xs text-neutral-500">{m.date} • {m.result.map}</div></div><div className="flex items-center gap-4"><div className={`text-2xl font-black ${parseInt(m.result.myScore) > parseInt(m.result.enemyScore) ? 'text-green-500' : 'text-red-500'}`}>{m.result.myScore} - {m.result.enemyScore}</div><button onClick={(e) => { e.stopPropagation(); startEdit(m); }} className="text-neutral-600 hover:text-white p-1">✏️</button></div></div>{expandedId === m.id && (<div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-2 gap-4 text-center"><div className="bg-neutral-900 p-2 rounded"><div className="text-[10px] text-neutral-500 uppercase font-bold">Attack</div><div className="text-white font-bold">{m.result.atkScore || '-'}</div></div><div className="bg-neutral-900 p-2 rounded"><div className="text-[10px] text-neutral-500 uppercase font-bold">Defense</div><div className="text-white font-bold">{m.result.defScore || '-'}</div></div></div>)}</div>);
                })}
            </div>
        </Card>
    );
}

// ... (Other components remain identical to v4.2 but fully functional in v5.0 context)
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
    return (<Card className="h-full"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black text-white">MAP VETO</h3><ButtonSecondary onClick={resetVeto} className="text-xs px-3 py-1">Reset Board</ButtonSecondary></div><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{MAPS.map(map => { const status = vetoState[map] || 'neutral'; return (<div key={map} onClick={() => toggleMap(map)} className={`aspect-video rounded-xl border-2 cursor-pointer flex items-center justify-center relative group ${status === 'neutral' ? 'border-neutral-800 bg-black/50' : ''} ${status === 'ban' ? 'border-red-600 bg-red-900/20' : ''} ${status === 'pick' ? 'border-green-500 bg-green-900/20' : ''}`}><span className="font-black uppercase text-white">{map}</span><div className="absolute bottom-2 text-[10px] font-bold">{status.toUpperCase()}</div></div>); })}</div></Card>);
}

function CaptainsMessage() {
    const [message, setMessage] = useState({ text: "Welcome", updatedBy: "System" }); const [isEditing, setIsEditing] = useState(false); const [draft, setDraft] = useState(""); const auth = getAuth();
    useEffect(() => { const unsub = onSnapshot(doc(db, 'general', 'captain_message'), (s) => { if (s.exists()) setMessage(s.data()); }); return () => unsub(); }, []);
    const handleSave = async () => { await setDoc(doc(db, 'general', 'captain_message'), { text: draft, updatedBy: auth.currentUser.displayName }); setIsEditing(false); };
    return (<div className="bg-gradient-to-br from-red-950 to-black p-6 rounded-3xl border border-red-900/50 shadow-xl"><div className="flex justify-between items-center mb-2"><h2 className="text-lg font-black text-white">📢 CAPTAIN'S MESSAGE</h2>{!isEditing && <button onClick={() => { setDraft(message.text); setIsEditing(true) }} className="text-xs text-neutral-400">Edit</button>}</div>{isEditing ? <div><textarea value={draft} onChange={e => setDraft(e.target.value)} className="w-full bg-black p-2 text-white mb-2" /><ButtonPrimary onClick={handleSave} className="text-xs py-2">Post</ButtonPrimary></div> : <p className="text-slate-200 text-sm whitespace-pre-wrap">"{message.text}"</p>}</div>);
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
    return (<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"><Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Win Rate</div><div className="text-3xl font-black text-white">{stats.overallWinRate}%</div><div className="w-full h-1 bg-neutral-800 mt-2"><div className="h-full bg-red-600" style={{ width: `${stats.overallWinRate}%` }}></div></div></Card><Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Record</div><div className="text-2xl font-black text-white">{stats.wins}W - {stats.losses}L</div></Card><Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">ATK / DEF</div><div className="flex gap-2 text-xs font-bold text-white"><div>⚔️ {stats.atkWinRate}%</div><div>🛡️ {stats.defWinRate}%</div></div></Card><Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Best Map</div><div className="text-xl font-black text-white truncate">{stats.bestMap}</div></Card></div>);
}

function RosterManager({ members }) {
    const [rosterData, setRosterData] = useState({}); const [mode, setMode] = useState('edit'); const [compare1, setCompare1] = useState(''); const [compare2, setCompare2] = useState(''); const [selectedMember, setSelectedMember] = useState(null); const [role, setRole] = useState('Tryout'); const [gameId, setGameId] = useState(''); const [notes, setNotes] = useState('');
    useEffect(() => { const unsub = onSnapshot(collection(db, 'roster'), (snap) => { const data = {}; snap.forEach(doc => data[doc.id] = doc.data()); setRosterData(data); }); return () => unsub(); }, []);
    const handleSave = async () => { if (!selectedMember) return; await setDoc(doc(db, 'roster', selectedMember), { role, notes, gameId }, { merge: true }); };
    return (
        <div className="h-full flex flex-col gap-6"><div className="flex gap-4 border-b border-white/10 pb-4"><button onClick={() => setMode('edit')} className={`text-sm font-bold uppercase ${mode === 'edit' ? 'text-red-500' : 'text-neutral-500'}`}>Edit Mode</button><button onClick={() => setMode('compare')} className={`text-sm font-bold uppercase ${mode === 'compare' ? 'text-red-500' : 'text-neutral-500'}`}>Compare Players</button></div>
            {mode === 'edit' ? (<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full"><div className="lg:col-span-1 bg-neutral-900/80 p-6 rounded-3xl border border-white/5"><h3 className="text-white font-bold mb-4">Members</h3><div className="space-y-2 overflow-y-auto h-96 custom-scrollbar">{members.map(m => (<div key={m} onClick={() => { setSelectedMember(m); setRole(rosterData[m]?.role || 'Tryout'); setNotes(rosterData[m]?.notes || ''); setGameId(rosterData[m]?.gameId || ''); }} className={`p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center ${selectedMember === m ? 'bg-red-900/20 border-red-600' : 'bg-black border-neutral-800'}`}><span className="text-white font-bold">{m}</span><span className="text-xs text-neutral-500 uppercase">{rosterData[m]?.role}</span></div>))}</div></div><Card className="lg:col-span-2">{selectedMember ? (<div className="space-y-6"><h3 className="text-2xl font-black text-white">Managing: <span className="text-red-500">{selectedMember}</span></h3><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-neutral-500 mb-1">Role</label><Select value={role} onChange={e => setRole(e.target.value)}>{['Captain', 'Main', 'Sub', 'Tryout'].map(r => <option key={r}>{r}</option>)}</Select></div><div><label className="block text-xs font-bold text-neutral-500 mb-1">Riot ID</label><Input value={gameId} onChange={e => setGameId(e.target.value)} /></div></div><textarea className="w-full h-40 bg-black border border-neutral-800 rounded-xl p-3 text-white" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." /><ButtonPrimary onClick={handleSave} className="w-full py-3">Save Changes</ButtonPrimary></div>) : <div className="h-full flex items-center justify-center text-neutral-500">Select a player</div>}</Card></div>) : (<div className="grid grid-cols-2 gap-8 h-full">{[setCompare1, setCompare2].map((setter, i) => (<Card key={i} className="h-full"><Select onChange={e => setter(e.target.value)} className="mb-6"><option>Select Player</option>{members.map(m => <option key={m}>{m}</option>)}</Select>{((i === 0 ? compare1 : compare2) && rosterData[i === 0 ? compare1 : compare2]) && (<div className="space-y-4 text-center"><div className="w-24 h-24 mx-auto bg-red-600 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-black shadow-xl">{(i === 0 ? compare1 : compare2)[0]}</div><div className="text-3xl font-black text-white uppercase">{(i === 0 ? compare1 : compare2)}</div><div className="flex justify-center gap-2"><span className="bg-neutral-800 px-3 py-1 rounded text-xs font-bold text-white">{rosterData[i === 0 ? compare1 : compare2]?.rank || 'Unranked'}</span><span className="bg-red-900/50 px-3 py-1 rounded text-xs font-bold text-red-400">{rosterData[i === 0 ? compare1 : compare2]?.role || 'Member'}</span></div><div className="p-4 bg-black/50 rounded-xl border border-neutral-800 text-left"><div className="text-[10px] text-neutral-500 uppercase font-bold mb-2">Performance Notes</div><p className="text-sm text-neutral-300 italic">"{rosterData[i === 0 ? compare1 : compare2]?.notes || 'No notes available.'}"</p></div></div>)}</Card>))}</div>)}
        </div>
    );
}

function PartnerDirectory() {
    const [partners, setPartners] = useState([]); const [newPartner, setNewPartner] = useState({ name: '', contact: '', notes: '' });
    useEffect(() => { const unsub = onSnapshot(collection(db, 'partners'), (s) => { const p = []; s.forEach(d => p.push({ id: d.id, ...d.data() })); setPartners(p); }); return unsub; }, []);
    const add = async () => { await addDoc(collection(db, 'partners'), newPartner); setNewPartner({ name: '', contact: '', notes: '' }); };
    return (<Card className="h-full"><h3 className="text-2xl font-black text-white mb-6">PARTNERS</h3><div className="mb-6 space-y-2"><Input placeholder="Team Name" value={newPartner.name} onChange={e => setNewPartner({ ...newPartner, name: e.target.value })} /><div className="flex gap-2"><Input placeholder="Contact" value={newPartner.contact} onChange={e => setNewPartner({ ...newPartner, contact: e.target.value })} /><Input placeholder="Notes" value={newPartner.notes} onChange={e => setNewPartner({ ...newPartner, notes: e.target.value })} /></div><ButtonPrimary onClick={add} className="w-full text-xs py-2">Add</ButtonPrimary></div><div className="space-y-2 h-96 overflow-y-auto custom-scrollbar">{partners.map(p => <div key={p.id} className="p-4 bg-black border border-neutral-800 rounded-xl flex justify-between"><div><div className="font-bold text-white">{p.name}</div><div className="text-xs text-red-500">{p.contact}</div></div><button onClick={() => deleteDoc(doc(db, 'partners', p.id))} className="text-neutral-600 hover:text-red-500">×</button></div>)}</div></Card>);
}

function ScrimScheduler({ onSchedule, userTimezone }) {
    const [form, setForm] = useState({ type: 'Scrim', date: '', time: '', opponent: '' });
    const submit = async () => { await onSchedule({ ...form, timezone: userTimezone }); setForm({ ...form, opponent: '' }); };
    return (<div className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-red-500 block mb-1">TYPE</label><Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option>Scrim</option><option>Tournament</option></Select></div><div><label className="text-xs font-bold text-red-500 block mb-1">OPPONENT</label><Input value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-red-500 block mb-1">DATE</label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="[color-scheme:dark]" /></div><div><label className="text-xs font-bold text-red-500 block mb-1">TIME</label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="[color-scheme:dark]" /></div></div><ButtonPrimary onClick={submit} className="w-full py-3">SCHEDULE EVENT</ButtonPrimary></div>);
}

function AvailabilityHeatmap({ availabilities, members }) {
    const bucketSize = 60; const numBuckets = (24 * 60) / bucketSize;
    const data = useMemo(() => { const d = {}; for (const day of DAYS) { const b = new Array(numBuckets).fill(0); members.forEach(m => { (availabilities[m] || []).filter(s => s.day === day).forEach(s => { const start = Math.floor(timeToMinutes(s.start) / bucketSize); const end = Math.ceil(timeToMinutes(s.end) / bucketSize); for (let i = start; i < end && i < numBuckets; i++) b[i]++; }); }); d[day] = b; } return d; }, [availabilities, members]);
    return (<div className="overflow-x-auto rounded-xl border border-neutral-800 bg-black shadow-inner"><div className="min-w-[600px]"><div className="flex border-b border-neutral-800"><div className="w-24 bg-black sticky left-0 p-2 text-xs font-bold text-red-500 border-r border-neutral-800">DAY</div>{Array.from({ length: 24 }).map((_, i) => <div key={i} className="flex-1 text-[10px] text-center text-neutral-500 py-1 border-l border-neutral-800">{i}</div>)}</div>{DAYS.map(day => <div key={day} className="flex border-b border-neutral-800/50"><div className="w-24 bg-black sticky left-0 p-2 text-xs font-bold text-neutral-400 border-r border-neutral-800">{day.substring(0, 3).toUpperCase()}</div>{data[day]?.map((c, i) => <div key={i} className="flex-1 h-8 border-l border-neutral-800/30 relative group bg-red-600" style={{ opacity: c > 0 ? (c / members.length) * 0.9 + 0.1 : 0 }}>{c > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{c}</span>}</div>)}</div>)}</div></div>);
}

function LoginScreen({ signIn }) {
    return (<div className="fixed inset-0 bg-black flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black"><div className="text-center p-12 rounded-[3rem] border border-white/10 bg-neutral-900/80 backdrop-blur-xl shadow-2xl shadow-red-900/40"><h1 className="text-7xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">SYRIX</h1><div className="h-1.5 w-32 bg-red-600 mx-auto rounded-full shadow-[0_0_15px_rgba(220,38,38,1)] my-4"></div><button onClick={signIn} className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white py-4 rounded-2xl font-bold shadow-lg transition-transform hover:scale-105">LOGIN WITH DISCORD</button></div></div>);
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

    const NavBtn = ({ id, label }) => <button onClick={() => setActiveTab(id)} className={`text-xs font-bold uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === id ? 'text-red-600 border-red-600 shadow-[0_10px_20px_-5px_rgba(220,38,38,0.5)]' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>{label}</button>;

    return (
        <div className="fixed inset-0 h-full w-full bg-black text-neutral-200 font-sans selection:bg-red-500/30 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-red-900/10 via-black to-black">
            <header className="flex-none flex justify-between items-center px-8 py-4 border-b border-white/10 bg-black/80 backdrop-blur-md z-40">
                <div><h1 className="text-3xl font-black tracking-tighter text-white">SYRIX <span className="text-red-600">HUB</span></h1><div className="flex gap-6 mt-2 overflow-x-auto pb-2 scrollbar-hide"><NavBtn id="dashboard" label="Dashboard" /><NavBtn id="comps" label="Comps" /><NavBtn id="matches" label="Matches" /><NavBtn id="strats" label="Stratbook" /><NavBtn id="roster" label="Roster" /><NavBtn id="partners" label="Partners" /><NavBtn id="mapveto" label="Map Veto" />{ADMINS.includes(currentUser.displayName) && <NavBtn id="admin" label="Admin" />}</div></div>
                <div className="flex items-center gap-4"><div className="text-right"><div className="text-sm font-bold text-white">{currentUser.displayName}</div><button onClick={handleSignOut} className="text-[10px] text-red-500 font-bold uppercase">Log Out</button></div><select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); localStorage.setItem('timezone', e.target.value) }} className="bg-black border border-neutral-800 text-xs rounded p-2 text-neutral-400">{timezones.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            </header>
            <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-black"><div className="max-w-[1920px] mx-auto">
                {activeTab === 'dashboard' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
                    <div className="lg:col-span-4 space-y-8">
                        <CaptainsMessage />
                        <LeaveLogger members={dynamicMembers} />
                        <Card className="border-red-900/20"><div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Set Availability</h2><div className="space-y-4"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Day</label><Select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</Select></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Start</label><Input type="time" value={start} onChange={e => setStart(e.target.value)} className="[color-scheme:dark]" /></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">End</label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="[color-scheme:dark]" /></div></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Pref. Role</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{ROLES.map(r => (<button key={r} onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-2 ${role === r ? 'bg-red-600 text-white border-red-500' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white'}`}>{RoleIcons[r]}{r}</button>))}</div></div><div className="pt-2 flex gap-2"><ButtonPrimary onClick={saveAvail} disabled={saveStatus !== 'idle'} className="flex-1">{saveStatus === 'idle' ? 'Save Slot' : 'Saved!'}</ButtonPrimary><ButtonSecondary onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)}>Clear</ButtonSecondary></div></div></Card>
                        <Card className="border-red-900/20"><div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Event Operations</h2><ScrimScheduler onSchedule={schedEvent} userTimezone={userTimezone} /></Card>
                    </div>
                    <div className="lg:col-span-8 space-y-8">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8"><Card><h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center uppercase tracking-wide"><span>Upcoming Events</span><span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-1 rounded font-bold">{events.length} ACTIVE</span></h2><div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">{events.map(ev => (<div key={ev.id} className="p-3 bg-black/40 rounded-xl border border-neutral-800 flex justify-between items-center group hover:border-red-900/50 transition-colors"><div><div className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{ev.type} <span className="text-neutral-500">vs</span> {ev.opponent || 'TBD'}</div><div className="text-xs text-neutral-400 mt-1">{ev.date} @ <span className="text-white font-mono">{ev.time}</span></div></div><button onClick={() => openModal('Delete Event', 'Remove?', () => deleteDoc(doc(db, 'events', ev.id)))} className="text-neutral-600 hover:text-red-500">×</button></div>))}</div></Card><Card><h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wide">Availability Heatmap</h2><AvailabilityHeatmap availabilities={availabilities} members={dynamicMembers} /></Card></div>
                        <PerformanceWidget events={events} />
                        <Card><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Detailed Timeline <span className="text-neutral-500 text-sm normal-case">({userTimezone})</span></h2><div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b border-neutral-800"><th className="p-3 text-xs font-bold text-neutral-500 uppercase tracking-wider w-32">Team Member</th>{SHORT_DAYS.map(day => (<th key={day} className="p-3 text-xs font-bold text-red-600 uppercase tracking-wider text-center border-l border-neutral-800">{day}</th>))}</tr></thead><tbody className="divide-y divide-neutral-800/50">{dynamicMembers.map(member => (<tr key={member} className="hover:bg-neutral-800/30 transition-colors group"><td className="p-4 font-bold text-white text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-red-500/50 shadow-sm"></div>{member}</td>{DAYS.map((day) => { const slots = (displayAvail[member] || []).filter(s => s.day === day); return (<td key={day} className="p-2 align-middle border-l border-neutral-800/50"><div className="flex flex-col gap-1 items-center justify-center">{slots.length > 0 ? slots.map((s, i) => (<div key={i} className="bg-gradient-to-br from-red-600 to-red-700 text-white text-[10px] font-bold px-2 py-1 rounded w-full text-center shadow-md whitespace-nowrap flex items-center justify-center gap-1">{s.start}-{s.end}{RoleIcons[s.role]}</div>)) : <div className="h-1 w-4 bg-neutral-800 rounded-full"></div>}</div></td>); })}</tr>))}</tbody></table></div></Card>
                    </div>
                </div>}
                {activeTab === 'comps' && <div className="animate-fade-in-up h-full"><TeamComps members={dynamicMembers} /></div>}
                {activeTab === 'matches' && <div className="animate-fade-in-up"><MatchHistory /></div>}
                {activeTab === 'strats' && <div className="animate-fade-in-up h-[85vh]"><StratBook /></div>}
                {activeTab === 'roster' && <div className="animate-fade-in-up h-full"><RosterManager members={dynamicMembers} /></div>}
                {activeTab === 'partners' && <div className="animate-fade-in-up h-full"><PartnerDirectory /></div>}
                {activeTab === 'admin' && <div className="animate-fade-in-up h-full"><AdminPanel /></div>}
                {activeTab === 'mapveto' && <div className="animate-fade-in-up h-[80vh]"><MapVeto /></div>}
            </div></main>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>{modalContent.children}</Modal>
        </div>
    );
}