/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- This version uses a real-time Firebase Firestore backend instead of localStorage.
- Data is now shared between all users in real-time.
- UPDATE: Moved "Best Times" and fixed player count logic.
*/

import React from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

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

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// --- End of Firebase Configuration ---


const DEFAULT_MEMBERS = ["Tawz", "Nemuxhin", "Aries", "Cat", "Nicky"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function timeToMinutes(t) {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(m) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
}

// --- UPDATED COMPONENT: BestTimesDisplay ---
function BestTimesDisplay({ availabilities, members }) {
    // FIXED: Only consider members who have submitted at least one availability slot.
    const activeMembers = members.filter(member => availabilities[member] && availabilities[member].length > 0);

    const calculateBestTimes = () => {
        const bucketSize = 30; // 30-minute intervals
        const results = {};

        for (const day of DAYS) {
            const buckets = new Array((24 * 60) / bucketSize).fill(0);

            // FIXED: Iterate over active members only for an accurate count.
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

            const ranges = [];
            let currentRange = null;
            for (let i = 0; i < buckets.length; i++) {
                const count = buckets[i];
                if (count > 1) { // Only show slots with 2 or more players
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
        return <p className="text-slate-500 text-sm">Waiting for more players to submit their availability...</p>;
    }

    return (
        <div className="space-y-4">
            {daysWithSlots.map(day => (
                <div key={day}>
                    <h4 className="font-semibold text-slate-800 mb-2">{day}</h4>
                    <div className="space-y-2">
                        {bestTimes[day]
                            .sort((a, b) => b.count - a.count)
                            .map((slot, i) => (
                                <div key={i} className={`p-2 rounded-md border ${slot.count === activeMembers.length ? 'bg-emerald-100 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-slate-700">
                                            {minutesToTime(slot.start)} – {minutesToTime(slot.end)}
                                        </span>
                                        {/* FIXED: Denominator is now based on active members. */}
                                        <span className={`font-bold px-2 py-1 rounded-full text-xs ${slot.count === activeMembers.length ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-800'}`}>
                                            {slot.count} / {activeMembers.length} players
                                        </span>
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}


function AvailabilityGrid({ day, members, availabilities }) {
    const timeSlots = [];
    const gridStartHour = 12; // 12 PM
    const gridEndHour = 24;   // Midnight

    for (let hour = gridStartHour; hour < gridEndHour; hour++) {
        timeSlots.push(`${String(hour).padStart(2, '0')}:00`);
        timeSlots.push(`${String(hour).padStart(2, '0')}:30`);
    }

    function isMemberAvailable(member, time) {
        const memberSlots = availabilities[member]?.filter(slot => slot.day === day) || [];
        const minutes = timeToMinutes(time);
        for (const slot of memberSlots) {
            if (minutes >= timeToMinutes(slot.start) && minutes < timeToMinutes(slot.end)) {
                return true;
            }
        }
        return false;
    }

    return (
        <div className="overflow-x-auto rounded-lg">
            <table className="min-w-full border-collapse text-center text-xs">
                <thead>
                    <tr className="bg-slate-200">
                        <th className="border-b border-slate-300 p-2 font-semibold text-slate-800 text-left">Member</th>
                        {timeSlots.map(time => (
                            <th key={time} className="border-b border-slate-300 p-2 font-semibold min-w-[3rem] text-slate-800">{time}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {members.map(member => (
                        <tr key={member} className="border-b border-slate-200">
                            <td className="p-2 font-semibold bg-white text-slate-800 text-left sticky left-0">{member}</td>
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


export default function App() {
    const [members, setMembers] = React.useState(DEFAULT_MEMBERS);
    const [selectedMember, setSelectedMember] = React.useState(DEFAULT_MEMBERS[0]);
    const [availabilities, setAvailabilities] = React.useState({});
    const [day, setDay] = React.useState(DAYS[0]);
    const [start, setStart] = React.useState('12:00');
    const [end, setEnd] = React.useState('23:30');

    React.useEffect(() => {
        const availabilitiesCol = collection(db, 'availabilities');
        const unsubscribe = onSnapshot(availabilitiesCol, (snapshot) => {
            const newAvailabilities = {};
            snapshot.forEach(doc => {
                newAvailabilities[doc.id] = doc.data().slots || [];
            });
            setAvailabilities(newAvailabilities);
        });
        return () => unsubscribe();
    }, []);

    async function addAvailability() {
        if (timeToMinutes(end) <= timeToMinutes(start)) {
            alert('End time must be after start time');
            return;
        }
        const newEntry = { day, start, end };
        const currentSlots = availabilities[selectedMember] || [];
        const updatedSlots = [...currentSlots, newEntry];
        updatedSlots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));
        const memberDocRef = doc(db, 'availabilities', selectedMember);
        await setDoc(memberDocRef, { slots: updatedSlots });
    }

    async function clearDayForMember() {
        const member = selectedMember;
        const selectedDay = day;
        const currentSlots = availabilities[member] || [];
        if (currentSlots.length === 0) return;

        const updatedSlots = currentSlots.filter(slot => slot.day !== selectedDay);

        const memberDocRef = doc(db, 'availabilities', member);

        if (updatedSlots.length === 0) {
            await deleteDoc(memberDocRef);
        } else {
            await setDoc(memberDocRef, { slots: updatedSlots });
        }
    }

    async function clearAllForMember(member) {
        const memberDocRef = doc(db, 'availabilities', member);
        await deleteDoc(memberDocRef);
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 p-6">
            <div className="">
                <header className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Syrix — Team Availability (GMT)</h1>
                    <div className="text-sm text-slate-600">Real-time version powered by Firebase</div>
                </header>

                {/* --- UPDATED LAYOUT --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left column now contains form AND best times */}
                    <div className="bg-white p-4 rounded-lg shadow space-y-6">
                        <div>
                            <h2 className="font-semibold text-slate-900 mb-2">Member — Add Availability</h2>
                            <label className="block text-sm font-medium text-slate-700">Profile</label>
                            <select className="w-full p-2 border border-slate-300 rounded mb-3 text-white" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                                {members.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>

                            <label className="block text-sm font-medium text-slate-700">Day</label>
                            <select className="w-full p-2 border border-slate-300 rounded mb-3 text-white" value={day} onChange={e => setDay(e.target.value)}>
                                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>

                            <div className="flex gap-2 mb-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700">Start</label>
                                    <input type="time" className="w-full p-2 border border-slate-300 rounded text-white" value={start} onChange={e => setStart(e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700">End</label>
                                    <input type="time" className="w-full p-2 border border-slate-300 rounded text-white" value={end} onChange={e => setEnd(e.target.value)} />
                                </div>
                            </div>

                            <div className="flex items-center flex-wrap gap-2">
                                <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-md" onClick={addAvailability}>Save Availability</button>
                                <button className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-2 rounded-md" onClick={clearDayForMember}>
                                    Clear for {day}
                                </button>
                                <button className="text-xs text-slate-500 hover:text-red-600 font-semibold" onClick={() => clearAllForMember(selectedMember)}>
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {/* Best Times section moved here */}
                        <div className="border-t border-slate-200 pt-4">
                            <h3 className="font-medium text-slate-900 mb-2">Best Times</h3>
                            <div className="max-h-[24rem] overflow-y-auto pr-2">
                                <BestTimesDisplay availabilities={availabilities} members={members} />
                            </div>
                        </div>
                    </div>

                    {/* Right two columns for the main dashboard */}
                    <div className="md:col-span-2 bg-white p-4 rounded-lg shadow">
                        <h2 className="font-semibold text-slate-900 mb-2">Manager Dashboard</h2>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-medium text-slate-900">All Submitted Slots</h3>
                                <div className="space-y-2 mt-2 max-h-[30rem] overflow-y-auto pr-2">
                                    {members.map(m => (
                                        (availabilities[m] && availabilities[m].length > 0) && (
                                            <div key={m} className="p-3 border border-slate-200 rounded-md">
                                                <div className="font-semibold text-slate-800">{m}</div>
                                                <div className="text-sm mt-2 text-slate-600">
                                                    {(availabilities[m] || []).map((s, i) => (
                                                        <div key={i} className="py-1">{s.day} — {s.start} to {s.end}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-medium text-slate-900">Availability Grid</h3>
                                <div className="mt-2 space-y-4 max-h-[30.5rem] overflow-y-auto">
                                    {DAYS.map(d => (
                                        <div key={d}>
                                            <div className="font-semibold text-slate-800 mb-2">{d}</div>
                                            <AvailabilityGrid day={d} members={members} availabilities={availabilities} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

