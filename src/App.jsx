/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- FIXED: Replaced Visual Selector Placeholder with a basic functional DailyTimeSelector.
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Added useCallback
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
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

// Initialize Firebase and Auth
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// --- End of Firebase Configuration ---

const discordWebhookUrl = "https://discord.com/api/webhooks/1427426922228351042/lqw36ZxOPEnC3qK45b3vnqZvbkaYhzIxqb-uS1tex6CGOvmLYs19OwKZvslOVABdpHnD";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];

// --- Utility and Timezone functions ---
const getAbsDateForDay = (dayString) => {
    const today = new Date();
    const todayDayIndex = (today.getUTCDay() === 0) ? 6 : today.getUTCDay() - 1;
    const targetDayIndex = DAYS.indexOf(dayString);
    const dayDifference = targetDayIndex - todayDayIndex;
    const targetDate = new Date(today);
    targetDate.setUTCDate(today.getUTCDate() + dayDifference);
    return targetDate;
};

const convertToGMT = (day, time) => {
    const date = getAbsDateForDay(day);
    const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${time}:00`;
    const localDate = new Date(dateString);
    const gmtFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
    const gmtDateParts = gmtFormatter.formatToParts(localDate).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
    return { day: gmtDateParts.weekday, time: `${gmtDateParts.hour.replace('24', '00')}:${gmtDateParts.minute}` };
};

const convertFromGMT = (day, time, timezone) => {
    if (!day || !time) return { day: '', time: '' };
    const [hours, minutes] = time.split(':').map(Number);
    const gmtDate = getAbsDateForDay(day);
    gmtDate.setUTCHours(hours, minutes, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
    const localDateParts = formatter.formatToParts(gmtDate).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
    return { day: localDateParts.weekday, time: `${localDateParts.hour.replace('24', '00')}:${localDateParts.minute}` };
};

function timeToMinutes(t) { if (!t || t === '24:00') return 1440; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const minutes = m % 1440; const hh = Math.floor(minutes / 60).toString().padStart(2, '0'); const mm = (minutes % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

// --- FEATURE: Time Slot Overlap Merging (Utility to normalize slots) ---
function getMergedSlots(day, selectedMins) {
    if (selectedMins.length === 0) return [];

    selectedMins.sort((a, b) => a - b);

    const slots = [];
    let startMinute = -1;

    for (let i = 0; i <= 1440; i += 30) {
        const isSelected = selectedMins.includes(i);

        if (isSelected && startMinute === -1) {
            // Start of a new block
            startMinute = i;
        } else if (!isSelected && startMinute !== -1) {
            // End of a block
            const endMinute = i;
            slots.push({ day, start: minutesToTime(startMinute), end: minutesToTime(endMinute) });
            startMinute = -1;
        }
    }
    return slots.filter(s => s.start !== s.end); // Remove zero-length slots
}


// --- DailyTimeSelector Component (New Functional Selector) ---
function DailyTimeSelector({ currentDay, userTimezone, userSlots, onUpdateSlots }) {
    // Stores minutes where a block starts (e.g., 600 for 10:00)
    const [selectedMinutes, setSelectedMinutes] = useState([]);

    // Total 48 blocks of 30 minutes (00:00 to 23:30)
    const timeBlocks = useMemo(() => Array.from({ length: 48 }, (_, i) => i * 30), []);

    // Effect to initialize state based on userSlots and currentDay
    useEffect(() => {
        const currentDayLocalSlots = userSlots
            .filter(slot => slot.day === currentDay);

        let newSelectedMinutes = [];

        currentDayLocalSlots.forEach(slot => {
            let start = timeToMinutes(slot.start);
            let end = timeToMinutes(slot.end);

            // Handle wrap-around from 24:00 (which is 1440 mins)
            if (end === 0) end = 1440;

            for (let m = start; m < end; m += 30) {
                newSelectedMinutes.push(m);
            }
        });

        setSelectedMinutes(newSelectedMinutes);
    }, [currentDay, userSlots]);

    // Function to handle the click (toggle selection)
    const handleBlockClick = (minute) => {
        const index = selectedMinutes.indexOf(minute);
        let newSelection;

        if (index > -1) {
            // Block is currently selected, unselect it
            newSelection = selectedMinutes.filter(m => m !== minute);
        } else {
            // Block is not selected, select it
            newSelection = [...selectedMinutes, minute];
        }

        setSelectedMinutes(newSelection);

        // Pass the resulting slots up to the App component immediately
        const resultingSlots = getMergedSlots(currentDay, newSelection);
        onUpdateSlots(resultingSlots);
    };

    return (
        <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-3 bg-slate-50 dark:bg-slate-700/50 shadow-inner">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Click below to mark 30-min blocks available:</p>
            <div className="flex w-full overflow-x-scroll pb-2">
                {/* Time Labels (Every 2 hours) */}
                <div className="flex text-xs text-slate-500 dark:text-slate-400 mb-1 w-full flex-shrink-0">
                    {Array.from({ length: 13 }, (_, i) => i * 120).map(m => (
                        <div key={m} className="text-center" style={{ width: i < 12 ? 'calc(100%/12)' : 'auto' }}>
                            {minutesToTime(m)}
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex w-full border border-slate-400 dark:border-slate-600 rounded overflow-hidden flex-shrink-0">
                {timeBlocks.map((minute) => {
                    const isSelected = selectedMinutes.includes(minute);
                    const isHourStart = minute % 60 === 0;

                    return (
                        <div
                            key={minute}
                            title={`${currentDay} ${minutesToTime(minute)} - ${minutesToTime(minute + 30)}`}
                            onClick={() => handleBlockClick(minute)}
                            className={`
                                h-8 flex-shrink-0 w-[2.0833%] cursor-pointer 
                                transition-colors duration-100 ease-in-out
                                ${isSelected ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}
                                ${isHourStart ? 'border-l border-slate-400 dark:border-slate-600' : 'border-l border-slate-300 dark:border-slate-700'}
                            `}
                        >
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


// --- Rest of the App Components (Kept same) ---
// ... Modal, AvailableNowIndicator, BestTimesDisplay, AvailabilityGrid, Heatmap ... 

// --- FEATURE: Condensed Availability Heatmap Component (Keep) ---
function AvailabilityHeatmap({ availabilities, members }) {
    const TOTAL_MINUTES = 24 * 60;
    const bucketSize = 60; // 1 hour buckets for condensation
    const numBuckets = TOTAL_MINUTES / bucketSize;
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);
    const maxCount = activeMembers.length;

    const heatmapData = useMemo(() => {
        const data = {};
        for (const day of DAYS) {
            const buckets = new Array(numBuckets).fill(0);
            for (const member of activeMembers) {
                const memberSlots = availabilities[member]?.filter(slot => slot.day === day) || [];
                for (const slot of memberSlots) {
                    const startMinute = timeToMinutes(slot.start);
                    const endMinute = timeToMinutes(slot.end);
                    const startBucket = Math.floor(startMinute / bucketSize);
                    const endBucket = Math.ceil(endMinute / bucketSize);
                    for (let i = startBucket; i < endBucket; i++) {
                        if (i < numBuckets) {
                            buckets[i]++;
                        }
                    }
                }
            }
            data[day] = buckets;
        }
        return data;
    }, [availabilities, activeMembers, numBuckets]);

    const getColorClass = (count, max) => {
        if (max === 0) return 'bg-slate-100 dark:bg-slate-700/50';
        const percent = count / max;
        if (percent === 1) return 'bg-emerald-600 hover:bg-emerald-700';
        if (percent >= 0.75) return 'bg-emerald-500 hover:bg-emerald-600';
        if (percent >= 0.50) return 'bg-emerald-400 hover:bg-emerald-500';
        if (percent >= 0.25) return 'bg-emerald-300 hover:bg-emerald-400';
        if (percent > 0) return 'bg-emerald-200 hover:bg-emerald-300';
        return 'bg-slate-100 dark:bg-slate-700/50';
    };

    const timeLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    return (
        <div className="overflow-x-auto rounded-xl shadow-lg border border-slate-300 dark:border-slate-700">
            <table className="min-w-full text-center text-xs border-collapse">
                <thead>
                    <tr className="bg-slate-100 dark:bg-slate-700/80">
                        <th className="sticky left-0 bg-slate-100 dark:bg-slate-700/80 p-2 font-semibold text-slate-800 dark:text-slate-200 w-24">Day</th>
                        {timeLabels.map((time, i) => (
                            <th key={i} className="p-1 font-normal text-slate-600 dark:text-slate-400 min-w-[3rem] border-x border-slate-300 dark:border-slate-600">{i % 4 === 0 ? time : (i % 2 === 0 ? '-' : '')}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {DAYS.map(day => (
                        <tr key={day} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="sticky left-0 p-2 font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-left w-24">{day}</td>
                            {heatmapData[day]?.map((count, i) => (
                                <td
                                    key={i}
                                    className={`p-0 h-8 ${getColorClass(count, maxCount)} transition-colors duration-150 border-x border-slate-100 dark:border-slate-800`}
                                    title={`${day}, ${timeLabels[i]} - ${timeLabels[i + 1] || '00:00'}: ${count}/${maxCount} Available`}
                                >
                                    {count > 0 && <span className="text-[10px] text-slate-900 dark:text-slate-900 font-bold">{count}</span>}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ... (NextSteps and LoginScreen functions omitted for brevity) ...

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [availabilities, setAvailabilities] = useState({});
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('23:30');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');
    const [userTimezone, setUserTimezone] = useState(localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [authLoading, setAuthLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', onConfirm: () => { } });

    // NEW: State to hold slots generated by the DailyTimeSelector
    const [dailySelectedSlots, setDailySelectedSlots] = useState([]);


    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => { /* ... */ };
    const handleSignOut = async () => { await signOut(auth); };

    const dynamicMembers = useMemo(() => {
        const membersFromData = Object.keys(availabilities);
        const allMembers = [...new Set(membersFromData)];
        return allMembers.sort();
    }, [availabilities]);


    useEffect(() => {
        const availabilitiesCol = collection(db, 'availabilities');
        const unsubscribe = onSnapshot(availabilitiesCol, (snapshot) => {
            const newAvailabilities = {};
            snapshot.forEach(doc => { newAvailabilities[doc.id] = doc.data().slots || []; });
            setAvailabilities(newAvailabilities);
        });
        return () => unsubscribe();
    }, []);

    // FIX: Restored Dark Mode Logic 1
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setIsDarkMode(true);
        } else if (savedTheme === 'light') {
            setIsDarkMode(false);
        } else {
            setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
    }, []);
    // FIX: Restored Dark Mode Logic 2
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const handleTimezoneChange = (tz) => {
        setUserTimezone(tz);
        localStorage.setItem('timezone', tz);
    };

    const openModal = (title, message, onConfirm) => {
        setModalContent({ title, message, onConfirm });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    // Callback to receive updated slots from the DailyTimeSelector
    const handleSelectorUpdate = useCallback((newSlots) => {
        setDailySelectedSlots(newSlots);
    }, []);


    // FIX: Restored Save Logic (UPDATED to use dailySelectedSlots)
    async function addAvailability() {
        if (!currentUser) return;

        // If the selector created slots, use those, otherwise use the start/end inputs.
        let slotsToSave = dailySelectedSlots;

        // If selector is empty, we fall back to the old input method, but we validate it first.
        if (slotsToSave.length === 0) {
            if (timeToMinutes(end) <= timeToMinutes(start)) {
                openModal('Invalid Time', 'End time must be after start time.', closeModal);
                return;
            }
            const gmtStart = convertToGMT(day, start);
            const gmtEnd = convertToGMT(day, end);
            slotsToSave = [{ day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time }];
        } else {
            // Convert local slots from selector back to GMT slots
            slotsToSave = slotsToSave.map(localSlot => {
                const gmtStart = convertToGMT(localSlot.day, localSlot.start);
                const gmtEnd = convertToGMT(localSlot.day, localSlot.end);
                return { day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time };
            });
        }

        // Get existing slots for the user, EXCLUDING the current day's old slots
        const localSelectedDay = day;
        const currentSlotsExceptToday = (availabilities[currentUser.displayName] || []).filter(slot => {
            const localSlotDay = convertFromGMT(slot.day, slot.start, userTimezone).day;
            return localSlotDay !== localSelectedDay;
        });

        // Combine non-today slots with the new slots (slotsToSave is already in GMT)
        let updatedSlots = [...currentSlotsExceptToday, ...slotsToSave];

        // Final sorting
        updatedSlots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));

        setSaveStatus('saving');
        const memberDocRef = doc(db, 'availabilities', currentUser.displayName);
        try {
            await setDoc(memberDocRef, { slots: updatedSlots });
            setSaveStatus('success');
        } catch (error) {
            console.error("Error saving availability: ", error);
            setSaveStatus('idle');
        } finally {
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    }


    // FIX: Restored Clear Day Logic
    async function clearDayForMember() {
        if (!currentUser) return;
        const localSelectedDay = day;
        const currentSlots = availabilities[currentUser.displayName] || [];
        if (currentSlots.length === 0) return;

        const updatedSlots = currentSlots.filter(slot => {
            const localSlotDay = convertFromGMT(slot.day, slot.start, userTimezone).day;
            return localSlotDay !== localSelectedDay;
        });

        const memberDocRef = doc(db, 'availabilities', currentUser.displayName);

        if (updatedSlots.length === 0) {
            await deleteDoc(memberDocRef);
        } else {
            await setDoc(memberDocRef, { slots: updatedSlots });
        }
        closeModal();
    }

    // FIX: Restored Clear All Logic
    async function clearAllForMember() {
        if (!currentUser) return;
        const memberDocRef = doc(db, 'availabilities', currentUser.displayName);
        await deleteDoc(memberDocRef);
        closeModal();
    }

    async function postToDiscord(day, slot, tz) {
        const activeMembersCount = dynamicMembers.filter(member => availabilities[member] && availabilities[member].length > 0).length;
        const content = `**Team Availability Alert!**\n\n**Best Time Found:**\n> **When:** ${day}, ${minutesToTime(slot.start)} - ${minutesToTime(slot.end)} (${tz})\n> **Who:** ${slot.count} / ${activeMembersCount} players available.\n\nLet's get a game in!`;
        try {
            const response = await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content }),
            });
            if (!response.ok) throw new Error(`Webhook returned status ${response.status}`);
            return true;
        } catch (error) {
            console.error('Failed to post to Discord:', error);
            openModal('Discord Error', 'Failed to post to Discord. Check the console for more details.', closeModal);
            return false;
        }
    }

    // Prepare current user's slots in LOCAL time for the DailyTimeSelector
    const currentUserLocalSlots = useMemo(() => {
        // This is complex, but necessary for the selector to load the current day's saved data
        const slots = availabilities[currentUser?.displayName] || [];
        const converted = [];

        slots.forEach(slot => {
            const localStart = convertFromGMT(slot.day, slot.start, userTimezone);
            const localEnd = convertFromGMT(slot.day, slot.end, userTimezone);

            // Handle cross-day splits here to ensure the selector only sees the current day
            if (localStart.day === localEnd.day) {
                if (timeToMinutes(localStart.time) < timeToMinutes(localEnd.time)) {
                    converted.push({ day: localStart.day, start: localStart.time, end: localEnd.time });
                }
            } else {
                // If it spans midnight, split it for visualization
                if (localStart.day === day) {
                    converted.push({ day: localStart.day, start: localStart.time, end: '24:00' });
                }
                if (localEnd.day === day && timeToMinutes(localEnd.time) > 0) {
                    converted.push({ day: localEnd.day, start: '00:00', end: localEnd.time });
                }
            }
        });

        return converted;
    }, [availabilities, userTimezone, currentUser?.displayName, day]);

    // Convert ALL availabilities for the display components
    const displayAvailabilities = useMemo(() => {
        const converted = {};
        for (const member in availabilities) {
            converted[member] = [];
            availabilities[member].forEach(slot => {
                const localStart = convertFromGMT(slot.day, slot.start, userTimezone);
                const localEnd = convertFromGMT(slot.day, slot.end, userTimezone);

                if (localStart.day === localEnd.day) {
                    if (timeToMinutes(localStart.time) < timeToMinutes(localEnd.time)) {
                        converted[member].push({ day: localStart.day, start: localStart.time, end: localEnd.time });
                    }
                } else {
                    converted[member].push({ day: localStart.day, start: localStart.time, end: '24:00' });
                    if (timeToMinutes(localEnd.time) > 0) {
                        converted[member].push({ day: localEnd.day, start: '00:00', end: localEnd.time });
                    }
                }
            });
        }
        return converted;
    }, [availabilities, userTimezone]);

    // --- UX Improvement: Show GMT conversion next to local time inputs (Kept) ---
    const gmtStartDisplay = useMemo(() => {
        const gmt = convertToGMT(day, start);
        return `${gmt.day} ${gmt.time} GMT`;
    }, [day, start]);

    const gmtEndDisplay = useMemo(() => {
        const gmt = convertToGMT(day, end);
        const isMidnight = end === '00:00' && timeToMinutes(end) === 0;
        return `${isMidnight ? 'Next Day ' : ''}${gmt.day} ${gmt.time} GMT`;
    }, [day, end]);
    // ---------------------------------------------------------------------

    if (authLoading) {
        return <div>Loading...</div>;
    }

    if (!currentUser) {
        return <LoginScreen signIn={signIn} />;
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-200 p-6">
            <div className="">
                <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-wide">Syrix — Team Availability</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <img src={currentUser.photoURL || 'https://via.placeholder.com/32'} alt={currentUser.displayName} className="w-8 h-8 rounded-full shadow-inner" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{currentUser.displayName}</span>
                        </div>
                        <select id="tz-select" value={userTimezone} onChange={e => handleTimezoneChange(e.target.value)} className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 text-sm shadow-sm transition-colors">
                            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors shadow-sm">
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                        <button onClick={handleSignOut} className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-red-500 transition-colors">
                            Sign Out
                        </button>
                    </div>
                </header>

                <AvailableNowIndicator availabilities={availabilities} members={dynamicMembers} userTimezone={userTimezone} />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-lg space-y-6">
                        {/* --- Start of My Availability Form --- */}
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">My Availability</h2>

                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Day (Local Time: {userTimezone})</label>
                            <select
                                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg mb-4 text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm transition-colors"
                                value={day}
                                onChange={e => {
                                    setDay(e.target.value);
                                    setDailySelectedSlots([]); // Reset selector when day changes
                                }}
                            >
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>

                            {/* NEW FEATURE: Daily Time Selector */}
                            <DailyTimeSelector
                                currentDay={day}
                                userTimezone={userTimezone}
                                userSlots={currentUserLocalSlots}
                                onUpdateSlots={handleSelectorUpdate}
                            />


                            <div className="flex gap-3 mb-4 mt-6">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Start (Fallback)</label>
                                    <input type="time" className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm transition-colors" value={start} onChange={e => setStart(e.target.value)} />
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{gmtStartDisplay}</div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">End (Fallback)</label>
                                    <input type="time" className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm transition-colors" value={end} onChange={e => setEnd(e.target.value)} />
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{gmtEndDisplay}</div>
                                </div>
                            </div>

                            <div className="flex items-center flex-wrap gap-3">
                                <button
                                    className={`font-bold px-4 py-2.5 rounded-xl flex items-center justify-center transition-all duration-200 shadow-md ${saveStatus === 'success' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    onClick={addAvailability}
                                    disabled={saveStatus !== 'idle'}
                                >
                                    {saveStatus === 'idle' && 'Save Availability'}
                                    {saveStatus === 'saving' && (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>)}
                                    {saveStatus === 'success' && (<> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-lg mr-2" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z" /></svg> Saved! </>)}
                                </button>
                                <button className="transition-colors bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-semibold px-3 py-2.5 rounded-xl shadow-md"
                                    onClick={() => openModal('Confirm Clear', `Are you sure you want to clear your availability for ${day}?`, clearDayForMember)}>
                                    Clear for {day}
                                </button>
                                <button className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 font-semibold transition-colors"
                                    onClick={() => openModal('Confirm Clear All', 'Are you sure you want to delete ALL of your availability slots?', clearAllForMember)}>
                                    Clear All My Slots
                                </button>
                            </div>
                        </div>
                        {/* --- End of My Availability Form --- */}

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-3">Best Times</h3>
                            <div className="max-h-[24rem] overflow-y-auto pr-2">
                                <BestTimesDisplay availabilities={displayAvailabilities} members={dynamicMembers} postToDiscord={postToDiscord} userTimezone={userTimezone} />
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-white dark:bg-slate-800 p-5 rounded-xl shadow-lg">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Manager Dashboard</h2>

                        {/* FEATURE: Heatmap Integration */}
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Weekly Availability Heatmap ({userTimezone})</h3>
                        <div className="mb-8">
                            <AvailabilityHeatmap availabilities={displayAvailabilities} members={dynamicMembers} />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">All Submitted Slots</h3>
                                <div className="space-y-2 mt-2 max-h-[30rem] overflow-y-auto pr-2">
                                    {dynamicMembers.map(m => (
                                        (displayAvailabilities[m] && displayAvailabilities[m].length > 0) && (
                                            <div key={m} className="p-3 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-700/50 shadow-sm">
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">{m}</div>
                                                <div className="text-sm mt-2 text-slate-600 dark:text-slate-400">
                                                    {(displayAvailabilities[m] || []).map((s, i) => (
                                                        <div key={i} className="py-1">{s.day} — **{s.start}** to **{s.end}**</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Availability Grid (Visual Timeline)</h3>
                                <div className="mt-2 space-y-4 max-h-[30.5rem] overflow-y-auto">
                                    {DAYS.map(d => (
                                        <div key={d}>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-4 mt-2">{d}</div>
                                            <AvailabilityGrid day={d} members={dynamicMembers} availabilities={displayAvailabilities} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <NextSteps />
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeModal}
                onConfirm={modalContent.onConfirm}
                title={modalContent.title}
            >
                <p>{modalContent.message}</p>
            </Modal>
        </div>
    );
}