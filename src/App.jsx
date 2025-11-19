/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- Fallback Code USED.
- NEW: Added ServerTimestamp, useCallback, mergeSlots, Heatmap, Suggester, and Stale Data Warning.
*/

import React, { useState, useEffect, useMemo, useCallback } from 'react'; // ADDED useCallback
import { initializeApp } from 'firebase/app';
// ADDED serverTimestamp import (CRITICAL FIX)
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


// --- FEATURE 5: Time Slot Overlap Merging ---
function mergeSlots(slots) {
    if (slots.length === 0) return [];

    slots.sort((a, b) =>
        DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    const merged = [];
    let current = { ...slots[0] };

    for (let i = 1; i < slots.length; i++) {
        const next = slots[i];

        const currentEndMins = timeToMinutes(current.end);
        const nextStartMins = timeToMinutes(next.start);

        if (current.day === next.day && nextStartMins <= currentEndMins) {
            const nextEndMins = timeToMinutes(next.end);
            current.end = minutesToTime(Math.max(currentEndMins, nextEndMins));
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    return merged;
}


// --- Modal Component (Kept same) ---
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

// --- AvailableNowIndicator (Kept same) ---
function AvailableNowIndicator({ availabilities, members, userTimezone }) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const dayIndex = now.getUTCDay();
    const currentGMTDay = DAYS[(dayIndex === 0 ? 6 : dayIndex - 1)];
    const currentGMTMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

    const isAvailable = (member) => {
        const memberSlots = availabilities[member] || [];
        for (const slot of memberSlots) {
            if (slot.day === currentGMTDay && currentGMTMinutes >= timeToMinutes(slot.start) && currentGMTMinutes < timeToMinutes(slot.end)) {
                return true;
            }
        }
        return false;
    };

    const availableMembers = members.filter(member => availabilities[member] && isAvailable(member));

    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow mb-6">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Who's Available Now? <span className="text-sm font-normal text-slate-500 dark:text-slate-400">({userTimezone})</span></h2>
            {availableMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {availableMembers.map(member => (
                        <span key={member} className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-sm font-medium rounded-full">
                            {member}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm">No one is currently available.</p>
            )}
        </div>
    );
}

// --- BestTimesDisplay (Kept same) ---
function BestTimesDisplay({ availabilities, members, postToDiscord, userTimezone }) {
    const [postingStatus, setPostingStatus] = useState({});
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);

    const handlePost = async (day, slot) => {
        const slotId = `${day}-${slot.start}-${slot.end}`;
        setPostingStatus(prev => ({ ...prev, [slotId]: 'posting' }));
        const success = await postToDiscord(day, slot, userTimezone);
        setPostingStatus(prev => ({ ...prev, [slotId]: success ? 'success' : 'idle' }));
        setTimeout(() => setPostingStatus(prev => ({ ...prev, [slotId]: 'idle' })), 2000);
    };

    const calculateBestTimes = () => {
        const bucketSize = 30;
        const results = {};
        for (const day of DAYS) {
            const buckets = new Array((24 * 60) / bucketSize).fill(0);
            for (const member of activeMembers) {
                const memberSlots = availabilities[member]?.filter(slot => slot.day === day) || [];
                for (const slot of memberSlots) {
                    const startMinute = timeToMinutes(slot.start);
                    const endMinute = timeToMinutes(slot.end);
                    const startBucket = Math.floor(startMinute / bucketSize);
                    const endBucket = Math.ceil(endMinute / bucketSize) > buckets.length ? buckets.length : Math.ceil(endMinute / bucketSize);
                    for (let i = startBucket; i < endBucket; i++) {
                        buckets[i]++;
                    }
                }
            }
            const ranges = [];
            let currentRange = null;
            for (let i = 0; i < buckets.length; i++) {
                const count = buckets[i];
                if (count > 1) {
                    const startTime = i * bucketSize;
                    if (currentRange && currentRange.count === count && currentRange.end === startTime) {
                        currentRange.end = (i + 1) * bucketSize;
                    } else {
                        if (currentRange) ranges.push(currentRange);
                        currentRange = { start: startTime, end: (i + 1) * bucketSize, count: count };
                    }
                } else {
                    if (currentRange) ranges.push(currentRange);
                    currentRange = null;
                }
            }
            if (currentRange) ranges.push(currentRange);
            if (ranges.length > 0) results[day] = ranges;
        }
        return results;
    };

    const bestTimes = calculateBestTimes();
    const daysWithSlots = Object.keys(bestTimes);

    if (activeMembers.length < 2 || daysWithSlots.length === 0) {
        return <p className="text-slate-500 dark:text-slate-400 text-sm">Waiting for more players to submit their availability...</p>;
    }

    return (
        <div className="space-y-4">
            {daysWithSlots.map(day => (
                <div key={day}>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{day}</h4>
                    <div className="space-y-2">
                        {bestTimes[day]
                            .sort((a, b) => b.count - a.count)
                            .map((slot, i) => {
                                const slotId = `${day}-${slot.start}-${slot.end}`;
                                const status = postingStatus[slotId] || 'idle';
                                return (
                                    <div key={i} className={`p-2 rounded-md border flex justify-between items-center ${slot.count === activeMembers.length ? 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600'}`}>
                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                                            {minutesToTime(slot.start)} – {minutesToTime(slot.end)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold px-2 py-1 rounded-full text-xs ${slot.count === activeMembers.length ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-200'}`}>
                                                {slot.count} / {activeMembers.length} players
                                            </span>
                                            <button
                                                onClick={() => handlePost(day, slot)}
                                                disabled={status !== 'idle'}
                                                className={`w-24 text-center text-xs font-semibold py-1 px-2 rounded-md transition-all ${status === 'idle' ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''
                                                    } ${status === 'posting' ? 'bg-slate-400 text-white' : ''
                                                    } ${status === 'success' ? 'bg-emerald-500 text-white' : ''
                                                    }`}
                                            >
                                                {status === 'idle' && 'Post to Discord'}
                                                {status === 'posting' && 'Posting...'}
                                                {status === 'success' && 'Posted!'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        }
                    </div>
                </div>
            ))}
        </div>
    );
}

// --- AvailabilityGrid (Updated with Visuals) ---
function AvailabilityGrid({ day, members, availabilities }) {
    const TOTAL_MINUTES = 24 * 60;

    const membersWithSlots = members.filter(member =>
        (availabilities[member] || []).some(slot => slot.day === day)
    );

    if (membersWithSlots.length === 0) {
        return <p className="text-sm text-slate-500 dark:text-slate-400 p-2">No availability submitted for this day.</p>;
    }

    const timeLabels = [];
    for (let h = 0; h < 24; h += 4) {
        timeLabels.push({
            time: `${String(h).padStart(2, '0')}:00`,
            percent: (h / 24) * 100
        });
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="min-w-[40rem]">
                <div className="flex bg-slate-200 dark:bg-slate-700 relative h-8 border-b border-slate-300 dark:border-slate-600">
                    <div className="w-[8rem] flex-shrink-0 p-2 text-left font-semibold text-slate-800 dark:text-slate-200 text-xs">Member</div>
                    <div className="flex-grow relative h-full">
                        {timeLabels.map(label => (
                            <div key={label.time}
                                className="absolute top-0 h-full border-l border-slate-400 dark:border-slate-500"
                                style={{ left: `calc(${label.percent}% - 1px)` }}>
                                <span className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 text-xs text-slate-700 dark:text-slate-300">{label.time}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {membersWithSlots.map(member => (
                        <div key={member} className="flex h-10 relative">
                            <div className="w-[8rem] flex-shrink-0 p-2 text-left font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm flex items-center z-10">{member}</div>

                            <div className="flex-grow relative bg-rose-100 dark:bg-rose-900/30">
                                {availabilities[member]
                                    .filter(slot => slot.day === day)
                                    .map((slot, i) => {
                                        const startMinutes = timeToMinutes(slot.start);
                                        const endMinutes = timeToMinutes(slot.end);

                                        const left = (startMinutes / TOTAL_MINUTES) * 100;
                                        const width = ((endMinutes - startMinutes) / TOTAL_MINUTES) * 100;

                                        return (
                                            <div
                                                key={i}
                                                className="absolute h-4 rounded-sm bg-emerald-500 opacity-80 shadow-md"
                                                style={{ left: `${left}%`, width: `${width}%`, top: '50%', transform: 'translateY(-50%)' }}
                                                title={`${member} is available: ${slot.start} - ${slot.end}`}
                                            ></div>
                                        );
                                    })
                                }
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// --- FEATURE 1: Availability Heatmap Component ---
function AvailabilityHeatmap({ availabilities, members }) {
    const TOTAL_MINUTES = 24 * 60;
    const bucketSize = 60;
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
        if (count === 0) return 'bg-slate-100 dark:bg-slate-700/50';
        const percent = count / max;
        if (percent >= 0.75) return 'bg-emerald-600 hover:bg-emerald-700';
        if (percent >= 0.50) return 'bg-emerald-500 hover:bg-emerald-600';
        if (percent >= 0.25) return 'bg-emerald-400 hover:bg-emerald-500';
        return 'bg-emerald-300 hover:bg-emerald-400';
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

// --- FEATURE 2: Meeting Suggester Component ---
function MeetingSuggester({ availabilities, members, userTimezone }) {
    const [length, setLength] = useState(60);
    const [suggestions, setSuggestions] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);

    // useCallback stabilizes the function for use in useEffect
    const findSuggestions = useCallback(() => {
        setIsSearching(true);
        const meetingLength = parseInt(length);
        if (meetingLength <= 0 || activeMembers.length === 0) {
            setSuggestions([]);
            setIsSearching(false);
            return;
        }

        const potentialSlots = [];
        const bucketSize = 30;
        const requiredBuckets = Math.ceil(meetingLength / bucketSize);

        for (const day of DAYS) {
            const buckets = new Array((24 * 60) / bucketSize).fill(0);

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

            for (let i = 0; i <= buckets.length - requiredBuckets; i++) {
                let isBlockAvailable = true;
                for (let j = 0; j < requiredBuckets; j++) {
                    // Check if ALL members are available in every required bucket
                    if (buckets[i + j] !== activeMembers.length) {
                        isBlockAvailable = false;
                        break;
                    }
                }

                if (isBlockAvailable) {
                    const startMinute = i * bucketSize;
                    const endMinute = startMinute + meetingLength;

                    // Only push a new suggestion if the previous bucket block wasn't also a success (to group continuous suggestions)
                    if (i === 0 || buckets[i - 1] !== activeMembers.length) {
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
                <span className="text-slate-500 dark:text-slate-400">({activeMembers.length} members required)</span>
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

// --- NextSteps and LoginScreen (Kept same) ---
function NextSteps() {
    return (
        <footer className="mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">What's Next?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                The application is in a great state right now. A future improvement could be to add recurring availability or an admin role to manage the team list.
            </p>
        </footer>
    );
}
function LoginScreen({ signIn }) {
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Syrix Team Availability</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-8">Please sign in with Discord to continue.</p>
            <button
                onClick={signIn}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-6 py-3 rounded-md flex items-center gap-3 transition-colors"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.048-.02c-1.154-.456-2.043-1.2-2.617-1.99a.05.05 0 0 1 .016-.075c.312-.212.637-.417.973-.608a.051.051 0 0 1 .059.009c1.135.632 2.325.942 3.52.942.502 0 1-.063 1.478-.195a.05.05 0 0 1 .059.009c.336.191.66.396.973.608a.05.05 0 0 1 .016.075c-.573.79-1.463 1.534-2.617 1.99a.05.05 0 0 0-.048.02.05.05 0 0 0-.01.059c.236.466.51.899.818 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.026-.252-6.052-1.69-9.123a.041.041 0 0 0-.021-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z" /></svg>
                Sign In with Discord
            </button>
        </div>
    );
}


export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [availabilities, setAvailabilities] = useState({});
    // Feature 4: Stale Data Check
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setAuthLoading(false);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => { /* ... (omitted) ... */ };
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
                    if (data.lastUpdate && typeof data.lastUpdate.toDate === 'function') {
                        currentUpdateTimestamp = data.lastUpdate;
                    }
                }
            });
            setAvailabilities(newAvailabilities);
            setLastUpdate(currentUpdateTimestamp);
        });
        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => { /* ... (Dark Mode Logic) ... */ }, []);
    useEffect(() => { /* ... (Dark Mode Class Update) ... */ }, [isDarkMode]);

    const handleTimezoneChange = (tz) => {
        setUserTimezone(tz);
        localStorage.setItem('timezone', tz);
    };

    const openModal = (title, message, onConfirm) => { /* ... (omitted) ... */ };
    const closeModal = () => { /* ... (omitted) ... */ };

    // --- FEATURE 5: Slot Merging in Save Function ---
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

        // FEATURE: Merge overlapping slots before saving
        updatedSlots = mergeSlots(updatedSlots);

        const memberDocRef = doc(db, 'availabilities', currentUser.displayName);
        try {
            // FEATURE 4: Add serverTimestamp
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

    async function clearDayForMember() { /* ... (omitted) ... */ }
    async function clearAllForMember() { /* ... (omitted) ... */ }

    // FEATURE 4: Stale Data Warning Logic 
    const isDataStale = useMemo(() => {
        if (!lastUpdate || !lastUpdate.toDate) return false;

        const fourteenDaysInMs = 14 * 24 * 60 * 60 * 1000;
        const lastUpdateMs = lastUpdate.toDate().getTime();
        const nowMs = Date.now();

        return (nowMs - lastUpdateMs) > fourteenDaysInMs;
    }, [lastUpdate]);

    const postToDiscord = async (day, slot, tz) => { /* ... (omitted) ... */ };

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

    const gmtStartDisplay = useMemo(() => {
        const gmt = convertToGMT(day, start);
        return `${gmt.day} ${gmt.time} GMT`;
    }, [day, start]);

    const gmtEndDisplay = useMemo(() => {
        const gmt = convertToGMT(day, end);
        const isMidnight = end === '00:00' && timeToMinutes(end) === 0;
        return `${isMidnight ? 'Next Day ' : ''}${gmt.day} ${gmt.time} GMT`;
    }, [day, end]);


    if (authLoading) { return <div>Loading...</div>; }
    if (!currentUser) { return <LoginScreen signIn={signIn} />; }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 p-6">
            <div className="">
                <header className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Syrix — Team Availability</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <img src={currentUser.photoURL || 'https://via.placeholder.com/32'} alt={currentUser.displayName} className="w-8 h-8 rounded-full" />
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{currentUser.displayName}</span>
                        </div>
                        <select id="tz-select" value={userTimezone} onChange={e => handleTimezoneChange(e.target.value)} className="p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 text-sm">
                            {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                        </select>
                        <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            {isDarkMode ? '☀️' : '🌙'}
                        </button>
                        <button onClick={handleSignOut} className="text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-red-500">
                            Sign Out
                        </button>
                    </div>
                </header>

                <AvailableNowIndicator availabilities={availabilities} members={dynamicMembers} userTimezone={userTimezone} />

                {/* FEATURE 4: Stale Data Warning Banner */}
                {isDataStale && (
                    <div className="bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200 p-4 mb-6 rounded-md" role="alert">
                        <p className="font-bold">Availability Data is Stale!</p>
                        <p className="text-sm">Your last update was over 14 days ago. Please review and save your availability to ensure accurate scheduling.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow space-y-6">
                        {/* --- Start of My Availability Form (UX Improvements Applied) --- */}
                        <div>
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">My Availability ({currentUser.displayName})</h2>

                            {/* UX Improvement: Click-to-Select Grid Placeholder */}
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Visual Selector (Future Feature)</h4>
                                <div className="p-2 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700/50 text-center text-xs text-slate-500 dark:text-slate-400 h-16 flex items-center justify-center">
                                    Click-and-drag grid to define time slots will go here.
                                </div>
                            </div>

                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Day (Local Time: {userTimezone})</label>
                            <select className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded mb-3 text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700" value={day} onChange={e => setDay(e.target.value)}>
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <div className="flex gap-2 mb-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start</label>
                                    <input type="time" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700" value={start} onChange={e => setStart(e.target.value)} />
                                    {/* UX Improvement: Timezone Consistency Display */}
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{gmtStartDisplay}</div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">End</label>
                                    <input type="time" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700" value={end} onChange={e => setEnd(e.target.value)} />
                                    {/* UX Improvement: Timezone Consistency Display */}
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{gmtEndDisplay}</div>
                                </div>
                            </div>
                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    className={`font-bold px-4 py-2 rounded-md flex items-center justify-center transition-all ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    onClick={addAvailability}
                                    disabled={saveStatus !== 'idle'}
                                >
                                    {saveStatus === 'idle' && 'Save Availability (Merged)'}
                                    {saveStatus === 'saving' && (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>)}
                                    {saveStatus === 'success' && (<> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-lg mr-2" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z" /></svg> Saved! </>)}
                                </button>
                                <button className="bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold px-3 py-2 rounded-md"
                                    onClick={() => openModal('Confirm Clear', `Are you sure you want to clear your availability for ${day}?`, clearDayForMember)}>
                                    Clear for {day}
                                </button>
                                <button className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 font-semibold"
                                    onClick={() => openModal('Confirm Clear All', 'Are you sure you want to delete ALL of your availability slots?', clearAllForMember)}>
                                    Clear All My Slots
                                </button>
                            </div>
                        </div>
                        {/* --- End of My Availability Form --- */}

                        {/* FEATURE 2: Meeting Suggester Component */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                            <MeetingSuggester availabilities={displayAvailabilities} members={dynamicMembers} userTimezone={userTimezone} />
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Best Times</h3>
                            <div className="max-h-[24rem] overflow-y-auto pr-2">
                                <BestTimesDisplay availabilities={displayAvailabilities} members={dynamicMembers} postToDiscord={postToDiscord} userTimezone={userTimezone} />
                            </div>
                        </div>
                    </div>
                    <div className="md:col-span-2 bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Manager Dashboard</h2>

                        {/* FEATURE 1: Availability Heatmap Component */}
                        <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2 mt-4">Team Availability Heatmap ({userTimezone})</h3>
                        <div className="mb-6">
                            <AvailabilityHeatmap availabilities={displayAvailabilities} members={dynamicMembers} />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-slate-100">All Submitted Slots</h3>
                                <div className="space-y-2 mt-2 max-h-[30rem] overflow-y-auto pr-2">
                                    {dynamicMembers.map(m => (
                                        (displayAvailabilities[m] && displayAvailabilities[m].length > 0) && (
                                            <div key={m} className="p-3 border border-slate-200 dark:border-slate-700 rounded-md">
                                                <div className="font-semibold text-slate-800 dark:text-slate-200">{m}</div>
                                                <div className="text-sm mt-2 text-slate-600 dark:text-slate-400">
                                                    {(displayAvailabilities[m] || []).map((s, i) => (
                                                        <div key={i} className="py-1">{s.day} — {s.start} to {s.end}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium text-slate-900 dark:text-slate-100">Availability Grid (Visual Timeline)</h3>
                                <div className="mt-2 space-y-4 max-h-[30.5rem] overflow-y-auto">
                                    {DAYS.map(d => (
                                        <div key={d}>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-6">{d}</div>
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