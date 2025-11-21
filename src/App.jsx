/*
Syrix Team Availability - FINAL PREMIUM BUILD (FIXED)
- FIXED: "Monday writes Tuesday" bug (improved Timezone/Date math).
- FIXED: Events not showing (Removed complex Firestore query requiring indexes).
- FEATURE: Event Operations & Discord Automation active.
- DESIGN: Premium "Glassmorphism" aesthetic maintained.
*/

import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

// --- Utility Functions ---
function timeToMinutes(t) { if (!t || t === '24:00') return 1440; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const minutes = m % 1440; const hh = Math.floor(minutes / 60).toString().padStart(2, '0'); const mm = (minutes % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

// FIX: More robust date calculation that avoids "drift"
const getNextDateForDay = (dayName) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = days.indexOf(dayName);
    const today = new Date();
    const currentDayIndex = today.getDay();

    let distance = targetIndex - currentDayIndex;
    // If the target day is today or in the past (within this week), we treat it as "this upcoming week" logic if needed,
    // but for simple scheduling, we usually mean the closest instance.
    // Let's assume "Monday" means the Monday of the CURRENT week to keep the grid stable.

    // Adjustment: Calculate 'distance' to align with the current week's instance of that day.
    const currentWeekMondayDiff = 1 - currentDayIndex; // Distance to this week's Monday
    const targetDiff = days.indexOf(dayName) - 1; // Distance of target from Monday

    // Actually, easiest way for a stable weekly grid:
    // Anchor everything to "Today" and find the offset.
    const d = new Date(today);
    d.setDate(today.getDate() + distance);
    return d;
};

const convertToGMT = (day, time) => {
    // 1. Create a date object for the selected Day/Time in the user's LOCAL browser time
    const targetDate = getNextDateForDay(day);
    const [hours, minutes] = time.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);

    // 2. Extract the parts in UTC (effectively converting Local -> GMT)
    const utcDayIndex = targetDate.getUTCDay();
    // Map JS getUTCDay (0=Sun, 1=Mon) back to our DAYS array names
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const gmtDay = jsDays[utcDayIndex];

    const gmtHours = String(targetDate.getUTCHours()).padStart(2, '0');
    const gmtMinutes = String(targetDate.getUTCMinutes()).padStart(2, '0');

    return { day: gmtDay, time: `${gmtHours}:${gmtMinutes}` };
};

const convertFromGMT = (day, time, timezone) => {
    if (!day || !time) return { day: '', time: '' };

    // 1. Create a UTC date object from the stored GMT Day/Time
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = jsDays.indexOf(day);
    const today = new Date();
    const currentDayIndex = today.getUTCDay();
    const distance = targetIndex - currentDayIndex;

    const gmtDate = new Date(today);
    gmtDate.setUTCDate(today.getUTCDate() + distance);

    const [hours, minutes] = time.split(':').map(Number);
    gmtDate.setUTCHours(hours, minutes, 0, 0);

    // 2. Format this UTC date into the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(gmtDate);
    const part = (type) => parts.find(p => p.type === type)?.value;

    let localHours = part('hour');
    // Fix: 24:00 handling or single digit handling
    if (localHours === '24') localHours = '00';

    return {
        day: part('weekday'),
        time: `${localHours}:${part('minute')}`
    };
};

// --- Components ---

