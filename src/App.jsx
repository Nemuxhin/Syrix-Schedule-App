/*
Syrix Team Availability - Single-file React prototype
- Default export is a React component (App)
- Uses Tailwind CSS classes (assumes Tailwind is available in the host project)
- Stores data in localStorage (no backend). You can deploy as a static site to Vercel.

How to deploy (quick):
1. Create a new GitHub repo and add this file as `src/App.jsx` inside a create-react-app or Vite React project.
2. Ensure Tailwind is set up (or remove Tailwind classes if not).
3. Push to GitHub and import the repo into Vercel (https://vercel.com/new).

Features in this prototype:
- Member selector (pre-populated with Tawz, Nemuxhin, Aries, Cat, Nicky)
- Availability input: select day, start time, end time (Option A style)
- Save availability to localStorage per member
- Manager Dashboard: shows members' availabilities, and computes common free windows (GMT)
- Settings panel to store Discord webhook URL later; "Post to Discord" button will send a webhook POST when webhook is set
- Mobile-friendly layout

NOTE: This is a single-file prototype meant to be dropped into a React project. You can further extend it with a backend (Firebase/Firestore) for multi-device real-time sync.
*/

import React, { useEffect, useState } from 'react';

const DEFAULT_MEMBERS = ["Tawz", "Nemuxhin", "Aries", "Cat", "Nicky"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function timeToMinutes(t) {
    // t = "HH:MM"
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}
function minutesToTime(m) {
    const hh = Math.floor(m / 60).toString().padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
}

export default function App() {
    const [members, setMembers] = useState(DEFAULT_MEMBERS);
    const [selectedMember, setSelectedMember] = useState(DEFAULT_MEMBERS[0]);
    const [availabilities, setAvailabilities] = useState({}); // { member: [{day, start, end}] }
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('18:00');
    const [end, setEnd] = useState('22:00');
    const [webhook, setWebhook] = useState('');
    const [minPlayersForHighlight, setMinPlayersForHighlight] = useState(3);

    // load from localStorage
    useEffect(() => {
        const a = localStorage.getItem('syrix_avail');
        const w = localStorage.getItem('syrix_webhook');
        if (a) setAvailabilities(JSON.parse(a));
        if (w) setWebhook(w);
    }, []);
    useEffect(() => {
        localStorage.setItem('syrix_avail', JSON.stringify(availabilities));
    }, [availabilities]);
    useEffect(() => {
        localStorage.setItem('syrix_webhook', webhook);
    }, [webhook]);

    function addAvailability() {
        const sM = selectedMember;
        if (timeToMinutes(end) <= timeToMinutes(start)) {
            alert('End time must be after start time');
            return;
        }
        const entry = { day, start, end };
        setAvailabilities(prev => {
            const copy = { ...prev };
            copy[sM] = copy[sM] ? [...copy[sM], entry] : [entry];
            return copy;
        });
    }

    function clearMember(member) {
        setAvailabilities(prev => { const c = { ...prev }; delete c[member]; return c; });
    }

    function computeCommonSlots() {
        // Build a per-day timeline of 30-minute buckets and count availability
        const bucketSize = 30; // minutes
        const results = {};
        for (const d of DAYS) {
            const buckets = new Array(24 * 60 / bucketSize).fill(0);
            for (const m of members) {
                const list = availabilities[m] || [];
                for (const e of list.filter(x => x.day === d)) {
                    const s = Math.max(0, timeToMinutes(e.start));
                    const en = Math.min(24 * 60, timeToMinutes(e.end));
                    for (let t = Math.floor(s / bucketSize); t < Math.ceil(en / bucketSize); t++) buckets[t]++;
                }
            }
            // compress buckets into ranges where count >= minPlayersForHighlight
            const ranges = [];
            let inRange = false; let rangeStart = 0;
            for (let i = 0; i < buckets.length; i++) {
                if (buckets[i] >= minPlayersForHighlight) {
                    if (!inRange) { inRange = true; rangeStart = i; }
                } else {
                    if (inRange) { ranges.push({ start: rangeStart * bucketSize, end: i * bucketSize, count: buckets.slice(rangeStart, i).reduce((a, b) => Math.max(a, b), 0) }); inRange = false; }
                }
            }
            if (inRange) ranges.push({ start: rangeStart * bucketSize, end: buckets.length * bucketSize, count: buckets.slice(rangeStart).reduce((a, b) => Math.max(a, b), 0) });
            results[d] = { buckets, ranges };
        }
        return results;
    }

    const common = computeCommonSlots();

    async function postToDiscord(dayRange) {
        if (!webhook) { alert('No webhook set. Add your Discord webhook in Settings.'); return; }
        const content = `**Syrix Team Availability**\nMost available on **${dayRange.day}** ${minutesToTime(dayRange.start)} - ${minutesToTime(dayRange.end)}\nMinimum players: ${minPlayersForHighlight}`;
        try {
            await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
            alert('Posted to Discord (or attempted).');
        } catch (e) {
            alert('Failed to post to Discord. Check webhook URL and CORS (if hosting restricts requests).');
        }
    }

    function exportData() {
        const blob = new Blob([JSON.stringify({ members, availabilities }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'syrix_availability.json'; a.click();
    }

    function importData(evt) {
        const file = evt.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.availabilities) setAvailabilities(data.availabilities);
                alert('Imported.');
            } catch (err) { alert('Invalid file'); }
        };
        reader.readAsText(file);
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-6xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Syrix — Team Availability (GMT)</h1>
                    <div className="text-sm text-gray-600">Prototype — local-only storage. Deploy to Vercel for public access.</div>
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

                        <div className="mt-4 border-t pt-3 text-sm text-gray-600">
                            <div className="mb-2">Quick actions</div>
                            <button className="px-3 py-2 bg-green-500 text-white rounded mr-2" onClick={exportData}>Export JSON</button>
                            <label className="px-3 py-2 bg-yellow-400 rounded cursor-pointer">
                                Import
                                <input onChange={importData} type="file" accept="application/json" className="hidden" />
                            </label>
                        </div>
                    </div>

                    {/* Dashboard */}
                    <div className="md:col-span-2 bg-white p-4 rounded shadow">
                        <div className="flex items-start justify-between">
                            <h2 className="font-semibold mb-2">Manager Dashboard</h2>
                            <div className="text-sm text-gray-600">Min players to highlight: <input className="w-12 ml-2 p-1 border rounded inline" type="number" value={minPlayersForHighlight} onChange={e => setMinPlayersForHighlight(Number(e.target.value) || 1)} /></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-medium">Member Availabilities</h3>
                                <div className="space-y-2 mt-2">
                                    {members.map(m => (
                                        <div key={m} className="p-2 border rounded">
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold">{m}</div>
                                                <div className="text-sm text-gray-600">{(availabilities[m] || []).length} slots</div>
                                            </div>
                                            <div className="text-sm mt-2">
                                                {(availabilities[m] || []).map((s, i) => (
                                                    <div key={i} className="py-1">{s.day} — {s.start} to {s.end}</div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-medium">Suggested Common Windows</h3>
                                <div className="mt-2 space-y-2">
                                    {DAYS.map(d => (
                                        <div key={d} className="p-2 border rounded">
                                            <div className="font-semibold">{d}</div>
                                            <div className="text-sm mt-1">
                                                {common[d].ranges.length === 0 ? <div className="text-gray-500">No windows with ≥ {minPlayersForHighlight} players</div>
                                                    : common[d].ranges.map((r, idx) => (
                                                        <div key={idx} className="flex items-center justify-between py-1">
                                                            <div>{minutesToTime(r.start)} — {minutesToTime(r.end)} ({r.count}+)</div>
                                                            <div>
                                                                <button className="px-2 py-1 bg-blue-600 text-white rounded mr-2" onClick={() => postToDiscord({ day: d, start: r.start, end: r.end })}>Post to Discord</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="mt-6 bg-white p-4 rounded shadow">
                    <h3 className="font-semibold">Settings</h3>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-sm text-gray-700">Discord Webhook URL (optional — add later)</label>
                            <input value={webhook} onChange={e => setWebhook(e.target.value)} className="w-full p-2 border rounded" placeholder="Paste webhook URL here" />
                            <div className="text-xs text-gray-500 mt-1">Add your webhook to enable automatic posts. You can also leave blank and copy suggested times manually.</div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-700">Timezone</label>
                            <div className="p-2 border rounded">GMT</div>
                        </div>
                    </div>
                </div>

                <footer className="mt-6 text-sm text-gray-600">If you'd like, I can convert this to a hosted Vercel demo and add persistent backend (Firebase) so availabilities sync across devices. You said this is private for Syrix — the repo will include only the pre-listed members.</footer>

            </div>
        </div>
    );
}
