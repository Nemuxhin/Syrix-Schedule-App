/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- Aesthetic and UI improvements applied (Color, Shadow, Typography).
- Fixed previous functionality bugs (Save/Clear/Dark Mode logic).
- Includes Visual Availability Grid and Timezone Consistency Display.
*/

import React, { useState, useEffect, useMemo } from 'react';
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


// --- Custom Modal Component (Aesthetic updates) ---
function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md transition-all duration-300 transform scale-100">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-4 border-b pb-2 border-slate-200 dark:border-slate-700">{title}</h3>
                <div className="text-slate-600 dark:text-slate-400 mb-6">
                    {children}
                </div>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="transition-colors bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-semibold px-5 py-2 rounded-lg shadow-md">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="transition-colors bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg shadow-md">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- AvailableNowIndicator (Aesthetic updates) ---
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
        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-lg mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center">
                🟢 Who's Available Now?
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-3">({userTimezone})</span>
            </h2>
            {availableMembers.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                    {availableMembers.map(member => (
                        <span key={member} className="px-4 py-1.5 bg-emerald-500 dark:bg-emerald-600 text-white text-base font-medium rounded-full shadow-md transition-transform transform hover:scale-[1.02]">
                            {member}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-slate-500 dark:text-slate-400 text-base">No one is currently available.</p>
            )}
        </div>
    );
}

// --- BestTimesDisplay (Aesthetic updates) ---
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
        <div className="space-y-3">
            {daysWithSlots.map(day => (
                <div key={day}>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-slate-700 pb-1">{day}</h4>
                    <div className="space-y-2">
                        {bestTimes[day]
                            .sort((a, b) => b.count - a.count)
                            .map((slot, i) => {
                                const slotId = `${day}-${slot.start}-${slot.end}`;
                                const status = postingStatus[slotId] || 'idle';
                                return (
                                    <div key={i} className={`p-3 rounded-xl border-2 transition-all duration-200 flex justify-between items-center ${slot.count === activeMembers.length ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-900/40 dark:border-emerald-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-700/40 dark:border-slate-600'}`}>
                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-sm">
                                            {minutesToTime(slot.start)} – {minutesToTime(slot.end)}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-bold px-2 py-1 rounded-full text-xs shadow-sm ${slot.count === activeMembers.length ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-200'}`}>
                                                {slot.count} / {activeMembers.length} players
                                            </span>
                                            <button
                                                onClick={() => handlePost(day, slot)}
                                                disabled={status !== 'idle'}
                                                className={`w-28 text-center text-xs font-semibold py-1.5 px-3 rounded-full transition-all duration-150 ${status === 'idle' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md' : ''
                                                    } ${status === 'posting' ? 'bg-slate-400 text-white' : ''
                                                    } ${status === 'success' ? 'bg-emerald-600 text-white' : ''
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

// --- AvailabilityGrid (Aesthetic updates) ---
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
        <div className="overflow-x-auto rounded-xl border border-slate-300 dark:border-slate-700 shadow-md">
            <div className="min-w-[40rem]">
                {/* Time Axis Header */}
                <div className="flex bg-slate-100 dark:bg-slate-700 relative h-8 border-b border-slate-300 dark:border-slate-600">
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

                {/* Availability Rows */}
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {membersWithSlots.map(member => (
                        <div key={member} className="flex h-10 relative">
                            <div className="w-[8rem] flex-shrink-0 p-2 text-left font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm flex items-center z-10">{member}</div>

                            <div className="flex-grow relative bg-rose-50 dark:bg-rose-900/20">
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
                                                className="absolute h-6 rounded-sm bg-emerald-600 opacity-90 shadow-md transition-all duration-300"
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

// --- FEATURE: Condensed Availability Heatmap Component ---
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

function NextSteps() {
    return (
        <footer className="mt-6 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-lg">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">What's Next?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                The application is in a great state right now. A future improvement could be to add recurring availability or an admin role to manage the team list.
            </p>
        </footer>
    );
}

function LoginScreen({ signIn }) {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-3 tracking-wide">Syrix Team Availability</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-10 text-lg">Please sign in with Discord to continue.</p>
            <button
                onClick={signIn}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-8 py-4 rounded-xl flex items-center gap-3 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
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

    const handleSignOut = async () => {
        await signOut(auth);
    };

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

    // FIX: Restored Save Logic
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
        const updatedSlots = [...currentSlots, newEntry];
        updatedSlots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));
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

    const displayAvailabilities = useMemo(() => {
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

    // --- UX Improvement: Show GMT conversion next to local time inputs ---
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

                            {/* UX Improvement: Click-to-Select Grid Placeholder */}
                            <div className="mb-4">
                                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Visual Selector (Future Feature)</h4>
                                <div className="p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-center text-xs text-slate-500 dark:text-slate-400 h-16 flex items-center justify-center shadow-inner">
                                    Click-and-drag grid to define time slots will go here.
                                </div>
                            </div>

                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Day (Local Time: {userTimezone})</label>
                            <select className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg mb-3 text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm transition-colors" value={day} onChange={e => setDay(e.target.value)}>
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <div className="flex gap-3 mb-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Start</label>
                                    <input type="time" className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm transition-colors" value={start} onChange={e => setStart(e.target.value)} />
                                    {/* UX Improvement: Timezone Consistency Display */}
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{gmtStartDisplay}</div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">End</label>
                                    <input type="time" className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700 shadow-sm transition-colors" value={end} onChange={e => setEnd(e.target.value)} />
                                    {/* UX Improvement: Timezone Consistency Display */}
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