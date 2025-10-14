/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- This version uses a real-time Firebase Firestore backend instead of localStorage.
- Data is now shared between all users in real-time.
- UPDATE: Added Discord Authentication. Users now sign in to manage their own availability.
*/

import React from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
// --- NEW: Firebase Auth imports ---
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

const DEFAULT_MEMBERS = ["Tawz", "Nemuxhin", "Aries", "Cat", "Nicky"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const timezones = [
    "UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
    "Asia/Tokyo", "Australia/Sydney"
];

// --- (Timezone helpers and other utility functions remain the same) ---
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

function timeToMinutes(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minutesToTime(m) { const hh = Math.floor(m / 60).toString().padStart(2, '0'); const mm = (m % 60).toString().padStart(2, '0'); return `${hh}:${mm}`; }


// --- FIXED: Full component definitions restored ---
function AvailableNowIndicator({ availabilities, members, userTimezone }) {
    const [now, setNow] = React.useState(new Date());

    React.useEffect(() => {
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

function BestTimesDisplay({ availabilities, members, postToDiscord, userTimezone }) {
    const [postingStatus, setPostingStatus] = React.useState({});
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
                    const endBucket = endMinute === 1440 ? 48 : Math.floor(endMinute / bucketSize);
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
                                    <div key={i} className={`p-2 rounded-md border ${slot.count === activeMembers.length ? 'bg-emerald-100 border-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700' : 'bg-slate-50 border-slate-200 dark:bg-slate-700/50 dark:border-slate-600'}`}>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
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

function AvailabilityGrid({ day, members, availabilities }) {
    const timeSlots = [];
    const gridStartHour = 12;
    const gridEndHour = 24;

    for (let hour = gridStartHour; hour < gridEndHour; hour++) {
        timeSlots.push(`${String(hour).padStart(2, '0')}:00`);
        timeSlots.push(`${String(hour).padStart(2, '0')}:30`);
    }

    function isMemberAvailable(member, time) {
        const memberSlots = availabilities[member]?.filter(slot => slot.day === day) || [];
        const minutes = timeToMinutes(time);
        for (const slot of memberSlots) {
            const startMinutes = timeToMinutes(slot.start);
            let endMinutes = timeToMinutes(slot.end);
            if (endMinutes === 0) endMinutes = 1440;

            if (startMinutes < endMinutes) {
                if (minutes >= startMinutes && minutes < endMinutes) return true;
            } else {
                if (minutes >= startMinutes || minutes < endMinutes) return true;
            }
        }
        return false;
    }

    return (
        <div className="overflow-x-auto rounded-lg">
            <table className="min-w-full border-collapse text-center text-xs">
                <thead>
                    <tr className="bg-slate-200 dark:bg-slate-700">
                        <th className="border-b border-slate-300 dark:border-slate-600 p-2 font-semibold text-slate-800 dark:text-slate-200 text-left">Member</th>
                        {timeSlots.map(time => (
                            <th key={time} className="border-b border-slate-300 dark:border-slate-600 p-2 font-semibold min-w-[3rem] text-slate-800 dark:text-slate-200">{time}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {members.map(member => (
                        <tr key={member} className="border-b border-slate-200 dark:border-slate-700">
                            <td className="p-2 font-semibold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-left sticky left-0">{member}</td>
                            {timeSlots.map(time => (
                                <td
                                    key={`${member}-${time}`}
                                    className={`${isMemberAvailable(member, time) ? 'bg-emerald-500' : 'bg-rose-500'}`}
                                    title={`${member} - ${time} - ${isMemberAvailable(member, time) ? 'Available' : 'Unavailable'}`}
                                >
                                    &nbsp;
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
        <footer className="mt-6 bg-white dark:bg-slate-800 p-4 rounded-lg shadow">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">What's Next?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                With user accounts added, the next logical step is to improve the user experience with custom confirmation modals instead of browser alerts.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                    <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-2">Quality-of-Life Improvements</h3>
                    <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
                        <li>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Confirmation Modals:</span> Replace browser alerts with attractive, custom-styled modals that fit the app's theme.
                        </li>
                    </ul>
                </div>
            </div>
        </footer>
    );
}

// --- NEW: Login Screen Component ---
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
    const [currentUser, setCurrentUser] = React.useState(null);
    const [availabilities, setAvailabilities] = React.useState({});
    const [day, setDay] = React.useState(DAYS[0]);
    const [start, setStart] = React.useState('12:00');
    const [end, setEnd] = React.useState('23:30');
    const [isDarkMode, setIsDarkMode] = React.useState(false);
    const [saveStatus, setSaveStatus] = React.useState('idle');
    const [userTimezone, setUserTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // --- AUTH LOGIC ---
    React.useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            setCurrentUser(user);
        });
        return unsubscribe;
    }, []);

    const signIn = async () => {
        const provider = new OAuthProvider('oidc.discord');
        // --- ADDED: Request necessary permissions from Discord ---
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

    // --- Dynamic member list ---
    const dynamicMembers = React.useMemo(() => {
        const membersFromDb = Object.keys(availabilities);
        const combined = new Set([...DEFAULT_MEMBERS, ...membersFromDb]);
        return Array.from(combined);
    }, [availabilities]);


    // --- (Data fetching and other effects remain largely the same) ---
    React.useEffect(() => {
        const availabilitiesCol = collection(db, 'availabilities');
        const unsubscribe = onSnapshot(availabilitiesCol, (snapshot) => {
            const newAvailabilities = {};
            snapshot.forEach(doc => { newAvailabilities[doc.id] = doc.data().slots || []; });
            setAvailabilities(newAvailabilities);
        });
        return () => unsubscribe();
    }, []);

    React.useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            setIsDarkMode(true);
        }
    }, []);
    React.useEffect(() => {
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

    async function addAvailability() {
        if (!currentUser) return;
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
    }

    async function clearAllForMember() {
        if (!currentUser) return;
        const memberDocRef = doc(db, 'availabilities', currentUser.displayName);
        await deleteDoc(memberDocRef);
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
            alert('Failed to post to Discord. Check your console for errors.');
            return false;
        }
    }

    const displayAvailabilities = React.useMemo(() => {
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

    // Show login screen if no user
    if (!currentUser) {
        return <LoginScreen signIn={signIn} />;
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200 p-6">
            <div className="">
                <header className="flex items-center justify-between mb-6 flex-wrap gap-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Syrix — Team Availability</h1>
                    {/* --- NEW: User profile and sign out button --- */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <img src={currentUser.photoURL} alt={currentUser.displayName} className="w-8 h-8 rounded-full" />
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow space-y-6">
                        <div>
                            {/* --- UPDATED: No more profile selector --- */}
                            <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">My Availability ({currentUser.displayName})</h2>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Day</label>
                            <select className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded mb-3 text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700" value={day} onChange={e => setDay(e.target.value)}>
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <div className="flex gap-2 mb-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start</label>
                                    <input type="time" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700" value={start} onChange={e => setStart(e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">End</label>
                                    <input type="time" className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-700" value={end} onChange={e => setEnd(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex items-center flex-wrap gap-2">
                                <button
                                    className={`font-bold px-4 py-2 rounded-md flex items-center justify-center transition-all ${saveStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                    onClick={addAvailability}
                                    disabled={saveStatus !== 'idle'}
                                >
                                    {saveStatus === 'idle' && 'Save Availability'}
                                    {saveStatus === 'saving' && (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>)}
                                    {saveStatus === 'success' && (<> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-check-lg mr-2" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022z" /></svg> Saved! </>)}
                                </button>
                                <button className="bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 font-bold px-3 py-2 rounded-md" onClick={clearDayForMember}> Clear for {day} </button>
                                <button className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 font-semibold" onClick={clearAllForMember}> Clear All My Slots </button>
                            </div>
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
                                <h3 className="font-medium text-slate-900 dark:text-slate-100">Availability Grid</h3>
                                <div className="mt-2 space-y-4 max-h-[30.5rem] overflow-y-auto">
                                    {DAYS.map(d => (
                                        <div key={d}>
                                            <div className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{d}</div>
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
        </div>
    );
}

