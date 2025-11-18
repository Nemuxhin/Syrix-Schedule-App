/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- Implemented: Availability Heatmap (1), Meeting Suggester (2), Slot Overlap Merging (5), and Stale Data Warning (4).
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
// NOTE: Added serverTimestamp for Stale Data check
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
function timeToMinutes(t) { if (!t || t === '24:00') return 1440; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const minutes = m % 1440; const hh = Math.floor(minutes / 60).toString().padStart(2, '0'); const mm = (minutes % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }

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

// --- NEW: Time Slot Overlap Merging (Feature 5) ---
function mergeSlots(slots) {
    if (slots.length === 0) return [];

    // Sort slots first by day, then by start time
    slots.sort((a, b) =>
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    const merged = [];
    let current = { ...slots[0] };

    for (let i = 1; i < slots.length; i++) {
        const next = slots[i];

        // Convert times to minutes for comparison
        const currentEndMins = timeToMinutes(current.end);
        const nextStartMins = timeToMinutes(next.start);

        // Check for overlap on the same day
        if (current.day === next.day && nextStartMins <= currentEndMins) {
            // Overlap or adjacency: merge the end times
            const nextEndMins = timeToMinutes(next.end);
            current.end = minutesToTime(Math.max(currentEndMins, nextEndMins));
        } else {
            // No overlap or different day: finalize current, start a new one
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    return merged;
}

// --- NEW: Custom Modal Component (Copied for completeness) ---
function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">{title}</h3>
                <div className="text-slate-600 dark:text-slate-400 mb-6">
                    {children}
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold px-4 py-2 rounded-md">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-md">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
// --- Other components (AvailableNowIndicator, BestTimesDisplay) remain the same ---

// --- NEW: Availability Heatmap Component (Feature 1) ---
function AvailabilityHeatmap({ availabilities, members }) {
    const TOTAL_MINUTES = 24 * 60;
    const bucketSize = 60; // 1 hour buckets
    const numBuckets = TOTAL_MINUTES / bucketSize;
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);
    const maxCount = activeMembers.length;

    const heatmapData = useMemo(() => {
        const data = {}; // { day: [count, count, ...] }
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
        if (count === 0) return 'bg-slate-100 dark:bg-slate-700/50';
        const percent = count / max;
        if (percent >= 0.75) return 'bg-emerald-600 hover:bg-emerald-700'; // High Availability
        if (percent >= 0.50) return 'bg-emerald-500 hover:bg-emerald-600';
        if (percent >= 0.25) return 'bg-emerald-400 hover:bg-emerald-500';
        return 'bg-emerald-300 hover:bg-emerald-400'; // Low Availability
    };

    const timeLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    return (
        <div className="overflow-x-auto rounded-lg shadow border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-center text-xs border-collapse">
                <thead>
                    <tr className="bg-slate-200 dark:bg-slate-700/80">
                        <th className="sticky left-0 bg-slate-200 dark:bg-slate-700/80 p-2 font-semibold text-slate-800 dark:text-slate-200 w-24">Day</th>
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
                                    {count > 0 && <span className="text-[10px] text-white dark:text-slate-900 font-bold">{count}</span>}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- NEW: Meeting Suggester Component (Feature 2) ---
function MeetingSuggester({ availabilities, members, userTimezone }) {
    const [length, setLength] = useState(60); // minutes
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);

    const findSuggestions = useCallback(() => {
        setIsSearching(true);
        const meetingLength = parseInt(length);
        if (meetingLength <= 0 || activeMembers.length === 0) {
            setSuggestions([]);
            setIsSearching(false);
            return;
        }

        const potentialSlots = [];
        const bucketSize = 30; // Check every 30 minutes
        const requiredBuckets = Math.ceil(meetingLength / bucketSize);

        for (const day of DAYS) {
            const buckets = new Array((24 * 60) / bucketSize).fill(0);

            // Step 1: Populate availability buckets (1 if available, 0 if not)
            for (const member of activeMembers) {
                const memberSlots = availabilities[member]?.filter(slot => slot.day === day) || [];
                for (const slot of memberSlots) {
                    const startMinute = timeToMinutes(slot.start);
                    const endMinute = timeToMinutes(slot.end);
                    const startBucket = Math.floor(startMinute / bucketSize);
                    const endBucket = Math.ceil(endMinute / bucketSize);
                    for (let i = startBucket; i < endBucket; i++) {
                        buckets[i]++;
                    }
                }
            }

            // Step 2: Find continuous blocks where ALL members are available
            for (let i = 0; i <= buckets.length - requiredBuckets; i++) {
                let isBlockAvailable = true;
                for (let j = 0; j < requiredBuckets; j++) {
                    if (buckets[i + j] !== activeMembers.length) {
                        isBlockAvailable = false;
                        break;
                    }
                }

                if (isBlockAvailable) {
                    const startMinute = i * bucketSize;
                    const endMinute = startMinute + meetingLength;

                    // Prevent duplicate suggestions (skip if the previous check was also successful)
                    if (i === 0 || buckets[i - 1] !== activeMembers.length || i * bucketSize % meetingLength === 0) {
                        potentialSlots.push({
                            day: day,
                            start: minutesToTime(startMinute),
                            end: minutesToTime(endMinute),
                            available: activeMembers.length
                        });
                    }

                }
            }
        }
        setSuggestions(potentialSlots);
        setIsSearching(false);
    }, [length, availabilities, activeMembers]);

    useEffect(() => { findSuggestions(); }, [length, availabilities, members, findSuggestions]);

    return (
        <div className="p-4 bg-white dark:bg-slate-800 rounded-lg shadow space-y-3">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Meeting Suggester</h3>
            <div className="flex items-center gap-2 text-sm">
                <label className="text-slate-700 dark:text-slate-300">Length (min):</label>
                <select value={length} onChange={e => setLength(e.target.value)} className="p-1 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700">
                    <option value={30}>30 min</option>
                    <option value={60}>60 min</option>
                    <option value={90}>90 min</option>
                    <option value={120}>120 min</option>
                </select>
                <span className="text-slate-500 dark:text-slate-400">({activeMembers.length} required)</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 text-sm">
                {isSearching ? (
                    <p className="text-slate-500 dark:text-slate-400">Searching...</p>
                ) : suggestions.length > 0 ? (
                    suggestions
                        .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
                        .map((s, i) => (
                            <div key={i} className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded flex justify-between items-center">
                                <span className="font-medium text-emerald-800 dark:text-emerald-200">
                                    {s.day}: {s.start} - {s.end}
                                </span>
                                <span className="text-xs text-emerald-700 dark:text-emerald-300">
                                    ({userTimezone})
                                </span>
                            </div>
                        ))
                ) : (
                    <p className="text-red-500 dark:text-red-400">No continuous {length}-minute blocks found where all team members are available this week.</p>
                )}
            </div>
        </div>
    );
}

// --- NextSteps Component and others remain the same ---

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [availabilities, setAvailabilities] = useState({});
    // NOTE: Added lastUpdate state for Feature 4
    const [lastUpdate, setLastUpdate] = useState(null);
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('23:30');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');
    const [userTimezone, setUserTimezone] = useState(localStorage.getItem('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [authLoading, setAuthLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', onConfirm: () => { } });

    // --- State and Handlers remain the same ---

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
        provider.addScope('email');
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Discord", error);
        }
    };

    const handleSignOut = async () => { await signOut(auth); };

    const dynamicMembers = useMemo(() => {
        const membersFromData = Object.keys(availabilities);
        const allMembers = [...new Set(membersFromData)];
        return allMembers.sort();
    }, [availabilities]);


    // --- Firebase Listener (Updated for Feature 4: Stale Data) ---
    useEffect(() => {
        const availabilitiesCol = collection(db, 'availabilities');
        const unsubscribe = onSnapshot(availabilitiesCol, (snapshot) => {
            const newAvailabilities = {};
            let currentUpdateTimestamp = null;
            snapshot.forEach(doc => {
                const data = doc.data();
                newAvailabilities[doc.id] = data.slots || [];

                // Track current user's last update time
                if (currentUser && doc.id === currentUser.displayName) {
                    currentUpdateTimestamp = data.lastUpdate;
                }
            });
            setAvailabilities(newAvailabilities);
            setLastUpdate(currentUpdateTimestamp); // Set the last update for the current user
        });
        return () => unsubscribe();
    }, [currentUser]); // Depend on currentUser to fetch their update time


    // --- Core Logic for Availability (Updated for Feature 5: Overlap Merging) ---
    async function addAvailability() {
        if (!currentUser) return;
        if (timeToMinutes(end) <= timeToMinutes(start)) {
            openModal('Invalid Time', 'End time must be after start time.', closeModal);
            return;
        }

        setSaveStatus('saving');
        const gmtStart = convertToGMT(day, start);
        const gmtEnd = convertToGMT(day, end);
        const newEntry = { day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time };

        const currentSlots = availabilities[currentUser.displayName] || [];
        let updatedSlots = [...currentSlots, newEntry];

        // NEW: Feature 5 - Merge overlapping slots before saving
        updatedSlots = mergeSlots(updatedSlots);

        // Sort slots again (mergeSlots handles sorting internally, but this is a final check)
        updatedSlots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));

        const memberDocRef = doc(db, 'availabilities', currentUser.displayName);
        try {
            // NEW: Feature 4 - Add serverTimestamp to track when data was last updated
            await setDoc(memberDocRef, {
                slots: updatedSlots,
                lastUpdate: serverTimestamp()
            });
            setSaveStatus('success');
        } catch (error) {
            console.error("Error saving availability: ", error);
            setSaveStatus('idle');
        } finally {
            setTimeout(() => setSaveStatus('idle'), 2000);
        }
    }

    // --- Stale Data Warning Logic (Feature 4) ---
    const isDataStale = useMemo(() => {
        if (!lastUpdate || !lastUpdate.toDate) return false;

        // Check if the timestamp is older than 14 days (14 days * 24 hours * 60 min * 60 sec * 1000 ms)
        const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
        const lastUpdateMs = lastUpdate.toDate().getTime();
        const nowMs = Date.now();

        return (nowMs - lastUpdateMs) > fourteenDaysInMs;
    }, [lastUpdate]);

    // --- Other handlers (clearDayForMember, clearAllForMember, postToDiscord) remain the same ---

    // The rest of the App component logic remains the same (Dark Mode, Timezone conversion, etc.)

    if (authLoading) { return <div>Loading...</div>; }
    if (!currentUser) { return <LoginScreen signIn={signIn} />; }

    const displayAvailabilities = useMemo(() => { /* ... conversion logic remains here ... */
        const converted = {};
        for (const member in availabilities) {
            converted[member] = [];
            availabilities[member].forEach(slot => {
                const localStart = convertFromGMT(slot.day, slot.start, userTimezone);
                const localEnd = convertFromGMT(slot.day, slot.end, userTimezone);

                // --- Complex Logic to handle slots crossing midnight based on local TZ ---
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

    const gmtStartDisplay = useMemo(() => { /* ... */ return convertToGMT(day, start); }, [day, start]);
    const gmtEndDisplay = useMemo(() => { /* ... */ return convertToGMT(day, end); }, [day, end]);

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 p-6">
            <div className="">
                {/* --- Header and AvailabilityNowIndicator remain the same --- */}

                {/* NEW: Feature 4 - Stale Data Warning Banner */}
                {isDataStale && (
                    <div className="bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 p-4 mb-6 rounded-md" role="alert">
                        <p className="font-bold">Availability Data is Stale!</p>
                        <p className="text-sm">Your last update was over 14 days ago. Please review and save your availability to ensure accurate scheduling.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow space-y-6">
                        {/* --- My Availability Form remains the same --- */}
                        <div>
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">My Availability ({currentUser.displayName})</h2>
                            {/* ... Form Inputs and Save Button ... */}
                        </div>

                        {/* NEW: Feature 2 - Meeting Suggester Component */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                            <MeetingSuggester availabilities={displayAvailabilities} members={dynamicMembers} userTimezone={userTimezone} />
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Best Times</h3>
                            <div className="max-h-[24rem] overflow-y-auto pr-2">
                                {/* ... BestTimesDisplay component ... */}
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Manager Dashboard</h2>

                        {/* NEW: Feature 1 - Availability Heatmap Component */}
                        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2 mt-4">Team Availability Heatmap ({userTimezone})</h3>
                        <div className="mb-6">
                            <AvailabilityHeatmap availabilities={displayAvailabilities} members={dynamicMembers} />

                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {/* ... All Submitted Slots and Availability Grid panels remain the same ... */}
                        </div>
                    </div>
                </div>
                {/* ... NextSteps and Modal remain the same ... */}
            </div>
            {/* ... Modal ... */}
        </div>
    );
}