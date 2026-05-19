import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc, updateDoc, query, where, getDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut, OAuthProvider } from 'firebase/auth';
import { auth, db, discordWebhookUrl } from './lib/firebase';
import { ADMIN_ACCESS_ROLES, ADMIN_ROLES, ADMIN_UIDS, AGENT_NAMES, DAYS, MAPS, RANKS, ROLE_ABBREVIATIONS, ROLES, SHORT_DAYS, UTILITY_TYPES, timezones } from './lib/constants';
import { convertFromGMT, convertToGMT, normalizeAvailabilitySlots, safeDocId, sortRosterByRole, timeToMinutes, writeAuditLog } from './lib/utils';
import { Background, ButtonPrimary, ButtonSecondary, Card, GlobalStyles, Input, Modal, Select, TeamLogo } from './components/shared';
import { ToastProvider } from './components/ToastProvider';
import { AdminPanel } from './components/hub/AdminPanel';
import { useValorantData } from './hooks/useValorantData';
import { useToast } from './hooks/useToast';

// ==========================================
// LANDING PAGE COMPONENT
// ==========================================
const LandingPage = ({ onEnterHub }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [roster, setRoster] = useState([]);
    const [matches, setMatches] = useState([]);
    const [allEvents, setAllEvents] = useState([]); // Added to store all events for stats
    const [newsData, setNewsData] = useState([]);
    const [intelData, setIntelData] = useState([]);
    const [merchData, setMerchData] = useState([]);
    const [achievements, setAchievements] = useState([]);

    // Load real data from Firestore
    useEffect(() => {
        const unsubRoster = onSnapshot(collection(db, 'roster'), (snap) => {
            const r = [];
            snap.forEach(doc => r.push({ id: doc.id, ...doc.data() }));
            setRoster(r);
        });
        const unsubEvents = onSnapshot(collection(db, 'events'), (snap) => {
            const e = [];
            snap.forEach(doc => e.push({ id: doc.id, ...doc.data() }));
            setAllEvents(e);

            // FIX: Filter for events that are TODAY or in the FUTURE
            const now = new Date();
            now.setHours(0, 0, 0, 0); // Set to start of today

            const futureMatches = e
                .filter(m => {
                    const eventDate = new Date(m.date);
                    return eventDate >= now && !m.result; // Hide if date passed OR if it has a result
                })
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            setMatches(futureMatches);
        });

        // News Listener
        const unsubNews = onSnapshot(query(collection(db, 'news')), (snap) => {
            const n = []; snap.forEach(doc => n.push({ id: doc.id, ...doc.data() }));
            setNewsData(n.sort((a, b) => (b.isFeatured === a.isFeatured) ? new Date(b.date) - new Date(a.date) : b.isFeatured ? 1 : -1));
        });

        // Intel (VOD) Listener
        const unsubIntel = onSnapshot(query(collection(db, 'intel')), (snap) => {
            const i = []; snap.forEach(doc => i.push({ id: doc.id, ...doc.data() }));
            setIntelData(i.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3));
        });

        // Merch Listener
        const unsubMerch = onSnapshot(collection(db, 'merch'), (snap) => {
            const m = [];
            snap.forEach(doc => m.push({ id: doc.id, ...doc.data() }));
            setMerchData(m);
        });

        // NEW: Achievements Listener for Landing Page
        const unsubAchieve = onSnapshot(collection(db, 'achievements'), (snap) => {
            const a = [];
            snap.forEach(doc => a.push({ id: doc.id, ...doc.data() }));
                // Sort by created date (newest first) or any other logic
            setAchievements(a.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)));
        });

        return () => {
            unsubRoster(); unsubEvents(); unsubNews(); unsubIntel(); unsubMerch(); unsubAchieve();
        };
    }, []);

    const { activePlayers, coachingStaff } = useMemo(() => {
        const sorted = sortRosterByRole(roster);
        const staffRoles = ["Manager", "Head Coach", "Coach"];

        return {
            coachingStaff: sorted.filter(p => staffRoles.includes(p.role)),
            activePlayers: sorted.filter(p => !staffRoles.includes(p.role))
        };
    }, [roster]);

    // --- NEW STATS CALCULATION ---
    const teamStats = useMemo(() => {
        const pastMatches = allEvents.filter(e => e.result && e.result.myScore).sort((a, b) => new Date(a.date) - new Date(b.date));
        let wins = 0, losses = 0;
        pastMatches.forEach(m => {
            const my = parseInt(m.result.myScore);
            const enemy = parseInt(m.result.enemyScore);
            if (my > enemy) wins++;
            else if (my < enemy) losses++;
        });
        const total = wins + losses;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        let cumulative = 0;
        const trendPoints = pastMatches.slice(-10).map(m => {
            cumulative += (parseInt(m.result.myScore) - parseInt(m.result.enemyScore));
            return cumulative;
        });

        return { winRate, wins, losses, trendPoints };
    }, [allEvents]);

    const generateTrendPath = (points) => {
        if (!points.length) return "";
        const max = Math.max(...points.map(Math.abs)) || 10;
        const height = 50; const width = 150;
        const stepX = width / (points.length - 1 || 1);
        return points.map((pt, i) => `${i * stepX},${height / 2 - (pt / max) * (height / 2)}`).join(" ");
    };

    const featuredNews = newsData.find(n => n.isFeatured) || newsData[0];
    const otherNews = newsData.filter(n => n.id !== featuredNews?.id).slice(0, 3);

    // Dynamic Script Loading for AOS
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/aos@2.3.1/dist/aos.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/aos@2.3.1/dist/aos.js';
        script.onload = () => { if (window.AOS) window.AOS.init({ duration: 800, once: true, offset: 50 }); };
        document.body.appendChild(script);

        return () => {
            document.head.removeChild(link);
            document.body.removeChild(script);
        };
    }, []);

    const formatEventDate = (date) => {
        if (!date) return 'Date TBD';
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return date;
        return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    };

    const PlayerCard = ({ player, delay }) => {
        const initials = String(player.id || '?').slice(0, 2).toUpperCase();
        return (
            <div className="player-card group w-full sm:w-[18.5rem]" data-aos="fade-up" data-aos-delay={delay}>
                <div className="card-inner h-full">
                    <div className="card-front bg-[#0d1016] overflow-hidden border border-white/10 relative h-full flex flex-col hover:border-red-500/50 transition-colors">
                        <div className="w-full h-64 bg-neutral-950 flex items-center justify-center overflow-hidden relative">
                            {player.pfp ? (
                                <img src={player.pfp} alt={player.id} className="w-full h-full object-cover object-top group-hover:scale-[1.04] transition-transform duration-500" />
                            ) : (
                                <span className="text-7xl font-black text-neutral-700 group-hover:text-red-500 transition-colors">{initials}</span>
                            )}
                            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0d1016] to-transparent"></div>
                            {player.ingameRole && (
                                <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-sm shadow-lg">
                                    {player.ingameRole}
                                </div>
                            )}
                        </div>
                        <div className="p-5 text-left relative flex-1 flex flex-col">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <h4 className="text-2xl font-black text-white leading-none">{player.id}</h4>
                                    {player.gameId && <p className="mt-1 text-xs text-neutral-500 font-mono truncate">{player.gameId}</p>}
                                </div>
                                <div className="text-[10px] font-black text-red-400 uppercase tracking-widest border border-red-500/30 bg-red-950/20 px-2 py-1 rounded-md whitespace-nowrap">{player.role || 'Member'}</div>
                            </div>
                            <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3 flex-1">{player.notes || 'No bio available yet.'}</p>
                            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
                                <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Rank</span>
                                <span className="text-xs text-white font-bold bg-white/5 border border-white/10 px-2 py-1 rounded-md">{player.rank || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const SectionHeading = ({ kicker, title, copy, align = 'left' }) => (
        <div className={`mb-7 ${align === 'center' ? 'text-center mx-auto max-w-3xl' : 'max-w-4xl'}`} data-aos="fade-up">
            <div className="section-kicker mb-3">{kicker}</div>
            <h3 className="section-title">{title}</h3>
            {copy && <p className="mt-4 text-sm md:text-base text-neutral-400 leading-relaxed">{copy}</p>}
        </div>
    );

    const StatBlock = ({ label, value, sub }) => (
        <div className="border-l border-white/10 pl-4">
            <div className="text-3xl md:text-5xl font-black text-white tracking-tight">{value}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-black">{label}</div>
            {sub && <div className="mt-2 text-xs text-neutral-400">{sub}</div>}
        </div>
    );

    const nextMatch = matches[0];
    const fallbackNews = featuredNews || { title: 'Syrix Operations Online', body: 'Follow the latest roster moves, match prep, and community updates from the team hub.', date: new Date().toISOString().split('T')[0], type: 'Update' };
    const heroVideo = intelData[0];
    const matchPreview = matches.slice(0, 3);
    const featuredProducts = merchData.slice(0, 3);
    const videoIdFromUrl = (url = '') => url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    const useNewLanding = true;

    if (useNewLanding) return (
        <div className="min-h-screen w-full font-sans text-white flex flex-col relative overflow-x-hidden bg-[#050608]">
            <Background />

            <header className="fixed top-0 w-full z-50 bg-[#050608]/90 backdrop-blur-xl border-b border-white/10 flex justify-center">
                <nav className="max-w-[1480px] w-full px-5 md:px-8 py-3 flex justify-between items-center">
                    <a href="#home" className="flex items-center gap-3 text-white hover:text-red-500 transition-colors">
                        <TeamLogo className="h-9 w-9 rounded-sm shadow-lg shadow-red-950/30" />
                        <span className="text-xl font-black uppercase tracking-tight italic">Syrix</span>
                    </a>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl z-50 p-2 focus:outline-none text-white">☰</button>
                    <div className="hidden md:flex items-center space-x-7 text-[11px] font-black uppercase tracking-[0.18em]">
                        <a href="#roster" className="text-white hover:text-red-500 transition duration-300">Roster</a>
                        <a href="#schedule" className="text-white hover:text-red-500 transition duration-300">Matches</a>
                        <a href="#vods" className="text-white hover:text-red-500 transition duration-300">Media</a>
                        <a href="#news" className="text-white hover:text-red-500 transition duration-300">News</a>
                        <a href="#merch" className="text-white hover:text-red-500 transition duration-300">Shop</a>
                        <button onClick={onEnterHub} className="px-5 py-2.5 rounded-sm bg-white hover:bg-red-600 text-black hover:text-white transition duration-300 flex items-center gap-2">
                            <span>TEAM HUB</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>
                </nav>
            </header>

            <div className={`fixed inset-0 bg-black/95 z-40 transform transition-transform duration-300 md:hidden pt-24 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col items-center space-y-8 text-xl font-black uppercase italic tracking-tight">
                    {['roster', 'schedule', 'vods', 'news', 'merch'].map(item => (
                        <a key={item} onClick={() => setMobileMenuOpen(false)} href={`#${item}`} className="text-white hover:text-red-500">{item === 'vods' ? 'Media' : item}</a>
                    ))}
                    <button onClick={() => { setMobileMenuOpen(false); onEnterHub(); }} className="px-8 py-4 rounded-sm bg-red-600 text-white shadow-xl">TEAM HUB</button>
                </div>
            </div>

            <main className="flex-1 relative z-10 flex flex-col items-center w-full">
                <section id="home" className="w-full min-h-[78vh] flex items-center justify-center relative overflow-hidden bg-black pt-24 pb-8">
                    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
                        <iframe className="absolute top-1/2 left-1/2 w-full h-full min-w-[177vh] min-h-[56.25vw] -translate-x-1/2 -translate-y-1/2 scale-[2.15] opacity-35 mix-blend-luminosity" src="https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1&mute=1&controls=0&loop=1&playlist=y9zweO_hU1U&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&origin=http://localhost:3000" title="Hero Background" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                        <div className="absolute inset-0 bg-[linear-gradient(90deg,#050608_0%,rgba(5,6,8,0.84)_38%,rgba(5,6,8,0.35)_100%)]"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-transparent to-[#050608]/90"></div>
                    </div>

                    <div className="relative z-10 max-w-[1480px] w-full mx-auto px-5 md:px-8 grid grid-cols-1 lg:grid-cols-[1.12fr_0.88fr] gap-6 items-center">
                        <div data-aos="fade-up">
                            <div className="inline-flex items-center gap-3 border border-white/15 bg-white/5 backdrop-blur-md px-3 py-1.5 mb-6">
                                <TeamLogo className="h-5 w-5 rounded-sm border-white/20" />
                                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-neutral-300">Official Valorant Team Portal</span>
                            </div>
                            <h1 className="text-[18vw] sm:text-[7.4rem] lg:text-[9rem] font-black leading-[0.78] tracking-tight italic text-white">SYRIX</h1>
                            <p className="text-neutral-300 text-base md:text-lg font-medium mt-5 mb-6 max-w-2xl leading-relaxed">
                                Matchday, roster, media, shop, community, and private team operations in one premium esports experience.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                <button onClick={() => document.getElementById('roster')?.scrollIntoView({ behavior: 'smooth' })} className="group relative px-8 py-4 bg-red-600 text-white font-black uppercase tracking-widest overflow-hidden hover:bg-red-700 transition-all border border-red-500 rounded-sm">
                                    <span className="relative z-10 flex items-center gap-2 justify-center">View Roster <span className="group-hover:translate-x-1 transition-transform">→</span></span>
                                </button>
                                <button onClick={onEnterHub} className="px-8 py-4 bg-white text-black border border-white font-black uppercase tracking-widest hover:bg-neutral-200 transition-all rounded-sm">Team Hub</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:pt-20" data-aos="fade-left">
                            <div className="bg-[#0d1016]/92 border border-white/10 p-5 min-h-52 flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.24em] text-red-400 font-black mb-3">Next Fixture</div>
                                    <div className="text-3xl font-black italic uppercase leading-none">SYRIX <span className="text-red-500">vs</span><br />{nextMatch?.opponent || 'TBD'}</div>
                                    <div className="mt-4 text-xs uppercase tracking-widest text-neutral-500">{nextMatch?.type || 'Match'} • {nextMatch?.map || 'Map TBD'}</div>
                                </div>
                                <div className="mt-6 border-t border-white/10 pt-4 flex items-end justify-between gap-3">
                                    <div>
                                        <div className="text-white font-black uppercase">{formatEventDate(nextMatch?.date)}</div>
                                        <div className="text-xs text-neutral-500 font-mono">{nextMatch?.time || 'Time TBD'} {nextMatch?.timezone || ''}</div>
                                    </div>
                                    <a href="#schedule" className="text-xs font-black uppercase text-red-400 hover:text-white">Schedule</a>
                                </div>
                            </div>
                            <div className="bg-[#151922] text-white border border-white/10 p-5 min-h-52 flex flex-col justify-between">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.24em] text-red-400 font-black mb-3">Featured</div>
                                    <div className="text-2xl font-black uppercase leading-tight">{fallbackNews.title}</div>
                                    <p className="mt-3 text-sm text-neutral-400 line-clamp-3">{fallbackNews.body}</p>
                                </div>
                                <a href="#news" className="text-xs font-black uppercase text-red-400 hover:text-white">Latest News</a>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-0 w-full bg-red-600/10 border-y border-red-600/25 backdrop-blur-sm overflow-hidden py-3">
                        <div className="flex gap-8 animate-marquee whitespace-nowrap">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="flex items-center gap-8">
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500/80">VALORANT</span>
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/80">MATCHDAY READY</span>
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">SYRIX TEAM PORTAL</span>
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-marquee { animation: marquee 20s linear infinite; }`}</style>
                </section>

                <section className="w-full py-7 bg-[#080a0f] border-b border-white/10 flex justify-center relative z-20">
                    <div className="max-w-[1480px] w-full px-5 md:px-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatBlock label="Season WR" value={`${teamStats.winRate}%`} sub="Recorded matches" />
                        <StatBlock label="Current Record" value={`${teamStats.wins}W ${teamStats.losses}L`} sub="Completed events" />
                        <StatBlock label="Active Roster" value={activePlayers.length} sub={`${coachingStaff.length} staff`} />
                        <div className="border-l border-white/10 pl-4 relative min-h-24">
                            <div className="text-[10px] uppercase tracking-[0.22em] text-neutral-500 font-black mb-2">Performance Trend</div>
                            <svg className="w-full h-16 opacity-80" viewBox="0 0 150 50" preserveAspectRatio="none">
                                <path d={`M 0,25 ${generateTrendPath(teamStats.trendPoints)}`} fill="none" stroke={teamStats.trendPoints[teamStats.trendPoints.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="3" />
                                <line x1="0" y1="25" x2="150" y2="25" stroke="#525252" strokeWidth="1" strokeDasharray="4" />
                            </svg>
                        </div>
                    </div>
                </section>

                <section id="schedule" className="w-full py-14 bg-[#050608] text-white relative flex justify-center border-y border-white/10">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
                            <div>
                                <div className="text-[11px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Match Center</div>
                                <h3 className="text-5xl md:text-7xl font-black italic uppercase leading-none">Upcoming Matches</h3>
                            </div>
                            <button onClick={onEnterHub} className="self-start lg:self-auto bg-white text-black px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors">Manage Schedule</button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {matchPreview.length > 0 ? matchPreview.map((match, i) => (
                                <div key={match.id || i} className="bg-[#0d1016] border border-white/10 p-5 min-h-52 flex flex-col justify-between group hover:border-red-500/60 transition-colors" data-aos="fade-up" data-aos-delay={i * 80}>
                                    <div>
                                        <div className="flex items-center justify-between mb-8">
                                            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">{match.type || 'Match'}</span>
                                            <span className="text-xs font-mono text-neutral-600">{String(i + 1).padStart(2, '0')}</span>
                                        </div>
                                        <div className="text-3xl font-black italic uppercase leading-none">SYRIX <span className="text-red-500">vs</span><br />{match.opponent || 'TBD'}</div>
                                        <div className="mt-4 text-xs uppercase tracking-widest text-neutral-500">{match.map || 'Map TBD'}</div>
                                    </div>
                                    <div className="border-t border-white/10 pt-4 flex justify-between items-end">
                                        <div>
                                            <div className="font-black uppercase">{formatEventDate(match.date)}</div>
                                            <div className="text-xs font-mono text-neutral-500">{match.time || 'TBD'} {match.timezone || ''}</div>
                                        </div>
                                        <span className="text-red-400 font-black group-hover:translate-x-1 transition-transform">→</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="lg:col-span-3 bg-[#0d1016] border border-white/10 p-8 text-center text-neutral-500">No upcoming operations scheduled.</div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="roster" className="w-full py-16 relative flex flex-col items-center">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <SectionHeading kicker="The Squad" title="Active Roster" copy="Large portraits, clear role tags, and readable player detail make the roster feel like a real team presentation instead of a database list." />
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
                            {activePlayers.length > 0 ? activePlayers.map((p, i) => (
                                <PlayerCard key={p.id} player={p} delay={i * 50} />
                            )) : (
                                <div className="sm:col-span-2 xl:col-span-4 text-center text-neutral-500 py-12 border border-dashed border-neutral-800">Roster loading.</div>
                            )}
                        </div>
                        {coachingStaff.length > 0 && (
                            <div className="border-t border-white/10 pt-12">
                                <SectionHeading kicker="Tactical Command" title="Coaching Staff" />
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                                    {coachingStaff.map((p, i) => <PlayerCard key={p.id} player={p} delay={i * 50} />)}
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="w-full py-7 border-y border-white/5 bg-[#080a0f] flex justify-center relative overflow-hidden">
                    <div className="max-w-[1480px] w-full px-5 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
                        {achievements.length > 0 ? achievements.map((item, index) => (
                            <div key={item.id} className="group border-l border-white/10 pl-4" data-aos="fade-up" data-aos-delay={index * 100}>
                                <div className="text-xs text-red-400 font-black uppercase tracking-widest mb-2">{item.icon || 'Achievement'}</div>
                                <div className="text-2xl font-black text-white italic tracking-tight uppercase">{item.highlight ? <span className="text-red-600">{item.title}</span> : item.title}</div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{item.subtitle}</div>
                            </div>
                        )) : <div className="col-span-2 md:col-span-4 text-neutral-600 italic text-sm">Achievements loading.</div>}
                    </div>
                </section>

                <section id="vods" className="w-full py-16 relative flex justify-center">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <SectionHeading kicker="Media" title="Highlights, VODs, Intel" copy="Org sites stay sticky by giving visitors something to watch. This puts recent video content beside a larger featured media slot." />
                        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5">
                            <a href={heroVideo?.url || '#news'} target={heroVideo?.url ? "_blank" : "_self"} rel="noopener noreferrer" className="group bg-[#0d1016] border border-white/10 overflow-hidden min-h-[20rem]" data-aos="fade-up">
                                <div className="aspect-video bg-neutral-900 relative">
                                    {heroVideo?.url && <img src={`https://img.youtube.com/vi/${videoIdFromUrl(heroVideo.url)}/maxresdefault.jpg`} alt={heroVideo.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-[1.03] transition-transform duration-500" onError={(e) => { e.target.style.display = 'none' }} />}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent"></div>
                                    <div className="absolute left-6 bottom-6 right-6">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-red-400 font-black mb-3">Featured Video</div>
                                        <h4 className="text-3xl md:text-5xl font-black uppercase italic leading-none">{heroVideo?.title || 'Media Hub Coming Online'}</h4>
                                        <p className="mt-3 text-sm text-neutral-300">{heroVideo?.subtitle || 'Add VODs from the content manager to power this section.'}</p>
                                    </div>
                                </div>
                            </a>
                            <div className="grid grid-cols-1 gap-5">
                                {intelData.slice(0, 3).map((item, i) => (
                                    <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="bg-[#0d1016] border border-white/10 p-4 flex gap-4 items-center group hover:border-red-500/50 transition-colors" data-aos="fade-up" data-aos-delay={i * 80}>
                                        <div className="w-24 aspect-video bg-neutral-900 relative overflow-hidden flex-none">
                                            <img src={`https://img.youtube.com/vi/${videoIdFromUrl(item.url)}/mqdefault.jpg`} alt={item.title} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform" onError={(e) => { e.target.style.display = 'none' }} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] text-red-400 font-black uppercase tracking-widest">Watch</div>
                                            <h4 className="font-black text-white uppercase line-clamp-2">{item.title}</h4>
                                            <p className="text-xs text-neutral-500 line-clamp-1">{item.subtitle}</p>
                                        </div>
                                    </a>
                                ))}
                                {!intelData.length && <div className="bg-[#0d1016] border border-white/10 p-8 text-neutral-500">No recent media posted.</div>}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="news" className="w-full py-16 relative flex justify-center bg-[#080a0f]">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <SectionHeading kicker="Newsroom" title="Latest From Syrix" align="center" />
                        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5">
                            <div className="bg-[#151922] text-white border border-white/10 p-7 md:p-8 min-h-72 flex flex-col justify-between" data-aos="fade-right">
                                <div>
                                    <span className="text-red-400 text-xs font-black uppercase tracking-widest mb-4 block">Featured • {fallbackNews.date}</span>
                                    <h4 className="text-4xl md:text-6xl font-black mb-5 uppercase italic leading-none">{fallbackNews.title}</h4>
                                    <p className="text-neutral-400 mb-6 line-clamp-5 leading-relaxed">{fallbackNews.body}</p>
                                </div>
                                {fallbackNews.url && <a href={fallbackNews.url} target="_blank" rel="noopener noreferrer" className="text-red-400 font-black text-sm hover:text-white transition-colors self-start uppercase tracking-widest">Read Full Report →</a>}
                            </div>
                            <div className="grid grid-cols-1 gap-4" data-aos="fade-left">
                                {otherNews.length ? otherNews.map(item => (
                                    <div key={item.id} className="bg-[#0d1016] border border-white/10 p-5 flex gap-4 items-center group hover:border-red-500/50 transition-all">
                                        <div className="w-16 h-16 bg-red-600 flex-shrink-0 flex items-center justify-center text-xl font-black text-white">{item.title.substring(0, 2).toUpperCase()}</div>
                                        <div className="min-w-0">
                                            <h5 className="font-black text-white group-hover:text-red-400 transition-colors line-clamp-1 uppercase">{item.title}</h5>
                                            <p className="text-xs text-neutral-500 uppercase tracking-wider">{item.type} • {item.date}</p>
                                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{item.body}</p>
                                        </div>
                                    </div>
                                )) : <div className="bg-[#0d1016] border border-white/10 p-8 text-neutral-500">More updates will appear here.</div>}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="merch" className="w-full py-16 relative flex justify-center">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <div className="grid grid-cols-1 lg:grid-cols-[0.75fr_1.25fr] gap-6 items-start">
                            <div className="lg:sticky lg:top-24">
                                <SectionHeading kicker="Official Gear" title="Armory Drop" copy="Commerce is one of the biggest differences between a team page and an org page. This section now feels more like a real product rail." />
                                <a href={featuredProducts[0]?.link || '#community'} target={featuredProducts[0]?.link ? "_blank" : "_self"} rel="noreferrer" className="inline-flex bg-white text-black px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors">Shop Latest</a>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {featuredProducts.length > 0 ? featuredProducts.map((item, i) => (
                                    <div key={item.id} className="bg-[#0d1016] border border-white/10 overflow-hidden group" data-aos="fade-up" data-aos-delay={i * 80}>
                                        <div className="aspect-[4/5] bg-neutral-900 flex items-center justify-center relative overflow-hidden">
                                            {item.image ? <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500" /> : <span className="text-neutral-500 font-black uppercase tracking-widest z-10">{item.name}</span>}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"></div>
                                        </div>
                                        <div className="p-5 flex justify-between items-end gap-4">
                                            <div className="min-w-0">
                                                <h4 className="font-black text-white uppercase truncate">{item.name}</h4>
                                                <p className="text-xs text-red-400 font-black mt-1">{item.price}</p>
                                            </div>
                                            <a href={item.link || '#'} target={item.link ? "_blank" : "_self"} rel="noreferrer" className="bg-white text-black px-3 py-2 font-black text-xs uppercase hover:bg-red-600 hover:text-white transition-colors">Buy</a>
                                        </div>
                                    </div>
                                )) : <div className="md:col-span-3 text-center text-neutral-500 italic py-12 border border-dashed border-neutral-800">New collection dropping soon.</div>}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="partners" className="w-full py-10 relative flex justify-center border-y border-white/5 bg-[#080a0f]">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] items-center gap-6">
                            <p className="text-neutral-500 text-xs font-black uppercase tracking-[0.3em]">Partners</p>
                            <div className="flex flex-wrap gap-8 md:gap-16 opacity-60">
                                {['RougeEnergy', 'Logitech', 'Discord', 'Valorant'].map((p) => <div key={p} className="text-2xl font-black text-white italic tracking-tight">{p}</div>)}
                            </div>
                        </div>
                    </div>
                </section>

                <section id="community" className="w-full py-16 relative flex justify-center">
                    <div className="max-w-[1480px] w-full px-5 md:px-8">
                        <div className="bg-red-600 text-white p-7 md:p-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center" data-aos="zoom-in">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70 mb-4">Community</div>
                                <h3 className="text-5xl md:text-7xl font-black italic uppercase leading-none">Join The Syndicate</h3>
                                <p className="text-red-50/90 mt-5 max-w-2xl text-lg leading-relaxed">Match-day chat, roster updates, community nights, and direct connection with the team.</p>
                            </div>
                            <a href="https://discord.gg/HWbJr8sCse" target="_blank" rel="noopener noreferrer" className="inline-flex justify-center px-8 py-4 bg-white text-black font-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-colors">Join Discord</a>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-black border-t border-white/10 py-12 relative z-10 flex justify-center">
                <div className="max-w-[1480px] w-full px-5 md:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
                        <div>
                            <div className="mb-3 flex items-center gap-3">
                                <TeamLogo className="h-12 w-12 rounded-sm shadow-lg shadow-red-950/30" />
                                <div className="text-4xl font-black text-white italic tracking-tight">SYRIX</div>
                            </div>
                            <div className="text-sm text-neutral-500 max-w-xl">A competitive Valorant organization page with public content and private team operations in one build.</div>
                        </div>
                        <div className="flex flex-wrap gap-5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                            <a href="#roster" className="hover:text-white">Roster</a>
                            <a href="#schedule" className="hover:text-white">Matches</a>
                            <a href="#news" className="hover:text-white">News</a>
                            <button onClick={onEnterHub} className="hover:text-white uppercase">Team Hub</button>
                        </div>
                    </div>
                    <div className="mt-10 pt-6 border-t border-white/10 text-xs text-neutral-700 uppercase tracking-widest">© 2026 Syrix Team Portal. All rights reserved.</div>
                </div>
            </footer>
        </div>
    );

    return (
        <div className="min-h-screen w-full font-sans text-white flex flex-col relative overflow-x-hidden bg-black">
            <Background />

            <header className="fixed top-0 w-full z-50 bg-[#050608]/82 backdrop-blur-xl border-b border-white/10 flex justify-center">
                <nav className="max-w-7xl w-full px-5 md:px-6 py-3.5 flex justify-between items-center">
                    <a href="#home" className="flex items-center space-x-2 text-white hover:text-red-500 transition-colors"><span className="text-3xl font-black text-red-600 italic">/</span><h1 className="text-xl font-black uppercase tracking-tighter italic">Syrix</h1></a>
                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-2xl z-50 p-2 focus:outline-none text-white">☰</button>
                    <div className="hidden md:flex items-center space-x-8 text-xs font-bold uppercase tracking-widest">
                        <a href="#roster" className="text-white hover:text-red-500 transition duration-300">Roster</a>
                        <a href="#schedule" className="text-white hover:text-red-500 transition duration-300">Matches</a>
                        <a href="#vods" className="text-white hover:text-red-500 transition duration-300">VODs</a>
                        <a href="#news" className="text-white hover:text-red-500 transition duration-300">News</a>
                        <a href="#merch" className="text-white hover:text-red-500 transition duration-300">Shop</a>
                        <button onClick={onEnterHub} className="px-6 py-2 rounded-full bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition duration-300 flex items-center gap-2 transform hover:scale-105">
                            <span>TEAM HUB</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                        </button>
                    </div>
                </nav>
            </header>

            {/* Mobile Menu */}
            <div className={`fixed inset-0 bg-black/95 z-40 transform transition-transform duration-300 md:hidden pt-24 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col items-center space-y-8 text-xl font-black uppercase italic tracking-tighter">
                    <a onClick={() => setMobileMenuOpen(false)} href="#roster" className="text-white hover:text-red-500">Roster</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#schedule" className="text-white hover:text-red-500">Matches</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#vods" className="text-white hover:text-red-500">VODs</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#news" className="text-white hover:text-red-500">News</a>
                    <a onClick={() => setMobileMenuOpen(false)} href="#merch" className="text-white hover:text-red-500">Shop</a>
                    <button onClick={() => { setMobileMenuOpen(false); onEnterHub(); }} className="px-8 py-4 rounded-full bg-red-600 text-white shadow-xl">TEAM HUB</button>
                </div>
            </div>

            <main className="flex-1 relative z-10 flex flex-col items-center w-full">
                {/* --- HERO SECTION: YOUTUBE NO-UPLOAD VERSION --- */}
                <section id="home" className="w-full min-h-[92vh] flex flex-col justify-center items-center text-center relative overflow-hidden bg-black">

                    {/* 1. YOUTUBE BACKGROUND LAYER */}
                    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
                        <iframe
                            className="absolute top-1/2 left-1/2 w-full h-full min-w-[177vh] min-h-[56.25vw] -translate-x-1/2 -translate-y-1/2 scale-[2.35] opacity-38 mix-blend-luminosity"
                            src="https://www.youtube.com/embed/y9zweO_hU1U?autoplay=1&mute=1&controls=0&loop=1&playlist=y9zweO_hU1U&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&origin=http://localhost:3000"
                            title="Hero Background"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        ></iframe>

                        {/* Gradient & Texture Overlays to make it look cinematic */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/80"></div>
                    </div>

                    {/* 2. HERO CONTENT */}
                    <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center px-4" data-aos="zoom-out" data-aos-duration="1000">

                        <div className="mb-6 flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">Official Team Portal</span>
                        </div>

                        <h1 className="text-[15vw] md:text-[11rem] font-black leading-[0.85] tracking-tighter italic text-white drop-shadow-2xl">
                            SYRIX
                        </h1>

                        <p className="text-neutral-300 text-base md:text-xl font-medium mt-5 mb-8 max-w-2xl leading-relaxed">
                            Competitive Valorant operations, match prep, roster management, and team strategy in one command center.
                        </p>

                        <div className="grid grid-cols-3 gap-3 w-full max-w-xl mb-8">
                            <div className="glass-panel rounded-lg p-3 border-white/10"><div className="text-2xl font-black text-white">{teamStats.winRate}%</div><div className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Win Rate</div></div>
                            <div className="glass-panel rounded-lg p-3 border-white/10"><div className="text-2xl font-black text-white">{activePlayers.length}</div><div className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Roster</div></div>
                            <div className="glass-panel rounded-lg p-3 border-white/10"><div className="text-2xl font-black text-white">{matches.length}</div><div className="text-[10px] font-bold uppercase text-neutral-500 tracking-widest">Upcoming</div></div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                            <button onClick={() => document.getElementById('roster').scrollIntoView({ behavior: 'smooth' })} className="group relative px-10 py-4 bg-red-600 text-white font-black uppercase tracking-widest overflow-hidden hover:bg-red-700 transition-all border border-red-500 rounded-lg">
                                <span className="relative z-10 flex items-center gap-2">
                                    View Roster <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] skew-x-[-15deg] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                            </button>
                            <button onClick={onEnterHub} className="px-10 py-4 bg-white text-black border border-white font-black uppercase tracking-widest hover:bg-neutral-200 transition-all rounded-lg">
                                Team Hub
                            </button>
                        </div>
                    </div>

                    {/* 3. SCROLLING TICKER */}
                    <div className="absolute bottom-0 w-full bg-red-600/10 border-t border-red-600/30 backdrop-blur-sm overflow-hidden py-3">
                        <div className="flex gap-8 animate-marquee whitespace-nowrap">
                            {[...Array(10)].map((_, i) => (
                                <div key={i} className="flex items-center gap-8">
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500/80">VALORANT PREMIER</span>
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/80">EU ESPORTS ORG</span>
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                    <span className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">EST. 2024</span>
                                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 20s linear infinite; }
    `}</style>
                </section>

                {/* --- NEW TEAM STATS SECTION --- */}
                <section className="w-full py-12 bg-black border-b border-white/10 flex justify-center relative z-20">
                    <div className="max-w-7xl w-full px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-panel p-6 rounded-xl flex items-center justify-between border border-red-900/30" data-aos="fade-up" data-aos-delay="0">
                            <div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">Season Win Rate</div>
                                <div className="text-5xl font-black text-white italic tracking-tighter">{teamStats.winRate}%</div>
                            </div>
                            <div className="h-16 w-16 rounded-full border-4 border-red-600 flex items-center justify-center bg-red-900/20 shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                                <span className="text-2xl">🔥</span>
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-xl flex items-center justify-between border border-white/10" data-aos="fade-up" data-aos-delay="100">
                            <div>
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">Current Record</div>
                                <div className="text-5xl font-black text-white italic tracking-tighter flex gap-3">
                                    <span className="text-green-500">{teamStats.wins}W</span>
                                    <span className="text-neutral-600">-</span>
                                    <span className="text-red-500">{teamStats.losses}L</span>
                                </div>
                            </div>
                        </div>
                        <div className="glass-panel p-6 rounded-xl flex items-center justify-between border border-white/10 relative overflow-hidden" data-aos="fade-up" data-aos-delay="200">
                            <div className="relative z-10">
                                <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest mb-1">Performance Trend</div>
                                <div className="text-sm text-neutral-300 font-mono">Last 10 Matches</div>
                            </div>
                            <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-50">
                                <svg className="w-full h-full" viewBox="0 0 150 50" preserveAspectRatio="none">
                                    <path d={`M 0,25 ${generateTrendPath(teamStats.trendPoints)}`} fill="none" stroke={teamStats.trendPoints[teamStats.trendPoints.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="3" />
                                    <line x1="0" y1="25" x2="150" y2="25" stroke="#555" strokeWidth="1" strokeDasharray="4" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </section>
                {/* ------------------------------- */}

                <section id="about" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div data-aos="fade-right">
                            <h3 className="text-4xl font-black text-white italic tracking-tighter mb-6">OUR <span className="text-red-600">MISSION</span></h3>
                            <p className="text-neutral-400 text-lg leading-relaxed mb-6">
                                Syrix was founded on the principle that uncompromising skill and unified strategy conquer all. We are a disciplined organization dedicated to achieving excellence in every major competitive title.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-3 text-neutral-300"><span className="text-red-600 font-bold">01.</span> Relentless Training & Preparation</li>
                                <li className="flex items-center gap-3 text-neutral-300"><span className="text-red-600 font-bold">02.</span> Fan-First Community Engagement</li>
                                <li className="flex items-center gap-3 text-neutral-300"><span className="text-red-600 font-bold">03.</span> Unrivaled Professionalism</li>
                            </ul>
                        </div>
                        <div className="relative h-96 glass-panel rounded-xl border-white/10 overflow-hidden" data-aos="fade-left">
                            <div className="absolute inset-0 bg-gradient-to-tr from-red-900/20 to-transparent"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-black text-9xl opacity-20 italic tracking-tighter">SYRIX</div>
                        </div>
                    </div>
                </section>

                {/* --- TROPHY CASE SECTION (DYNAMIC) --- */}
                <section className="w-full py-12 border-y border-white/5 bg-neutral-900/30 flex justify-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent"></div>

                    <div className="max-w-7xl w-full px-6 flex flex-wrap justify-center gap-8 md:gap-24 text-center">
                        {achievements.length > 0 ? (
                            achievements.map((item, index) => (
                                <div key={item.id} className="group" data-aos="fade-up" data-aos-delay={index * 100}>
                                    <div className="text-4xl mb-2 group-hover:-translate-y-2 transition-transform duration-300">{item.icon}</div>
                                    <div className="text-2xl font-black text-white italic tracking-tighter uppercase">
                                        {item.highlight ? <span className="text-red-600">{item.title}</span> : item.title}
                                    </div>
                                    <div className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{item.subtitle}</div>
                                </div>
                            ))
                        ) : (
                            // Placeholder if no trophies yet
                            <div className="text-neutral-600 italic text-sm">Achievements loading or empty...</div>
                        )}
                    </div>
                </section>

                <section id="roster" className="w-full py-24 relative flex flex-col items-center">
                    <div className="max-w-7xl w-full px-6">
                        {/* --- ACTIVE ROSTER --- */}
                        <div className="text-center mb-16" data-aos="fade-up">
                            <div className="section-kicker mb-3">The Squad</div>
                            <h3 className="section-title">Active Roster</h3>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8 mb-24">
                            {activePlayers.length > 0 ? activePlayers.map((p, i) => (
                                <PlayerCard key={p.id} player={p} delay={i * 50} />
                            )) : (
                                <div className="w-full text-center text-neutral-500 py-12 border border-dashed border-neutral-800 rounded-xl">Loading Agents...</div>
                            )}
                        </div>

                        {/* --- COACHING STAFF (Only shows if coaches exist) --- */}
                        {coachingStaff.length > 0 && (
                            <>
                                <div className="text-center mb-16 border-t border-white/5 pt-16" data-aos="fade-up">
                                    <h3 className="text-3xl md:text-4xl font-black text-white italic tracking-tighter mb-4"><span className="text-red-600">/</span> COACHING STAFF</h3>
                                    <p className="text-neutral-500 uppercase tracking-widest font-bold text-sm">Tactical Command</p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-8">
                                    {coachingStaff.map((p, i) => (
                                        <PlayerCard key={p.id} player={p} delay={i * 50} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </section>

                <section id="schedule" className="w-full py-24 bg-gradient-to-b from-transparent to-neutral-900/20 border-y border-white/5 relative flex justify-center">
                    <div className="max-w-5xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <div className="section-kicker mb-3">Mission Log</div>
                            <h3 className="section-title">Upcoming Matches</h3>
                        </div>
                        <div className="space-y-4" data-aos="fade-up">
                            {matches.length > 0 ? matches.map((match, i) => (
                                <div key={i} className="glass-panel p-5 rounded-xl grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-5 hover:border-red-600/40 transition-all group">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="h-12 w-12 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-sm font-black text-neutral-500 group-hover:text-white transition-colors">{String(i + 1).padStart(2, '0')}</div>
                                        <div className="min-w-0">
                                            <div className="text-xl md:text-2xl font-black text-white italic tracking-tight flex flex-wrap items-center gap-2">
                                                SYRIX <span className="text-xs text-red-500 not-italic font-black px-2 py-1 rounded bg-red-950/30 border border-red-900/40">VS</span> {match.opponent || 'TBD'}
                                            </div>
                                            <div className="text-xs text-neutral-500 font-mono uppercase tracking-widest mt-1">{match.type || 'Match'} • {match.map || 'TBD'}</div>
                                        </div>
                                    </div>
                                    <div className="md:text-right bg-black/35 px-4 py-3 rounded-lg border border-white/10 min-w-40">
                                        <div className="text-red-400 font-black text-base uppercase">{formatEventDate(match.date)}</div>
                                        <div className="text-white font-mono text-sm">{match.time || 'TBD'} {match.timezone || ''}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 glass-panel rounded-xl">
                                    <p className="text-neutral-500 italic">No upcoming operations scheduled.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="vods" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <div className="section-kicker mb-3">VODs & Highlights</div>
                            <h3 className="section-title">Recent Intel</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {intelData.length > 0 ? intelData.map((item, i) => (
                                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="glass-panel rounded-xl overflow-hidden group cursor-pointer block" data-aos="fade-up" data-aos-delay={i * 100}>
                                    <div className="aspect-video bg-neutral-900 relative">
                                        <img
                                            src={`https://img.youtube.com/vi/${item.url.split('v=')[1]?.split('&')[0] || item.url.split('/').pop()}/maxresdefault.jpg`}
                                            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-500"
                                            onError={(e) => { e.target.style.display = 'none' }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center text-white group-hover:text-red-600 transition-colors z-10">
                                            <svg className="w-16 h-16 drop-shadow-xl" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                    </div>
                                    <div className="p-4 relative z-20 bg-black/50 backdrop-blur-sm">
                                        <h4 className="font-bold text-white uppercase tracking-tight truncate">{item.title}</h4>
                                        <p className="text-xs text-neutral-500 mt-1">{item.subtitle}</p>
                                    </div>
                                </a>
                            )) : (
                                <div className="col-span-3 text-center text-neutral-500 italic">No recent intel declassified.</div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="news" className="w-full py-24 relative flex justify-center bg-black/50">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <div className="section-kicker mb-3">News & Updates</div>
                            <h3 className="section-title">SITREP</h3>
                        </div>

                        {newsData.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Featured Article */}
                                {featuredNews && (
                                    <div className="glass-panel p-8 rounded-xl border border-red-900/30 flex flex-col justify-center" data-aos="fade-right">
                                        <span className="text-red-500 text-xs font-bold uppercase tracking-widest mb-2 block">Featured • {featuredNews.date}</span>
                                        <h4 className="text-3xl font-black text-white mb-4 uppercase leading-none">{featuredNews.title}</h4>
                                        <p className="text-neutral-400 mb-6 line-clamp-4">{featuredNews.body}</p>
                                        {featuredNews.url && <a href={featuredNews.url} target="_blank" rel="noopener noreferrer" className="text-white font-bold text-sm hover:text-red-500 transition-colors self-start">Read Full Report &rarr;</a>}
                                    </div>
                                )}

                                {/* Other News List */}
                                <div className="space-y-4" data-aos="fade-left">
                                    {otherNews.map(item => (
                                        <div key={item.id} className="glass-panel p-6 rounded-xl flex gap-4 items-center group hover:border-red-600/30 transition-all">
                                            <div className="w-16 h-16 bg-neutral-800 rounded-lg flex-shrink-0 flex items-center justify-center text-2xl font-black text-neutral-700">
                                                {/* Initials as icon */}
                                                {item.title.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-white group-hover:text-red-500 transition-colors line-clamp-1">{item.title}</h5>
                                                <p className="text-xs text-neutral-500 uppercase tracking-wider">{item.type} • {item.date}</p>
                                                <p className="text-xs text-neutral-400 mt-1 line-clamp-1">{item.body}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-neutral-500 italic">Communications offline.</div>
                        )}
                    </div>
                </section>

                <section id="merch" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-7xl w-full px-6">
                        <div className="text-center mb-16" data-aos="fade-up">
                            <div className="section-kicker mb-3">Official Gear</div>
                            <h3 className="section-title">Armory</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {merchData.length > 0 ? merchData.map((item, i) => (
                                <div key={item.id} className="glass-panel rounded-xl overflow-hidden group cursor-pointer" data-aos="fade-up" data-aos-delay={i * 100}>
                                    <div className="h-64 bg-neutral-900 flex items-center justify-center group-hover:bg-neutral-800 transition-colors relative overflow-hidden">
                                        {item.image ? <img src={item.image} alt={item.name} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" /> : <span className="text-neutral-500 font-black uppercase tracking-widest z-10">{item.name}</span>}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                                    </div>
                                    <div className="p-6 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-white truncate max-w-[150px]">{item.name}</h4>
                                            <p className="text-xs text-red-500 font-bold">{item.price}</p>
                                        </div>
                                        <a href={item.link || '#'} target={item.link ? "_blank" : "_self"} rel="noreferrer" className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-red-600 hover:text-white transition-colors">
                                            Buy
                                        </a>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-3 text-center text-neutral-500 italic py-12">New collection dropping soon.</div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="partners" className="w-full py-16 relative flex justify-center border-t border-white/5 bg-black">
                    <div className="max-w-7xl w-full px-6">
                        <p className="text-center text-neutral-600 text-xs font-bold uppercase tracking-[0.3em] mb-8">Trusted By</p>
                        <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                            {['RougeEnergy','Logitech'].map((p) => (
                                <div key={p} className="text-2xl font-black text-white italic tracking-tighter">{p}</div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="community" className="w-full py-24 relative flex justify-center">
                    <div className="max-w-4xl w-full px-6">
                        <div className="glass-panel rounded-xl p-12 text-center border border-red-600/30 relative overflow-hidden" data-aos="zoom-in">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent"></div>
                            <div className="relative z-10">
                                <h3 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter mb-6">JOIN THE <span className="text-red-600">SYNDICATE</span></h3>
                                <p className="text-neutral-400 mb-10 max-w-xl mx-auto text-lg">Become part of the Syrix family. Join our official Discord server for match-day chats, community events, and direct interaction with the team.</p>
                                <a href="https://discord.gg/HWbJr8sCse" target="_blank" rel="noopener noreferrer" className="inline-block px-12 py-5 rounded-full bg-white text-black font-black text-xl shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform uppercase tracking-widest">
                                    Join Discord
                                </a>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-black border-t border-white/10 py-12 relative z-10 flex justify-center">
                <div className="max-w-7xl w-full px-6 text-center">
                    <div className="text-3xl font-black text-neutral-800 italic tracking-tighter mb-4">SYRIX</div>
                    <div className="text-xs text-neutral-600 uppercase tracking-widest">© 2025 Syrix Team Portal. All Rights Reserved.</div>
                </div>
            </footer>
        </div>
    );
};

// ==========================================
// SYRIX HUB / DASHBOARD (REACT APP INPUT)
// ==========================================

// 1. These must be OUTSIDE and ABOVE the AdminPanel function
const VictoryStamp = () => <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-green-500 text-green-500 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter -rotate-12 pointer-events-none mix-blend-screen shadow-[0_0_20px_rgba(34,197,94,0.5)] animate-fade-in">VICTORY</div>;
const DefeatStamp = () => <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 border-8 border-red-600 text-red-600 font-black text-5xl md:text-7xl p-4 uppercase tracking-tighter rotate-12 pointer-events-none mix-blend-screen shadow-[0_0_20px_rgba(220,38,38,0.5)] animate-fade-in">DEFEAT</div>;

function AvailabilityHeatmap({ availabilities, members }) {
    const bucketSize = 60; const numBuckets = (24 * 60) / bucketSize;
    const data = useMemo(() => { const d = {}; for (const day of DAYS) { const b = new Array(numBuckets).fill(0); members.forEach(m => { (availabilities[m] || []).filter(s => s.day === day).forEach(s => { const start = Math.floor(timeToMinutes(s.start) / bucketSize); const end = Math.ceil(timeToMinutes(s.end) / bucketSize); for (let i = start; i < end && i < numBuckets; i++) b[i]++; }); }); d[day] = b; } return d; }, [availabilities, members, bucketSize, numBuckets]);
    return (<div className="overflow-x-auto rounded-xl border border-neutral-800 bg-black/50 shadow-inner"><div className="min-w-[600px]"><div className="flex border-b border-neutral-800"><div className="w-24 bg-black/50 sticky left-0 p-2 text-xs font-bold text-red-500 border-r border-neutral-800">DAY</div>{Array.from({ length: 24 }).map((_, i) => <div key={i} className="flex-1 text-[10px] text-center text-neutral-500 py-1 border-l border-neutral-800">{i}</div>)}</div>{DAYS.map(day => <div key={day} className="flex border-b border-neutral-800/50"><div className="w-24 bg-black/50 sticky left-0 p-2 text-xs font-bold text-neutral-400 border-r border-neutral-800">{day.substring(0, 3).toUpperCase()}</div>{data[day]?.map((c, i) => <div key={i} className="flex-1 h-8 border-l border-neutral-800/30 relative group bg-red-600" style={{ opacity: c > 0 ? (c / members.length) * 0.9 + 0.1 : 0 }}>{c > 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white opacity-0 group-hover:opacity-100">{c}</span>}</div>)}</div>)}</div></div>);
}

function ApplicationForm({ currentUser }) {
    // added 'ign' (In-Game Name) to state
    const [form, setForm] = useState({ ign: '', rank: 'Unranked', role: 'Flex', exp: '', why: '' });
    const [status, setStatus] = useState('idle');
    const addToast = useToast();

    // Check if user already applied
    useEffect(() => {
        const checkExisting = async () => {
            if (!currentUser) return;
            const q = query(collection(db, 'applications'), where("uid", "==", currentUser.uid));
            try {
                const snap = await getDocs(q);
                if (!snap.empty) setStatus('already_applied');
            } catch (e) { console.error("Auth check error", e); }
        };
        checkExisting();
    }, [currentUser]);

    const submitApp = async () => {
        // Validation: Ensure IGN is filled
        if (!form.ign || !form.why) return addToast("Please fill out all required fields (IGN and Why)", "error");

        setStatus('saving');

        // Use the manually entered IGN as the 'user' field, fallback to Discord name if needed
        const finalUsername = form.ign || currentUser.displayName || "Unknown_User";

        const appData = {
            ...form,
            user: finalUsername, // This is now safe
            uid: currentUser.uid,
            submittedAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, 'applications'), appData);

            // Discord Webhook
            const content = { embeds: [{ title: `New App: ${finalUsername}`, color: 16776960, fields: [{ name: 'Rank', value: form.rank }, { name: 'Role', value: form.role }] }] };
            fetch(discordWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(content) }).catch(console.error);

            setStatus('success');
            addToast("Application Submitted Successfully");
        } catch (e) {
            console.error(e);
            setStatus('error');
            addToast("Error submitting application", "error");
        }
    };

    if (status === 'success') return <div className="h-full flex flex-col gap-4 items-center justify-center text-white text-2xl font-black">✅ APPLICATION SENT</div>;
    if (status === 'already_applied') return <div className="h-full flex flex-col gap-4 items-center justify-center text-white text-2xl font-black">⏳ APPLICATION PENDING</div>;

    return (
        <div className="bg-neutral-900/90 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 max-w-2xl mx-auto shadow-2xl">
            <h2 className="text-4xl font-black text-white mb-6 italic tracking-tighter">JOIN <span className="text-red-600">SYRIX</span></h2>

            <div className="space-y-4">
                {/* NEW INPUT: Riot ID */}
                <div>
                    <label className="text-xs font-bold text-red-500 uppercase mb-1 block">Riot ID (Game Name)</label>
                    <Input
                        value={form.ign}
                        onChange={e => setForm({ ...form, ign: e.target.value })}
                        placeholder="e.g. Syrix#NA1"
                        className="border-red-500/50" // Highlight this input
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Current Rank</label>
                        <Select value={form.rank} onChange={e => setForm({ ...form, rank: e.target.value })}>
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase mb-1 block">Preferred Role</label>
                        <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </Select>
                    </div>
                </div>

                <Input value={form.exp} onChange={e => setForm({ ...form, exp: e.target.value })} placeholder="Competitive Experience" />

                <textarea
                    className="w-full bg-black/50 border border-neutral-800 rounded-xl p-4 text-white min-h-[100px]"
                    value={form.why}
                    onChange={e => setForm({ ...form, why: e.target.value })}
                    placeholder="Why do you want to join?"
                />

                <ButtonPrimary onClick={submitApp} disabled={status === 'saving'} className="w-full py-4 text-lg">
                    {status === 'saving' ? 'SENDING...' : 'SUBMIT APPLICATION'}
                </ButtonPrimary>
            </div>
        </div>
    );
}
function PerformanceWidget({ events }) {
    const stats = useMemo(() => {
        let wins = 0, losses = 0; let atkWins = 0, atkPlayed = 0, defWins = 0, defPlayed = 0; const mapStats = {};
        const recentMatches = events.filter(e => e.result && e.result.myScore).sort((a, b) => new Date(a.date) - new Date(b.date));

        recentMatches.forEach(m => {
            const my = parseInt(m.result.myScore); const enemy = parseInt(m.result.enemyScore);
            if (my > enemy) wins++; else if (my < enemy) losses++;
            if (!mapStats[m.result.map]) mapStats[m.result.map] = { played: 0, wins: 0 };
            mapStats[m.result.map].played++;
            if (my > enemy) mapStats[m.result.map].wins++;
            if (m.result.atkScore) { atkWins += parseInt(m.result.atkScore); atkPlayed += 12; }
            if (m.result.defScore) { defWins += parseInt(m.result.defScore); defPlayed += 12; }
        });

        const totalGames = wins + losses;
        const overallWinRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const atkWinRate = atkPlayed > 0 ? Math.round((atkWins / atkPlayed) * 100) : 0;
        const defWinRate = defPlayed > 0 ? Math.round((defWins / defPlayed) * 100) : 0;
        let bestMap = 'N/A'; let bestRate = -1;
        Object.keys(mapStats).forEach(m => { const r = mapStats[m].wins / mapStats[m].played; if (r > bestRate) { bestRate = r; bestMap = m; } });

        let cumulative = 0;
        const trendPoints = recentMatches.slice(-10).map((m) => {
            const diff = parseInt(m.result.myScore) - parseInt(m.result.enemyScore);
            cumulative += diff;
            return cumulative;
        });

        return { wins, losses, overallWinRate, bestMap, atkWinRate, defWinRate, trendPoints };
    }, [events]);

    const generatePath = () => {
        if (!stats.trendPoints.length) return "";
        const max = Math.max(...stats.trendPoints.map(Math.abs)) || 10;
        const height = 50; const width = 100;
        const stepX = width / (stats.trendPoints.length - 1 || 1);
        const points = stats.trendPoints.map((pt, i) => {
            const x = i * stepX;
            const y = height / 2 - (pt / max) * (height / 2);
            return `${x},${y}`;
        });
        return points.join(" ");
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card className="!p-4 flex flex-col justify-between relative overflow-hidden">
                <div className="text-[10px] text-neutral-500 font-bold uppercase z-10">Performance Trend</div>
                <div className="text-xs text-white font-bold z-10">Round Diff History</div>
                <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path d={`M 0,25 ${generatePath()}`} fill="none" stroke={stats.trendPoints[stats.trendPoints.length - 1] >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="2" />
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#555" strokeWidth="0.5" strokeDasharray="2" />
                </svg>
            </Card>
            <Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Win Rate</div><div className="text-3xl font-black text-white">{stats.overallWinRate}%</div><div className="w-full h-1 bg-neutral-800 mt-2"><div className="h-full bg-red-600" style={{ width: `${stats.overallWinRate}%` }}></div></div></Card>
            <Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">ATK / DEF</div><div className="flex gap-2 text-xs font-bold text-white"><div>⚔️ {stats.atkWinRate}%</div><div>🛡️ {stats.defWinRate}%</div></div></Card>
            <Card className="!p-4 flex flex-col justify-between"><div className="text-[10px] text-neutral-500 font-bold uppercase">Best Map</div><div className="text-xl font-black text-white truncate">{stats.bestMap}</div></Card>
        </div>
    );
}

function Playbook() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [side, setSide] = useState('Attack');
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const fetchNotes = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'playbooks', `${selectedMap}_${side}`);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    setContent(snap.data().text);
                } else {
                    setContent("");
                }
            } catch (error) {
                console.error("Playbook Error:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNotes();
    }, [selectedMap, side]);

    const handleSave = async () => {
        try {
            await setDoc(doc(db, 'playbooks', `${selectedMap}_${side}`), {
                text: content,
                updatedAt: new Date().toISOString()
            });
            addToast(`${selectedMap} ${side} Protocols Saved!`);
        } catch (e) {
            addToast("Error saving protocols", "error");
        }
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-3xl font-black text-white italic tracking-tighter">
                    <span className="text-red-600">/</span> PROTOCOLS
                </h3>
                <div className="flex bg-black border border-neutral-800 rounded-xl p-1">
                    <button onClick={() => setSide('Attack')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${side === 'Attack' ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}>Attack</button>
                    <button onClick={() => setSide('Defense')} className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${side === 'Defense' ? 'bg-blue-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}>Defense</button>
                </div>
            </div>

            <div className="flex justify-center w-full">
                <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar max-w-full">
                    {MAPS.map(m => (
                        <button key={m} onClick={() => setSelectedMap(m)} className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${selectedMap === m ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600'}`}>
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-neutral-900/80 border border-white/10 rounded-xl p-1 relative overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                <div className={`absolute top-0 left-0 w-full h-1 z-10 ${side === 'Attack' ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                {loading && <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center text-xs font-bold text-white animate-pulse">LOADING PROTOCOLS...</div>}
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="flex-1 w-full h-full bg-transparent p-8 text-sm md:text-base text-neutral-300 font-mono focus:outline-none resize-none custom-scrollbar placeholder-neutral-700 leading-relaxed"
                    placeholder={`Write your ${selectedMap} ${side} protocols here...\n\nExamples:\n- Default setup: Omen smokes tree, Sova darts main.\n- Anti-Eco: Play retake A, hold passive angles.\n- Ult Economy: If we have KJ ult, rush B.`}
                />
                <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end backdrop-blur-sm">
                    <ButtonPrimary onClick={handleSave} className="text-xs py-3 px-8">Save {side} Notes</ButtonPrimary>
                </div>
            </div>
        </div>
    );
}

function TeamComps({ members }) {
    const [comps, setComps] = useState([]);
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [newComp, setNewComp] = useState({ agents: Array(5).fill(''), players: Array(5).fill('') });
    const [activeDropdown, setActiveDropdown] = useState(null);

    const { agentData } = useValorantData();
    const addToast = useToast();

    const getAgentIcon = (agentName) => {
        if (!agentName) return null;
        if (agentData && agentData[agentName]) return agentData[agentName].icon;
        return null;
    };

    useEffect(() => { const unsub = onSnapshot(collection(db, 'comps'), (snap) => { const c = []; snap.forEach(doc => c.push({ id: doc.id, ...doc.data() })); setComps(c); }); return () => unsub(); }, []);
    const saveComp = async () => { if (newComp.agents.some(a => !a)) return addToast('Please select all 5 agents', 'error'); await addDoc(collection(db, 'comps'), { map: selectedMap, ...newComp }); setNewComp({ agents: Array(5).fill(''), players: Array(5).fill('') }); addToast('Composition Saved'); };
    const deleteComp = async (id) => { await deleteDoc(doc(db, 'comps', id)); addToast('Composition Deleted'); };
    const currentMapComps = comps.filter(c => c.map === selectedMap);

    const AgentCard = ({ index }) => {
        const isOpen = activeDropdown === index;
        const selectedAgent = newComp.agents[index];
        const agentImage = getAgentIcon(selectedAgent);

        return (
            <div className="relative group h-64 bg-neutral-900/80 border border-white/10 rounded-xl overflow-hidden transition-all hover:border-red-600 hover:shadow-[0_0_30px_rgba(220,38,38,0.2)] flex flex-col">
                {selectedAgent && agentImage && (<div className="absolute inset-0 z-0"><img src={agentImage} alt={selectedAgent} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity mix-blend-luminosity" style={{ objectPosition: 'center top' }} /><div className="absolute inset-0 bg-gradient-to-b from-transparent via-neutral-900/50 to-neutral-950"></div></div>)}
                <div onClick={() => setActiveDropdown(isOpen ? null : index)} className="flex-1 relative flex flex-col justify-center items-center p-4 z-10 border-b border-white/5 cursor-pointer">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-3 z-20 drop-shadow-md">Role {index + 1}</label>
                    {selectedAgent ? (<div className="flex flex-col items-center animate-fade-in z-20"><div className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter drop-shadow-[0_0_10px_rgba(0,0,0,0.8)]">{selectedAgent}</div><div className="mt-2 h-0.5 w-8 bg-red-600 rounded-full shadow-[0_0_8px_red]"></div></div>) : (<div className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-700 rounded-xl p-4 w-full h-full hover:border-red-500/50 transition-all opacity-60 hover:opacity-100"><span className="text-2xl text-neutral-400 mb-1">+</span><span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Select Agent</span></div>)}
                </div>
                {isOpen && (<div className="absolute inset-0 bg-neutral-950 z-50 flex flex-col animate-fade-in"><div className="flex justify-between items-center p-3 border-b border-white/10 bg-neutral-900"><span className="text-xs font-bold text-white uppercase tracking-widest">Pick Agent</span><button onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }} className="text-neutral-500 hover:text-red-500 text-lg leading-none">×</button></div><div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1 custom-scrollbar">{AGENT_NAMES.map(agent => (<button key={agent} onClick={(e) => { e.stopPropagation(); const a = [...newComp.agents]; a[index] = agent; setNewComp({ ...newComp, agents: a }); setActiveDropdown(null); }} className={`text-[10px] font-bold uppercase py-2 rounded border border-transparent hover:border-red-900 transition-all ${newComp.agents[index] === agent ? 'bg-red-700 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}>{agent}</button>))}</div></div>)}
                <div className="h-16 relative bg-black/80 backdrop-blur flex items-center justify-center z-20 border-t border-white/5"><select value={newComp.players[index]} onChange={e => { const p = [...newComp.players]; p[index] = e.target.value; setNewComp({ ...newComp, players: p }); }} className="appearance-none bg-transparent text-center text-xs font-bold text-neutral-500 uppercase outline-none cursor-pointer w-full h-full hover:text-white transition-all tracking-wider" style={{ textAlignLast: 'center' }}><option value="" className="bg-neutral-900">Assign Player</option>{members.map(m => <option key={m} value={m} className="bg-neutral-900">{m}</option>)}</select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-700 text-[10px]">▼</div></div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 border-b border-white/10 pb-6"><h3 className="text-4xl font-black text-white italic tracking-tighter flex items-center gap-3"><span className="text-red-600 text-5xl">/</span> TACTICAL COMPS</h3></div>
            <div className="flex flex-wrap gap-2">{MAPS.map(m => (<button key={m} onClick={() => setSelectedMap(m)} className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all transform ${selectedMap === m ? 'bg-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] scale-105 border border-red-500' : 'bg-black border border-neutral-800 text-neutral-500 hover:bg-neutral-900 hover:text-white hover:border-white/20'}`}>{m}</button>))}</div>
            <div className="bg-neutral-900/50 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="flex justify-between items-center mb-8 relative z-10"><div className="flex items-center gap-3"><span className="flex h-3 w-3 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span></span><h4 className="text-sm font-bold text-neutral-300 uppercase tracking-widest">Design {selectedMap} Strategy</h4></div><ButtonPrimary onClick={saveComp} className="text-xs py-2">Save Loadout</ButtonPrimary></div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4" onClick={() => setActiveDropdown(null)}>{Array.from({ length: 5 }).map((_, i) => (<div key={i} onClick={e => e.stopPropagation()}><AgentCard index={i} /></div>))}</div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{currentMapComps.map(comp => (<div key={comp.id} className="bg-neutral-900/80 rounded-xl border border-white/5 overflow-hidden relative group hover:border-red-600/40 transition-all shadow-lg"><div className="bg-black/50 px-5 py-3 flex justify-between items-center border-b border-neutral-800 group-hover:bg-red-900/10 transition-colors"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div><div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">ID: {comp.id.substring(0, 6)}</div></div><button onClick={() => deleteComp(comp.id)} className="text-neutral-600 hover:text-white font-bold text-[10px] bg-neutral-800 hover:bg-red-600 px-2 py-1 rounded transition-all">DELETE</button></div><div className="p-5 grid grid-cols-5 gap-2 divide-x divide-neutral-800/50">{comp.agents.map((agent, i) => (<div key={i} className="text-center flex flex-col justify-center items-center gap-1"><div className="text-xs sm:text-sm font-black text-white uppercase tracking-tight drop-shadow-sm">{agent}</div><div className="text-[9px] text-neutral-500 font-mono uppercase tracking-widest truncate w-full">{comp.players[i] || '-'}</div></div>))}</div></div>))}</div>
        </div>
    );
}

function StratBook() {
    const boardRef = useRef(null);
    const { mapImages, agentData } = useValorantData();
    const addToast = useToast();

    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [side, setSide] = useState('Attack');
    const [tool, setTool] = useState('select');
    const [color, setColor] = useState('#ef4444');
    const [strokeWidth, setStrokeWidth] = useState(0.45);
    const [selectedAgent, setSelectedAgent] = useState(AGENT_NAMES[0]);
    const [selectedAbility, setSelectedAbility] = useState(null);
    const [objects, setObjects] = useState([]);
    const [history, setHistory] = useState([[]]);
    const [historyStep, setHistoryStep] = useState(0);
    const [selectedId, setSelectedId] = useState(null);
    const [dragging, setDragging] = useState(null);
    const [draft, setDraft] = useState(null);
    const [stratName, setStratName] = useState('');
    const [loadingSave, setLoadingSave] = useState(false);
    const [paletteDrag, setPaletteDrag] = useState(null);
    const [pendingTextPoint, setPendingTextPoint] = useState(null);
    const [textDraft, setTextDraft] = useState('');

    const tools = [
        { id: 'select', label: 'Select', hint: 'Move and edit placed items' },
        { id: 'smoke', label: 'Smoke', hint: 'Place smoke radius' },
        { id: 'molly', label: 'Molly', hint: 'Place damage utility' },
        { id: 'line', label: 'Line', hint: 'Draw straight path' },
        { id: 'arrow', label: 'Arrow', hint: 'Draw execute or rotation arrow' },
        { id: 'freehand', label: 'Draw', hint: 'Freehand drawing' },
        { id: 'text', label: 'Text', hint: 'Place callout label' },
        { id: 'spike', label: 'Spike', hint: 'Place spike marker' },
        { id: 'ping', label: 'Ping', hint: 'Place attention marker' }
    ];

    const palette = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#2dd4bf', '#3b82f6', '#a855f7', '#f8fafc'];

    const uid = () => {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        } catch {
            // Fall through to timestamp fallback when crypto is unavailable.
        }
        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const TEXT_MIN = 0.2;
    const TEXT_DEFAULT = 0.32;
    const TEXT_MAX = 0.85;

    const getAgentData = (name) => {
        if (!agentData) return null;
        if (agentData[name]) return agentData[name];
        const key = Object.keys(agentData).find(k => norm(k) === norm(name));
        return key ? agentData[key] : null;
    };

    const selectedAgentData = getAgentData(selectedAgent);
    const availableAbilities = useMemo(() => selectedAgentData?.abilities || [], [selectedAgentData]);

    useEffect(() => {
        if (!selectedAbility && availableAbilities.length) setSelectedAbility(availableAbilities[0]);
        if (selectedAbility && availableAbilities.length && !availableAbilities.some(a => a.name === selectedAbility.name)) {
            setSelectedAbility(availableAbilities[0]);
        }
    }, [availableAbilities, selectedAbility]);

    const commitObjects = useCallback((nextObjects) => {
        const clean = nextObjects.map(obj => ({ ...obj }));
        const nextHistory = history.slice(0, historyStep + 1);
        nextHistory.push(clean);
        const cappedHistory = nextHistory.slice(-80);
        setHistory(cappedHistory);
        setHistoryStep(cappedHistory.length - 1);
        setObjects(clean);
    }, [history, historyStep]);

    const undo = useCallback(() => {
        if (historyStep <= 0) return;
        const nextStep = historyStep - 1;
        setHistoryStep(nextStep);
        setObjects(history[nextStep]);
        setSelectedId(null);
    }, [history, historyStep]);

    const redo = useCallback(() => {
        if (historyStep >= history.length - 1) return;
        const nextStep = historyStep + 1;
        setHistoryStep(nextStep);
        setObjects(history[nextStep]);
        setSelectedId(null);
    }, [history, historyStep]);

    const getBoardPoint = (event) => {
        const rect = boardRef.current?.getBoundingClientRect();
        if (!rect) return { x: 50, y: 50 };
        return {
            x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
            y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
        };
    };

    const area = (kind, radius, fill, stroke, extra = {}) => ({ shape: 'circle', kind, radius, fill, stroke, ...extra });
    const beam = (kind, length, width, fill, stroke, extra = {}) => ({ shape: 'beam', kind, length, width, fill, stroke, rotation: 0, ...extra });
    const wall = (kind, length, width, stroke, extra = {}) => ({ shape: 'wall', kind, length, width, stroke, rotation: 0, ...extra });
    const cone = (kind, length, width, fill, stroke, extra = {}) => ({ shape: 'cone', kind, length, width, fill, stroke, rotation: 0, ...extra });
    const marker = (kind, stroke, extra = {}) => ({ shape: 'marker', kind, stroke, size: 1, rotation: 0, ...extra });

    const UTIL = {
        smoke: area('smoke', 2.45, 'rgba(226, 232, 240, 0.16)', '#e2e8f0'),
        smokeLarge: area('smoke', 2.75, 'rgba(226, 232, 240, 0.16)', '#e2e8f0'),
        smokeSmall: area('smoke', 2.05, 'rgba(226, 232, 240, 0.16)', '#e2e8f0'),
        molly: area('molly', 2.05, 'rgba(239, 68, 68, 0.18)', '#ef4444'),
        grenade: area('molly', 1.75, 'rgba(239, 68, 68, 0.18)', '#ef4444'),
        stun: area('stun', 2.15, 'rgba(249, 115, 22, 0.14)', '#f97316'),
        slow: area('slow', 2.75, 'rgba(125, 211, 252, 0.14)', '#7dd3fc'),
        scan: area('scan', 2.35, 'rgba(59, 130, 246, 0.13)', '#3b82f6'),
        trap: area('trap', 1.65, 'rgba(168, 85, 247, 0.16)', '#a855f7'),
        flashCone: cone('flash', 6.5, 4.8, 'rgba(250, 204, 21, 0.18)', '#facc15'),
        blindCone: cone('blind', 7.5, 5.2, 'rgba(168, 85, 247, 0.18)', '#c084fc'),
        paranoia: beam('blind', 17, 3.1, 'rgba(168, 85, 247, 0.23)', '#c084fc'),
        aftershock: beam('molly', 12, 2.4, 'rgba(239, 68, 68, 0.20)', '#ef4444'),
        faultLine: beam('stun', 19, 2.8, 'rgba(249, 115, 22, 0.20)', '#f97316'),
        wall: wall('wall', 20, 1.05, '#2dd4bf'),
        longWall: wall('wall', 28, 1.05, '#22c55e'),
        harborWall: wall('wall', 24, 1.2, '#38bdf8'),
        marker: marker('ability', '#f8fafc'),
        movement: marker('movement', '#38bdf8'),
        deployable: marker('deployable', '#f8fafc'),
        sentry: marker('trap', '#a855f7'),
        ult: marker('ultimate', '#facc15', { size: 1.15 })
    };

    const clonePreset = (preset) => ({ ...preset });
    const abilityKey = (agentName, abilityName) => `${norm(agentName)}:${norm(abilityName)}`;

    const UTILITY_PRESETS = {
        // Astra
        'astra:gravity well': UTIL.stun,
        'astra:nova pulse': UTIL.stun,
        'astra:nebula / dissipate': UTIL.smoke,
        'astra:nebula': UTIL.smoke,
        'astra:cosmic divide': wall('wall', 32, 1.4, '#a855f7'),
        'astra:astral form / cosmic divide': wall('wall', 32, 1.4, '#a855f7'),

        // Breach
        'breach:aftershock': UTIL.aftershock,
        'breach:flashpoint': beam('flash', 9, 2.2, 'rgba(250, 204, 21, 0.18)', '#facc15'),
        'breach:fault line': UTIL.faultLine,
        'breach:rolling thunder': beam('stun', 28, 7, 'rgba(249, 115, 22, 0.14)', '#f97316'),

        // Brimstone
        'brimstone:stim beacon': area('buff', 2.2, 'rgba(34, 197, 94, 0.14)', '#22c55e'),
        'brimstone:incendiary': UTIL.molly,
        'brimstone:sky smoke': UTIL.smoke,
        'brimstone:orbital strike': area('ultimate', 3.2, 'rgba(239, 68, 68, 0.18)', '#ef4444'),

        // Chamber
        'chamber:trademark': UTIL.sentry,
        'chamber:rendezvous': marker('teleport', '#38bdf8'),
        'chamber:headhunter': UTIL.marker,
        'chamber:tour de force': UTIL.ult,

        // Clove
        'clove:ruse': UTIL.smoke,
        'clove:meddle': area('decay', 2.25, 'rgba(168, 85, 247, 0.16)', '#a855f7'),
        'clove:pick-me-up': marker('self', '#22c55e'),
        'clove:not dead yet': UTIL.ult,

        // Cypher
        'cypher:trapwire': wall('trap', 7.5, 0.55, '#38bdf8'),
        'cypher:cyber cage': UTIL.smokeSmall,
        'cypher:spycam': marker('camera', '#38bdf8'),
        'cypher:neural theft': UTIL.ult,

        // Deadlock
        'deadlock:gravnet': area('net', 2.35, 'rgba(56, 189, 248, 0.15)', '#38bdf8'),
        'deadlock:sonic sensor': area('trap', 1.75, 'rgba(56, 189, 248, 0.14)', '#38bdf8'),
        'deadlock:barrier mesh': wall('wall', 8, 1.2, '#7dd3fc'),
        'deadlock:annihilation': beam('ultimate', 18, 1.6, 'rgba(56, 189, 248, 0.16)', '#38bdf8'),

        // Fade
        'fade:prowler': marker('seek', '#a855f7'),
        'fade:seize': area('seize', 2.55, 'rgba(168, 85, 247, 0.15)', '#a855f7'),
        'fade:haunt': UTIL.scan,
        'fade:nightfall': beam('ultimate', 28, 7, 'rgba(168, 85, 247, 0.13)', '#a855f7'),

        // Gekko
        'gekko:wingman': marker('deployable', '#22c55e'),
        'gekko:dizzy': UTIL.flashCone,
        'gekko:mosh pit': area('molly', 2.55, 'rgba(34, 197, 94, 0.16)', '#22c55e'),
        'gekko:thrash': marker('ultimate', '#22c55e', { size: 1.15 }),

        // Harbor
        'harbor:cascade': wall('wall', 12, 1.25, '#38bdf8'),
        'harbor:cove': UTIL.smokeLarge,
        'harbor:high tide': UTIL.harborWall,
        'harbor:reckoning': area('ultimate', 6.2, 'rgba(56, 189, 248, 0.10)', '#38bdf8'),

        // Iso
        'iso:undercut': beam('vulnerable', 12, 2.3, 'rgba(168, 85, 247, 0.18)', '#a855f7'),
        'iso:double tap': marker('self', '#a855f7'),
        'iso:contingency': wall('wall', 8.5, 1.35, '#a855f7'),
        'iso:kill contract': UTIL.ult,

        // Jett
        'jett:cloudburst': area('smoke', 1.65, 'rgba(226, 232, 240, 0.16)', '#e2e8f0'),
        'jett:updraft': UTIL.movement,
        'jett:tailwind': UTIL.movement,
        'jett:blade storm': UTIL.ult,

        // KAY/O
        'kay/o:frag/ment': area('molly', 2.25, 'rgba(239, 68, 68, 0.18)', '#ef4444'),
        'kay/o:flash/drive': UTIL.flashCone,
        'kay/o:zero/point': UTIL.scan,
        'kay/o:null/cmd': area('ultimate', 5.2, 'rgba(59, 130, 246, 0.10)', '#3b82f6'),

        // Killjoy
        'killjoy:nanoswarm': area('molly', 2.15, 'rgba(239, 68, 68, 0.16)', '#ef4444'),
        'killjoy:alarmbot': UTIL.sentry,
        'killjoy:turret': marker('sentry', '#facc15'),
        'killjoy:lockdown': area('ultimate', 7.6, 'rgba(250, 204, 21, 0.10)', '#facc15'),

        // Miks
        'miks:m-pulse': area('stun', 2.35, 'rgba(168, 85, 247, 0.14)', '#a855f7'),
        'miks:waveform': wall('wall', 16, 1.15, '#38bdf8'),
        'miks:harmonize': marker('support', '#22c55e'),
        'miks:bassquake': beam('ultimate', 20, 5, 'rgba(168, 85, 247, 0.13)', '#a855f7'),

        // Neon
        'neon:fast lane': wall('wall', 18, 1.4, '#38bdf8'),
        'neon:relay bolt': UTIL.stun,
        'neon:high gear': UTIL.movement,
        'neon:overdrive': UTIL.ult,

        // Omen
        'omen:shrouded step': marker('teleport', '#a855f7'),
        'omen:paranoia': UTIL.paranoia,
        'omen:dark cover': UTIL.smoke,
        'omen:from the shadows': UTIL.ult,

        // Phoenix
        'phoenix:blaze': wall('wall', 10, 1.2, '#f97316'),
        'phoenix:curveball': UTIL.flashCone,
        'phoenix:hot hands': UTIL.molly,
        'phoenix:run it back': UTIL.ult,

        // Raze
        'raze:boom bot': marker('deployable', '#f97316'),
        'raze:blast pack': UTIL.movement,
        'raze:paint shells': UTIL.grenade,
        'raze:showstopper': UTIL.ult,

        // Reyna
        'reyna:leer': UTIL.blindCone,
        'reyna:devour': marker('self', '#a855f7'),
        'reyna:dismiss': marker('self', '#a855f7'),
        'reyna:empress': UTIL.ult,

        // Sage
        'sage:barrier orb': wall('wall', 6.2, 1.45, '#7dd3fc'),
        'sage:slow orb': UTIL.slow,
        'sage:healing orb': marker('heal', '#22c55e'),
        'sage:resurrection': UTIL.ult,

        // Skye
        'skye:regrowth': marker('heal', '#22c55e'),
        'skye:trailblazer': marker('seek', '#22c55e'),
        'skye:guiding light': UTIL.flashCone,
        'skye:seekers': marker('ultimate', '#22c55e', { size: 1.15 }),

        // Sova
        'sova:shock bolt': area('damage', 1.65, 'rgba(59, 130, 246, 0.12)', '#3b82f6'),
        'sova:recon bolt': UTIL.scan,
        'sova:owl drone': marker('drone', '#3b82f6'),
        'sova:hunter’s fury': beam('ultimate', 32, 1.8, 'rgba(59, 130, 246, 0.16)', '#3b82f6'),
        "sova:hunter's fury": beam('ultimate', 32, 1.8, 'rgba(59, 130, 246, 0.16)', '#3b82f6'),

        // Tejo
        'tejo:guided salvo': area('molly', 2.35, 'rgba(239, 68, 68, 0.18)', '#ef4444'),
        'tejo:special delivery': UTIL.stun,
        'tejo:stealth drone': marker('drone', '#38bdf8'),
        'tejo:armageddon': beam('ultimate', 30, 5.8, 'rgba(239, 68, 68, 0.13)', '#ef4444'),

        // Viper
        'viper:snake bite': UTIL.molly,
        'viper:poison cloud': UTIL.smoke,
        'viper:toxic screen': UTIL.longWall,
        'viper:viper’s pit': area('ultimate', 6.5, 'rgba(34, 197, 94, 0.10)', '#22c55e'),
        "viper:viper's pit": area('ultimate', 6.5, 'rgba(34, 197, 94, 0.10)', '#22c55e'),

        // Vyse
        'vyse:arc rose': UTIL.flashCone,
        'vyse:shear': wall('trap', 5.8, 1, '#facc15'),
        'vyse:razorvine': area('slow', 2.6, 'rgba(250, 204, 21, 0.13)', '#facc15'),
        'vyse:steel garden': area('ultimate', 5.2, 'rgba(250, 204, 21, 0.10)', '#facc15'),

        // Waylay
        'waylay:refract': UTIL.movement,
        'waylay:light speed': UTIL.movement,
        'waylay:lightspeed': UTIL.movement,
        'waylay:saturate': area('debuff', 2.25, 'rgba(250, 204, 21, 0.13)', '#facc15'),
        'waylay:convergent paths': beam('ultimate', 18, 5, 'rgba(250, 204, 21, 0.13)', '#facc15'),

        // Yoru
        'yoru:fakeout': marker('decoy', '#38bdf8'),
        'yoru:blindside': UTIL.flashCone,
        'yoru:gatecrash': marker('teleport', '#38bdf8'),
        'yoru:dimensional drift': UTIL.ult,

        // Veto, fallback names may shift as Riot updates the agent.
        'veto:crosscut': wall('wall', 7, 1, '#a855f7'),
        'veto:chokehold': area('trap', 2.3, 'rgba(168, 85, 247, 0.14)', '#a855f7'),
        'veto:interceptor': marker('sentry', '#a855f7'),
        'veto:evolution': UTIL.ult
    };

    const utilityPresetFor = (agentName, abilityName) => {
        const key = abilityKey(agentName, abilityName);
        const exact = UTILITY_PRESETS[key];
        if (exact) return clonePreset(exact);

        const name = norm(abilityName);
        if (/toxic screen|high tide|cascade|barrier orb|wall|fast lane|blaze/.test(name)) return clonePreset(UTIL.wall);
        if (/smoke|cloud|dark cover|sky smoke|nebula|astral|cove|cage|ruse/.test(name)) return clonePreset(UTIL.smoke);
        if (/molly|snake bite|snakebite|incendiary|hot hands|nanoswarm|paint shells|grenade|mosh/.test(name)) return clonePreset(UTIL.molly);
        if (/recon|dart|haunt|eye|knife|zero\/point|sonic sensor|trapwire|trademark|alarmbot|turret/.test(name)) return clonePreset(UTIL.scan);
        if (/stun|relay bolt|slow orb|seismic|gravnet/.test(name)) return clonePreset(UTIL.stun);
        if (/paranoia/.test(name)) return clonePreset(UTIL.paranoia);
        if (/flash|curveball|blind|leer|guiding light|flashpoint|dizzy|arc rose|blindside/.test(name)) return clonePreset(UTIL.flashCone);
        if (/dash|updraft|dismiss|teleport|gatecrash|satchel|blast pack|tailwind|wingman|prowler|drone|bot/.test(name)) return clonePreset(UTIL.movement);
        return clonePreset(UTIL.marker);
    };

    const circleStyleFor = (kind) => {
        const styles = {
            smoke: { fill: 'rgba(226, 232, 240, 0.16)', stroke: '#e2e8f0', r: 2.65 },
            molly: { fill: 'rgba(239, 68, 68, 0.18)', stroke: '#ef4444', r: 2.05 },
            recon: { fill: 'rgba(59, 130, 246, 0.13)', stroke: '#3b82f6', r: 2.35 },
            stun: { fill: 'rgba(249, 115, 22, 0.14)', stroke: '#f97316', r: 2.2 }
        };
        return styles[kind] || { fill: `${color}30`, stroke: color, r: 2.1 };
    };

    const createPaletteObject = (point, paletteItem) => {
        if (!paletteItem) return null;
        if (paletteItem.type === 'agent') {
            const data = getAgentData(paletteItem.agent);
            return { id: uid(), type: 'agent', name: paletteItem.agent, icon: data?.icon || '', x: point.x, y: point.y, size: 1, rotation: 0, side };
        }
        if (paletteItem.type === 'ability') {
            const preset = utilityPresetFor(paletteItem.agent, paletteItem.ability.name);
            return { id: uid(), type: 'ability', name: paletteItem.ability.name, icon: paletteItem.ability.icon, x: point.x, y: point.y, side, ...preset };
        }
        return null;
    };

    const placePaletteObject = (point, paletteItem) => {
        const item = createPaletteObject(point, paletteItem);
        if (!item) return;
        commitObjects([...objects, item]);
        setSelectedId(item.id);
        setTool('select');
    };

    const handleBoardDrop = (event) => {
        event.preventDefault();
        let dropped = paletteDrag;
        const raw = event.dataTransfer?.getData('application/json');
        if (!dropped && raw) {
            try { dropped = JSON.parse(raw); } catch { dropped = null; }
        }
        if (!dropped) return;
        placePaletteObject(getBoardPoint(event), dropped);
        setPaletteDrag(null);
    };

    const startPaletteDrag = (event, paletteItem) => {
        setPaletteDrag(paletteItem);
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('application/json', JSON.stringify(paletteItem));
    };

    const addObjectAt = (point) => {
        let item = null;
        if (tool === 'smoke' || tool === 'molly') {
            const style = circleStyleFor(tool);
            item = { id: uid(), type: 'area', name: tool === 'smoke' ? 'Smoke' : 'Molly', kind: tool, x: point.x, y: point.y, radius: style.r, fill: style.fill, stroke: style.stroke, side };
        }
        if (tool === 'text') {
            setPendingTextPoint(point);
            setTextDraft('');
            return;
        }
        if (tool === 'spike') item = { id: uid(), type: 'spike', x: point.x, y: point.y, color: '#facc15', size: 1, side };
        if (tool === 'ping') item = { id: uid(), type: 'ping', x: point.x, y: point.y, color, size: 1, side };

        if (!item) return;
        commitObjects([...objects, item]);
        setSelectedId(item.id);
        if (!['agent', 'ability'].includes(tool)) setTool('select');
    };

    const addTextObject = () => {
        if (!pendingTextPoint || !textDraft.trim()) {
            setPendingTextPoint(null);
            setTextDraft('');
            return;
        }
        const item = { id: uid(), type: 'text', text: textDraft.trim(), x: pendingTextPoint.x, y: pendingTextPoint.y, color, size: TEXT_DEFAULT, width: 18, rotation: 0, side };
        commitObjects([...objects, item]);
        setSelectedId(item.id);
        setPendingTextPoint(null);
        setTextDraft('');
        setTool('select');
    };

    const handleBoardPointerDown = (event) => {
        if (event.button !== 0) return;
        const point = getBoardPoint(event);
        if (['smoke', 'molly', 'text', 'spike', 'ping'].includes(tool)) {
            addObjectAt(point);
            return;
        }
        if (tool === 'line' || tool === 'arrow') {
            setDraft({ id: uid(), type: tool, x1: point.x, y1: point.y, x2: point.x, y2: point.y, color, width: strokeWidth, side });
            return;
        }
        if (tool === 'freehand') {
            setDraft({ id: uid(), type: 'freehand', points: [point], color, width: strokeWidth, side });
            return;
        }
        setSelectedId(null);
    };

    const handleBoardPointerMove = (event) => {
        const point = getBoardPoint(event);
        if (dragging) {
            setObjects(prev => prev.map(obj => {
                if (obj.id !== dragging.id) return obj;
                if (dragging.handle === 'start') return { ...obj, x1: point.x, y1: point.y };
                if (dragging.handle === 'end') return { ...obj, x2: point.x, y2: point.y };
                if (dragging.handle === 'rotate') {
                    const angle = Math.atan2(point.y - dragging.original.y, point.x - dragging.original.x) * 180 / Math.PI;
                    return { ...obj, rotation: Math.round(angle) };
                }

                const deltaX = point.x - dragging.startPoint.x;
                const deltaY = point.y - dragging.startPoint.y;
                if (obj.type === 'line' || obj.type === 'arrow') {
                    return {
                        ...obj,
                        x1: clamp(dragging.original.x1 + deltaX, 0, 100),
                        y1: clamp(dragging.original.y1 + deltaY, 0, 100),
                        x2: clamp(dragging.original.x2 + deltaX, 0, 100),
                        y2: clamp(dragging.original.y2 + deltaY, 0, 100)
                    };
                }
                if (obj.type === 'freehand') {
                    return {
                        ...obj,
                        points: dragging.original.points.map(p => ({
                            x: clamp(p.x + deltaX, 0, 100),
                            y: clamp(p.y + deltaY, 0, 100)
                        }))
                    };
                }
                return { ...obj, x: clamp(point.x - dragging.dx, 0, 100), y: clamp(point.y - dragging.dy, 0, 100) };
            }));
            return;
        }
        if (!draft) return;
        if (draft.type === 'line' || draft.type === 'arrow') setDraft(prev => ({ ...prev, x2: point.x, y2: point.y }));
        if (draft.type === 'freehand') {
            setDraft(prev => {
                const last = prev.points[prev.points.length - 1];
                if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.35) return prev;
                return { ...prev, points: [...prev.points, point] };
            });
        }
    };

    const finishBoardAction = () => {
        if (dragging) {
            commitObjects(objects);
            setDragging(null);
            return;
        }
        if (draft) {
            const shouldSave = draft.type === 'freehand' ? draft.points.length > 1 : Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 1;
            if (shouldSave) commitObjects([...objects, draft]);
            setDraft(null);
        }
    };

    const startDragObject = (event, obj, handle = 'body') => {
        if (tool !== 'select') return;
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const point = getBoardPoint(event);
        setSelectedId(obj.id);
        setDragging({
            id: obj.id,
            handle,
            dx: point.x - (obj.x || point.x),
            dy: point.y - (obj.y || point.y),
            startPoint: point,
            original: JSON.parse(JSON.stringify(obj))
        });
    };

    const selectedObject = objects.find(obj => obj.id === selectedId);

    const updateSelected = (patch) => {
        if (!selectedId) return;
        const next = objects.map(obj => obj.id === selectedId ? { ...obj, ...patch } : obj);
        commitObjects(next);
    };

    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        commitObjects(objects.filter(obj => obj.id !== selectedId));
        setSelectedId(null);
    }, [commitObjects, objects, selectedId]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                undo();
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
                event.preventDefault();
                redo();
            }
            if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
                const tag = document.activeElement?.tagName?.toLowerCase();
                if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') deleteSelected();
            }
            if (event.key === 'Escape') {
                setSelectedId(null);
                setDraft(null);
                setDragging(null);
                setTool('select');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [deleteSelected, redo, selectedId, undo]);

    const duplicateSelected = () => {
        if (!selectedObject) return;
        const copy = { ...selectedObject, id: uid(), x: clamp((selectedObject.x || 45) + 3, 0, 100), y: clamp((selectedObject.y || 45) + 3, 0, 100) };
        if (copy.x1 !== undefined) {
            copy.x1 = clamp(copy.x1 + 3, 0, 100);
            copy.x2 = clamp(copy.x2 + 3, 0, 100);
            copy.y1 = clamp(copy.y1 + 3, 0, 100);
            copy.y2 = clamp(copy.y2 + 3, 0, 100);
        }
        commitObjects([...objects, copy]);
        setSelectedId(copy.id);
    };

    const clearBoard = () => {
        if (!objects.length) return;
        if (!window.confirm('Clear this planner board?')) return;
        commitObjects([]);
        setSelectedId(null);
    };

    const saveStrat = async () => {
        if (!objects.length) return addToast('Place something on the board first', 'error');
        setLoadingSave(true);
        try {
            await addDoc(collection(db, 'strats'), {
                name: stratName.trim() || `${selectedMap} ${side} strat`,
                map: selectedMap,
                side,
                objects,
                date: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            setStratName('');
            addToast('Strategy saved');
        } catch (error) {
            console.error('Save strat failed:', error);
            addToast('Unable to save strategy', 'error');
        } finally {
            setLoadingSave(false);
        }
    };

    const exportJson = () => {
        const payload = JSON.stringify({ name: stratName || `${selectedMap}-${side}`, map: selectedMap, side, objects }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedMap}-${side}-strat.json`.toLowerCase().replace(/\s+/g, '-');
        link.click();
        URL.revokeObjectURL(url);
    };

    const renderArrowHead = (obj) => {
        const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1) * 180 / Math.PI;
        return `translate(${obj.x2} ${obj.y2}) rotate(${angle})`;
    };

    const renderObject = (obj) => {
        const isSelected = selectedId === obj.id;
        if (obj.type === 'line' || obj.type === 'arrow') {
            return (
                <g key={obj.id} className="cursor-pointer" onPointerDown={(e) => startDragObject(e, obj, 'body')}>
                    <line x1={`${obj.x1}%`} y1={`${obj.y1}%`} x2={`${obj.x2}%`} y2={`${obj.y2}%`} stroke="transparent" strokeWidth="3%" />
                    <line x1={`${obj.x1}%`} y1={`${obj.y1}%`} x2={`${obj.x2}%`} y2={`${obj.y2}%`} stroke={obj.color} strokeWidth={obj.width || 0.45} strokeLinecap="round" />
                    {obj.type === 'arrow' && <path d="M 0 0 L -1.4 -0.9 L -1.4 0.9 Z" transform={renderArrowHead(obj)} fill={obj.color} />}
                    {isSelected && (
                        <>
                            <circle cx={`${obj.x1}%`} cy={`${obj.y1}%`} r="1.1%" fill="#020617" stroke="#22c55e" strokeWidth="2" onPointerDown={(e) => startDragObject(e, obj, 'start')} />
                            <circle cx={`${obj.x2}%`} cy={`${obj.y2}%`} r="1.1%" fill="#020617" stroke="#22c55e" strokeWidth="2" onPointerDown={(e) => startDragObject(e, obj, 'end')} />
                        </>
                    )}
                </g>
            );
        }

        if (obj.type === 'freehand') {
            const points = obj.points?.map(p => `${p.x},${p.y}`).join(' ') || '';
            return <polyline key={obj.id} points={points} fill="none" stroke={obj.color} strokeWidth={obj.width || 0.45} strokeLinecap="round" strokeLinejoin="round" onPointerDown={(e) => startDragObject(e, obj)} className="cursor-pointer" />;
        }

        if (obj.type === 'text') {
            const textSize = clamp(obj.size || TEXT_DEFAULT, TEXT_MIN, TEXT_MAX);
            const textWidth = clamp(obj.width || 18, 8, 34);
            return (
                <foreignObject key={obj.id} x={`${obj.x}%`} y={`${obj.y}%`} width={`${textWidth}%`} height="30%" className="overflow-visible">
                    <div
                        className={`inline-block w-full rounded bg-black/72 border border-white/20 px-1.5 py-1 text-[4.5px] font-bold leading-snug tracking-normal whitespace-pre-wrap break-words shadow-[0_3px_14px_rgba(0,0,0,0.8)] select-none cursor-grab ${isSelected ? 'outline outline-1 outline-green-400 outline-offset-1' : ''}`}
                        style={{ color: obj.color, transform: `translate(-50%, -50%) rotate(${obj.rotation || 0}deg) scale(${textSize})`, transformOrigin: 'center' }}
                        onPointerDown={(e) => startDragObject(e, obj)}
                    >
                        {obj.text}
                    </div>
                </foreignObject>
            );
        }

        if (obj.type === 'ability' || obj.type === 'area') {
            const shape = obj.shape || 'circle';
            const markerSize = 3.2 * (obj.size || 1);
            if (shape === 'circle') {
                return (
                    <g key={obj.id} className="cursor-grab" onPointerDown={(e) => startDragObject(e, obj)}>
                        <circle cx={`${obj.x}%`} cy={`${obj.y}%`} r={`${obj.radius || 2.2}%`} fill={obj.fill} stroke={obj.stroke} strokeWidth="1.2" />
                        {obj.icon && <image href={obj.icon} x={`${obj.x - 1.05}%`} y={`${obj.y - 1.05}%`} width="2.1%" height="2.1%" opacity="0.95" />}
                        {isSelected && <circle cx={`${obj.x}%`} cy={`${obj.y}%`} r={`${(obj.radius || 2.2) + 0.3}%`} fill="none" stroke="#22c55e" strokeWidth="0.9" />}
                    </g>
                );
            }
            if (shape === 'beam') {
                return (
                    <g key={obj.id} className="cursor-grab" transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`} onPointerDown={(e) => startDragObject(e, obj)}>
                        <rect x="0" y={`${-(obj.width || 3) / 2}`} width={obj.length || 12} height={obj.width || 3} rx={(obj.width || 3) / 2} fill={obj.fill} stroke={obj.stroke} strokeWidth="0.45" />
                        <line x1="0" y1="0" x2={obj.length || 12} y2="0" stroke={obj.stroke} strokeWidth="0.35" strokeDasharray="1.5 1.2" />
                        {obj.icon && <image href={obj.icon} x="-1.4" y="-1.4" width="2.8" height="2.8" />}
                        {isSelected && (
                            <>
                                <rect x="-0.4" y={`${-(obj.width || 3) / 2 - 0.4}`} width={(obj.length || 12) + 0.8} height={(obj.width || 3) + 0.8} rx={(obj.width || 3) / 2} fill="none" stroke="#22c55e" strokeWidth="0.35" />
                                <circle cx={obj.length || 12} cy="0" r="1" fill="#22c55e" stroke="#020617" strokeWidth="0.35" onPointerDown={(e) => startDragObject(e, obj, 'rotate')} />
                            </>
                        )}
                    </g>
                );
            }
            if (shape === 'wall') {
                const length = obj.length || 18;
                return (
                    <g key={obj.id} className="cursor-grab" transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`} onPointerDown={(e) => startDragObject(e, obj)}>
                        <line x1={-length / 2} y1="0" x2={length / 2} y2="0" stroke={obj.stroke} strokeWidth={obj.width || 1.1} strokeLinecap="round" opacity="0.9" />
                        <line x1={-length / 2} y1="0" x2={length / 2} y2="0" stroke="rgba(255,255,255,0.55)" strokeWidth="0.25" strokeLinecap="round" />
                        {obj.icon && <image href={obj.icon} x="-1.25" y="-1.25" width="2.5" height="2.5" />}
                        {isSelected && (
                            <>
                                <rect x={-length / 2} y="-1.4" width={length} height="2.8" fill="none" stroke="#22c55e" strokeWidth="0.35" />
                                <circle cx={length / 2} cy="0" r="1" fill="#22c55e" stroke="#020617" strokeWidth="0.35" onPointerDown={(e) => startDragObject(e, obj, 'rotate')} />
                            </>
                        )}
                    </g>
                );
            }
            if (shape === 'cone') {
                const length = obj.length || 7;
                const width = obj.width || 5;
                return (
                    <g key={obj.id} className="cursor-grab" transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`} onPointerDown={(e) => startDragObject(e, obj)}>
                        <path d={`M 0 0 L ${length} ${-width / 2} L ${length} ${width / 2} Z`} fill={obj.fill} stroke={obj.stroke} strokeWidth="0.35" />
                        {obj.icon && <image href={obj.icon} x="-1.25" y="-1.25" width="2.5" height="2.5" />}
                        {isSelected && (
                            <>
                                <path d={`M -0.4 0 L ${length + 0.4} ${-width / 2 - 0.4} L ${length + 0.4} ${width / 2 + 0.4} Z`} fill="none" stroke="#22c55e" strokeWidth="0.35" />
                                <circle cx={length} cy="0" r="1" fill="#22c55e" stroke="#020617" strokeWidth="0.35" onPointerDown={(e) => startDragObject(e, obj, 'rotate')} />
                            </>
                        )}
                    </g>
                );
            }
            return (
                <g key={obj.id} className="cursor-grab" transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`} onPointerDown={(e) => startDragObject(e, obj)}>
                    <circle cx="0" cy="0" r={markerSize / 2} fill="rgba(0,0,0,0.78)" stroke={obj.stroke || color} strokeWidth="0.45" />
                    {obj.icon && <image href={obj.icon} x={-markerSize / 2 + 0.35} y={-markerSize / 2 + 0.35} width={markerSize - 0.7} height={markerSize - 0.7} />}
                    {isSelected && <circle cx="0" cy="0" r={markerSize / 2 + 0.35} fill="none" stroke="#22c55e" strokeWidth="0.35" />}
                </g>
            );
        }

        return (
            <foreignObject key={obj.id} x={`${obj.x - 2.8}%`} y={`${obj.y - 2.8}%`} width="5.6%" height="5.6%" className="overflow-visible">
                <div
                    className={`relative flex h-full w-full items-center justify-center select-none cursor-grab ${isSelected ? 'outline outline-2 outline-green-400 outline-offset-1' : ''}`}
                    style={{ transform: `rotate(${obj.rotation || 0}deg) scale(${obj.size || 1})`, transformOrigin: 'center' }}
                    onPointerDown={(e) => startDragObject(e, obj)}
                >
                    {obj.type === 'agent' && (obj.icon ? <img src={obj.icon} alt={obj.name} className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] pointer-events-none" /> : <div className="h-full w-full text-white flex items-center justify-center text-[10px] font-black drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">{obj.name?.slice(0, 2)}</div>)}
                    {obj.type === 'spike' && <div className="h-2/3 w-2/3 rotate-45 bg-yellow-400 border border-yellow-100 shadow-[0_0_10px_rgba(250,204,21,0.65)]" />}
                    {obj.type === 'ping' && <div className="h-4/5 w-4/5 rounded-full border-2 bg-transparent animate-pulse" style={{ borderColor: obj.color }} />}
                </div>
            </foreignObject>
        );
    };

    const allObjects = draft ? [...objects, draft] : objects;

    return (
        <div className="h-full min-h-[760px] grid grid-cols-1 xl:grid-cols-[280px_minmax(420px,1fr)_320px] bg-[#070b0f] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <aside className="border-b xl:border-b-0 xl:border-r border-white/10 bg-black/40 overflow-y-auto custom-scrollbar">
                <div className="p-4 border-b border-white/10">
                    <div className="text-2xl font-black text-white italic tracking-tighter"><span className="text-red-600">/</span> STRAT PLANNER</div>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Valo-style tactical board</div>
                </div>

                <div className="p-4 space-y-5">
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Map</label>
                        <Select value={selectedMap} onChange={e => { setSelectedMap(e.target.value); setSelectedId(null); }}>
                            {MAPS.map(map => <option key={map} value={map}>{map}</option>)}
                        </Select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Side</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Attack', 'Defense'].map(value => <button key={value} onClick={() => setSide(value)} className={`h-10 rounded-lg border text-xs font-black uppercase ${side === value ? 'bg-red-700 text-white border-red-500' : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white'}`}>{value}</button>)}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Tools</label>
                        <div className="grid grid-cols-2 gap-2">
                            {tools.map(item => <button key={item.id} title={item.hint} onClick={() => setTool(item.id)} className={`h-10 rounded-lg border text-[11px] font-black uppercase ${tool === item.id ? 'bg-red-700 text-white border-red-500' : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:border-white/20'}`}>{item.label}</button>)}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Color</label>
                        <div className="flex flex-wrap gap-2">
                            {palette.map(value => <button key={value} onClick={() => setColor(value)} className={`w-8 h-8 rounded-full border-2 ${color === value ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: value }} title={value} />)}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Line Width</label>
                        <input type="range" min="0.15" max="1.5" step="0.05" value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} className="w-full accent-red-600" />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <ButtonSecondary onClick={undo} className="text-xs" disabled={historyStep === 0}>Undo</ButtonSecondary>
                        <ButtonSecondary onClick={redo} className="text-xs" disabled={historyStep === history.length - 1}>Redo</ButtonSecondary>
                        <ButtonSecondary onClick={duplicateSelected} className="text-xs" disabled={!selectedObject}>Duplicate</ButtonSecondary>
                        <ButtonSecondary onClick={deleteSelected} className="text-xs" disabled={!selectedObject}>Delete</ButtonSecondary>
                    </div>
                    <ButtonSecondary onClick={clearBoard} className="w-full text-xs">Clear Board</ButtonSecondary>
                </div>
            </aside>

            <section className="relative min-h-[540px] bg-[#0b1116] overflow-hidden flex items-center justify-center p-4 md:p-8">
                <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
                    <div className="px-3 py-2 rounded-lg bg-black/70 border border-white/10 text-xs font-black uppercase text-white pointer-events-auto">{selectedMap} / {side} / {tool}</div>
                    <div className="ml-auto px-3 py-2 rounded-lg bg-black/70 border border-white/10 text-xs font-bold text-neutral-400 pointer-events-auto">{objects.length} items</div>
                </div>

                <div
                    ref={boardRef}
                    className="relative aspect-square w-full max-w-[min(78vh,920px)] rounded-xl overflow-hidden border border-white/10 bg-neutral-950 shadow-2xl touch-none"
                    onPointerDown={handleBoardPointerDown}
                    onPointerMove={handleBoardPointerMove}
                    onPointerUp={finishBoardAction}
                    onPointerLeave={finishBoardAction}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
                    onDrop={handleBoardDrop}
                >
                    {mapImages?.[selectedMap] ? (
                        <img src={mapImages[selectedMap]} alt={`${selectedMap} tactical map`} className="absolute inset-0 w-full h-full object-cover opacity-95 pointer-events-none" draggable={false} />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-black text-5xl italic">{selectedMap}</div>
                    )}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)] pointer-events-none" />
                    <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {allObjects.map(renderObject)}
                    </svg>
                </div>
            </section>

            <aside className="border-t xl:border-t-0 xl:border-l border-white/10 bg-black/40 overflow-y-auto custom-scrollbar">
                <div className="p-4 border-b border-white/10">
                    <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Agent</label>
                    <Select value={selectedAgent} onChange={e => { setSelectedAgent(e.target.value); setSelectedAbility(null); }}>
                        {AGENT_NAMES.map(agent => <option key={agent} value={agent}>{agent}</option>)}
                    </Select>
                    <div className="mt-3 grid grid-cols-4 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {AGENT_NAMES.map(agent => {
                            const data = getAgentData(agent);
                            return (
                                <button
                                    key={agent}
                                    draggable
                                    onDragStart={(event) => startPaletteDrag(event, { type: 'agent', agent })}
                                    onDragEnd={() => setPaletteDrag(null)}
                                    onClick={() => { setSelectedAgent(agent); setSelectedAbility(null); setTool('select'); }}
                                    className={`aspect-square rounded-lg overflow-hidden border bg-neutral-900 flex items-center justify-center cursor-grab active:cursor-grabbing ${selectedAgent === agent ? 'border-red-500' : 'border-white/10 hover:border-white/30'}`}
                                    title={`Drag ${agent} onto the map`}
                                >
                                    {data?.icon ? <img src={data.icon} alt={agent} className="w-full h-full object-cover pointer-events-none" loading="lazy" draggable={false} /> : <span className="text-[10px] font-black text-neutral-500">{agent.slice(0, 2).toUpperCase()}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-b border-white/10">
                    <label className="text-[10px] font-black text-red-500 uppercase mb-2 block">Abilities</label>
                    <div className="grid grid-cols-2 gap-2">
                        {availableAbilities.length ? availableAbilities.map(ability => (
                            <button
                                key={ability.name}
                                draggable
                                onDragStart={(event) => startPaletteDrag(event, { type: 'ability', agent: selectedAgent, ability })}
                                onDragEnd={() => setPaletteDrag(null)}
                                onClick={() => { setSelectedAbility(ability); setTool('select'); }}
                                className={`min-h-16 rounded-xl border p-2 flex items-center gap-2 text-left cursor-grab active:cursor-grabbing ${selectedAbility?.name === ability.name ? 'bg-red-900/30 border-red-500 text-white' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'}`}
                                title={`Drag ${ability.name} onto the map`}
                            >
                                {ability.icon && <img src={ability.icon} alt="" className="w-7 h-7 object-contain pointer-events-none" draggable={false} />}
                                <span className="text-[10px] font-bold uppercase leading-tight pointer-events-none">{ability.name}</span>
                            </button>
                        )) : <div className="col-span-2 text-xs text-neutral-500 italic">Ability data loading...</div>}
                    </div>
                </div>

                {selectedObject && (
                    <div className="p-4 border-b border-white/10 bg-red-950/10">
                        <div className="text-[10px] font-black text-red-500 uppercase mb-3">Inspector</div>
                        <div className="space-y-3">
                            <div className="text-sm font-bold text-white truncate">{selectedObject.name || selectedObject.text || selectedObject.type}</div>
                            {'size' in selectedObject && <div><label className="text-[10px] text-neutral-500 uppercase font-bold">Size</label><input type="range" min={selectedObject.type === 'text' ? TEXT_MIN : 0.5} max={selectedObject.type === 'text' ? TEXT_MAX : 2.5} step="0.05" value={selectedObject.type === 'text' ? clamp(selectedObject.size || TEXT_DEFAULT, TEXT_MIN, TEXT_MAX) : selectedObject.size || 1} onChange={e => updateSelected({ size: Number(e.target.value) })} className="w-full accent-red-600" /></div>}
                            {selectedObject.type === 'text' && <div><label className="text-[10px] text-neutral-500 uppercase font-bold">Text Width</label><input type="range" min="8" max="34" step="1" value={selectedObject.width || 18} onChange={e => updateSelected({ width: Number(e.target.value) })} className="w-full accent-red-600" /></div>}
                            {'rotation' in selectedObject && <div><label className="text-[10px] text-neutral-500 uppercase font-bold">Rotation</label><input type="range" min="0" max="360" value={selectedObject.rotation || 0} onChange={e => updateSelected({ rotation: Number(e.target.value) })} className="w-full accent-red-600" /></div>}
                            {selectedObject.type === 'text' && <textarea value={selectedObject.text} onChange={e => updateSelected({ text: e.target.value })} className="w-full min-h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-xs outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 resize-y" />}
                        </div>
                    </div>
                )}

                <div className="p-4 border-b border-white/10 space-y-3">
                    <label className="text-[10px] font-black text-red-500 uppercase block">Save Strategy</label>
                    <Input value={stratName} onChange={e => setStratName(e.target.value)} placeholder="Strategy name" />
                    <div className="grid grid-cols-2 gap-2">
                        <ButtonPrimary onClick={saveStrat} disabled={loadingSave} className="text-xs py-2">{loadingSave ? 'Saving...' : 'Save'}</ButtonPrimary>
                        <ButtonSecondary onClick={exportJson} className="text-xs">Export</ButtonSecondary>
                    </div>
                </div>
                <div className="p-4 text-xs text-neutral-500 leading-relaxed">
                    Saved strategies now live in the Strat Library tab, where app-made plans and uploaded ValoPlant images are grouped by map and side.
                </div>
            </aside>
            <Modal isOpen={Boolean(pendingTextPoint)} onClose={() => { setPendingTextPoint(null); setTextDraft(''); }} onConfirm={addTextObject} title="Add Text">
                <div className="space-y-3">
                    <textarea
                        autoFocus
                        value={textDraft}
                        onChange={e => setTextDraft(e.target.value)}
                        className="w-full min-h-40 bg-black/50 border border-neutral-800 rounded-xl p-4 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 resize-y"
                        placeholder="Write a callout, note, or paragraph..."
                    />
                    <p className="text-xs text-neutral-500">Line breaks are preserved on the planner.</p>
                </div>
            </Modal>
        </div>
    );
}

function StratPreviewBoard({ strat, mapImage, className = '' }) {
    const objects = Array.isArray(strat?.objects) ? strat.objects : [];
    const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));
    const renderArrowHead = (obj) => {
        const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1) * 180 / Math.PI;
        return `translate(${obj.x2} ${obj.y2}) rotate(${angle})`;
    };

    const renderObject = (obj, index) => {
        const key = obj.id || `${obj.type}-${index}`;
        if (obj.type === 'line' || obj.type === 'arrow') {
            return (
                <g key={key}>
                    <line x1={`${obj.x1}%`} y1={`${obj.y1}%`} x2={`${obj.x2}%`} y2={`${obj.y2}%`} stroke={obj.color || '#ef4444'} strokeWidth={obj.width || 0.45} strokeLinecap="round" />
                    {obj.type === 'arrow' && <path d="M 0 0 L -1.4 -0.9 L -1.4 0.9 Z" transform={renderArrowHead(obj)} fill={obj.color || '#ef4444'} />}
                </g>
            );
        }

        if (obj.type === 'freehand') {
            const points = obj.points?.map(point => `${point.x},${point.y}`).join(' ') || '';
            return <polyline key={key} points={points} fill="none" stroke={obj.color || '#ef4444'} strokeWidth={obj.width || 0.45} strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (obj.type === 'text') {
            const textSize = clampValue(obj.size || 0.32, 0.2, 0.85);
            const textWidth = clampValue(obj.width || 18, 8, 34);
            return (
                <foreignObject key={key} x={`${obj.x}%`} y={`${obj.y}%`} width={`${textWidth}%`} height="30%" className="overflow-visible">
                    <div
                        className="inline-block w-full rounded bg-black/72 border border-white/20 px-1.5 py-1 text-[4.5px] font-bold leading-snug tracking-normal whitespace-pre-wrap break-words shadow-[0_3px_14px_rgba(0,0,0,0.8)]"
                        style={{ color: obj.color || '#f8fafc', transform: `translate(-50%, -50%) rotate(${obj.rotation || 0}deg) scale(${textSize})`, transformOrigin: 'center' }}
                    >
                        {obj.text}
                    </div>
                </foreignObject>
            );
        }

        if (obj.type === 'ability' || obj.type === 'area') {
            const markerSize = 3.2 * (obj.size || 1);
            if ((obj.shape || 'circle') === 'circle') {
                return (
                    <g key={key}>
                        <circle cx={`${obj.x}%`} cy={`${obj.y}%`} r={`${obj.radius || 2.2}%`} fill={obj.fill || 'rgba(226,232,240,0.16)'} stroke={obj.stroke || '#e2e8f0'} strokeWidth="1.2" />
                        {obj.icon && <image href={obj.icon} x={`${obj.x - 1.05}%`} y={`${obj.y - 1.05}%`} width="2.1%" height="2.1%" opacity="0.95" />}
                    </g>
                );
            }
            if (obj.shape === 'beam') {
                return (
                    <g key={key} transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`}>
                        <rect x="0" y={`${-(obj.width || 3) / 2}`} width={obj.length || 12} height={obj.width || 3} rx={(obj.width || 3) / 2} fill={obj.fill || 'rgba(168,85,247,0.2)'} stroke={obj.stroke || '#c084fc'} strokeWidth="0.45" />
                        <line x1="0" y1="0" x2={obj.length || 12} y2="0" stroke={obj.stroke || '#c084fc'} strokeWidth="0.35" strokeDasharray="1.5 1.2" />
                        {obj.icon && <image href={obj.icon} x="-1.4" y="-1.4" width="2.8" height="2.8" />}
                    </g>
                );
            }
            if (obj.shape === 'wall') {
                const length = obj.length || 18;
                return (
                    <g key={key} transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`}>
                        <line x1={-length / 2} y1="0" x2={length / 2} y2="0" stroke={obj.stroke || '#2dd4bf'} strokeWidth={obj.width || 1.1} strokeLinecap="round" opacity="0.9" />
                        <line x1={-length / 2} y1="0" x2={length / 2} y2="0" stroke="rgba(255,255,255,0.55)" strokeWidth="0.25" strokeLinecap="round" />
                        {obj.icon && <image href={obj.icon} x="-1.25" y="-1.25" width="2.5" height="2.5" />}
                    </g>
                );
            }
            if (obj.shape === 'cone') {
                const length = obj.length || 7;
                const width = obj.width || 5;
                return (
                    <g key={key} transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`}>
                        <path d={`M 0 0 L ${length} ${-width / 2} L ${length} ${width / 2} Z`} fill={obj.fill || 'rgba(250,204,21,0.18)'} stroke={obj.stroke || '#facc15'} strokeWidth="0.35" />
                        {obj.icon && <image href={obj.icon} x="-1.25" y="-1.25" width="2.5" height="2.5" />}
                    </g>
                );
            }
            return (
                <g key={key} transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`}>
                    <circle cx="0" cy="0" r={markerSize / 2} fill="rgba(0,0,0,0.78)" stroke={obj.stroke || obj.color || '#f8fafc'} strokeWidth="0.45" />
                    {obj.icon && <image href={obj.icon} x={-markerSize / 2 + 0.35} y={-markerSize / 2 + 0.35} width={markerSize - 0.7} height={markerSize - 0.7} />}
                </g>
            );
        }

        return (
            <foreignObject key={key} x={`${(obj.x || 50) - 2.8}%`} y={`${(obj.y || 50) - 2.8}%`} width="5.6%" height="5.6%" className="overflow-visible">
                <div className="relative flex h-full w-full items-center justify-center" style={{ transform: `rotate(${obj.rotation || 0}deg) scale(${obj.size || 1})`, transformOrigin: 'center' }}>
                    {obj.type === 'agent' && (obj.icon ? <img src={obj.icon} alt={obj.name || 'Agent'} className="h-full w-full object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]" /> : <div className="h-full w-full text-white flex items-center justify-center text-[10px] font-black">{obj.name?.slice(0, 2)}</div>)}
                    {obj.type === 'spike' && <div className="h-2/3 w-2/3 rotate-45 bg-yellow-400 border border-yellow-100 shadow-[0_0_10px_rgba(250,204,21,0.65)]" />}
                    {obj.type === 'ping' && <div className="h-4/5 w-4/5 rounded-full border-2 bg-transparent animate-pulse" style={{ borderColor: obj.color || '#ef4444' }} />}
                </div>
            </foreignObject>
        );
    };

    return (
        <div className={`relative aspect-square overflow-hidden bg-neutral-950 ${className}`}>
            {mapImage ? (
                <img src={mapImage} alt={`${strat?.map || 'Map'} tactical map`} className="absolute inset-0 h-full w-full object-cover opacity-95" draggable={false} />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-black text-5xl italic">{strat?.map || 'Map'}</div>
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,0.35)_100%)]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {objects.map(renderObject)}
            </svg>
        </div>
    );
}

function StratLibrary() {
    const { mapImages } = useValorantData();
    const addToast = useToast();
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const [side, setSide] = useState('Attack');
    const [appStrats, setAppStrats] = useState([]);
    const [externalStrats, setExternalStrats] = useState([]);
    const [fullscreenStrat, setFullscreenStrat] = useState(null);
    const [uploadForm, setUploadForm] = useState({ title: '', notes: '', imageUrl: '' });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'strats'), where('map', '==', selectedMap)),
            (snap) => {
                const rows = [];
                snap.forEach(docSnap => rows.push({ id: docSnap.id, ...docSnap.data() }));
                setAppStrats(rows.sort((a, b) => new Date(b.updatedAt || b.date || 0) - new Date(a.updatedAt || a.date || 0)));
            },
            (error) => {
                console.error('Strat library app plans unavailable:', error);
                setAppStrats([]);
            }
        );
        return () => unsub();
    }, [selectedMap]);

    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'external_strats'), where('map', '==', selectedMap)),
            (snap) => {
                const rows = [];
                snap.forEach(docSnap => rows.push({ id: docSnap.id, ...docSnap.data() }));
                setExternalStrats(rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
            },
            (error) => {
                console.error('Uploaded strat images unavailable:', error);
                setExternalStrats([]);
            }
        );
        return () => unsub();
    }, [selectedMap]);

    const filteredAppStrats = appStrats.filter(strat => (strat.side || 'Attack') === side);
    const filteredExternalStrats = externalStrats.filter(strat => (strat.side || 'Attack') === side);

    useEffect(() => {
        if (!fullscreenStrat) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setFullscreenStrat(null);
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [fullscreenStrat]);

    const handleImageFile = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return addToast('Please choose an image file', 'error');
        if (file.size > 700 * 1024) return addToast('Image is too large. Use an image under 700KB or paste an image URL.', 'error');

        const reader = new FileReader();
        reader.onload = () => setUploadForm(prev => ({ ...prev, imageUrl: String(reader.result || '') }));
        reader.onerror = () => addToast('Unable to read image file', 'error');
        reader.readAsDataURL(file);
    };

    const saveUploadedStrat = async () => {
        if (!uploadForm.title.trim()) return addToast('Strategy title is required', 'error');
        if (!uploadForm.imageUrl.trim()) return addToast('Add an image URL or upload an image file', 'error');

        setUploading(true);
        try {
            await addDoc(collection(db, 'external_strats'), {
                title: uploadForm.title.trim(),
                notes: uploadForm.notes.trim(),
                imageUrl: uploadForm.imageUrl.trim(),
                map: selectedMap,
                side,
                source: 'ValoPlant',
                createdAt: new Date().toISOString()
            });
            setUploadForm({ title: '', notes: '', imageUrl: '' });
            addToast('Uploaded strategy saved');
        } catch (error) {
            console.error('Upload strat save failed:', error);
            addToast('Unable to save uploaded strategy', 'error');
        } finally {
            setUploading(false);
        }
    };

    const deleteUploadedStrat = async (id) => {
        try {
            await deleteDoc(doc(db, 'external_strats', id));
            addToast('Uploaded strategy removed');
        } catch (error) {
            console.error('Upload strat delete failed:', error);
            addToast('Unable to delete uploaded strategy', 'error');
        }
    };

    const deleteAppStrat = async (id) => {
        try {
            await deleteDoc(doc(db, 'strats', id));
            addToast('Strategy deleted');
        } catch (error) {
            console.error('Delete strat failed:', error);
            addToast('Unable to delete strategy', 'error');
        }
    };

    const exportAppStrat = (strat) => {
        const payload = JSON.stringify({
            name: strat.name || strat.title || 'Untitled strategy',
            map: strat.map,
            side: strat.side,
            objects: strat.objects || []
        }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${strat.map}-${strat.side}-${strat.name || 'strat'}`.toLowerCase().replace(/\s+/g, '-');
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-fade-in space-y-6">
            {fullscreenStrat && (
                <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-xl flex flex-col">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/10 bg-neutral-950/80 px-4 md:px-6 py-4">
                        <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black">{fullscreenStrat.map} / {fullscreenStrat.side || side}</div>
                            <h3 className="mt-1 text-xl md:text-2xl font-black uppercase italic text-white truncate">{fullscreenStrat.title || fullscreenStrat.name || 'Untitled strategy'}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {fullscreenStrat.kind === 'external' && String(fullscreenStrat.imageUrl || '').startsWith('http') && (
                                <a href={fullscreenStrat.imageUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white hover:text-black">
                                    Open Source
                                </a>
                            )}
                            <button onClick={() => setFullscreenStrat(null)} className="rounded-lg border border-red-500/50 bg-red-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500">
                                Minimize
                            </button>
                        </div>
                    </div>
                    <div className="min-h-0 flex-1 grid grid-cols-1 xl:grid-cols-[1fr_22rem]">
                        <div className="min-h-0 flex items-center justify-center bg-black p-3 md:p-6">
                            {fullscreenStrat.kind === 'external' ? (
                                <img src={fullscreenStrat.imageUrl} alt={fullscreenStrat.title} className="max-h-full max-w-full object-contain rounded-lg border border-white/10 shadow-2xl" />
                            ) : (
                                <StratPreviewBoard strat={fullscreenStrat} mapImage={mapImages[fullscreenStrat.map]} className="h-full max-h-full w-auto max-w-full rounded-lg border border-white/10 shadow-2xl" />
                            )}
                        </div>
                        <aside className="border-t xl:border-t-0 xl:border-l border-white/10 bg-neutral-950 p-5 overflow-y-auto">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-neutral-500 font-black">Plan Notes</div>
                            {fullscreenStrat.notes ? (
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{fullscreenStrat.notes}</p>
                            ) : (
                                <p className="mt-4 text-sm text-neutral-500">No notes saved for this plan.</p>
                            )}
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Source</div>
                                    <div className="mt-1 text-sm font-black text-white">{fullscreenStrat.kind === 'app' ? 'Stratbook' : fullscreenStrat.source || 'External'}</div>
                                </div>
                                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Saved</div>
                                    <div className="mt-1 text-sm font-black text-white">{fullscreenStrat.createdAt || fullscreenStrat.updatedAt || fullscreenStrat.date ? new Date(fullscreenStrat.createdAt || fullscreenStrat.updatedAt || fullscreenStrat.date).toLocaleDateString() : 'No date'}</div>
                                </div>
                            </div>
                            {fullscreenStrat.kind === 'app' && (
                                <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3">
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Items</div>
                                    <div className="mt-1 text-sm font-black text-white">{fullscreenStrat.objects?.length || 0}</div>
                                </div>
                            )}
                        </aside>
                    </div>
                </div>
            )}
            <Card>
                <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-6">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Strategy Archive</div>
                        <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic leading-none">Strat Library</h2>
                        <p className="mt-3 text-sm text-neutral-400 max-w-3xl">Browse app-made Stratbook plans or store ValoPlant/ValoPlanner image exports by map and side.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[14rem_16rem] gap-3">
                        <Select value={selectedMap} onChange={e => setSelectedMap(e.target.value)}>
                            {MAPS.map(map => <option key={map}>{map}</option>)}
                        </Select>
                        <div className="grid grid-cols-2 gap-2">
                            {['Attack', 'Defense'].map(value => (
                                <button key={value} onClick={() => setSide(value)} className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest ${side === value ? 'bg-red-600 border-red-500 text-white' : 'bg-black/40 border-white/10 text-neutral-500 hover:text-white'}`}>{value}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[0.74fr_1.26fr] gap-6">
                    <div className="space-y-6">
                        <div className="rounded-xl border border-white/10 bg-black/35 overflow-hidden">
                            <div className="aspect-video bg-neutral-950 relative">
                                {mapImages[selectedMap] ? <img src={mapImages[selectedMap]} alt={selectedMap} className="h-full w-full object-contain opacity-75" /> : <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-black uppercase">{selectedMap}</div>}
                                <div className="absolute left-3 top-3 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs font-black uppercase text-white">{selectedMap} / {side}</div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10">
                                <div className="p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">App Strats</div>
                                    <div className="mt-1 text-3xl font-black text-white">{filteredAppStrats.length}</div>
                                </div>
                                <div className="p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Uploads</div>
                                    <div className="mt-1 text-3xl font-black text-white">{filteredExternalStrats.length}</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/35 p-4 space-y-3">
                            <div className="text-[10px] uppercase tracking-[0.24em] text-red-400 font-black">Upload External Image</div>
                            <Input value={uploadForm.title} onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })} placeholder="Strategy title" />
                            <Input value={uploadForm.imageUrl} onChange={e => setUploadForm({ ...uploadForm, imageUrl: e.target.value })} placeholder="Image URL or upload below" />
                            <input type="file" accept="image/*" onChange={handleImageFile} className="block w-full text-xs text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-black file:uppercase file:text-white hover:file:bg-red-600" />
                            <textarea value={uploadForm.notes} onChange={e => setUploadForm({ ...uploadForm, notes: e.target.value })} placeholder="Optional notes, callouts, or source link..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                            <ButtonPrimary onClick={saveUploadedStrat} disabled={uploading} className="w-full text-xs py-3">{uploading ? 'Saving...' : 'Save Upload'}</ButtonPrimary>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-white">Made In Stratbook</h3>
                                <span className="text-[10px] uppercase tracking-widest text-neutral-500">{filteredAppStrats.length} saved</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {filteredAppStrats.length ? filteredAppStrats.map(strat => (
                                    <div key={strat.id} className="rounded-xl border border-white/10 bg-black/45 p-4">
                                        <button onClick={() => setFullscreenStrat({ ...strat, kind: 'app', title: strat.name || strat.title || 'Untitled strategy' })} className="group relative mb-4 block w-full overflow-hidden rounded-lg border border-white/10 bg-neutral-950 text-left">
                                            <StratPreviewBoard strat={strat} mapImage={mapImages[strat.map]} className="opacity-90 transition-opacity group-hover:opacity-100" />
                                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white">View Fullscreen</span>
                                                <span className="rounded-md border border-white/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black">Open</span>
                                            </span>
                                        </button>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="text-lg font-black text-white truncate">{strat.name || strat.title || 'Untitled strategy'}</div>
                                                <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500">{strat.side || 'Attack'} / {strat.objects?.length || 0} items / {strat.updatedAt ? new Date(strat.updatedAt).toLocaleDateString() : 'No date'}</div>
                                            </div>
                                            <button onClick={() => deleteAppStrat(strat.id)} className="text-neutral-600 hover:text-red-500 text-xl leading-none">×</button>
                                        </div>
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <ButtonSecondary onClick={() => setFullscreenStrat({ ...strat, kind: 'app', title: strat.name || strat.title || 'Untitled strategy' })} className="text-[10px] py-2">Fullscreen</ButtonSecondary>
                                            <ButtonSecondary onClick={() => exportAppStrat(strat)} className="text-[10px] py-2">Export JSON</ButtonSecondary>
                                        </div>
                                    </div>
                                )) : <div className="lg:col-span-2 p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No app-made strategies saved for {selectedMap} {side}.</div>}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-white">Uploaded External Plans</h3>
                                <span className="text-[10px] uppercase tracking-widest text-neutral-500">{filteredExternalStrats.length} images</span>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {filteredExternalStrats.length ? filteredExternalStrats.map(strat => (
                                    <div key={strat.id} className="rounded-xl border border-white/10 bg-black/45 overflow-hidden">
                                        <button onClick={() => setFullscreenStrat({ ...strat, kind: 'external' })} className="group relative block aspect-video w-full bg-neutral-950 text-left">
                                            <img src={strat.imageUrl} alt={strat.title} className="h-full w-full object-contain" />
                                            <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white">View Fullscreen</span>
                                                <span className="rounded-md border border-white/15 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-black">Open</span>
                                            </span>
                                        </button>
                                        <div className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-lg font-black text-white truncate">{strat.title}</div>
                                                    <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500">{strat.source || 'External'} / {strat.createdAt ? new Date(strat.createdAt).toLocaleDateString() : 'No date'}</div>
                                                </div>
                                                <button onClick={() => deleteUploadedStrat(strat.id)} className="text-neutral-600 hover:text-red-500 text-xl leading-none">×</button>
                                            </div>
                                            {strat.notes && <p className="mt-3 text-sm text-neutral-400 whitespace-pre-wrap">{strat.notes}</p>}
                                            <div className="mt-3 flex flex-wrap gap-3">
                                                <button onClick={() => setFullscreenStrat({ ...strat, kind: 'external' })} className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white">Fullscreen</button>
                                                {String(strat.imageUrl || '').startsWith('http') && <a href={strat.imageUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white">Open Image</a>}
                                            </div>
                                        </div>
                                    </div>
                                )) : <div className="lg:col-span-2 p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No uploaded external plans for {selectedMap} {side}.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}

function LineupLibrary() {
    const [selectedMap, setSelectedMap] = useState(MAPS[0]);
    const { mapImages, agentData } = useValorantData();
    const [lineups, setLineups] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [viewingLineup, setViewingLineup] = useState(null);
    const [tempCoords, setTempCoords] = useState(null);
    const [newLineup, setNewLineup] = useState({ title: '', url: '', description: '', agent: 'Sova', type: 'Recon' });
    const currentUser = auth.currentUser;
    const addToast = useToast();
    const mapRef = useRef(null);

    useEffect(() => {
        const q = query(collection(db, 'lineups'), where("map", "==", selectedMap));
        const unsub = onSnapshot(q, (snap) => {
            const l = [];
            snap.forEach(doc => l.push({ id: doc.id, ...doc.data() }));
            setLineups(l);
        });
        return () => unsub();
    }, [selectedMap]);

    const handleMapClick = (e) => {
        if (!mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setTempCoords({ x, y });
        setIsAdding(true);
    };

    const saveLineup = async () => {
        if (!newLineup.title || !newLineup.url) {
            addToast("Please enter a Title and URL", "error");
            return;
        }
        if (!tempCoords) {
            addToast("Error: No location selected", "error");
            return;
        }

        try {
            await addDoc(collection(db, 'lineups'), {
                ...newLineup,
                map: selectedMap,
                x: tempCoords.x,
                y: tempCoords.y,
                addedBy: currentUser.displayName || "Unknown",
                userId: currentUser.uid,
                date: new Date().toISOString()
            });
            setIsAdding(false);
            setNewLineup({ title: '', url: '', description: '', agent: 'Sova', type: 'Recon' });
            addToast("Lineup Added to Library");
        } catch (error) {
            console.error("Error saving lineup:", error);
            addToast("Failed to save lineup", "error");
        }
    };

    const deleteLineup = async (id) => {
        await deleteDoc(doc(db, 'lineups', id));
        setViewingLineup(null);
        addToast("Lineup Removed");
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex flex-col space-y-2">
                <h3 className="text-3xl font-black text-white italic tracking-tighter"><span className="text-red-600">/</span> LINEUP LIBRARY</h3>
                <div className="text-xs text-neutral-500">Click on the map to add a new lineup pin.</div>
            </div>

            <div className="w-full bg-black/40 border border-white/5 p-2 rounded-xl overflow-x-auto flex gap-2 custom-scrollbar">
                {MAPS.map(m => (
                    <button
                        key={m}
                        onClick={() => setSelectedMap(m)}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${selectedMap === m ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/50' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 hover:bg-neutral-800'}`}
                    >
                        {m}
                    </button>
                ))}
            </div>

            <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
                <div className="relative aspect-square h-full max-h-[600px] bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl flex-shrink-0 group self-start lg:self-auto">
                    {mapImages[selectedMap] && <img ref={mapRef} onClick={handleMapClick} src={mapImages[selectedMap]} alt="Map" className="w-full h-full object-cover cursor-crosshair opacity-80 group-hover:opacity-100 transition-opacity" />}
                    {lineups.map(l => (
                        <div
                            key={l.id}
                            onClick={(e) => { e.stopPropagation(); setViewingLineup(l); }}
                            className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full border-2 border-white cursor-pointer hover:scale-125 transition-transform z-10 shadow-[0_0_10px_red] flex items-center justify-center"
                            style={{ left: `${l.x}%`, top: `${l.y}%` }}
                        >
                            {agentData[l.agent]?.icon && <img src={agentData[l.agent].icon} className="w-full h-full rounded-full object-cover" />}
                        </div>
                    ))}
                </div>

                <Card className="flex-1 flex flex-col h-full min-h-[400px]">
                    {viewingLineup ? (
                        <div className="space-y-4 h-full flex flex-col">
                            <div className="flex justify-between items-start border-b border-white/10 pb-4">
                                <div>
                                    <h4 className="text-2xl font-black text-white uppercase">{viewingLineup.title}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-900/50 font-bold uppercase">{viewingLineup.agent}</span>
                                        <span className="text-xs text-neutral-500">Added by {viewingLineup.addedBy}</span>
                                    </div>
                                </div>
                                <button onClick={() => deleteLineup(viewingLineup.id)} className="text-neutral-500 hover:text-red-500 transition-colors">DELETE</button>
                            </div>
                            <div className="flex-1 bg-black/50 rounded-xl overflow-hidden border border-neutral-800 relative min-h-[200px]">
                                {viewingLineup.url.includes('youtube') || viewingLineup.url.includes('youtu.be') ? (
                                    <iframe src={viewingLineup.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} className="w-full h-full absolute inset-0" allowFullScreen></iframe>
                                ) : (
                                    <img src={viewingLineup.url} className="w-full h-full object-contain" />
                                )}
                            </div>
                            <p className="text-neutral-300 italic text-sm p-4 bg-black/30 rounded-lg border border-white/5">"{viewingLineup.description}"</p>
                            <ButtonSecondary onClick={() => setViewingLineup(null)} className="w-full">Close Viewer</ButtonSecondary>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-600 space-y-4">
                            <div className="w-16 h-16 border-2 border-dashed border-neutral-700 rounded-full flex items-center justify-center text-2xl">📍</div>
                            <div className="text-sm font-bold uppercase tracking-widest">Select a pin to view details</div>
                        </div>
                    )}
                </Card>
            </div>

            <Modal isOpen={isAdding} onClose={() => setIsAdding(false)} onConfirm={saveLineup} title="Add New Lineup">
                <div className="space-y-4">
                    <Input placeholder="Lineup Title (e.g., God Dart A Main)" value={newLineup.title} onChange={e => setNewLineup({ ...newLineup, title: e.target.value })} />
                    <Input placeholder="Video/Image URL" value={newLineup.url} onChange={e => setNewLineup({ ...newLineup, url: e.target.value })} />
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={newLineup.agent} onChange={e => setNewLineup({ ...newLineup, agent: e.target.value })}>
                            {AGENT_NAMES.map(a => <option key={a}>{a}</option>)}
                        </Select>
                        <Input placeholder="Description / Tips" value={newLineup.description} onChange={e => setNewLineup({ ...newLineup, description: e.target.value })} />
                    </div>
                </div>
            </Modal>
        </div>
    )
}

function MatchHistory({ currentUser, members }) {
    const [history, setHistory] = useState([]);
    const [pending, setPending] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    // State for Editing/Finalizing
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // State for New Manual Logs - UPDATED WITH ANALYTICS FIELDS
    const [newMatch, setNewMatch] = useState({
        opponent: '', date: '', myScore: '', enemyScore: '',
        atkScore: '', defScore: '', map: 'Ascent', vod: '',
        pistols: '', ecos: '', fb: ''
    });

    const addToast = useToast();

    // Load Events
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'events'), (snap) => {
            const evs = [];
            snap.forEach(doc => evs.push({ id: doc.id, ...doc.data() }));
            setHistory(evs.filter(e => e.result).sort((a, b) => new Date(b.date) - new Date(a.date)));
            setPending(evs.filter(e => !e.result).sort((a, b) => new Date(a.date) - new Date(b.date)));
        });
        return () => unsub();
    }, []);

    const handleManualAdd = async () => {
        if (!newMatch.opponent || !newMatch.myScore) return addToast("Opponent & Score required", "error");

        await addDoc(collection(db, 'events'), {
            type: 'Scrim',
            opponent: newMatch.opponent,
            date: newMatch.date || new Date().toISOString().split('T')[0],
            result: { ...newMatch }
        });
        setIsAdding(false);
        setNewMatch({ opponent: '', date: '', myScore: '', enemyScore: '', atkScore: '', defScore: '', map: 'Ascent', vod: '', pistols: '', ecos: '', fb: '' });
        addToast('Match Analysis Logged');
    };

    const openEditor = (match, isFinalizing = false) => {
        setEditingId(match.id);
        setEditForm({
            opponent: match.opponent,
            date: match.date,
            map: match.map || (match.result ? match.result.map : 'Ascent'),
            vod: match.result?.vod || '',
            myScore: match.result?.myScore || '',
            enemyScore: match.result?.enemyScore || '',
            atkScore: match.result?.atkScore || '',
            defScore: match.result?.defScore || '',
            // Load new stats if they exist, otherwise empty
            pistols: match.result?.pistols || '',
            ecos: match.result?.ecos || '',
            fb: match.result?.fb || '',
            isFinalizing: isFinalizing
        });
    };

    const saveEdit = async () => {
        const { opponent, date, ...resultData } = editForm;
        delete resultData.isFinalizing;
        await updateDoc(doc(db, 'events', editingId), {
            opponent,
            date,
            result: resultData
        });
        setEditingId(null);
        addToast('Match Stats Updated');
    };

    const deleteEvent = async (id) => {
        if (window.confirm("Delete this match record?")) {
            await deleteDoc(doc(db, 'events', id));
            addToast("Record Deleted");
        }
    }

    const castVote = async (matchId, player) => {
        await setDoc(doc(db, 'events', matchId), {
            mvpVotes: { [currentUser.uid]: player }
        }, { merge: true });
        addToast(`Voted for ${player}`);
    };

    const getVoteLeader = (votes) => {
        if (!votes) return null;
        const tally = {};
        Object.values(votes).forEach(v => tally[v] = (tally[v] || 0) + 1);
        let max = 0; let leader = null;
        Object.entries(tally).forEach(([p, c]) => { if (c > max) { max = c; leader = p; } });
        return { leader, count: max };
    };

    const getResultColor = (my, enemy) => {
        const m = parseInt(my); const e = parseInt(enemy);
        if (m > e) return 'border-l-4 border-l-green-500';
        if (m < e) return 'border-l-4 border-l-red-600';
        return 'border-l-4 border-l-neutral-500';
    };

    return (
        <Card className="min-h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-white flex items-center gap-3"><span className="text-red-600">MATCH</span> HISTORY</h3>
                <ButtonSecondary onClick={() => setIsAdding(!isAdding)} className="text-xs">
                    {isAdding ? 'Cancel' : '+ Log Analysis'}
                </ButtonSecondary>
            </div>

            {/* --- MANUAL ADD FORM --- */}
            {isAdding && (
                <div className="mb-8 bg-black/50 p-6 rounded-xl border border-white/10 space-y-4 animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
                    <h4 className="text-white font-bold uppercase text-sm">Log Unscheduled Match</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <Input placeholder="Opponent Name" value={newMatch.opponent} onChange={e => setNewMatch({ ...newMatch, opponent: e.target.value })} />
                        <Input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })} className="[color-scheme:dark]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value })}>
                            {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Select>
                        <Input placeholder="VOD Link (Optional)" value={newMatch.vod} onChange={e => setNewMatch({ ...newMatch, vod: e.target.value })} />
                    </div>

                    {/* Scores */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 flex gap-2">
                            <Input placeholder="My Score" value={newMatch.myScore} onChange={e => setNewMatch({ ...newMatch, myScore: e.target.value })} type="number" />
                            <Input placeholder="Enemy Score" value={newMatch.enemyScore} onChange={e => setNewMatch({ ...newMatch, enemyScore: e.target.value })} type="number" />
                        </div>
                        <Input placeholder="Atk Wins" value={newMatch.atkScore} onChange={e => setNewMatch({ ...newMatch, atkScore: e.target.value })} type="number" />
                        <Input placeholder="Def Wins" value={newMatch.defScore} onChange={e => setNewMatch({ ...newMatch, defScore: e.target.value })} type="number" />
                    </div>

                    {/* NEW: ADVANCED ANALYTICS ROW */}
                    <div className="grid grid-cols-3 gap-3 p-3 bg-neutral-900/50 rounded-lg border border-white/5">
                        <div>
                            <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Pistols (0-2)</label>
                            <Input placeholder="#" value={newMatch.pistols} onChange={e => setNewMatch({ ...newMatch, pistols: e.target.value })} type="number" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">Eco Wins</label>
                            <Input placeholder="#" value={newMatch.ecos} onChange={e => setNewMatch({ ...newMatch, ecos: e.target.value })} type="number" />
                        </div>
                        <div>
                            <label className="text-[10px] text-neutral-500 font-bold uppercase block mb-1">First Blood %</label>
                            <Input placeholder="%" value={newMatch.fb} onChange={e => setNewMatch({ ...newMatch, fb: e.target.value })} type="number" />
                        </div>
                    </div>

                    <ButtonPrimary onClick={handleManualAdd} className="w-full py-3 text-xs">Save to History</ButtonPrimary>
                </div>
            )}

            {/* --- PENDING REPORTS SECTION --- */}
            {pending.length > 0 && (
                <div className="mb-8">
                    <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Pending Reports
                    </h4>
                    <div className="grid grid-cols-1 gap-3">
                        {pending.map(p => (
                            <div key={p.id} className="bg-neutral-900/50 border border-yellow-500/20 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                                <div>
                                    <div className="font-bold text-white text-lg">{p.opponent}</div>
                                    <div className="text-xs text-neutral-400">{p.date} • {p.time} • <span className="text-red-400">{p.map}</span></div>
                                </div>
                                {editingId === p.id ? (
                                    <div className="flex-1 w-full bg-black p-4 rounded-lg border border-neutral-700 animate-fade-in">
                                        <div className="text-xs text-yellow-500 font-bold mb-2 uppercase">Input Stats</div>
                                        <div className="grid grid-cols-4 gap-2 mb-2">
                                            <Input placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} type="number" />
                                            <Input placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} type="number" />
                                            <Input placeholder="Atk" value={editForm.atkScore} onChange={e => setEditForm({ ...editForm, atkScore: e.target.value })} type="number" />
                                            <Input placeholder="Def" value={editForm.defScore} onChange={e => setEditForm({ ...editForm, defScore: e.target.value })} type="number" />
                                        </div>
                                        {/* NEW: ANALYTICS FOR PENDING */}
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <Input placeholder="Pistols" value={editForm.pistols} onChange={e => setEditForm({ ...editForm, pistols: e.target.value })} type="number" />
                                            <Input placeholder="Ecos" value={editForm.ecos} onChange={e => setEditForm({ ...editForm, ecos: e.target.value })} type="number" />
                                            <Input placeholder="FB %" value={editForm.fb} onChange={e => setEditForm({ ...editForm, fb: e.target.value })} type="number" />
                                        </div>
                                        <div className="flex gap-2">
                                            <ButtonPrimary onClick={saveEdit} className="text-xs py-2 flex-1">Confirm</ButtonPrimary>
                                            <ButtonSecondary onClick={() => setEditingId(null)} className="text-xs py-2">Cancel</ButtonSecondary>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => openEditor(p, true)} className="bg-yellow-600/20 hover:bg-yellow-600 text-yellow-500 hover:text-white border border-yellow-600/50 px-6 py-2 rounded-lg font-bold text-xs uppercase transition-all shadow-lg">
                                        ✅ Report Score
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MATCH HISTORY LIST --- */}
            <h4 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Completed Operations</h4>
            <div className="space-y-4">
                {history.length === 0 && <div className="text-neutral-600 italic text-center py-8">No match history recorded.</div>}

                {history.map(m => {
                    // --- EDIT MODE FOR EXISTING HISTORY ---
                    if (editingId === m.id) return (
                        <div key={m.id} className="bg-neutral-900 border border-red-600 p-4 rounded-xl space-y-3 animate-fade-in">
                            <div className="flex justify-between items-center border-b border-red-900/30 pb-2">
                                <span className="text-red-500 font-bold text-xs uppercase">Editing Record</span>
                                <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-white text-xs">Cancel</button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input value={editForm.opponent} onChange={e => setEditForm({ ...editForm, opponent: e.target.value })} />
                                <Input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="[color-scheme:dark]" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={editForm.map} onChange={e => setEditForm({ ...editForm, map: e.target.value })}>
                                    {MAPS.map(map => <option key={map} value={map}>{map}</option>)}
                                </Select>
                                <Input placeholder="VOD Link" value={editForm.vod} onChange={e => setEditForm({ ...editForm, vod: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-2 flex gap-2">
                                    <Input placeholder="Us" value={editForm.myScore} onChange={e => setEditForm({ ...editForm, myScore: e.target.value })} />
                                    <Input placeholder="Them" value={editForm.enemyScore} onChange={e => setEditForm({ ...editForm, enemyScore: e.target.value })} />
                                </div>
                                <Input placeholder="Atk" value={editForm.atkScore} onChange={e => setEditForm({ ...editForm, atkScore: e.target.value })} />
                                <Input placeholder="Def" value={editForm.defScore} onChange={e => setEditForm({ ...editForm, defScore: e.target.value })} />
                            </div>
                            {/* NEW: ANALYTICS EDITING */}
                            <div className="grid grid-cols-3 gap-2">
                                <Input placeholder="Pistols" value={editForm.pistols} onChange={e => setEditForm({ ...editForm, pistols: e.target.value })} />
                                <Input placeholder="Ecos" value={editForm.ecos} onChange={e => setEditForm({ ...editForm, ecos: e.target.value })} />
                                <Input placeholder="FB %" value={editForm.fb} onChange={e => setEditForm({ ...editForm, fb: e.target.value })} />
                            </div>
                            <ButtonPrimary onClick={saveEdit} className="w-full py-2 text-xs">Update Record</ButtonPrimary>
                        </div>
                    );

                    // --- VIEW MODE ---
                    const voteData = getVoteLeader(m.mvpVotes);
                    const isWin = parseInt(m.result.myScore) > parseInt(m.result.enemyScore);

                    return (
                        <div key={m.id} onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className={`bg-black/40 border border-neutral-800 p-4 rounded-xl relative overflow-hidden cursor-pointer hover:bg-neutral-900 transition-all ${getResultColor(m.result.myScore, m.result.enemyScore)}`}>
                            {expandedId === m.id && (isWin ? <VictoryStamp /> : <DefeatStamp />)}
                            <div className="flex justify-between items-center relative z-10">
                                <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                        {m.opponent}
                                        {m.result.vod && (
                                            <a href={m.result.vod} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-500 font-black uppercase flex items-center gap-1"><span>▶</span> VOD</a>
                                        )}
                                    </div>
                                    <div className="text-xs text-neutral-500 font-mono mt-0.5">{m.date} • {m.result.map}</div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={`text-2xl font-black ${isWin ? 'text-green-500' : 'text-red-500'}`}>{m.result.myScore} - {m.result.enemyScore}</div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); openEditor(m); }} className="text-neutral-600 hover:text-white p-1" title="Edit">✏️</button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteEvent(m.id); }} className="text-neutral-600 hover:text-red-500 p-1" title="Delete">🗑️</button>
                                    </div>
                                </div>
                            </div>

                            {/* Details Drawer */}
                            {expandedId === m.id && (
                                <div className="mt-4 pt-4 border-t border-neutral-800 animate-slide-in">
                                    {/* SCORES ROW */}
                                    <div className="grid grid-cols-2 gap-4 text-center mb-4">
                                        <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold">Attack Wins</div>
                                            <div className="text-white font-bold text-lg">{m.result.atkScore || '-'}</div>
                                        </div>
                                        <div className="bg-neutral-900 p-2 rounded border border-neutral-800">
                                            <div className="text-[10px] text-neutral-500 uppercase font-bold">Defense Wins</div>
                                            <div className="text-white font-bold text-lg">{m.result.defScore || '-'}</div>
                                        </div>
                                    </div>

                                    {/* NEW: ANALYTICS ROW */}
                                    <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                        <div className="bg-neutral-900/50 p-2 rounded border border-white/5">
                                            <div className="text-[9px] text-neutral-400 uppercase font-bold">Pistols Won</div>
                                            <div className={`text-sm font-black ${m.result.pistols >= 1 ? 'text-green-500' : 'text-neutral-500'}`}>{m.result.pistols || '0'}/2</div>
                                        </div>
                                        <div className="bg-neutral-900/50 p-2 rounded border border-white/5">
                                            <div className="text-[9px] text-neutral-400 uppercase font-bold">Eco Wins</div>
                                            <div className="text-sm font-black text-white">{m.result.ecos || '0'}</div>
                                        </div>
                                        <div className="bg-neutral-900/50 p-2 rounded border border-white/5">
                                            <div className="text-[9px] text-neutral-400 uppercase font-bold">FB %</div>
                                            <div className="text-sm font-black text-white">{m.result.fb || '0'}%</div>
                                        </div>
                                    </div>

                                    <div className="bg-neutral-900/50 p-3 rounded-lg border border-white/5 flex flex-wrap gap-4 items-center justify-between" onClick={e => e.stopPropagation()}>
                                        <div className="text-xs font-bold text-neutral-400 flex items-center gap-2">
                                            <span>⭐ MVP VOTE:</span>
                                            {voteData ? <span className="text-yellow-500 text-sm">{voteData.leader} ({voteData.count})</span> : <span className="text-neutral-600">No votes</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {m.mvpVotes?.[currentUser.uid] ? (
                                                <span className="text-[10px] bg-green-900/30 text-green-500 px-2 py-1 rounded border border-green-900/50">Voted for {m.mvpVotes[currentUser.uid]}</span>
                                            ) : (
                                                <select onChange={(e) => castVote(m.id, e.target.value)} className="bg-black text-white text-xs p-1.5 rounded border border-neutral-700 outline-none focus:border-red-500 cursor-pointer" defaultValue="">
                                                    <option value="" disabled>Select MVP...</option>
                                                    {members.map(mem => <option key={mem} value={mem}>{mem}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

function ActionItems({ members }) {
    const [tasks, setTasks] = useState([]);
    const [form, setForm] = useState({ title: '', owner: '', priority: 'Normal', due: '', type: 'Practice', notes: '' });
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'tasks'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setTasks(rows.sort((a, b) => {
                if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
                return new Date(a.due || '2999-12-31') - new Date(b.due || '2999-12-31');
            }));
        });
        return () => unsub();
    }, []);

    const openTasks = tasks.filter(task => !task.done);
    const doneTasks = tasks.filter(task => task.done);
    const dueSoon = openTasks.filter(task => task.due && new Date(task.due).getTime() <= Date.now() + 1000 * 60 * 60 * 24 * 3).length;

    const createTask = async () => {
        if (!form.title.trim()) return addToast('Task title is required', 'error');
        setSaving(true);
        try {
            await addDoc(collection(db, 'tasks'), {
                ...form,
                title: form.title.trim(),
                notes: form.notes.trim(),
                done: false,
                createdAt: new Date().toISOString()
            });
            setForm({ title: '', owner: '', priority: 'Normal', due: '', type: 'Practice', notes: '' });
            addToast('Task added');
        } catch (error) {
            console.error('Task create failed:', error);
            addToast('Unable to add task', 'error');
        } finally {
            setSaving(false);
        }
    };

    const toggleTask = async (task) => {
        try {
            await updateDoc(doc(db, 'tasks', task.id), {
                done: !task.done,
                completedAt: !task.done ? new Date().toISOString() : ''
            });
        } catch (error) {
            console.error('Task update failed:', error);
            addToast('Unable to update task', 'error');
        }
    };

    const removeTask = async (id) => {
        await deleteDoc(doc(db, 'tasks', id));
        addToast('Task removed');
    };

    const priorityClass = (priority) => {
        if (priority === 'High') return 'text-red-300 border-red-900/50 bg-red-950/30';
        if (priority === 'Low') return 'text-neutral-400 border-white/10 bg-white/5';
        return 'text-yellow-300 border-yellow-900/40 bg-yellow-950/20';
    };

    return (
        <div className="animate-fade-in space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <Card className="border-red-900/20">
                    <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Command Queue</div>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic leading-none">Action Items</h2>
                            <p className="mt-3 text-sm text-neutral-400 max-w-2xl">Assign practice prep, matchday jobs, review follow-ups, and admin tasks so the next session has a clear owner.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 min-w-[18rem]">
                            <div className="bg-black/40 border border-white/10 p-3 rounded-xl">
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Open</div>
                                <div className="mt-1 text-2xl font-black text-white">{openTasks.length}</div>
                            </div>
                            <div className="bg-black/40 border border-white/10 p-3 rounded-xl">
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Due Soon</div>
                                <div className="mt-1 text-2xl font-black text-white">{dueSoon}</div>
                            </div>
                            <div className="bg-black/40 border border-white/10 p-3 rounded-xl">
                                <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Done</div>
                                <div className="mt-1 text-2xl font-black text-white">{doneTasks.length}</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {tasks.length ? tasks.map(task => (
                            <div key={task.id} className={`bg-black/45 border rounded-xl p-4 transition-all ${task.done ? 'border-white/5 opacity-55' : 'border-white/10 hover:border-red-500/35'}`}>
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className={`text-[9px] uppercase tracking-widest border px-2 py-1 rounded ${priorityClass(task.priority)}`}>{task.priority || 'Normal'}</span>
                                            <span className="text-[9px] uppercase tracking-widest border border-white/10 bg-white/5 text-neutral-400 px-2 py-1 rounded">{task.type || 'Task'}</span>
                                            {task.due && <span className="text-[9px] uppercase tracking-widest text-neutral-500">Due {task.due}</span>}
                                        </div>
                                        <div className={`text-lg font-black ${task.done ? 'line-through text-neutral-500' : 'text-white'}`}>{task.title}</div>
                                        <div className="mt-1 text-xs text-neutral-500">Owner: <span className="text-neutral-300 font-bold">{task.owner || 'Unassigned'}</span></div>
                                        {task.notes && <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{task.notes}</p>}
                                    </div>
                                    <div className="flex md:flex-col gap-2">
                                        <button onClick={() => toggleTask(task)} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${task.done ? 'bg-white/5 border-white/10 text-neutral-400 hover:text-white' : 'bg-green-950/30 border-green-900/40 text-green-300 hover:bg-green-900/40'}`}>{task.done ? 'Reopen' : 'Done'}</button>
                                        <button onClick={() => removeTask(task.id)} className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-900/40">Delete</button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No action items yet.</div>
                        )}
                    </div>
                </Card>

                <Card>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-3">New Task</div>
                    <h3 className="text-2xl font-black text-white uppercase italic mb-5">Assign Work</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Title</label>
                            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Review Sunset pistol round" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 mb-1">Owner</label>
                                <Select value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })}>
                                    <option value="">Unassigned</option>
                                    {members.map(member => <option key={member} value={member}>{member}</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 mb-1">Due Date</label>
                                <Input type="date" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} className="[color-scheme:dark]" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 mb-1">Type</label>
                                <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                    {['Practice', 'Matchday', 'VOD Review', 'Admin', 'Content', 'Roster'].map(type => <option key={type}>{type}</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-500 mb-1">Priority</label>
                                <Select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                    {['Low', 'Normal', 'High'].map(priority => <option key={priority}>{priority}</option>)}
                                </Select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Context, link, or expected outcome..." className="w-full h-32 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 resize-none" />
                        </div>
                        <ButtonPrimary onClick={createTask} disabled={saving} className="w-full py-3">
                            {saving ? 'Adding...' : 'Add Action Item'}
                        </ButtonPrimary>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function TeamCalendar({ events }) {
    const [cursor, setCursor] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const startDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: Math.ceil((startDay + daysInMonth) / 7) * 7 }, (_, index) => {
        const dayNumber = index - startDay + 1;
        if (dayNumber < 1 || dayNumber > daysInMonth) return null;
        const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
        return { dayNumber, date };
    });
    const eventsByDate = events.reduce((acc, event) => {
        if (!event.date) return acc;
        acc[event.date] = [...(acc[event.date] || []), event];
        return acc;
    }, {});

    const moveMonth = (amount) => {
        setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    return (
        <div className="animate-fade-in space-y-6">
            <Card className="border-white/10">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Team Calendar</div>
                        <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic leading-none">{monthLabel}</h2>
                        <p className="mt-3 text-sm text-neutral-400">A single view for scrims, officials, practices, VOD reviews, and prep deadlines.</p>
                    </div>
                    <div className="flex gap-2">
                        <ButtonSecondary onClick={() => moveMonth(-1)} className="text-xs px-4">Prev</ButtonSecondary>
                        <ButtonSecondary onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="text-xs px-4">Today</ButtonSecondary>
                        <ButtonSecondary onClick={() => moveMonth(1)} className="text-xs px-4">Next</ButtonSecondary>
                    </div>
                </div>
                <div className="grid grid-cols-7 border border-white/10 rounded-xl overflow-hidden bg-black/35">
                    {SHORT_DAYS.map(day => <div key={day} className="p-3 text-[10px] font-black uppercase tracking-widest text-red-400 border-b border-white/10 bg-white/5">{day}</div>)}
                    {cells.map((cell, index) => (
                        <div key={index} className="min-h-32 p-3 border-b border-r border-white/10 last:border-r-0">
                            {cell && <>
                                <div className="text-xs font-black text-white mb-2">{cell.dayNumber}</div>
                                <div className="space-y-1">
                                    {(eventsByDate[cell.date] || []).map(event => (
                                        <div key={event.id} className="rounded-md border border-red-900/35 bg-red-950/25 px-2 py-1">
                                            <div className="text-[10px] font-black uppercase text-white truncate">{event.type || 'Event'}</div>
                                            <div className="text-[9px] text-neutral-400 truncate">{event.time || 'TBD'} · {event.opponent || event.map || 'Team'}</div>
                                        </div>
                                    ))}
                                </div>
                            </>}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function PracticePlanner({ members, currentUserName }) {
    const [sessions, setSessions] = useState([]);
    const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], map: MAPS[0], focus: 'Defaults', players: [], drills: '', goals: '', vod: '' });
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'practice_sessions'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setSessions(rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
        });
        return () => unsub();
    }, []);

    const togglePlayer = (member) => {
        setForm(prev => ({
            ...prev,
            players: prev.players.includes(member) ? prev.players.filter(player => player !== member) : [...prev.players, member]
        }));
    };

    const createSession = async () => {
        if (!form.title.trim()) return addToast('Practice title is required', 'error');
        setSaving(true);
        try {
            await addDoc(collection(db, 'practice_sessions'), {
                ...form,
                title: form.title.trim(),
                drills: form.drills.trim(),
                goals: form.goals.trim(),
                vod: form.vod.trim(),
                status: 'Planned',
                createdAt: new Date().toISOString(),
                createdBy: currentUserName || 'Unknown'
            });
            await writeAuditLog('Practice created', form.title.trim(), currentUserName);
            setForm({ title: '', date: new Date().toISOString().split('T')[0], map: MAPS[0], focus: 'Defaults', players: [], drills: '', goals: '', vod: '' });
            addToast('Practice block created');
        } catch (error) {
            console.error('Practice create failed:', error);
            addToast('Unable to create practice', 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (session, status) => {
        await updateDoc(doc(db, 'practice_sessions', session.id), { status, updatedAt: new Date().toISOString() });
        await writeAuditLog('Practice status updated', `${session.title} -> ${status}`, currentUserName);
        addToast('Practice updated');
    };

    const removeSession = async (session) => {
        await deleteDoc(doc(db, 'practice_sessions', session.id));
        await writeAuditLog('Practice deleted', session.title, currentUserName);
        addToast('Practice removed');
    };

    return (
        <div className="animate-fade-in grid grid-cols-1 xl:grid-cols-[0.85fr_1.15fr] gap-6">
            <Card>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Session Builder</div>
                <h2 className="text-3xl font-black text-white uppercase italic mb-5">Practice Plan</h2>
                <div className="space-y-4">
                    <Input placeholder="Session title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="[color-scheme:dark]" />
                        <Select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}>{MAPS.map(map => <option key={map}>{map}</option>)}</Select>
                    </div>
                    <Select value={form.focus} onChange={e => setForm({ ...form, focus: e.target.value })}>
                        {['Defaults', 'Retakes', 'Executes', 'Mid-rounding', 'Anti-eco', 'Pistol rounds', 'VOD review', 'Utility timing'].map(item => <option key={item}>{item}</option>)}
                    </Select>
                    <div>
                        <div className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500 font-black">Players</div>
                        <div className="flex flex-wrap gap-2">
                            {members.map(member => <button key={member} onClick={() => togglePlayer(member)} className={`px-3 py-2 rounded-lg border text-[10px] font-black uppercase tracking-widest ${form.players.includes(member) ? 'bg-red-600 border-red-500 text-white' : 'bg-black/40 border-white/10 text-neutral-500 hover:text-white'}`}>{member}</button>)}
                        </div>
                    </div>
                    <textarea value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} placeholder="Session goals..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <textarea value={form.drills} onChange={e => setForm({ ...form, drills: e.target.value })} placeholder="Drills, rounds, notes..." className="w-full h-28 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <Input placeholder="VOD / server / reference link" value={form.vod} onChange={e => setForm({ ...form, vod: e.target.value })} />
                    <ButtonPrimary onClick={createSession} disabled={saving} className="w-full py-3 text-xs">{saving ? 'Creating...' : 'Create Session'}</ButtonPrimary>
                </div>
            </Card>
            <Card>
                <div className="flex items-end justify-between gap-4 mb-5">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-2">Practice Board</div>
                        <h3 className="text-2xl font-black text-white uppercase italic">Planned Blocks</h3>
                    </div>
                    <div className="text-xs text-neutral-500">{sessions.length} sessions</div>
                </div>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                    {sessions.length ? sessions.map(session => (
                        <div key={session.id} className="bg-black/45 border border-white/10 rounded-xl p-4">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-400 px-2 py-1 rounded">{session.date || 'Date TBD'}</span>
                                        <span className="text-[9px] uppercase tracking-widest bg-red-950/25 border border-red-900/40 text-red-300 px-2 py-1 rounded">{session.map}</span>
                                        <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-400 px-2 py-1 rounded">{session.status || 'Planned'}</span>
                                    </div>
                                    <div className="text-lg font-black text-white">{session.title}</div>
                                    <div className="mt-1 text-xs text-neutral-500">{session.focus} · {(session.players || []).join(', ') || 'No players assigned'}</div>
                                </div>
                                <div className="flex gap-2">
                                    <ButtonSecondary onClick={() => updateStatus(session, session.status === 'Complete' ? 'Planned' : 'Complete')} className="text-[10px] py-2">{session.status === 'Complete' ? 'Reopen' : 'Complete'}</ButtonSecondary>
                                    <button onClick={() => removeSession(session)} className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-900/40">Delete</button>
                                </div>
                            </div>
                            {session.goals && <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{session.goals}</p>}
                            {session.drills && <p className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">{session.drills}</p>}
                            {session.vod && <a href={session.vod} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white">Open Reference</a>}
                        </div>
                    )) : <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No practice sessions planned.</div>}
                </div>
            </Card>
        </div>
    );
}

function MatchPrep({ members, events, currentUserName }) {
    const [preps, setPreps] = useState([]);
    const [form, setForm] = useState({ opponent: '', eventId: '', map: MAPS[0], status: 'Scouting', comp: '', veto: '', winConditions: '', threats: '', playerNotes: '', links: '' });
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'match_prep'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setPreps(rows.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)));
        });
        return () => unsub();
    }, []);

    const selectedEvent = events.find(event => event.id === form.eventId);
    useEffect(() => {
        if (selectedEvent) setForm(prev => ({ ...prev, opponent: selectedEvent.opponent || prev.opponent, map: selectedEvent.map && selectedEvent.map !== 'TBD' ? selectedEvent.map : prev.map }));
    }, [selectedEvent]);

    const savePrep = async () => {
        if (!form.opponent.trim()) return addToast('Opponent is required', 'error');
        setSaving(true);
        try {
            await addDoc(collection(db, 'match_prep'), {
                ...form,
                opponent: form.opponent.trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: currentUserName || 'Unknown'
            });
            await writeAuditLog('Match prep created', form.opponent.trim(), currentUserName);
            setForm({ opponent: '', eventId: '', map: MAPS[0], status: 'Scouting', comp: '', veto: '', winConditions: '', threats: '', playerNotes: '', links: '' });
            addToast('Match prep saved');
        } catch (error) {
            console.error('Match prep failed:', error);
            addToast('Unable to save prep', 'error');
        } finally {
            setSaving(false);
        }
    };

    const deletePrep = async (prep) => {
        await deleteDoc(doc(db, 'match_prep', prep.id));
        await writeAuditLog('Match prep deleted', prep.opponent, currentUserName);
        addToast('Prep removed');
    };

    return (
        <div className="animate-fade-in grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
            <Card>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Opponent Room</div>
                <h2 className="text-3xl font-black text-white uppercase italic mb-5">Match Prep</h2>
                <div className="space-y-4">
                    <Select value={form.eventId} onChange={e => setForm({ ...form, eventId: e.target.value })}>
                        <option value="">Link upcoming event</option>
                        {events.map(event => <option key={event.id} value={event.id}>{event.date} · {event.type} vs {event.opponent || 'TBD'}</option>)}
                    </Select>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input placeholder="Opponent" value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} />
                        <Select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}>{MAPS.map(map => <option key={map}>{map}</option>)}</Select>
                    </div>
                    <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                        {['Scouting', 'Ready', 'Needs VOD', 'Reviewed', 'Archived'].map(status => <option key={status}>{status}</option>)}
                    </Select>
                    <textarea value={form.veto} onChange={e => setForm({ ...form, veto: e.target.value })} placeholder="Map veto plan..." className="w-full h-20 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <textarea value={form.comp} onChange={e => setForm({ ...form, comp: e.target.value })} placeholder="Expected comp / our comp..." className="w-full h-20 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <textarea value={form.winConditions} onChange={e => setForm({ ...form, winConditions: e.target.value })} placeholder="Win conditions..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <textarea value={form.threats} onChange={e => setForm({ ...form, threats: e.target.value })} placeholder="Opponent threats / habits..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <textarea value={form.playerNotes} onChange={e => setForm({ ...form, playerNotes: e.target.value })} placeholder={`Player assignments (${members.slice(0, 5).join(', ')})...`} className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <Input placeholder="VOD / tracker / sheet links" value={form.links} onChange={e => setForm({ ...form, links: e.target.value })} />
                    <ButtonPrimary onClick={savePrep} disabled={saving} className="w-full py-3 text-xs">{saving ? 'Saving...' : 'Save Prep'}</ButtonPrimary>
                </div>
            </Card>
            <Card>
                <div className="flex items-end justify-between gap-4 mb-5">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-2">Prep Library</div>
                        <h3 className="text-2xl font-black text-white uppercase italic">Opponent Files</h3>
                    </div>
                    <div className="text-xs text-neutral-500">{preps.length} files</div>
                </div>
                <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    {preps.length ? preps.map(prep => (
                        <div key={prep.id} className="bg-black/45 border border-white/10 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <span className="text-[9px] uppercase tracking-widest bg-red-950/25 border border-red-900/40 text-red-300 px-2 py-1 rounded">{prep.map}</span>
                                        <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-400 px-2 py-1 rounded">{prep.status}</span>
                                    </div>
                                    <div className="text-xl font-black text-white uppercase italic">SYRIX vs {prep.opponent}</div>
                                </div>
                                <button onClick={() => deletePrep(prep)} className="text-neutral-600 hover:text-red-500 text-xl leading-none">×</button>
                            </div>
                            {['veto', 'comp', 'winConditions', 'threats', 'playerNotes'].map(key => prep[key] && (
                                <div key={key} className="mt-3 border-t border-white/10 pt-3">
                                    <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black mb-1">{key.replace(/([A-Z])/g, ' $1')}</div>
                                    <p className="text-sm text-neutral-300 whitespace-pre-wrap">{prep[key]}</p>
                                </div>
                            ))}
                            {prep.links && <a href={prep.links} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white">Open Link</a>}
                        </div>
                    )) : <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No match prep saved.</div>}
                </div>
            </Card>
        </div>
    );
}

function Announcements({ currentUserName }) {
    const [announcements, setAnnouncements] = useState([]);
    const [form, setForm] = useState({ title: '', body: '', level: 'Team', pinned: false });
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setAnnouncements(rows.sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
        });
        return () => unsub();
    }, []);

    const postAnnouncement = async () => {
        if (!form.title.trim() || !form.body.trim()) return addToast('Title and message are required', 'error');
        setSaving(true);
        try {
            await addDoc(collection(db, 'announcements'), {
                ...form,
                title: form.title.trim(),
                body: form.body.trim(),
                author: currentUserName || 'Unknown',
                createdAt: new Date().toISOString()
            });
            await writeAuditLog('Announcement posted', form.title.trim(), currentUserName);
            setForm({ title: '', body: '', level: 'Team', pinned: false });
            addToast('Announcement posted');
        } catch (error) {
            console.error('Announcement failed:', error);
            addToast('Unable to post announcement', 'error');
        } finally {
            setSaving(false);
        }
    };

    const removeAnnouncement = async (item) => {
        await deleteDoc(doc(db, 'announcements', item.id));
        await writeAuditLog('Announcement deleted', item.title, currentUserName);
        addToast('Announcement removed');
    };

    return (
        <div className="animate-fade-in grid grid-cols-1 xl:grid-cols-[0.75fr_1.25fr] gap-6">
            <Card>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Broadcast</div>
                <h2 className="text-3xl font-black text-white uppercase italic mb-5">Announcement</h2>
                <div className="space-y-4">
                    <Input placeholder="Headline" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <Select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>
                        {['Team', 'Urgent', 'Practice', 'Matchday', 'Roster', 'Content'].map(level => <option key={level}>{level}</option>)}
                    </Select>
                    <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Message..." className="w-full h-40 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    <label className="flex items-center gap-2 text-xs text-neutral-400 font-bold uppercase"><input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} className="accent-red-600" /> Pin announcement</label>
                    <ButtonPrimary onClick={postAnnouncement} disabled={saving} className="w-full py-3 text-xs">{saving ? 'Posting...' : 'Post Announcement'}</ButtonPrimary>
                </div>
            </Card>
            <Card>
                <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-3">Team Feed</div>
                <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    {announcements.length ? announcements.map(item => (
                        <div key={item.id} className={`rounded-xl border p-4 ${item.pinned ? 'border-red-900/50 bg-red-950/20' : 'border-white/10 bg-black/45'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {item.pinned && <span className="text-[9px] uppercase tracking-widest bg-red-600 text-white px-2 py-1 rounded">Pinned</span>}
                                        <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-400 px-2 py-1 rounded">{item.level}</span>
                                    </div>
                                    <div className="text-xl font-black text-white uppercase italic">{item.title}</div>
                                    <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500">{item.author || 'Unknown'} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Date TBD'}</div>
                                </div>
                                <button onClick={() => removeAnnouncement(item)} className="text-neutral-600 hover:text-red-500 text-xl leading-none">×</button>
                            </div>
                            <p className="mt-3 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{item.body}</p>
                        </div>
                    )) : <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No announcements posted.</div>}
                </div>
            </Card>
        </div>
    );
}

function NotificationCenter({ events }) {
    const [tasks, setTasks] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        const unsubTasks = onSnapshot(collection(db, 'tasks'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setTasks(rows);
        });
        const unsubAnnouncements = onSnapshot(collection(db, 'announcements'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setAnnouncements(rows);
        });
        return () => { unsubTasks(); unsubAnnouncements(); };
    }, []);

    const now = Date.now();
    const upcomingEvents = events.filter(event => event.date && new Date(`${event.date}T${event.time || '00:00'}`).getTime() <= now + 1000 * 60 * 60 * 24 * 7);
    const dueTasks = tasks.filter(task => !task.done && task.due && new Date(task.due).getTime() <= now + 1000 * 60 * 60 * 24 * 3);
    const pinned = announcements.filter(item => item.pinned);
    const alerts = [
        ...upcomingEvents.map(event => ({ id: `event-${event.id}`, type: 'Event', title: `${event.type || 'Event'} vs ${event.opponent || 'TBD'}`, meta: `${event.date} @ ${event.time || 'TBD'}` })),
        ...dueTasks.map(task => ({ id: `task-${task.id}`, type: 'Task', title: task.title, meta: task.due ? `Due ${task.due}` : 'No due date' })),
        ...pinned.map(item => ({ id: `announcement-${item.id}`, type: 'Pinned', title: item.title, meta: item.level || 'Announcement' }))
    ];

    return (
        <div className="animate-fade-in space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Signal Center</div>
                        <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic leading-none">Notifications</h2>
                        <p className="mt-3 text-sm text-neutral-400">Upcoming events, due tasks, and pinned announcements in one queue.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 min-w-[18rem]">
                        <div className="bg-black/40 border border-white/10 p-3 rounded-xl"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Events</div><div className="mt-1 text-2xl font-black text-white">{upcomingEvents.length}</div></div>
                        <div className="bg-black/40 border border-white/10 p-3 rounded-xl"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Tasks</div><div className="mt-1 text-2xl font-black text-white">{dueTasks.length}</div></div>
                        <div className="bg-black/40 border border-white/10 p-3 rounded-xl"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Pinned</div><div className="mt-1 text-2xl font-black text-white">{pinned.length}</div></div>
                    </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    {alerts.length ? alerts.map(alert => (
                        <div key={alert.id} className="bg-black/45 border border-white/10 rounded-xl p-4">
                            <div className="text-[9px] uppercase tracking-widest text-red-400 font-black mb-2">{alert.type}</div>
                            <div className="text-lg font-black text-white">{alert.title}</div>
                            <div className="mt-2 text-xs text-neutral-500">{alert.meta}</div>
                        </div>
                    )) : <div className="xl:col-span-3 p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No urgent notifications right now.</div>}
                </div>
            </Card>
        </div>
    );
}

function PlayerAdminNotes({ members, currentUserName }) {
    const [notes, setNotes] = useState([]);
    const [form, setForm] = useState({
        player: members[0] || '',
        rating: '7',
        playstyle: '',
        comms: '',
        improvement: '',
        notes: ''
    });
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(null);
    const [editingSaving, setEditingSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        if (!form.player && members.length) setForm(prev => ({ ...prev, player: members[0] }));
    }, [form.player, members]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'admin_player_notes'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setNotes(rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
        });
        return () => unsub();
    }, []);

    const selectedNotes = notes.filter(note => note.player === form.player);
    const averageRating = selectedNotes.length
        ? (selectedNotes.reduce((sum, note) => sum + Number(note.rating || 0), 0) / selectedNotes.length).toFixed(1)
        : 'N/A';

    const saveNote = async () => {
        if (!form.player) return addToast('Select a player first', 'error');
        const rating = Number(form.rating);
        if (Number.isNaN(rating) || rating < 1 || rating > 10) return addToast('Rating must be between 1 and 10', 'error');
        if (!form.playstyle.trim() && !form.comms.trim() && !form.improvement.trim() && !form.notes.trim()) {
            return addToast('Add at least one coaching note', 'error');
        }

        setSaving(true);
        try {
            await addDoc(collection(db, 'admin_player_notes'), {
                player: form.player,
                rating,
                playstyle: form.playstyle.trim(),
                comms: form.comms.trim(),
                improvement: form.improvement.trim(),
                notes: form.notes.trim(),
                author: currentUserName || 'Admin',
                createdAt: new Date().toISOString()
            });
            await writeAuditLog('Player note added', `${form.player} rated ${rating}/10`, currentUserName || 'Admin');
            setForm(prev => ({ ...prev, rating: '7', playstyle: '', comms: '', improvement: '', notes: '' }));
            addToast('Player note saved');
        } catch (error) {
            console.error('Player note save failed:', error);
            addToast('Unable to save player note', 'error');
        } finally {
            setSaving(false);
        }
    };

    const removeNote = async (note) => {
        try {
            await deleteDoc(doc(db, 'admin_player_notes', note.id));
            await writeAuditLog('Player note deleted', `${note.player} note removed`, currentUserName || 'Admin');
            addToast('Player note removed');
        } catch (error) {
            console.error('Player note delete failed:', error);
            addToast('Unable to delete player note', 'error');
        }
    };

    const startEditNote = (note) => {
        setEditingId(note.id);
        setEditForm({
            player: note.player || form.player,
            rating: String(note.rating || 7),
            playstyle: note.playstyle || '',
            comms: note.comms || '',
            improvement: note.improvement || '',
            notes: note.notes || ''
        });
    };

    const cancelEditNote = () => {
        setEditingId(null);
        setEditForm(null);
    };

    const saveEditedNote = async () => {
        if (!editingId || !editForm) return;
        const rating = Number(editForm.rating);
        if (Number.isNaN(rating) || rating < 1 || rating > 10) return addToast('Rating must be between 1 and 10', 'error');
        if (!editForm.playstyle.trim() && !editForm.comms.trim() && !editForm.improvement.trim() && !editForm.notes.trim()) {
            return addToast('Add at least one coaching note', 'error');
        }

        setEditingSaving(true);
        try {
            await updateDoc(doc(db, 'admin_player_notes', editingId), {
                player: editForm.player,
                rating,
                playstyle: editForm.playstyle.trim(),
                comms: editForm.comms.trim(),
                improvement: editForm.improvement.trim(),
                notes: editForm.notes.trim(),
                updatedAt: new Date().toISOString(),
                updatedBy: currentUserName || 'Admin'
            });
            await writeAuditLog('Player note edited', `${editForm.player} rated ${rating}/10`, currentUserName || 'Admin');
            cancelEditNote();
            addToast('Player note updated');
        } catch (error) {
            console.error('Player note update failed:', error);
            addToast('Unable to update player note', 'error');
        } finally {
            setEditingSaving(false);
        }
    };

    return (
        <div className="animate-fade-in grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-6">
            <Card>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Private Coaching</div>
                <h2 className="text-3xl font-black text-white uppercase italic mb-5">Player Notes</h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Player</label>
                        <Select value={form.player} onChange={e => setForm({ ...form, player: e.target.value })}>
                            <option value="">Select player</option>
                            {members.map(member => <option key={member} value={member}>{member}</option>)}
                        </Select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Game Rating: {form.rating}/10</label>
                        <input type="range" min="1" max="10" step="1" value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="w-full accent-red-600" />
                        <div className="mt-2 grid grid-cols-10 gap-1">
                            {Array.from({ length: 10 }, (_, index) => (
                                <button key={index + 1} onClick={() => setForm({ ...form, rating: String(index + 1) })} className={`h-8 rounded-md border text-[10px] font-black ${Number(form.rating) === index + 1 ? 'bg-red-600 border-red-500 text-white' : 'bg-black/40 border-white/10 text-neutral-500 hover:text-white'}`}>{index + 1}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Playstyle</label>
                        <textarea value={form.playstyle} onChange={e => setForm({ ...form, playstyle: e.target.value })} placeholder="Positioning, pacing, decision-making, agent comfort..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Comms</label>
                        <textarea value={form.comms} onChange={e => setForm({ ...form, comms: e.target.value })} placeholder="Clarity, timing, mid-round info, emotional control..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">What To Improve</label>
                        <textarea value={form.improvement} onChange={e => setForm({ ...form, improvement: e.target.value })} placeholder="Specific habits, drills, review points, next-session focus..." className="w-full h-28 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Extra Notes</label>
                        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything else admins/coaches should remember..." className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                    </div>
                    <ButtonPrimary onClick={saveNote} disabled={saving} className="w-full py-3 text-xs">{saving ? 'Saving...' : 'Save Player Note'}</ButtonPrimary>
                </div>
            </Card>

            <Card>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-2">Review History</div>
                        <h3 className="text-2xl font-black text-white uppercase italic">{form.player || 'Select Player'}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 min-w-[12rem]">
                        <div className="bg-black/40 border border-white/10 p-3 rounded-xl">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Avg Rating</div>
                            <div className="mt-1 text-2xl font-black text-white">{averageRating}</div>
                        </div>
                        <div className="bg-black/40 border border-white/10 p-3 rounded-xl">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Notes</div>
                            <div className="mt-1 text-2xl font-black text-white">{selectedNotes.length}</div>
                        </div>
                    </div>
                </div>
                <div className="space-y-3 max-h-[78vh] overflow-y-auto pr-2 custom-scrollbar">
                    {selectedNotes.length ? selectedNotes.map(note => (
                        <div key={note.id} className="bg-black/45 border border-white/10 rounded-xl p-4">
                            {editingId === note.id && editForm ? (
                                <div className="space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <div className="text-[9px] uppercase tracking-widest text-red-400 font-black mb-1">Editing Note</div>
                                            <div className="text-lg font-black text-white">{note.player}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <ButtonSecondary onClick={cancelEditNote} className="text-[10px] py-2">Cancel</ButtonSecondary>
                                            <ButtonPrimary onClick={saveEditedNote} disabled={editingSaving} className="text-[10px] py-2">{editingSaving ? 'Saving...' : 'Save Edit'}</ButtonPrimary>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Rating: {editForm.rating}/10</label>
                                        <input type="range" min="1" max="10" step="1" value={editForm.rating} onChange={e => setEditForm({ ...editForm, rating: e.target.value })} className="w-full accent-red-600" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Playstyle</label>
                                            <textarea value={editForm.playstyle} onChange={e => setEditForm({ ...editForm, playstyle: e.target.value })} className="w-full h-28 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Comms</label>
                                            <textarea value={editForm.comms} onChange={e => setEditForm({ ...editForm, comms: e.target.value })} className="w-full h-28 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">What To Improve</label>
                                        <textarea value={editForm.improvement} onChange={e => setEditForm({ ...editForm, improvement: e.target.value })} className="w-full h-28 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Extra Notes</label>
                                        <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} className="w-full h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 placeholder-neutral-600 resize-y" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <span className="text-[9px] uppercase tracking-widest bg-red-600 text-white px-2 py-1 rounded">{note.rating || 'N/A'}/10</span>
                                                <span className="text-[9px] uppercase tracking-widest bg-white/5 border border-white/10 text-neutral-400 px-2 py-1 rounded">{note.author || 'Admin'}</span>
                                                <span className="text-[9px] uppercase tracking-widest text-neutral-500">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'Date TBD'}</span>
                                                {note.updatedAt && <span className="text-[9px] uppercase tracking-widest text-neutral-600">Edited {new Date(note.updatedAt).toLocaleDateString()}</span>}
                                            </div>
                                            <div className="text-lg font-black text-white">{note.player}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => startEditNote(note)} className="px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white hover:border-red-500/40">Edit</button>
                                            <button onClick={() => removeNote(note)} className="text-neutral-600 hover:text-red-500 text-xl leading-none">×</button>
                                        </div>
                                    </div>
                                    {note.playstyle && <div className="mt-3 border-t border-white/10 pt-3"><div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black mb-1">Playstyle</div><p className="text-sm text-neutral-300 whitespace-pre-wrap">{note.playstyle}</p></div>}
                                    {note.comms && <div className="mt-3 border-t border-white/10 pt-3"><div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black mb-1">Comms</div><p className="text-sm text-neutral-300 whitespace-pre-wrap">{note.comms}</p></div>}
                                    {note.improvement && <div className="mt-3 border-t border-white/10 pt-3"><div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black mb-1">Improve</div><p className="text-sm text-neutral-300 whitespace-pre-wrap">{note.improvement}</p></div>}
                                    {note.notes && <div className="mt-3 border-t border-white/10 pt-3"><div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black mb-1">Extra</div><p className="text-sm text-neutral-300 whitespace-pre-wrap">{note.notes}</p></div>}
                                </>
                            )}
                        </div>
                    )) : <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No private notes for this player yet.</div>}
                </div>
            </Card>
        </div>
    );
}

function AuditLog() {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'audit_logs'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setLogs(rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 100));
        });
        return () => unsub();
    }, []);

    return (
        <div className="animate-fade-in">
            <Card>
                <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Admin Trail</div>
                <h2 className="text-3xl font-black text-white uppercase italic mb-5">Audit Log</h2>
                <div className="space-y-2 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    {logs.length ? logs.map(log => (
                        <div key={log.id} className="grid grid-cols-1 md:grid-cols-[10rem_1fr_12rem] gap-3 bg-black/45 border border-white/10 rounded-xl p-4">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500">{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Date TBD'}</div>
                            <div>
                                <div className="text-sm font-black text-white">{log.action}</div>
                                <div className="mt-1 text-xs text-neutral-500">{log.detail}</div>
                            </div>
                            <div className="text-xs text-neutral-400 md:text-right">{log.actor || 'System'}</div>
                        </div>
                    )) : <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No audit activity yet.</div>}
                </div>
            </Card>
        </div>
    );
}

function RosterManager({ members, events, canManageRoster = false }) {
    const [rosterData, setRosterData] = useState({});
    const [mode, setMode] = useState(canManageRoster ? 'edit' : 'compare');
    const [compare1, setCompare1] = useState('');
    const [compare2, setCompare2] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);

    // Editor State
    const [role, setRole] = useState('Tryout');
    const [rank, setRank] = useState('Unranked');
    const [gameId, setGameId] = useState('');
    const [pfp, setPfp] = useState('');
    const [ingameRole, setIngameRole] = useState('Flex');
    const [notes, setNotes] = useState('');

    // Rename State
    const [renameInput, setRenameInput] = useState('');

    const addToast = useToast();

    // Fetch Roster Data
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'roster'), (snap) => {
            const data = {};
            snap.forEach(doc => data[doc.id] = doc.data());
            setRosterData(data);
        });
        return () => unsub();
    }, []);

    // Save Changes Handler
    const handleSave = async () => {
        if (!selectedMember) return;
        try {
            await setDoc(doc(db, 'roster', selectedMember), {
                role,
                rank,
                notes,
                gameId,
                pfp,
                ingameRole
            }, { merge: true });
            addToast('Player Updated Successfully');
        } catch (error) {
            console.error("Save failed:", error);
            addToast("Error saving player", "error");
        }
    };

    // Rename User Handler
    const handleRename = async () => {
        if (!selectedMember || !renameInput) return addToast("Please enter a new name", "error");
        if (renameInput === selectedMember) return addToast("Name is identical", "error");

        const confirm = window.confirm(
            `⚠️ CAUTION: Renaming '${selectedMember}' to '${renameInput}'.\n\n` +
            `This will move their Roster profile AND Availability slots.\n` +
            `Are you sure?`
        );

        if (!confirm) return;

        try {
            // 1. Fetch Old Data
            const oldRosterRef = doc(db, 'roster', selectedMember);
            const oldAvailRef = doc(db, 'availabilities', selectedMember);

            const rosterSnap = await getDoc(oldRosterRef);
            const availSnap = await getDoc(oldAvailRef);

            // 2. Create NEW Roster Document
            if (rosterSnap.exists()) {
                await setDoc(doc(db, 'roster', renameInput), rosterSnap.data());
                await deleteDoc(oldRosterRef); // Delete old
            } else {
                await setDoc(doc(db, 'roster', renameInput), { role: 'Tryout', rank: 'Unranked', notes: 'Renamed user' });
            }

            // 3. Create NEW Availability Document (if it exists)
            if (availSnap.exists()) {
                await setDoc(doc(db, 'availabilities', renameInput), availSnap.data());
                await deleteDoc(oldAvailRef); // Delete old
            }

            addToast(`Successfully renamed to ${renameInput}`);
            setSelectedMember(renameInput); // Switch selection to new name
            setRenameInput(''); // Clear input

        } catch (error) {
            console.error("Rename failed:", error);
            addToast("Error moving data", "error");
        }
    };

    // Sorted Members for Sidebar
    const sortedMembers = useMemo(() => {
        return sortRosterByRole(members, rosterData);
    }, [members, rosterData]);

    // MVP Calculations
    const mvpCounts = useMemo(() => {
        const counts = {};
        if (!events) return counts;
        events.forEach(ev => {
            if (!ev.mvpVotes) return;
            const voteTally = {};
            Object.values(ev.mvpVotes).forEach(p => voteTally[p] = (voteTally[p] || 0) + 1);
            let max = 0; let winner = null;
            Object.entries(voteTally).forEach(([p, c]) => { if (c > max) { max = c; winner = p; } });
            if (winner) counts[winner] = (counts[winner] || 0) + 1;
        });
        return counts;
    }, [events]);

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex gap-4 border-b border-white/10 pb-4">
                {canManageRoster && <button onClick={() => setMode('edit')} className={`text-sm font-bold uppercase ${mode === 'edit' ? 'text-red-500' : 'text-neutral-500'}`}>Edit Mode</button>}
                <button onClick={() => setMode('compare')} className={`text-sm font-bold uppercase ${mode === 'compare' ? 'text-red-500' : 'text-neutral-500'}`}>Compare Players</button>
            </div>

            {mode === 'edit' && canManageRoster ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                    {/* Sidebar List */}
                    <div className="lg:col-span-1 bg-neutral-900/80 p-6 rounded-xl border border-white/5 flex flex-col">
                        <h3 className="text-white font-bold mb-4">Members</h3>
                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                            {sortedMembers.length === 0 ?
                                <div className="text-neutral-500 text-xs italic p-4 text-center border border-dashed border-neutral-800 rounded-xl">No members found. Log availability to appear here.</div> :
                                sortedMembers.map(m => (
                                    <div key={m} onClick={() => {
                                        setSelectedMember(m);
                                        setRole(rosterData[m]?.role || 'Tryout');
                                        setRank(rosterData[m]?.rank || 'Unranked');
                                        setNotes(rosterData[m]?.notes || '');
                                        setGameId(rosterData[m]?.gameId || '');
                                        setPfp(rosterData[m]?.pfp || '');
                                        setIngameRole(rosterData[m]?.ingameRole || 'Flex');
                                    }} className={`p-3 rounded-xl cursor-pointer border transition-all flex justify-between items-center ${selectedMember === m ? 'bg-red-900/20 border-red-600' : 'bg-black border-neutral-800'}`}>
                                        <span className="text-white font-bold flex items-center gap-2">{m} {mvpCounts[m] > 0 && <span className="text-[9px] bg-yellow-500/20 text-yellow-500 px-1 rounded border border-yellow-500/20">🏆 x{mvpCounts[m]}</span>}</span>
                                        <span className="text-xs text-neutral-500 uppercase">{rosterData[m]?.role}</span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>

                    {/* Edit Form */}
                    <Card className="lg:col-span-2">
                        {selectedMember ? (
                            <div className="space-y-6">
                                <h3 className="text-2xl font-black text-white">Managing: <span className="text-red-500">{selectedMember}</span></h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Team Role</label>
                                        <Select value={role} onChange={e => setRole(e.target.value)}>
                                            {['Manager', 'Head Coach', 'Coach', 'Captain', 'Main', 'Sub', 'Tryout'].map(r => <option key={r}>{r}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Rank</label>
                                        <Select value={rank} onChange={e => setRank(e.target.value)}>{RANKS.map(r => <option key={r}>{r}</option>)}</Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Agent Role</label>
                                        <Select value={ingameRole} onChange={e => setIngameRole(e.target.value)}>
                                            {ROLES.filter(r => !['Head Coach', 'Coach'].includes(r)).map(r => <option key={r}>{r}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-500 mb-1">Riot ID</label>
                                        <Input value={gameId} onChange={e => setGameId(e.target.value)} />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 mb-1">Profile Image URL</label>
                                    <Input value={pfp} onChange={e => setPfp(e.target.value)} placeholder="https://..." />
                                </div>

                                <textarea className="w-full h-40 bg-black border border-neutral-800 rounded-xl p-3 text-white" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes..." />

                                <ButtonPrimary onClick={handleSave} className="w-full py-3">Save Changes</ButtonPrimary>

                                {/* --- RENAME SECTION (Danger Zone) --- */}
                                <div className="mt-8 pt-6 border-t border-neutral-800">
                                    <label className="block text-xs font-bold text-red-500 mb-2 uppercase tracking-widest">
                                        Danger Zone: Rename User
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={renameInput}
                                            onChange={(e) => setRenameInput(e.target.value)}
                                            placeholder={`New name for ${selectedMember}...`}
                                            className="border-red-900/30 focus:border-red-600"
                                        />
                                        <button
                                            onClick={handleRename}
                                            className="bg-red-950 hover:bg-red-900 text-red-500 border border-red-900 font-bold px-4 rounded-xl text-xs uppercase tracking-wider transition-colors"
                                        >
                                            Rename
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-600 mt-2">
                                        This moves their Roster Profile and Availability slots to the new ID.
                                    </p>
                                </div>

                            </div>
                        ) : <div className="h-full flex items-center justify-center text-neutral-500">Select a player</div>}
                    </Card>
                </div>
            ) : (
                // Compare Mode (Unchanged)
                <div className="grid grid-cols-2 gap-8 h-full">
                    {[setCompare1, setCompare2].map((setter, i) => (
                        <Card key={i} className="h-full">
                            <Select onChange={e => setter(e.target.value)} className="mb-6"><option>Select Player</option>{members.map(m => <option key={m}>{m}</option>)}</Select>
                            {((i === 0 ? compare1 : compare2) && rosterData[i === 0 ? compare1 : compare2]) && (
                                <div className="space-y-4 text-center">
                                    <div className="w-24 h-24 mx-auto bg-red-600 rounded-full flex items-center justify-center text-3xl font-black text-white border-4 border-black shadow-xl">{(i === 0 ? compare1 : compare2)[0]}</div>
                                    <div className="text-3xl font-black text-white uppercase">{(i === 0 ? compare1 : compare2)}</div>
                                    <div className="flex justify-center gap-2">
                                        <span className="bg-neutral-800 px-3 py-1 rounded text-xs font-bold text-white">{rosterData[i === 0 ? compare1 : compare2]?.rank || 'Unranked'}</span>
                                        <span className="bg-red-900/50 px-3 py-1 rounded text-xs font-bold text-red-400">{rosterData[i === 0 ? compare1 : compare2]?.role || 'Member'}</span>
                                    </div>
                                    {mvpCounts[(i === 0 ? compare1 : compare2)] > 0 && <div className="text-yellow-500 font-bold text-sm bg-yellow-900/20 py-1 rounded border border-yellow-500/20">🏆 {mvpCounts[(i === 0 ? compare1 : compare2)]} MVP Awards</div>}
                                    <div className="p-4 bg-black/50 rounded-xl border border-neutral-800 text-left">
                                        <div className="text-[10px] text-neutral-500 uppercase font-bold mb-2">Performance Notes</div>
                                        <p className="text-sm text-neutral-300 italic">"{rosterData[i === 0 ? compare1 : compare2]?.notes || 'No notes available.'}"</p>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}


function PartnerDirectory() {
    const [partners, setPartners] = useState([]); const [newPartner, setNewPartner] = useState({ name: '', contact: '', notes: '' });
    useEffect(() => { const unsub = onSnapshot(collection(db, 'partners'), (s) => { const p = []; s.forEach(d => p.push({ id: d.id, ...d.data() })); setPartners(p); }); return unsub; }, []);
    const add = async () => { await addDoc(collection(db, 'partners'), newPartner); setNewPartner({ name: '', contact: '', notes: '' }); };
    return (
        <Card className="h-full"><h3 className="text-2xl font-black text-white mb-6">PARTNERS</h3><div className="mb-6 space-y-2"><Input placeholder="Team Name" value={newPartner.name} onChange={e => setNewPartner({ ...newPartner, name: e.target.value })} /><div className="flex gap-2"><Input placeholder="Contact" value={newPartner.contact} onChange={e => setNewPartner({ ...newPartner, contact: e.target.value })} /><Input placeholder="Notes" value={newPartner.notes} onChange={e => setNewPartner({ ...newPartner, notes: e.target.value })} /></div><ButtonPrimary onClick={add} className="w-full text-xs py-2">Add</ButtonPrimary></div><div className="space-y-2 h-96 overflow-y-auto custom-scrollbar">{partners.map(p => <div key={p.id} className="p-4 bg-black border border-neutral-800 rounded-xl flex justify-between"><div><div className="font-bold text-white">{p.name}</div><div className="text-xs text-red-500">{p.contact}</div></div><button onClick={() => deleteDoc(doc(db, 'partners', p.id))} className="text-neutral-600 hover:text-red-500">×</button></div>)}</div></Card>
    );
}

function MapVeto() {
    const [vetoState, setVetoState] = useState({});
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'general', 'map_veto'), (snap) => {
            setVetoState(snap.exists() ? snap.data() : {});
        });
        return () => unsub();
    }, []);

    const statusOrder = ['neutral', 'ban', 'pick', 'inactive'];
    const activeMaps = MAPS.filter(map => (vetoState[map] || 'neutral') !== 'inactive');
    const inactiveMaps = MAPS.filter(map => (vetoState[map] || 'neutral') === 'inactive');

    const setMapStatus = async (map, status) => {
        await setDoc(doc(db, 'general', 'map_veto'), { ...vetoState, [map]: status });
    };

    const toggleMap = async (map) => {
        const current = vetoState[map] || 'neutral';
        const next = statusOrder[(statusOrder.indexOf(current) + 1) % statusOrder.length];
        await setMapStatus(map, next);
    };

    const resetVeto = async () => {
        await setDoc(doc(db, 'general', 'map_veto'), {});
        addToast('Map veto board reset');
    };

    const statusClasses = (status) => {
        if (status === 'ban') return 'border-red-600 bg-red-950/35 text-red-100';
        if (status === 'pick') return 'border-green-500 bg-green-950/30 text-green-100';
        if (status === 'inactive') return 'border-neutral-700 bg-neutral-950/80 text-neutral-500 grayscale';
        return 'border-neutral-800 bg-black/50 text-white';
    };

    const MapTile = ({ map }) => {
        const status = vetoState[map] || 'neutral';
        return (
            <div className={`rounded-lg border overflow-hidden ${statusClasses(status)}`}>
                <button onClick={() => toggleMap(map)} className="aspect-[1.55] w-full flex items-center justify-center relative group">
                    <span className="font-black uppercase tracking-wide text-sm">{map}</span>
                    <div className="absolute bottom-2 text-[9px] font-black tracking-widest">{status.toUpperCase()}</div>
                </button>
                <div className="grid grid-cols-4 border-t border-white/10">
                    {statusOrder.map(nextStatus => (
                        <button
                            key={nextStatus}
                            onClick={() => setMapStatus(map, nextStatus)}
                            className={`h-8 text-[8px] font-black uppercase tracking-widest border-r border-white/5 last:border-r-0 ${status === nextStatus ? 'bg-white text-black' : 'bg-black/30 text-neutral-500 hover:text-white hover:bg-white/10'}`}
                        >
                            {nextStatus === 'neutral' ? 'Live' : nextStatus}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Card className="min-h-full !p-5 md:!p-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-2">Map Pool</div>
                    <h3 className="text-2xl md:text-3xl font-black text-white uppercase italic leading-none">Map Veto</h3>
                    <p className="mt-3 text-sm text-neutral-400 max-w-2xl">Mark maps as live, ban, pick, or inactive so the team can separate current rotation maps from out-of-pool prep.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs font-black text-white">{activeMaps.length} ACTIVE</div>
                    <div className="px-3 py-2 rounded-lg border border-white/10 bg-black/40 text-xs font-black text-neutral-400">{inactiveMaps.length} INACTIVE</div>
                    <ButtonSecondary onClick={resetVeto} className="text-xs px-3 py-2">Reset Board</ButtonSecondary>
                </div>
            </div>

            <div className="space-y-6">
                <section>
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Active Rotation</h4>
                        <span className="text-[10px] text-neutral-500 uppercase tracking-widest">Click a map to cycle status</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                        {activeMaps.map(map => <MapTile key={map} map={map} />)}
                    </div>
                </section>

                <section>
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <h4 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Inactive Maps</h4>
                        <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Kept visible for rotation planning</span>
                    </div>
                    {inactiveMaps.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {inactiveMaps.map(map => <MapTile key={map} map={map} />)}
                        </div>
                    ) : (
                        <div className="p-6 border border-dashed border-neutral-800 rounded-xl text-sm text-neutral-500 text-center">No inactive maps selected.</div>
                    )}
                </section>
            </div>
        </Card>
    );
}

function ContentManager() {
    // Existing State
    const [news, setNews] = useState([]);
    const [intel, setIntel] = useState([]);
    const [merch, setMerch] = useState([]);
    const [newNews, setNewNews] = useState({ title: '', body: '', date: new Date().toISOString().split('T')[0], type: 'Update', isFeatured: false });
    const [newIntel, setNewIntel] = useState({ title: '', subtitle: '', url: '', date: new Date().toISOString().split('T')[0] });
    const [newMerch, setNewMerch] = useState({ name: '', price: '', link: '' });

    // Achievements State
    const [achievements, setAchievements] = useState([]);
    const [newAchievement, setNewAchievement] = useState({ title: '', subtitle: '', icon: '🏆', highlight: false });

    const addToast = useToast();

    // Fetch Data
    useEffect(() => {
        const unsubNews = onSnapshot(query(collection(db, 'news')), (snap) => {
            const n = []; snap.forEach(doc => n.push({ id: doc.id, ...doc.data() }));
            setNews(n.sort((a, b) => new Date(b.date) - new Date(a.date)));
        });
        const unsubIntel = onSnapshot(query(collection(db, 'intel')), (snap) => {
            const i = []; snap.forEach(doc => i.push({ id: doc.id, ...doc.data() }));
            setIntel(i.sort((a, b) => new Date(b.date) - new Date(a.date)));
        });
        const unsubMerch = onSnapshot(collection(db, 'merch'), (snap) => {
            const m = []; snap.forEach(doc => m.push({ id: doc.id, ...doc.data() }));
            setMerch(m);
        });
        const unsubAchieve = onSnapshot(collection(db, 'achievements'), (snap) => {
            const a = []; snap.forEach(doc => a.push({ id: doc.id, ...doc.data() }));
            setAchievements(a);
        });

        return () => { unsubNews(); unsubIntel(); unsubMerch(); unsubAchieve(); };
    }, []);

    // Handlers
    const addNews = async () => {
        if (!newNews.title || !newNews.body) return addToast('Title and Body required', 'error');
        await addDoc(collection(db, 'news'), newNews);
        setNewNews({ title: '', body: '', date: new Date().toISOString().split('T')[0], type: 'Update', isFeatured: false });
        addToast('News Posted');
    };

    const addIntel = async () => {
        if (!newIntel.title || !newIntel.url) return addToast('Title and URL required', 'error');
        await addDoc(collection(db, 'intel'), newIntel);
        setNewIntel({ title: '', subtitle: '', url: '', date: new Date().toISOString().split('T')[0] });
        addToast('Intel Added');
    };

    const addMerch = async () => {
        if (!newMerch.name || !newMerch.price) return addToast('Name and Price required', 'error');
        await addDoc(collection(db, 'merch'), newMerch);
        setNewMerch({ name: '', price: '', link: '' });
        addToast('Item Added');
    };

    const addAchievement = async () => {
        if (!newAchievement.title || !newAchievement.subtitle) return addToast('Details required', 'error');
        await addDoc(collection(db, 'achievements'), {
            ...newAchievement,
            createdAt: new Date().toISOString()
        });
        setNewAchievement({ title: '', subtitle: '', icon: '🏆', highlight: false });
        addToast('Trophy Added');
    };

    const deleteItem = async (collectionName, id) => {
        await deleteDoc(doc(db, collectionName, id));
        addToast('Item Deleted');
    };

    return (
        // UPDATED GRID CLASS HERE: grid-cols-1 md:grid-cols-2 (Creates 2x2 layout)
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">

            {/* 1. NEWS MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> SITREP</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">Post News</span>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newNews.isFeatured} onChange={e => setNewNews({ ...newNews, isFeatured: e.target.checked })} className="accent-red-600 w-3 h-3" /><span className="text-[10px] font-bold text-red-500 uppercase">Featured</span></label>
                    </div>
                    <Input placeholder="Headline" value={newNews.title} onChange={e => setNewNews({ ...newNews, title: e.target.value })} />
                    <textarea className="w-full bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-xs" rows={2} placeholder="Body..." value={newNews.body} onChange={e => setNewNews({ ...newNews, body: e.target.value })} />
                    <ButtonPrimary onClick={addNews} className="w-full py-2 text-xs">Post</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{news.map(n => (<div key={n.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-start"><div className="w-full"><div className="font-bold text-white text-xs truncate">{n.title}</div></div><button onClick={() => deleteItem('news', n.id)} className="text-neutral-500 hover:text-red-500 ml-2">×</button></div>))}</div>
            </Card>

            {/* 2. INTEL MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> INTEL</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">Add VOD</span>
                    <Input placeholder="Title" value={newIntel.title} onChange={e => setNewIntel({ ...newIntel, title: e.target.value })} />
                    <Input placeholder="URL" value={newIntel.url} onChange={e => setNewIntel({ ...newIntel, url: e.target.value })} />
                    <ButtonPrimary onClick={addIntel} className="w-full py-2 text-xs">Add</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{intel.map(i => (<div key={i.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-center"><div className="truncate text-xs text-white font-bold">{i.title}</div><button onClick={() => deleteItem('intel', i.id)} className="text-neutral-500 hover:text-red-500">×</button></div>))}</div>
            </Card>

            {/* 3. ARMORY MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> ARMORY</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase">New Item</span>
                    <Input placeholder="Name" value={newMerch.name} onChange={e => setNewMerch({ ...newMerch, name: e.target.value })} />
                    <Input placeholder="Price" value={newMerch.price} onChange={e => setNewMerch({ ...newMerch, price: e.target.value })} />
                    <ButtonPrimary onClick={addMerch} className="w-full py-2 text-xs">Add</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">{merch.map(m => (<div key={m.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-center"><div className="truncate text-xs text-white font-bold">{m.name}</div><button onClick={() => deleteItem('merch', m.id)} className="text-neutral-500 hover:text-red-500">×</button></div>))}</div>
            </Card>

            {/* 4. TROPHY MANAGER */}
            <Card className="h-full flex flex-col min-h-[400px]">
                <h3 className="text-xl font-black text-white mb-4 flex items-center gap-2"><span className="text-red-600">/</span> TROPHIES</h3>
                <div className="bg-neutral-900/50 p-4 rounded-xl border border-white/10 space-y-3 mb-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">New Achievement</span>
                        <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={newAchievement.highlight} onChange={e => setNewAchievement({ ...newAchievement, highlight: e.target.checked })} className="accent-red-600 w-3 h-3" /><span className="text-[10px] font-bold text-red-500 uppercase">Red Text</span></label>
                    </div>
                    <div className="flex gap-2">
                        <Select value={newAchievement.icon} onChange={e => setNewAchievement({ ...newAchievement, icon: e.target.value })} className="w-16 text-center text-xl">
                            {['🏆', '🥇', '🥈', '🥉', '🎖️', '⭐', '🔥', '👑'].map(icon => <option key={icon}>{icon}</option>)}
                        </Select>
                        <Input placeholder="Title (e.g. PREMIER)" value={newAchievement.title} onChange={e => setNewAchievement({ ...newAchievement, title: e.target.value })} />
                    </div>
                    <Input placeholder="Subtitle (e.g. Winner 2024)" value={newAchievement.subtitle} onChange={e => setNewAchievement({ ...newAchievement, subtitle: e.target.value })} />
                    <ButtonPrimary onClick={addAchievement} className="w-full py-2 text-xs">Add Trophy</ButtonPrimary>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {achievements.map(a => (
                        <div key={a.id} className="p-3 bg-black/40 rounded border border-neutral-800 flex justify-between items-center group">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{a.icon}</span>
                                <div>
                                    <div className={`text-xs font-black uppercase ${a.highlight ? 'text-red-500' : 'text-white'}`}>{a.title}</div>
                                    <div className="text-[10px] text-neutral-500 font-bold uppercase">{a.subtitle}</div>
                                </div>
                            </div>
                            <button onClick={() => deleteItem('achievements', a.id)} className="text-neutral-600 hover:text-red-500 px-2">×</button>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

function LoginScreen({ signIn, onBack }) {
    return (
        <div className="fixed inset-0 bg-black text-white overflow-y-auto flex items-center justify-center p-6">
            <Background />
            <button onClick={onBack} className="absolute top-4 left-4 z-20 text-neutral-400 hover:text-white font-bold uppercase text-sm">&larr; Home</button>
            <div className="relative z-10 w-full max-w-md glass-panel rounded-xl border border-red-900/30 p-8 text-center">
                <TeamLogo className="mx-auto mb-5 h-20 w-20 rounded-sm border-white/15 shadow-2xl shadow-red-950/40" />
                <div className="text-5xl font-black italic tracking-tighter mb-2">SYRIX</div>
                <p className="text-neutral-400 text-sm mb-8">Sign in with Discord to access the team hub.</p>
                <ButtonPrimary onClick={signIn} className="w-full">Sign In With Discord</ButtonPrimary>
            </div>
        </div>
    );
}

function CaptainsMessage() {
    return (
        <Card className="border-red-900/20">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div>
            <h2 className="text-xl font-bold text-white mb-3 uppercase tracking-wide">Captain's Message</h2>
            <p className="text-sm text-neutral-400 leading-relaxed">Keep availability current, review the active match plan, and log updates before practice.</p>
        </Card>
    );
}

function LeaveLogger({ members, rosterName }) {
    const [selectedMember, setSelectedMember] = useState(rosterName || '');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        if (rosterName) setSelectedMember(rosterName);
    }, [rosterName]);

    const submitLeave = async () => {
        if (!selectedMember || !note.trim()) return addToast('Select a member and add a note', 'error');
        setSaving(true);
        try {
            await addDoc(collection(db, 'leave_logs'), {
                member: selectedMember,
                note: note.trim(),
                createdAt: new Date().toISOString()
            });
            setNote('');
            addToast('Leave note logged');
        } catch (error) {
            console.error('Leave log failed:', error);
            addToast('Unable to log leave note', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="border-red-900/20">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div>
            <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-wide">Leave Logger</h2>
            <div className="space-y-3">
                <Select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}>
                    <option value="">Select member</option>
                    {members.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full min-h-24 bg-black/40 border border-neutral-800 rounded-xl p-3 text-white text-sm outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder-neutral-600 resize-y"
                    placeholder="Reason, dates, or availability note"
                />
                <ButtonSecondary onClick={submitLeave} className="w-full text-xs" disabled={saving}>{saving ? 'Logging...' : 'Log Note'}</ButtonSecondary>
            </div>
        </Card>
    );
}

function ScrimScheduler({ onSchedule, userTimezone }) {
    const [form, setForm] = useState({
        type: 'Scrim',
        opponent: '',
        map: 'TBD',
        date: new Date().toISOString().split('T')[0],
        time: '20:00',
        timezone: userTimezone || 'GMT'
    });
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        setForm(prev => ({ ...prev, timezone: userTimezone || prev.timezone }));
    }, [userTimezone]);

    const submit = async () => {
        if (!form.opponent.trim() || !form.date || !form.time) return addToast('Opponent, date, and time are required', 'error');
        setSaving(true);
        try {
            await onSchedule({
                ...form,
                opponent: form.opponent.trim(),
                createdAt: new Date().toISOString()
            });
            setForm(prev => ({ ...prev, opponent: '' }));
        } catch (error) {
            console.error('Schedule failed:', error);
            addToast('Unable to schedule event', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-3">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                <option value="Scrim">Scrim</option>
                <option value="Official">Official</option>
                <option value="Practice">Practice</option>
                <option value="VOD Review">VOD Review</option>
            </Select>
            <Input placeholder="Opponent or topic" value={form.opponent} onChange={e => setForm({ ...form, opponent: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}>
                    <option value="TBD">TBD</option>
                    {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="[color-scheme:dark]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="[color-scheme:dark]" />
                <Select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                    {timezones.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
            </div>
            <ButtonPrimary onClick={submit} disabled={saving} className="w-full text-xs py-3">{saving ? 'Scheduling...' : 'Schedule Event'}</ButtonPrimary>
        </div>
    );
}

function SyrixDashboard({ onBack }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [rosterName, setRosterName] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [availabilities, setAvailabilities] = useState({});
    const [events, setEvents] = useState([]);
    const [day, setDay] = useState(DAYS[0]);
    const [start, setStart] = useState('12:00');
    const [end, setEnd] = useState('23:30');
    const [role, setRole] = useState('Flex');
    const [saveStatus, setSaveStatus] = useState('idle');
    const [userTimezone, setUserTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [authLoading, setAuthLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', children: null });
    const [isMember, setIsMember] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState('');
    const [adminAccess, setAdminAccess] = useState(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const addToast = useToast();
    const [allRosterNames, setAllRosterNames] = useState([]);
    const [openTaskCount, setOpenTaskCount] = useState(0);

    useEffect(() => { return onAuthStateChanged(auth, user => { setCurrentUser(user); setAuthLoading(false); }); }, []);
    const signIn = async () => { try { await signInWithPopup(auth, new OAuthProvider('oidc.discord')); } catch (e) { console.error(e); } };
    const handleSignOut = async () => await signOut(auth);

    useEffect(() => {
        if (!currentUser) {
            setAdminAccess(null);
            return;
        }
        return onSnapshot(doc(db, 'admin_users', currentUser.uid), (snapshot) => {
            if (snapshot.exists() && snapshot.data().active !== false) {
                setAdminAccess({ id: snapshot.id, ...snapshot.data() });
                setIsMember(true);
            } else {
                setAdminAccess(null);
            }
        });
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser) return;

        // Listener 1: Get Current User's Profile (Existing logic)
        const memberQuery = query(collection(db, 'roster'), where("uid", "==", currentUser.uid));
        const unsub1 = onSnapshot(memberQuery, (snapshot) => {
            if (!snapshot.empty) {
                const profile = snapshot.docs[0].data();
                setRosterName(snapshot.docs[0].id);
                setCurrentUserRole(profile.role || '');
                setIsMember(true);
            } else {
                setIsMember(ADMIN_UIDS.includes(currentUser.uid) || (adminAccess && ADMIN_ACCESS_ROLES.includes(adminAccess.role)));
                setRosterName(currentUser.displayName);
                setCurrentUserRole('');
            }
        });

        // Listener 2: Get Availabilities (Existing logic)
        const unsub2 = onSnapshot(collection(db, 'availabilities'), (s) => {
            const d = {};
            s.forEach(doc => d[doc.id] = normalizeAvailabilitySlots(doc.data()));
            setAvailabilities(d);
        });

        // Listener 3: Get Events (Existing logic)
        const unsub3 = onSnapshot(collection(db, 'events'), (s) => {
            const e = [];
            s.forEach(d => e.push({ id: d.id, ...d.data() }));

            const now = new Date().setHours(0, 0, 0, 0);

            // Filter out past events and events that already have scores/results
            const upcomingOnly = e.filter(ev => {
                const eventDate = new Date(ev.date).getTime();
                return eventDate >= now && !ev.result;
            });

            setEvents(upcomingOnly.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time)));
        });

        // --- NEW LISTENER 4: FETCH ALL ROSTER NAMES ---
        // This ensures members show up even if they haven't set availability yet
        const unsub4 = onSnapshot(collection(db, 'roster'), (s) => {
            const names = [];
            s.forEach(doc => names.push(doc.id));
            setAllRosterNames(names);
        });

        const unsub5 = onSnapshot(collection(db, 'tasks'), (s) => {
            let count = 0;
            s.forEach(task => { if (!task.data().done) count += 1; });
            setOpenTaskCount(count);
        });

        return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
    }, [currentUser, adminAccess]);

    // 3. UPDATE dynamicMembers TO USE THE ROSTER LIST
    // Replace the old dynamicMembers line with this:
    const dynamicMembers = useMemo(() => {
        // Combine roster names AND availability names (just in case) and remove duplicates
        return [...new Set([...allRosterNames, ...Object.keys(availabilities)])].sort();
    }, [allRosterNames, availabilities]);

    const currentMemberName = safeDocId(rosterName || currentUser?.displayName || currentUser?.uid, 'Guest');

    // Process Availability for display
    const displayAvail = useMemo(() => {
        const c = {};
        for (const m in availabilities) {
            c[m] = [];
            availabilities[m].forEach(s => {
                const ls = convertFromGMT(s.day, s.start, userTimezone);
                const le = convertFromGMT(s.day, s.end, userTimezone);
                if (ls.day === le.day) {
                    if (timeToMinutes(ls.time) < timeToMinutes(le.time)) c[m].push({ day: ls.day, start: ls.time, end: le.time, role: s.role });
                } else {
                    c[m].push({ day: ls.day, start: ls.time, end: '24:00', role: s.role });
                    if (timeToMinutes(le.time) > 0) c[m].push({ day: le.day, start: '00:00', end: le.time, role: s.role });
                }
            });
        }
        return c;
    }, [availabilities, userTimezone]);

    useEffect(() => {
        const currentDaySlot = (displayAvail[currentMemberName] || []).find(s => s.day === day);
        if (!currentDaySlot) {
            setStart('12:00');
            setEnd('23:30');
            setRole('Flex');
            return;
        }
        setStart(currentDaySlot.start === '24:00' ? '23:59' : currentDaySlot.start);
        setEnd(currentDaySlot.end === '24:00' ? '23:59' : currentDaySlot.end);
        setRole(currentDaySlot.role || 'Flex');
    }, [currentMemberName, day, displayAvail]);

    const openModal = (t, c, f) => { setModalContent({ title: t, children: c, onConfirm: f }); setIsModalOpen(true); };

    const saveAvail = async () => {
        if (!currentUser) return;
        if (!start || !end) return addToast('Start and end times are required', 'error');
        if (start === end) return addToast('Start and end times cannot match', 'error');

        const finalName = currentMemberName;
        const gmtStart = convertToGMT(day, start, userTimezone);
        const gmtEnd = convertToGMT(day, end, userTimezone);
        const existing = availabilities[finalName] || [];
        const nextSlots = [
            ...existing.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day),
            { day: gmtStart.day, start: gmtStart.time, end: gmtEnd.time, role }
        ];

        setSaveStatus('saving');
        try {
            await setDoc(doc(db, 'availabilities', finalName), {
                name: finalName,
                uid: currentUser.uid,
                slots: nextSlots,
                lastUpdated: new Date().toISOString(),
                timezone: userTimezone
            }, { merge: true });

            addToast('Availability synced');
        } catch (e) {
            console.error('Error saving availability:', e);
            addToast('Failed to sync availability', 'error');
        } finally {
            setSaveStatus('idle');
        }
    };

    const clearDay = async () => {
        const finalName = currentMemberName;
        const old = availabilities[finalName] || [];
        await setDoc(doc(db, 'availabilities', finalName), {
            name: finalName,
            uid: currentUser.uid,
            slots: old.filter(s => convertFromGMT(s.day, s.start, userTimezone).day !== day),
            lastUpdated: new Date().toISOString(),
            timezone: userTimezone
        }, { merge: true });
        setIsModalOpen(false);
        addToast(`Cleared ${day}`);
    };
    const schedEvent = async (d) => { await addDoc(collection(db, 'events'), d); await writeAuditLog('Event scheduled', `${d.type || 'Event'} vs ${d.opponent || 'TBD'}`, currentMemberName); addToast('Event Scheduled'); };
    const deleteEvent = async (id) => { await deleteDoc(doc(db, 'events', id)); await writeAuditLog('Event deleted', id, currentMemberName); setIsModalOpen(false); addToast('Event Deleted'); };

    if (authLoading) return <div className="fixed inset-0 bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>;

    // If not logged in, show Login Screen
    if (!currentUser) return <LoginScreen signIn={signIn} onBack={onBack} />;

    // If logged in but not a member, show Application
    if (!isMember) return (
        <div className="fixed inset-0 bg-black p-8 overflow-y-auto">
            <div className="absolute top-4 left-4 z-50">
                <button onClick={onBack} className="text-white font-bold uppercase hover:text-red-500 transition">&larr; Home</button>
            </div>
            <div className="relative z-10 pt-12"><ApplicationForm currentUser={currentUser} /></div>
        </div>
    );

    const isRosterManager = ADMIN_ROLES.includes(currentUserRole);
    const dbAdminRole = adminAccess?.active === false ? '' : adminAccess?.role;
    const isDbAdmin = ADMIN_ACCESS_ROLES.includes(dbAdminRole);
    const isAdmin = currentUser && (ADMIN_UIDS.includes(currentUser.uid) || isRosterManager || isDbAdmin);
    const accessLabel = ADMIN_UIDS.includes(currentUser.uid) ? 'Owner' : dbAdminRole || (isRosterManager ? 'Manager' : 'Member');
    const navGroups = [
        { label: 'Command', items: [{ id: 'dashboard', label: 'Dashboard' }, { id: 'calendar', label: 'Calendar' }, { id: 'notifications', label: 'Notifications' }, { id: 'announcements', label: 'Announcements' }, { id: 'tasks', label: 'Tasks' }] },
        { label: 'Team', items: [{ id: 'roster', label: 'Roster' }, { id: 'availability', label: 'Availability' }, { id: 'matches', label: 'Matches' }] },
        { label: 'Valorant', items: [{ id: 'practice', label: 'Practice' }, { id: 'strats', label: 'Stratbook' }, { id: 'stratlibrary', label: 'Strat Library' }, { id: 'comps', label: 'Comps' }, { id: 'prep', label: 'Match Prep' }, { id: 'mapveto', label: 'Map Veto' }] },
        { label: 'Library', items: [{ id: 'lineups', label: 'Lineups' }, { id: 'playbook', label: 'Playbook' }] },
        ...(isAdmin ? [{ label: 'Admin', items: [{ id: 'playernotes', label: 'Player Notes' }, { id: 'content', label: 'Content' }, { id: 'partners', label: 'Partners' }, { id: 'audit', label: 'Audit Log' }, { id: 'admin', label: 'Admin Panel' }] }] : [])
    ];
    const flatNav = navGroups.flatMap(group => group.items);
    const activeLabel = flatNav.find(item => item.id === activeTab)?.label || 'Dashboard';
    const nextEvent = events[0];
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: userTimezone });
    const availableToday = dynamicMembers.filter(member => (displayAvail[member] || []).some(slot => slot.day === todayName)).length;
    const pageMeta = {
        dashboard: 'Overview, next operation, quick actions, and team status.',
        calendar: 'View upcoming scrims, officials, practices, and VOD reviews by month.',
        notifications: 'Track upcoming events, due tasks, and pinned announcements.',
        announcements: 'Post captain messages, urgent updates, and team-wide comms.',
        availability: 'Edit your weekly availability and inspect the team schedule.',
        matches: 'Record match results, reports, VODs, and performance context.',
        roster: 'Manage member profiles, roles, ranks, and roster notes.',
        practice: 'Build practice blocks with maps, goals, drills, links, and assigned players.',
        playbook: 'Write map-specific protocols for attack and defense.',
        comps: 'Build and save team compositions by map.',
        strats: 'Plan rounds visually with agents, utility, paths, and saved strats.',
        stratlibrary: 'Review app-made strategies and uploaded ValoPlant images by map and side.',
        lineups: 'Store lineup media and map pins for fast review.',
        mapveto: 'Track pick, ban, and comfort status for the active map pool.',
        prep: 'Create opponent files with veto plans, comps, win conditions, and review notes.',
        tasks: 'Assign and clear team action items for practice, matchday, and admin work.',
        playernotes: 'Private coaching notes, player ratings, and improvement plans.',
        content: 'Manage public site news, merch, achievements, and media.',
        partners: 'Track partner contacts and sponsorship notes.',
        audit: 'Review a timeline of important operational changes.',
        admin: 'Review applications and schedule operations.'
    };
    const navBadge = (id) => {
        if (id === 'availability') return availableToday ? String(availableToday) : '';
        if (id === 'calendar') return events.length ? String(events.length) : '';
        if (id === 'notifications') return (events.length + openTaskCount) ? String(events.length + openTaskCount) : '';
        if (id === 'matches') return events.length ? String(events.length) : '';
        if (id === 'roster') return dynamicMembers.length ? String(dynamicMembers.length) : '';
        if (id === 'tasks') return openTaskCount ? String(openTaskCount) : '';
        return '';
    };
    const NavItem = ({ item, compact = false, collapsed = false }) => (
        <button
            onClick={() => setActiveTab(item.id)}
            title={item.label}
            className={`${compact ? 'px-3 py-2 text-[10px]' : collapsed ? 'w-full px-2 py-2.5 text-[10px] justify-center' : 'w-full px-3 py-2.5 text-xs'} text-left font-black uppercase tracking-[0.16em] transition-all border flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3 ${activeTab === item.id ? 'bg-red-600 text-white border-red-500' : 'bg-transparent text-neutral-500 border-transparent hover:text-white hover:bg-white/5 hover:border-white/10'}`}
        >
            <span>{collapsed ? item.label.slice(0, 2) : item.label}</span>
            {!collapsed && navBadge(item.id) && <span className={`text-[9px] px-1.5 py-0.5 border ${activeTab === item.id ? 'border-white/30 bg-black/20 text-white' : 'border-white/10 bg-white/5 text-neutral-400'}`}>{navBadge(item.id)}</span>}
        </button>
    );

    return (
        <div className="fixed inset-0 h-full w-full text-neutral-200 font-sans selection:bg-red-500/30 flex overflow-hidden bg-[#050608]">
            <Background />

            <aside className={`relative z-40 hidden lg:flex ${sidebarCollapsed ? 'w-20' : 'w-72'} flex-none flex-col border-r border-white/10 bg-[#080a0f]/92 backdrop-blur-xl transition-[width] duration-200`}>
                <div className={`${sidebarCollapsed ? 'p-3' : 'p-5'} border-b border-white/10`}>
                    <button onClick={onBack} className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} text-white hover:text-red-400 transition w-full`}>
                        <TeamLogo className="h-10 w-10 rounded-sm shadow-lg shadow-red-950/30" />
                        {!sidebarCollapsed && <span className="text-2xl font-black tracking-tight italic">SYRIX</span>}
                    </button>
                    <button onClick={() => setSidebarCollapsed(value => !value)} className="mt-3 w-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white py-2 text-[10px] font-black uppercase tracking-widest">
                        {sidebarCollapsed ? 'Open' : 'Collapse'}
                    </button>
                    {!sidebarCollapsed && <div className="mt-5 grid grid-cols-2 gap-2">
                        <div className="bg-black/35 border border-white/10 p-3">
                            <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black">Access</div>
                            <div className="mt-1 text-sm font-black text-white">{accessLabel}</div>
                        </div>
                        <div className="bg-black/35 border border-white/10 p-3">
                            <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-black">Members</div>
                            <div className="mt-1 text-sm font-black text-white">{dynamicMembers.length}</div>
                        </div>
                    </div>}
                </div>

                <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'p-2 space-y-3' : 'p-4 space-y-6'} custom-scrollbar`}>
                    {navGroups.map(group => (
                        <div key={group.label}>
                            {!sidebarCollapsed && <div className="px-3 mb-2 text-[10px] uppercase tracking-[0.24em] text-neutral-600 font-black">{group.label}</div>}
                            <div className="space-y-1">
                                {group.items.map(item => <NavItem key={item.id} item={item} collapsed={sidebarCollapsed} />)}
                            </div>
                        </div>
                    ))}
                </nav>

                {!sidebarCollapsed ? <div className="p-4 border-t border-white/10">
                    <div className="mb-3 bg-red-950/20 border border-red-900/35 p-3">
                        <div className="text-[9px] uppercase tracking-[0.22em] text-red-400 font-black">Next Operation</div>
                        <div className="mt-2 text-xs font-black text-white uppercase leading-snug">{nextEvent ? `${nextEvent.type || 'Event'} vs ${nextEvent.opponent || 'TBD'}` : 'No event scheduled'}</div>
                        <div className="mt-1 text-[10px] text-neutral-500">{nextEvent ? `${nextEvent.date || 'Date TBD'} @ ${nextEvent.time || 'Time TBD'}` : 'Create one from Dashboard or Admin.'}</div>
                    </div>
                    <div className="bg-black/40 border border-white/10 p-4">
                        <div className="text-sm font-black text-white truncate">{rosterName || currentUser.displayName || 'Guest'}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500">Signed in</div>
                        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                            <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); }} className="min-w-0 bg-black/60 border border-neutral-800 text-xs p-2 text-neutral-400 backdrop-blur-sm">{timezones.map(t => <option key={t} value={t}>{t}</option>)}</select>
                            <button onClick={handleSignOut} className="bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] px-3">Out</button>
                        </div>
                    </div>
                </div> : <div className="p-2 border-t border-white/10"><button onClick={handleSignOut} className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] py-2">Out</button></div>}
            </aside>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col">
            <header className="flex-none border-b border-white/10 bg-[#080a0f]/88 backdrop-blur-xl">
                <div className="flex justify-between items-center px-4 md:px-6 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onBack} className="lg:hidden text-neutral-500 hover:text-white transition">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                        <div>
                            <div className="text-[10px] uppercase tracking-[0.24em] text-red-400 font-black">Command Center</div>
                            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">{activeLabel}</h1>
                            <p className="hidden sm:block mt-0.5 text-xs text-neutral-500 max-w-xl">{pageMeta[activeTab]}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden md:block">
                            <div className="text-sm font-bold text-white">
                                {rosterName || currentUser.displayName || 'Guest'}
                            </div>
                            <button onClick={handleSignOut} className="text-[10px] text-red-500 font-bold uppercase">Log Out</button>
                        </div>                        <select value={userTimezone} onChange={e => { setUserTimezone(e.target.value); }} className="bg-black/50 border border-neutral-800 text-xs p-2 text-neutral-400 backdrop-blur-sm max-w-40">{timezones.map(t => <option key={t} value={t}>{t}</option>)}</select>
                    </div>
                </div>
                <div className="lg:hidden flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide mask-fade">
                    {flatNav.map(item => <NavItem key={item.id} item={item} compact />)}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-red-900/50 scrollbar-track-black/20">
                <div className="max-w-[1920px] mx-auto min-h-screen flex flex-col">
                    {activeTab === 'dashboard' && <div className="animate-fade-in space-y-6"><div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4"><div className="glass-panel rounded-xl p-6 border-white/10 overflow-hidden"><div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Today Command</div><h2 className="text-4xl md:text-5xl font-black text-white uppercase italic leading-none">Ready Room</h2><p className="mt-4 text-sm text-neutral-400 max-w-2xl">Review the next operation, keep team notes current, and jump into planning before practice starts.</p><div className="mt-6 flex flex-wrap gap-2"><button onClick={() => setActiveTab('strats')} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-xs font-black uppercase tracking-widest">Open Planner</button><button onClick={() => setActiveTab('matches')} className="bg-white/10 hover:bg-white/15 border border-white/10 text-white px-4 py-2 text-xs font-black uppercase tracking-widest">Match Logs</button><button onClick={() => setActiveTab('tasks')} className="bg-white/10 hover:bg-white/15 border border-white/10 text-white px-4 py-2 text-xs font-black uppercase tracking-widest">Tasks</button><button onClick={() => setActiveTab('roster')} className="bg-white/10 hover:bg-white/15 border border-white/10 text-white px-4 py-2 text-xs font-black uppercase tracking-widest">Roster</button></div></div><div className="glass-panel rounded-xl p-6 border-white/10"><div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-4">Next Operation</div><div className="text-2xl font-black text-white uppercase italic leading-tight">{nextEvent ? `${nextEvent.type || 'Event'} vs ${nextEvent.opponent || 'TBD'}` : 'No Event Scheduled'}</div><div className="mt-3 text-sm text-neutral-400">{nextEvent ? `${nextEvent.date || 'Date TBD'} @ ${nextEvent.time || 'Time TBD'} ${nextEvent.timezone || ''}` : 'Use Event Operations to schedule the next practice, scrim, or official.'}</div><div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-2 gap-3"><div><div className="text-3xl font-black text-white">{dynamicMembers.length}</div><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Members</div></div><div><div className="text-3xl font-black text-white">{events.length}</div><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Upcoming</div></div></div></div></div><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div className="glass-panel rounded-xl p-4 border-white/10"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Members</div><div className="mt-2 text-3xl font-black text-white">{dynamicMembers.length}</div></div><div className="glass-panel rounded-xl p-4 border-white/10"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Events</div><div className="mt-2 text-3xl font-black text-white">{events.length}</div></div><div className="glass-panel rounded-xl p-4 border-white/10"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Timezone</div><div className="mt-2 text-sm font-bold text-white truncate">{userTimezone}</div></div><div className="glass-panel rounded-xl p-4 border-white/10"><div className="text-[10px] uppercase tracking-widest text-neutral-500 font-black">Access</div><div className="mt-2 text-sm font-bold text-white">{accessLabel}</div></div></div><div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 space-y-8">
                            <CaptainsMessage />
                            <Card className="border-red-900/20"><div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Event Operations</h2><ScrimScheduler onSchedule={schedEvent} userTimezone={userTimezone} /></Card>
                        </div>
                        <div className="lg:col-span-8 space-y-8">
                            <Card><h2 className="text-lg font-bold text-white mb-4 flex justify-between items-center uppercase tracking-wide"><span>Upcoming Events</span><span className="text-[10px] bg-red-900/30 text-red-400 border border-red-900/50 px-2 py-1 rounded font-bold">{events.length} ACTIVE</span></h2><div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700">{events.length > 0 ? events.map(ev => (<div key={ev.id} className="p-3 bg-black/40 rounded-xl border border-neutral-800 flex justify-between items-center group hover:border-red-900/50 transition-colors"><div><div className="font-bold text-white text-sm group-hover:text-red-400 transition-colors">{ev.type} <span className="text-neutral-500">vs</span> {ev.opponent || 'TBD'}</div><div className="text-xs text-neutral-400 mt-1">{ev.date} @ <span className="text-white font-mono">{ev.time}</span></div></div><button onClick={() => openModal('Delete Event', 'Remove?', () => deleteEvent(ev.id))} className="text-neutral-600 hover:text-red-500">×</button></div>)) : <div className="p-6 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No active events scheduled.</div>}</div></Card>
                            <PerformanceWidget events={events} />
                        </div>
                    </div></div>}
                    {activeTab === 'calendar' && <TeamCalendar events={events} />}
                    {activeTab === 'notifications' && <NotificationCenter events={events} />}
                    {activeTab === 'announcements' && <Announcements currentUserName={rosterName || currentUser.displayName || 'Unknown'} />}
                    {activeTab === 'availability' && <div className="animate-fade-in space-y-6"><div className="grid grid-cols-1 xl:grid-cols-[0.7fr_1.3fr] gap-6"><div className="space-y-6"><Card className="border-red-900/20"><div className="absolute top-0 left-0 w-1 h-full bg-red-600/50"></div><div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Your Week</div><h2 className="text-2xl font-black text-white uppercase italic mb-5">Availability Editor</h2><div className="space-y-4"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Day</label><Select value={day} onChange={e => setDay(e.target.value)}>{DAYS.map(d => <option key={d} value={d}>{d}</option>)}</Select><div className="mt-2 text-[11px] text-neutral-500">Editing availability for <span className="text-neutral-300 font-bold">{currentMemberName}</span> in <span className="text-neutral-300 font-bold">{userTimezone}</span>.</div></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Start</label><Input type="time" value={start} onChange={e => setStart(e.target.value)} className="[color-scheme:dark]" /></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">End</label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} className="[color-scheme:dark]" /></div></div><div><label className="text-[10px] font-black text-red-500 uppercase mb-1 block">Pref. Role</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{ROLES.map(r => (<button key={r} onClick={() => setRole(r)} className={`px-3 py-2 rounded-lg text-xs font-black border transition-all whitespace-nowrap flex items-center justify-center ${role === r ? 'bg-red-600 text-white border-red-500' : 'bg-black/50 border-neutral-800 text-neutral-500 hover:text-white'}`}>{ROLE_ABBREVIATIONS[r] || r}</button>))}</div></div><div className="pt-2 flex gap-2"><ButtonPrimary onClick={saveAvail} disabled={saveStatus !== 'idle'} className="flex-1">{saveStatus === 'idle' ? 'Save Slot' : 'Saving...'}</ButtonPrimary><ButtonSecondary onClick={() => openModal('Clear Day', `Clear all for ${day}?`, clearDay)}>Clear</ButtonSecondary></div></div></Card><LeaveLogger members={dynamicMembers} rosterName={rosterName} /></div><div className="space-y-6"><div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><Card><h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wide">Team Heatmap</h2><AvailabilityHeatmap availabilities={displayAvail} members={dynamicMembers} /></Card><Card><div className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-black mb-3">Today</div><div className="text-4xl font-black text-white">{availableToday}/{dynamicMembers.length}</div><div className="mt-2 text-sm text-neutral-400">members have availability logged for {todayName}.</div><div className="mt-5 pt-4 border-t border-white/10 text-xs text-neutral-500">Keep this current before scrims so captains can plan realistic blocks.</div></Card></div><Card><h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wide">Weekly Timeline <span className="text-neutral-500 text-sm normal-case">({userTimezone})</span></h2><div className="overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700"><table className="w-full text-left border-collapse min-w-[600px]"><thead><tr className="border-b border-neutral-800"><th className="p-3 text-xs font-bold text-neutral-500 uppercase tracking-wider w-32">Team Member</th>{SHORT_DAYS.map(day => (<th key={day} className="p-3 text-xs font-bold text-red-600 uppercase tracking-wider text-center border-l border-neutral-800">{day}</th>))}</tr></thead><tbody className="divide-y divide-neutral-800/50">{dynamicMembers.map(member => (<tr key={member} className="hover:bg-neutral-800/30 transition-colors group"><td className="p-4 font-bold text-white text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-red-500/50 shadow-sm"></div>{member}</td>{DAYS.map((day) => { const slots = (displayAvail[member] || []).filter(s => s.day === day); return (<td key={day} className="p-2 align-middle border-l border-neutral-800/50"><div className="flex flex-col gap-1 items-center justify-center">{slots.length > 0 ? slots.map((s, i) => (<div key={i} className="bg-gradient-to-br from-red-600 to-red-700 text-white text-[10px] font-bold px-2 py-1 rounded w-full text-center shadow-md whitespace-nowrap flex items-center justify-center gap-1">{s.start}-{s.end}<span className="opacity-75 ml-1 text-[9px] border border-white/20 px-1 rounded bg-black/20">{ROLE_ABBREVIATIONS[s.role] || s.role}</span></div>)) : <div className="h-1 w-4 bg-neutral-800 rounded-full"></div>}</div></td>); })}</tr>))}</tbody></table></div></Card></div></div></div>}
                    {activeTab === 'practice' && <PracticePlanner members={dynamicMembers} currentUserName={rosterName || currentUser.displayName || 'Unknown'} />}
                    {activeTab === 'playbook' && <div className="animate-fade-in h-[80vh]"><Playbook /></div>}
                    {activeTab === 'comps' && <div className="animate-fade-in h-full"><TeamComps members={dynamicMembers} /></div>}
                    {activeTab === 'matches' && <div className="animate-fade-in"><MatchHistory currentUser={currentUser} members={dynamicMembers} /></div>}
                    {activeTab === 'strats' && <div className="animate-fade-in h-[85vh]"><StratBook /></div>}
                    {activeTab === 'stratlibrary' && <StratLibrary />}
                    {activeTab === 'lineups' && <div className="animate-fade-in h-[85vh]"><LineupLibrary /></div>}
                    {activeTab === 'roster' && <div className="animate-fade-in h-full flex-1 flex flex-col"><RosterManager members={dynamicMembers} events={events} canManageRoster={isAdmin} /></div>}
                    {activeTab === 'prep' && <MatchPrep members={dynamicMembers} events={events} currentUserName={rosterName || currentUser.displayName || 'Unknown'} />}
                    {activeTab === 'tasks' && <ActionItems members={dynamicMembers} />}
                    {activeTab === 'playernotes' && isAdmin && <PlayerAdminNotes members={dynamicMembers} currentUserName={rosterName || currentUser.displayName || 'Admin'} />}
                    {activeTab === 'partners' && isAdmin && <div className="animate-fade-in h-full"><PartnerDirectory /></div>}
                    {activeTab === 'content' && isAdmin && <div className="animate-fade-in h-full"><ContentManager /></div>}
                    {activeTab === 'audit' && isAdmin && <AuditLog />}
                    {activeTab === 'admin' && isAdmin && <div className="animate-fade-in h-full"><AdminPanel /></div>}
                    {activeTab === 'mapveto' && <div className="animate-fade-in h-[80vh]"><MapVeto /></div>}

                </div>
            </main>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onConfirm={modalContent.onConfirm} title={modalContent.title}>{modalContent.children}</Modal>
        </div>
    );
}

// ==========================================
// ROOT APP COMPONENT (CONTROLLER)
// ==========================================
export default function App() {
    // State to toggle between Landing Page ('landing') and Team Hub ('hub')
    const [currentView, setCurrentView] = useState('landing');

    useEffect(() => {
        document.title = currentView === 'landing'
            ? "SYRIX | Official Team Portal"
            : "SYRIX | Command Center";
    }, [currentView]);

    return (
        <ToastProvider>
            <GlobalStyles />
            {currentView === 'landing' ? (
                <LandingPage onEnterHub={() => setCurrentView('hub')} />
            ) : (
                <SyrixDashboard onBack={() => setCurrentView('landing')} />
            )}
        </ToastProvider>
    );
}

//
