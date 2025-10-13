/*
Syrix Team Availability - Single-file React prototype - FIREBASE VERSION
- This version uses a real-time Firebase Firestore backend instead of localStorage.
- Data is now shared between all users in real-time.
*/

import React, { useEffect, useState } from 'react';
// Import Firebase modules
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Configuration ---
// 📄 PASTE YOUR FIREBASE CONFIG OBJECT HERE
const firebaseConfig = {
    apiKey: "AIzaSyB9gQgB2OkxtMahi3a_g9g7e-b6tFFlDm4",

    authDomain: "syrix-schedule-app.firebaseapp.com",

    projectId: "syrix-schedule-app",

    storageBucket: "syrix-schedule-app.firebasestorage.app",

    messagingSenderId: "1003227848787",

    appId: "1:1003227848787:web:ba0f151cee837e549ee6a6",

    measurementId: "G-1DE07V6CXP"
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

function AvailabilityGrid({ day, members, availabilities }) {
    const timeSlots = [];
    const gridStartHour = 17; // 5 PM
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
        <div className="overflow-x-auto rounded">
            <table className="min-w-full border-collapse border border-gray-300 text-center text-xs">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-1 font-semibold">Member</th>
                        {timeSlots.map(time => (
                            <th key={time} className="border border-gray-300 p-1 font-semibold min-w-[3rem]">{time}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {members.map(member => (
                        <tr key={member}>
                            <td className="border border-gray-300 p-1 font-semibold bg-gray-50 text-left sticky left-0">{member}</td>
                            {timeSlots.map(time => (
                                <td
                                    key={`${member}-${time}`}
                                    className={`border border-gray-300 ${isMemberAvailable(member, time) ? 'bg-green-400' : 'bg-red-400'}`}
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
    const [members, setMembers] = useState(DEFAULT_MEMBERS);
    const [selectedMember, setSelectedMember] = useState(DEFAULT_MEMBERS[0]);
    const [availabilities, setAvailabilities] = useState({}); // { member: [{day, start, end}] }
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('18:00');
    const [end, setEnd] = useState('22:00');

    // ☁️ LOAD from FIREBASE in REAL-TIME
    useEffect(() => {
        const availabilitiesCol = collection(db, 'availabilities');
        // onSnapshot creates a real-time listener
        const unsubscribe = onSnapshot(availabilitiesCol, (snapshot) => {
            const newAvailabilities = {};
            snapshot.forEach(doc => {
                // The document ID is the member's name
                newAvailabilities[doc.id] = doc.data().slots || [];
            });
            setAvailabilities(newAvailabilities);
        });
        // Cleanup function to stop listening when the component unmounts
        return () => unsubscribe();
    }, []);


    // ☁️ SAVE to FIREBASE
    async function addAvailability() {
        if (timeToMinutes(end) <= timeToMinutes(start)) {
            alert('End time must be after start time');
            return;
        }
        const newEntry = { day, start, end };

        // Get the member's existing slots or create an empty array
        const currentSlots = availabilities[selectedMember] || [];
        const updatedSlots = [...currentSlots, newEntry];

        // Sort entries for clean display
        updatedSlots.sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || timeToMinutes(a.start) - timeToMinutes(b.start));

        // Create a reference to the Firestore document (the member's name is the ID)
        const memberDocRef = doc(db, 'availabilities', selectedMember);

        // Save the entire updated array to Firestore
        await setDoc(memberDocRef, { slots: updatedSlots });
    }

    // ☁️ DELETE from FIREBASE
    async function clearMember(member) {
        const memberDocRef = doc(db, 'availabilities', member);
        // You can set the document to an empty array or delete it. Deleting is cleaner.
        await deleteDoc(memberDocRef);
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Syrix — Team Availability (GMT)</h1>
                    <div className="text-sm text-gray-600">Real-time version powered by Firebase</div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Member form */}
                    <div className="bg-white p-4 rounded shadow">
                        <h2 className="font-semibold mb-2">Member — Add Availability</h2>
                        <label className="block text-sm text-gray-700">Profile</label>
                        <select className="w-full p-2 border rounded mb-3" value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                            {members.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>

                        <label className="block text-sm text-gray-700">Day</label>
                        <select className="w-full p-2 border rounded mb-3" value={day} onChange={e => setDay(e.target.value)}>
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <div className="flex gap-2 mb-3">
                            <div className="flex-1">
                                <label className="block text-sm text-gray-700">Start</label>
                                <input type="time" className="w-full p-2 border rounded" value={start} onChange={e => setStart(e.target.value)} />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm text-gray-700">End</label>
                                <input type="time" className="w-full p-2 border rounded" value={end} onChange={e => setEnd(e.target.value)} />
                            </div>
                        </div>

                        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={addAvailability}>Save Availability</button>
                        <button className="ml-2 bg-gray-200 px-3 py-2 rounded" onClick={() => clearMember(selectedMember)}>Clear My Availability</button>
                    </div>

                    {/* Dashboard */}
                    <div className="md:col-span-2 bg-white p-4 rounded shadow">
                        <h2 className="font-semibold mb-2">Manager Dashboard</h2>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-medium">All Submitted Slots</h3>
                                <div className="space-y-2 mt-2 max-h-96 overflow-y-auto pr-2">
                                    {members.map(m => (
                                        <div key={m}>
                                            {(availabilities[m] && availabilities[m].length > 0) && (
                                                <div className="p-2 border rounded mb-2">
                                                    <div className="font-semibold">{m}</div>
                                                    <div className="text-sm mt-2">
                                                        {(availabilities[m] || []).map((s, i) => (
                                                            <div key={i} className="py-1">{s.day} — {s.start} to {s.end}</div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="xl:col-span-1">
                                <h3 className="font-medium">Availability Grid</h3>
                                <div className="mt-2 space-y-4 max-h-96 overflow-y-auto pr-2">
                                    {DAYS.map(d => (
                                        <div key={d}>
                                            <div className="font-semibold mb-2">{d}</div>
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