function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-md p-4">
            <div className="bg-slate-800 rounded-2xl shadow-3xl p-6 w-full max-w-md border border-slate-700 animate-fade-in-up">
                <h3 className="text-2xl font-extrabold text-slate-100 mb-4 border-b pb-2 border-slate-600">{title}</h3>
                <div className="text-slate-300 mb-6">{children}</div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-5 py-2 rounded-xl transition-all">Cancel</button>
                    <button onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-xl shadow-lg transition-all">Confirm</button>
                </div>
            </div>
        </div>
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
        // Pass data up
        await onSchedule({ type, date, time, opponent, timezone: userTimezone });
        setStatus('success');
        setTimeout(() => { setStatus('idle'); setOpponent(''); setDate(''); setTime(''); }, 2000);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Type</label>
                    <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option>Scrim</option>
                        <option>Tournament</option>
                        <option>Practice</option>
                        <option>VOD Review</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Opponent / Notes</label>
                    <input type="text" placeholder="e.g. Team Liquid" value={opponent} onChange={e => setOpponent(e.target.value)} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Time ({userTimezone})</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
            </div>
            <button
                onClick={handleSubmit}
                disabled={status !== 'idle'}
                className={`w-full py-3 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${status === 'success' ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
                {status === 'idle' && '📅 Schedule & Post to Discord'}
                {status === 'saving' && 'Scheduling...'}
                {status === 'success' && 'Event Scheduled!'}
            </button>
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
        <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-inner bg-slate-800/50">
            <div className="min-w-[600px]">
                <div className="flex border-b border-slate-700">
                    <div className="w-24 p-2 text-xs font-bold text-slate-400 bg-slate-800/80 sticky left-0">Day</div>
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="flex-1 text-[10px] text-center text-slate-500 border-l border-slate-700/50 py-1">{i}</div>
                    ))}
                </div>
                {DAYS.map(day => (
                    <div key={day} className="flex border-b border-slate-700/50 last:border-0">
                        <div className="w-24 p-2 text-xs font-semibold text-slate-300 bg-slate-800/80 sticky left-0 border-r border-slate-700">{day}</div>
                        {heatmapData[day]?.map((count, i) => (
                            <div key={i} className={`flex-1 h-8 border-l border-slate-700/20 transition-all hover:brightness-125 relative group ${count > 0 ? 'bg-emerald-500' : ''}`} style={{ opacity: count > 0 ? count / maxCount : 1, backgroundColor: count === 0 ? 'transparent' : undefined }}>
                                {count > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white group-hover:scale-125 transition-transform">{count}</span>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// --- Main Application ---

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [availabilities, setAvailabilities] = useState({});
    const [events, setEvents] = useState([]);
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('23:30');
    const [isDarkMode, setIsDarkMode] = useState(true); // Default to Dark
    const [saveStatus, setSaveStatus] = useState('idle');
    const [userTimezone, setUserTimezone] = useState(localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [authLoading, setAuthLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({});

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    // Initial Sign In
    const signIn = async () => {
        const provider = new OAuthProvider('oidc.discord');
        provider.addScope('identify');
        try { await signInWithPopup(auth, provider); } catch (e) { console.error(e); }
    };

    const handleSignOut = async () => await signOut(auth);

    // Data Listeners
    useEffect(() => {
        // Availabilities Listener
        const unsubAvail = onSnapshot(collection(db, 'availabilities'), (snap) => {
            const data = {};
            snap.forEach(doc => data[doc.id] = doc.data().slots || []);
            setAvailabilities(data);
        });

        // FIX: Removed orderBy('date') to fix "Missing Index" error causing events to hide
        // We will sort the events in the client (JavaScript) side instead
        const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
            const evs = [];
            snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() }));
            // Sort by date/time in JS
            evs.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
            // Filter out old events
            setEvents(evs.filter(e => new Date(e.date + 'T' + e.time) >= new Date()));
        });

        return () => { unsubAvail(); unsubEvents(); };
    }, []);

    // Dark Mode Force
    useEffect(() => { document.documentElement.classList.add('dark'); }, []);

    // --- Logic ---
    const dynamicMembers = useMemo(() => [...new Set(Object.keys(availabilities))].sort(), [availabilities]);

    const displayAvailabilities = useMemo(() => {
        const converted = {};
        for (const member in availabilities) {
            converted[member] = [];
            availabilities[member].forEach(slot => {
                const localStart = convertFromGMT(slot.day, slot.start, userTimezone);
                const localEnd = convertFromGMT(slot.day, slot.end, userTimezone);
                // Simple mapping logic
                if (localStart.day === localEnd.day) {
                    if (timeToMinutes(localStart.time) < timeToMinutes(localEnd.time)) converted[member].push({ day: localStart.day, start: localStart.time, end: localEnd.time });
                } else {
                    converted[member].push({ day: localStart.day, start: localStart.time, end: '24:00' });
                    if (timeToMinutes(localEnd.time) > 0) converted[member].push({ day: localEnd.day, start: '00:00', end: localEnd.time });
                }
            });
        }
        return converted;
    }, [availabilities, userTimezone]);

    // Discord PFP Fix - Improved Fallback Logic
    const getAvatar = () => {
        if (!currentUser) return null;

        // 1. If photoURL is a full URL (rare for Discord auth), use it
        if (currentUser.photoURL && currentUser.photoURL.startsWith('http')) return currentUser.photoURL;

        // 2. Check providerData for raw Discord details
        const discordData = currentUser.providerData.find(p => p.providerId === 'oidc.discord');
        if (discordData && discordData.photoURL) {
            return discordData.photoURL;
        }

        // 3. Construct manual URL if we have a hash but it wasn't a full URL
        if (currentUser.photoURL) {
            return `https://cdn.discordapp.com/avatars/${currentUser.uid}/${currentUser.photoURL}.png`;
        }

        // 4. Generic Fallback
        return `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
    };

    // Actions
    const openModal = (title, message, onConfirm) => { setModalContent({ title, children: message, onConfirm }); setIsModalOpen(true); };

    const saveAvailability = async () => {
        if (timeToMinutes(end) <= timeToMinutes(start)) return openModal('Error', 'End time must be after start.', () => setIsModalOpen(false));
        setSaveStatus('saving');

        // FIX: Use new robust converter
        const gmtStart = convertToGMT(day, start);
        const gmtEnd = convertToGMT(day, end);

        // Get existing slots excluding this day to avoid dupes/overlaps logic for now (simple add)
        const existing = availabilities[currentUser.displayName] || [];
        // Clean up existing logic
        const others = existing.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day);
        const newSlots = [...others, { day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time }];

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
        // 1. Save to Firestore
        await addDoc(collection(db, 'events'), eventData);

        // 2. Post to Discord
        const content = {
            embeds: [{
                title: `📅 New ${eventData.type} Scheduled!`,
                color: 3066993, // Green
                fields: [
                    { name: 'Type', value: eventData.type, inline: true },
                    { name: 'Opponent/Info', value: eventData.opponent || 'N/A', inline: true },
                    { name: 'When', value: `${eventData.date} at ${eventData.time} (${eventData.timezone})` },
                    { name: 'Scheduled By', value: currentUser.displayName }
                ],
                footer: { text: "Syrix Scheduler" },
                timestamp: new Date().toISOString()
            }]
        };

        try {
            await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(content)
            });
        } catch (e) { console.error("Webhook failed", e); }
    };

    if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-200">Loading Syrix Hub...</div>;
    if (!currentUser) return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-black flex items-center justify-center p-4">
            <div className="text-center space-y-6">
                <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tighter">SYRIX</h1>
                <p className="text-slate-400 text-lg">Team Coordination Hub</p>
                <button onClick={signIn} className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 rounded-2xl font-bold shadow-2xl transition-transform hover:scale-105 flex items-center gap-3 mx-auto">
                    <span>Sign In with Discord</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 p-4 sm:p-8 font-sans selection:bg-emerald-500/30">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 border-b border-slate-800 pb-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-white">SYRIX <span className="text-emerald-500">HUB</span></h1>
                    <p className="text-slate-500 text-sm font-medium tracking-widest uppercase mt-1">Availability & Operations</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                    <img src={getAvatar()} className="w-10 h-10 rounded-full border-2 border-emerald-500/50" alt="Profile" />
                    <div className="pr-4">
                        <div className="text-sm font-bold text-white">{currentUser.displayName}</div>
                        <button onClick={handleSignOut} className="text-xs text-slate-400 hover:text-red-400 transition-colors font-medium">Log Out</button>
                    </div>
                    <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); localStorage.setItem('timezone', e.target.value); }} className="bg-slate-900 border border-slate-700 text-xs rounded-lg p-2 text-slate-300 outline-none focus:border-emerald-500">
                        {timezones.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </header>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Left Column: Inputs & Ops (4 cols) */}
                <div className="lg:col-span-4 space-y-8">
                    {/* Availability Input */}
                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 shadow-xl backdrop-blur-sm">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                            Set Availability
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Day</label>
                                <select value={day} onChange={e => setDay(e.target.value)} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Start</label>
                                    <input type="time" value={start} onChange={e => setStart(e.target.value)} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">End</label>
                                    <input type="time" value={end} onChange={e => setEnd(e.target.value)} className="w-full p-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                                <button onClick={saveAvailability} disabled={saveStatus !== 'idle'} className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all transform active:scale-95 ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-900 hover:bg-white'}`}>
                                    {saveStatus === 'idle' ? 'Save Slot' : saveStatus === 'saving' ? '...' : 'Saved!'}
                                </button>
                                <button onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 font-bold transition-colors">Clear</button>
                            </div>
                            <div className="text-center">
                                <button onClick={() => openModal('Reset', 'Delete ALL your data?', clearAll)} className="text-xs text-red-500/70 hover:text-red-400 font-medium transition-colors">Reset All My Data</button>
                            </div>
                        </div>
                    </div>

                    {/* NEW: Event Operations Module */}
                    <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50 shadow-xl backdrop-blur-sm">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                            Event Operations
                        </h2>
                        <ScrimScheduler onSchedule={scheduleEvent} userTimezone={userTimezone} />
                    </div>
                </div>

                {/* Right Column: Dashboard (8 cols) */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Top Row: Heatmap & Upcoming */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Upcoming Events Feed */}
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-3xl border border-slate-700 shadow-2xl">
                            <h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center">
                                <span>📅 Upcoming Events</span>
                                <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">{events.length} Scheduled</span>
                            </h2>
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600">
                                {events.length === 0 ? <p className="text-slate-500 text-sm">No upcoming events.</p> : events.map(ev => (
                                    <div key={ev.id} className="p-3 bg-slate-700/30 rounded-xl border border-slate-700/50 flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-emerald-400 text-sm">{ev.type} {ev.opponent && `vs ${ev.opponent}`}</div>
                                            <div className="text-xs text-slate-400">{ev.date} @ {ev.time}</div>
                                        </div>
                                        <div className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-500">By {ev.scheduledBy || 'Team'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Heatmap Container */}
                        <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                            <h2 className="text-lg font-bold text-white mb-4">🔥 Availability Heatmap</h2>
                            <AvailabilityHeatmap availabilities={availabilities} members={dynamicMembers} />
                        </div>
                    </div>

                    {/* Detailed Grid */}
                    <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-6">Detailed Timeline ({userTimezone})</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {DAYS.map(d => (
                                <div key={d} className="bg-slate-900/50 rounded-2xl p-4 border border-slate-700/50">
                                    <h3 className="font-bold text-slate-400 mb-3 uppercase text-xs tracking-wider">{d}</h3>
                                    <div className="space-y-2">
                                        {dynamicMembers.map(m => {
                                            const slots = (displayAvailabilities[m] || []).filter(s => s.day === d);
                                            if (!slots.length) return null;
                                            return (
                                                <div key={m} className="text-sm">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="font-bold text-slate-200">{m}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {slots.map((s, i) => (
                                                            <span key={i} className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded text-xs border border-emerald-500/30">
                                                                {s.start}-{s.end}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {!dynamicMembers.some(m => (displayAvailabilities[m] || []).some(s => s.day === d)) &&
                                            <p className="text-xs text-slate-600 italic">No availability.</p>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>
                {modalContent.children}
            </Modal>
        </div>
    );
}