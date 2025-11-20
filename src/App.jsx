/*
Syrix Team Availability - Single-file React prototype - FINAL FANCY PASS
- Applied premium, sleek, and visually engaging design.
- Implemented subtle gradients, elevated shadows, refined typography.
- Focused on "glassmorphism" inspired elements and enhanced micro-interactions.
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


// --- Custom Modal Component (Fancy updates) ---
function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center backdrop-blur-md">
            <div className="bg-slate-800 rounded-2xl shadow-3xl p-8 w-full max-w-lg transition-all duration-300 transform scale-100 border border-slate-700">
                <h3 className="text-2xl font-extrabold text-slate-100 mb-4 border-b pb-2 border-slate-600">{title}</h3>
                <div className="text-slate-300 text-lg mb-6">
                    {children}
                </div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="transition-all bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="transition-all bg-red-700 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- AvailableNowIndicator (Fancy updates) ---
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
        <div className="bg-slate-800 p-6 rounded-2xl shadow-2xl mb-8 border border-slate-700/60">
            <h2 className="text-2xl font-extrabold text-slate-100 mb-4 flex items-center">
                <span className="relative flex h-3 w-3 mr-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Live Status
                <span className="text-base font-medium text-slate-400 ml-4">({userTimezone})</span>
            </h2>
            {availableMembers.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                    {availableMembers.map(member => (
                        <span key={member} className="px-5 py-2 bg-emerald-600 text-white text-lg font-semibold rounded-full shadow-lg transition-transform transform hover:scale-[1.03] hover:brightness-110">
                            {member}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-slate-400 text-lg py-2">No one is currently available.</p>
            )}
        </div>
    );
}

// --- BestTimesDisplay (Fancy updates) ---
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
        return <p className="text-slate-400 text-base py-3">Waiting for enough members to submit their schedule...</p>;
    }

    return (
        <div className="space-y-4">
            {daysWithSlots.map(day => (
                <div key={day}>
                    <h4 className="font-bold text-slate-200 mb-2 border-b border-slate-700 pb-1">{day}</h4>
                    <div className="space-y-3">
                        {bestTimes[day]
                            .sort((a, b) => b.count - a.count)
                            .map((slot, i) => {
                                const slotId = `${day}-${slot.start}-${slot.end}`;
                                const status = postingStatus[slotId] || 'idle';
                                const isMax = slot.count === activeMembers.length;

                                return (
                                    <div key={i} className={`p-4 rounded-xl border transition-all duration-200 flex justify-between items-center shadow-lg transform hover:scale-[1.01] ${isMax ? 'bg-emerald-800/30 border-emerald-600' : 'bg-slate-700/50 border-slate-600'}`}>
                                        <span className={`font-semibold text-lg ${isMax ? 'text-emerald-300' : 'text-slate-300'}`}>
                                            {minutesToTime(slot.start)} – {minutesToTime(slot.end)}
                                        </span>
                                        <div className="flex items-center gap-3">
                                            <span className={`font-extrabold px-3 py-1.5 rounded-full text-sm shadow-md ${isMax ? 'bg-emerald-600 text-white' : 'bg-slate-600 text-slate-200'}`}>
                                                {slot.count} / {activeMembers.length}
                                            </span>
                                            <button
                                                onClick={() => handlePost(day, slot)}
                                                disabled={status !== 'idle'}
                                                className={`w-36 text-center text-sm font-semibold py-2 px-3 rounded-full transition-all duration-150 shadow-md ${status === 'idle' ? 'bg-blue-600 hover:brightness-125 text-white' : ''
                                                    } ${status === 'posting' ? 'bg-slate-500 text-white' : ''
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

// --- AvailabilityGrid (Fancy visuals) ---
function AvailabilityGrid({ day, members, availabilities }) {
    const TOTAL_MINUTES = 24 * 60;

    const membersWithSlots = members.filter(member =>
        (availabilities[member] || []).some(slot => slot.day === day)
    );

    if (membersWithSlots.length === 0) {
        return <p className="text-sm text-slate-400 p-3">No availability submitted for this day.</p>;
    }

    const timeLabels = [];
    for (let h = 0; h < 24; h += 4) {
        timeLabels.push({
            time: `${String(h).padStart(2, '0')}:00`,
            percent: (h / 24) * 100
        });
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-xl">
            <div className="min-w-[40rem]">
                {/* Time Axis Header */}
                <div className="flex bg-slate-700/60 relative h-10 border-b border-slate-600">
                    <div className="w-[8rem] flex-shrink-0 p-3 text-left font-bold text-slate-200 text-sm">Member</div>
                    <div className="flex-grow relative h-full">
                        {timeLabels.map(label => (
                            <div key={label.time}
                                className="absolute top-0 h-full border-l border-slate-500"
                                style={{ left: `calc(${label.percent}% - 1px)` }}>
                                <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-slate-400">{label.time}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Availability Rows */}
                <div className="divide-y divide-slate-700">
                    {membersWithSlots.map(member => (
                        <div key={member} className="flex h-14 relative group hover:bg-slate-700/40 transition-colors duration-150">
                            <div className="w-[8rem] flex-shrink-0 p-3 text-left font-semibold bg-slate-800 text-slate-200 text-base flex items-center z-10 sticky left-0 border-r border-slate-700">{member}</div>

                            <div className="flex-grow relative bg-gradient-to-r from-slate-900 to-gray-950">
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
                                                className="absolute h-9 rounded-md bg-emerald-500 opacity-95 shadow-lg transition-all duration-300 group-hover:bg-emerald-400"
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

// --- FEATURE: Condensed Availability Heatmap Component (Fancy updates) ---
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
        if (max === 0) return 'bg-slate-700/50';
        const percent = count / max;
        // Use color intensity (darker green means more available)
        if (percent === 1) return 'bg-emerald-700 hover:bg-emerald-600';
        if (percent >= 0.75) return 'bg-emerald-600 hover:bg-emerald-500';
        if (percent >= 0.50) return 'bg-emerald-500 hover:bg-emerald-400';
        if (percent >= 0.25) return 'bg-emerald-400 hover:bg-emerald-300';
        if (percent > 0) return 'bg-emerald-300 hover:bg-emerald-200';
        return 'bg-slate-700/50 hover:bg-slate-600/50';
    };

    const timeLabels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    return (
        <div className="overflow-x-auto rounded-xl shadow-lg border border-slate-700">
            <table className="min-w-full text-center text-xs border-collapse">
                <thead>
                    <tr className="bg-slate-700/80">
                        <th className="sticky left-0 bg-slate-700/80 p-3 font-extrabold text-slate-100 w-28">Day</th>
                        {timeLabels.map((time, i) => (
                            <th key={i} className="p-1 font-normal text-slate-400 min-w-[3rem] border-x border-slate-600">{i % 4 === 0 ? time : (i % 2 === 0 ? '-' : '')}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {DAYS.map(day => (
                        <tr key={day} className="border-t border-slate-700">
                            <td className="sticky left-0 p-3 font-semibold bg-slate-800 text-slate-200 text-left w-28">{day}</td>
                            {heatmapData[day]?.map((count, i) => (
                                <td
                                    key={i}
                                    className={`p-0 h-10 ${getColorClass(count, maxCount)} transition-colors duration-150 border-x border-slate-800`}
                                    title={`${day}, ${timeLabels[i]} - ${timeLabels[i + 1] || '00:00'}: ${count}/${maxCount} Available`}
                                >
                                    {/* Display count if available */}
                                    {count > 0 && <span className="text-xs font-extrabold text-white">{count}</span>}
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
        <footer className="mt-8 bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700/60">
            <h2 className="font-bold text-slate-100 mb-3 text-xl">Future Enhancements</h2>
            <p className="text-base text-slate-400 mb-4">
                The application now offers a premium experience for team coordination. Further development could introduce recurring availability patterns, advanced filtering, or administrative controls for managing team members directly within the UI.
            </p>
        </footer>
    );
}

function LoginScreen({ signIn }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-gray-950 flex flex-col items-center justify-center p-8">
            <h1 className="text-5xl font-extrabold text-slate-100 mb-4 tracking-wide text-center drop-shadow-lg">Syrix — Team Availability</h1>
            <p className="text-slate-300 mb-12 text-xl text-center max-w-md">Seamlessly coordinate your team's schedule with elegant simplicity.</p>
            <button
                onClick={signIn}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-10 py-5 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" viewBox="0 0 16 16"><path d="M13.545 2.907a13.227 13.227 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.19 12.19 0 0 0-3.658 0 8.258 8.258 0 0 0-.412-.833.051.051 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.041.041 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032c.001.014.01.028.021.037a13.276 13.276 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019c.308-.42.582-.863.818-1.329a.05.05 0 0 0-.01-.059.051.051 0 0 0-.048-.02c-1.154-.456-2.043-1.2-2.617-1.99a.05.05 0 0 1 .016-.075c.312-.212.637-.417.973-.608a.051.051 0 0 1 .059.009c1.135.632 2.325.942 3.52.942.502 0 1-.063 1.478-.195a.05.05 0 0 1 .059.009c.336.191.66.396.973.608a.05.05 0 0 1 .016.075c-.573.79-1.463 1.534-2.617 1.99a.05.05 0 0 0-.048.02.05.05 0 0 0-.01.059c.236.466.51.899.818 1.329a.05.05 0 0 0 .056.019 13.235 13.235 0 0 0 4.001-2.02.049.049 0 0 0 .021-.037c.334-3.026-.252-6.052-1.69-9.123a.041.041 0 0 0-.021-.019Zm-8.198 7.307c-.789 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612Zm5.316 0c-.788 0-1.438-.724-1.438-1.612 0-.889.637-1.613 1.438-1.613.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612Z" /></svg>
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

    // FIX: Auth state listener. Crucial for initial load and auth state management.
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
            setAuth