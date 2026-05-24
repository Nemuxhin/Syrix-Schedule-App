import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { DEFAULT_TEAM_ID, STAFF_ACCESS_ROLES, MAPS, timezones } from '../../lib/constants';
import { db } from '../../lib/firebase';
import { safeDocId, teamMatches, writeAuditLog } from '../../lib/utils';
import { ButtonPrimary, ButtonSecondary, Card, Input, Select } from '../shared';
import { useToast } from '../../hooks/useToast';

export const AdminPanel = ({ activeTeam, teams = [], onSelectTeam, onCreateTeam }) => {
    const activeTeamId = activeTeam?.id || DEFAULT_TEAM_ID;
    const [form, setForm] = useState({
        type: 'Scrim',
        opponent: '',
        map: MAPS[0],
        date: new Date().toISOString().split('T')[0],
        time: '20:00',
        timezone: 'GMT'
    });
    const [applications, setApplications] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);
    const [adminForm, setAdminForm] = useState({ uid: '', name: '', role: 'Manager' });
    const [teamForm, setTeamForm] = useState({ name: '', id: '', color: '#2563eb' });
    const [saving, setSaving] = useState(false);
    const addToast = useToast();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'applications'), (snap) => {
            const rows = [];
            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                if (teamMatches(data, activeTeamId)) rows.push(data);
            });
            setApplications(rows.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0)));
        });
        const unsubAdmins = onSnapshot(collection(db, 'admin_users'), (snap) => {
            const rows = [];
            snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
            setAdminUsers(rows.sort((a, b) => (a.role || '').localeCompare(b.role || '') || (a.name || a.id).localeCompare(b.name || b.id)));
        });
        return () => { unsub(); unsubAdmins(); };
    }, [activeTeamId]);

    const submit = async () => {
        if (!form.opponent.trim() || !form.date || !form.time) {
            addToast('Opponent/topic, date, and time are required', 'error');
            return;
        }

        setSaving(true);
        try {
            await addDoc(collection(db, 'events'), {
                ...form,
                teamId: activeTeamId,
                opponent: form.opponent.trim(),
                createdAt: new Date().toISOString()
            });
            setForm(prev => ({ ...prev, opponent: '' }));
            addToast('Event scheduled');
        } catch (error) {
            console.error('Schedule event failed:', error);
            addToast('Unable to schedule event', 'error');
        } finally {
            setSaving(false);
        }
    };

    const approveApplication = async (application) => {
        const memberName = safeDocId(application.user || application.ign || application.displayName);
        try {
            await setDoc(doc(db, 'roster', memberName), {
                uid: application.uid || '',
                teamId: activeTeamId,
                role: 'Tryout',
                rank: application.rank || 'Unranked',
                ingameRole: application.role || 'Flex',
                gameId: application.ign || application.user || '',
                notes: application.why || application.exp || '',
                joinedAt: new Date().toISOString()
            }, { merge: true });
            await deleteDoc(doc(db, 'applications', application.id));
            addToast(`${memberName} approved`);
        } catch (error) {
            console.error('Approve application failed:', error);
            addToast('Unable to approve application', 'error');
        }
    };

    const rejectApplication = async (id) => {
        try {
            await deleteDoc(doc(db, 'applications', id));
            addToast('Application removed');
        } catch (error) {
            console.error('Reject application failed:', error);
            addToast('Unable to remove application', 'error');
        }
    };

    const saveAdminUser = async () => {
        const uid = adminForm.uid.trim();
        if (!uid) return addToast('UID is required', 'error');
        if (!STAFF_ACCESS_ROLES.includes(adminForm.role)) return addToast('Choose a valid access role', 'error');
        try {
            await setDoc(doc(db, 'admin_users', uid), {
                uid,
                name: adminForm.name.trim() || uid,
                role: adminForm.role,
                active: true,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            await writeAuditLog('Admin access granted', `${adminForm.role} access for ${adminForm.name.trim() || uid}`, 'Admin Panel');
            setAdminForm({ uid: '', name: '', role: 'Manager' });
            addToast('Admin access updated');
        } catch (error) {
            console.error('Admin access update failed:', error);
            addToast('Unable to update admin access', 'error');
        }
    };

    const createTeam = async () => {
        if (!onCreateTeam) return;
        await onCreateTeam(teamForm);
        setTeamForm({ name: '', id: '', color: '#2563eb' });
    };

    const removeAdminUser = async (entry) => {
        try {
            await updateDoc(doc(db, 'admin_users', entry.id), {
                active: false,
                removedAt: new Date().toISOString()
            });
            await writeAuditLog('Admin access revoked', `${entry.role || 'Admin'} access for ${entry.name || entry.id}`, 'Admin Panel');
            addToast('Admin access revoked');
        } catch (error) {
            console.error('Admin access revoke failed:', error);
            addToast('Unable to revoke admin access', 'error');
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-3">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                    <div>
                        <div className="text-[10px] uppercase tracking-[0.28em] text-red-400 font-black mb-3">Team Hubs</div>
                        <h3 className="text-2xl font-black text-white uppercase italic">Manage Squad Spaces</h3>
                        <p className="mt-2 text-sm text-neutral-400">Switch the active admin context or create another Syrix team hub. Old data without a team is treated as Syrix Red.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {teams.map(team => (
                            <button
                                key={team.id}
                                onClick={() => onSelectTeam?.(team.id)}
                                className={`px-4 py-2 rounded-lg border text-xs font-black uppercase tracking-widest ${team.id === activeTeamId ? 'bg-white text-black border-white' : 'bg-black/40 border-white/10 text-neutral-400 hover:text-white'}`}
                            >
                                {team.name || team.id}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_12rem_9rem_auto] gap-3">
                    <Input placeholder="Team name, e.g. Syrix Blue" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />
                    <Input placeholder="team-id" value={teamForm.id} onChange={e => setTeamForm({ ...teamForm, id: e.target.value })} />
                    <Input type="color" value={teamForm.color} onChange={e => setTeamForm({ ...teamForm, color: e.target.value })} className="h-11 p-1" />
                    <ButtonPrimary onClick={createTeam} className="text-xs py-3">Create Team</ButtonPrimary>
                </div>
            </Card>

            <Card>
                <h3 className="text-xl font-black text-white uppercase mb-1">Schedule Event</h3>
                <div className="mb-4 text-xs text-neutral-500">Posting to {activeTeam?.name || 'Syrix Red'}</div>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-red-500 block mb-1">EVENT TYPE</label>
                        <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            <option value="Scrim">Scrim</option>
                            <option value="Official">Official</option>
                            <option value="Practice">Practice</option>
                            <option value="VOD Review">VOD Review</option>
                            <option value="Meeting">Meeting</option>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-red-500 block mb-1">
                            {form.type === 'VOD Review' ? 'TOPIC' : 'OPPONENT'}
                        </label>
                        <Input
                            value={form.opponent}
                            onChange={e => setForm({ ...form, opponent: e.target.value })}
                            placeholder={form.type === 'VOD Review' ? 'e.g. Reviewing Ascent Scrim' : 'e.g. Team Liquid'}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-red-500 block mb-1">MAP</label>
                            <Select value={form.map} onChange={e => setForm({ ...form, map: e.target.value })}>
                                <option value="General">General / None</option>
                                {MAPS.map(m => <option key={m}>{m}</option>)}
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 block mb-1">TIMEZONE</label>
                            <Select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                                {timezones.map(t => <option key={t}>{t}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-red-500 block mb-1">DATE</label>
                            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="[color-scheme:dark]" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-red-500 block mb-1">TIME</label>
                            <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="[color-scheme:dark]" />
                        </div>
                    </div>
                    <ButtonPrimary onClick={submit} disabled={saving} className="w-full py-3">
                        {saving ? 'SCHEDULING...' : 'SCHEDULE EVENT'}
                    </ButtonPrimary>
                </div>
            </Card>

            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-white uppercase">Applications</h3>
                    <span className="text-[10px] font-black text-red-400 bg-red-950/30 border border-red-900/40 px-2 py-1 rounded-md">{applications.length} PENDING</span>
                </div>
                <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                    {applications.length ? applications.map(application => (
                        <div key={application.id} className="bg-black/40 border border-neutral-800 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between gap-3">
                                <div>
                                    <div className="font-black text-white">{application.user || application.ign || 'Unknown Player'}</div>
                                    <div className="text-xs text-neutral-500">{application.rank || 'Unranked'} • {application.role || 'Flex'}</div>
                                </div>
                                <div className="text-[10px] text-neutral-600 font-mono">{application.submittedAt ? new Date(application.submittedAt).toLocaleDateString() : 'No date'}</div>
                            </div>
                            {(application.why || application.exp) && <p className="text-sm text-neutral-400 leading-relaxed line-clamp-3">{application.why || application.exp}</p>}
                            <div className="flex gap-2">
                                <ButtonPrimary onClick={() => approveApplication(application)} className="flex-1 text-xs py-2">Approve</ButtonPrimary>
                                <ButtonSecondary onClick={() => rejectApplication(application.id)} className="text-xs py-2">Reject</ButtonSecondary>
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No pending applications.</div>
                    )}
                </div>
            </Card>

            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-black text-white uppercase">Access Control</h3>
                    <span className="text-[10px] font-black text-red-400 bg-red-950/30 border border-red-900/40 px-2 py-1 rounded-md">{adminUsers.filter(user => user.active !== false).length} ACTIVE</span>
                </div>
                <div className="bg-black/35 border border-white/10 rounded-xl p-4 space-y-3 mb-4">
                    <Input placeholder="Firebase UID" value={adminForm.uid} onChange={e => setAdminForm({ ...adminForm, uid: e.target.value })} />
                    <Input placeholder="Display name" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} />
                    <Select value={adminForm.role} onChange={e => setAdminForm({ ...adminForm, role: e.target.value })}>
                        {STAFF_ACCESS_ROLES.map(role => <option key={role}>{role}</option>)}
                    </Select>
                    <ButtonPrimary onClick={saveAdminUser} className="w-full text-xs py-2">Grant Access</ButtonPrimary>
                </div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                    {adminUsers.length ? adminUsers.map(entry => (
                        <div key={entry.id} className={`bg-black/40 border rounded-xl p-3 ${entry.active === false ? 'border-white/5 opacity-50' : 'border-neutral-800'}`}>
                            <div className="flex justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-black text-white truncate">{entry.name || entry.id}</div>
                                    <div className="text-[10px] text-neutral-500 font-mono truncate">{entry.id}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase text-red-400">{entry.role || 'Admin'}</div>
                                    <button onClick={() => removeAdminUser(entry)} disabled={entry.active === false} className="mt-2 text-[10px] font-black uppercase text-neutral-500 hover:text-red-400 disabled:opacity-40">Revoke</button>
                                </div>
                            </div>
                        </div>
                    )) : <div className="p-8 text-center text-sm text-neutral-500 border border-dashed border-neutral-800 rounded-xl">No database admins added yet.</div>}
                </div>
            </Card>
        </div>
    );
};
