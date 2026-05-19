import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

export function timeToMinutes(t) {
    if (!t || t === '24:00') return 1440;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

export const safeDocId = (value, fallback = 'Unknown_User') => String(value || fallback)
    .trim()
    .replaceAll('/', '-')
    .replaceAll('#', '-')
    .replaceAll('?', '-')
    .replaceAll('[', '-')
    .replaceAll(']', '-')
    .slice(0, 120) || fallback;

export const normalizeAvailabilitySlots = (data = {}) => {
    if (Array.isArray(data.slots)) return data.slots;

    if (data.days && typeof data.days === 'object') {
        return Object.entries(data.days)
            .filter(([, range]) => range?.start && range?.end)
            .map(([day, range]) => ({
                day,
                start: range.start,
                end: range.end,
                role: range.role || 'Flex'
            }));
    }

    return [];
};

export const convertFromGMT = (day, time, timezone) => {
    if (!day || !time) return { day: '', time: '' };
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = jsDays.indexOf(day);
    const today = new Date();
    const currentDayIndex = today.getUTCDay();
    const distance = targetIndex - currentDayIndex;
    const gmtDate = new Date(today);
    gmtDate.setUTCDate(today.getUTCDate() + distance);
    const [hours, minutes] = time.split(':').map(Number);
    gmtDate.setUTCHours(hours, minutes, 0, 0);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = formatter.formatToParts(gmtDate);
    const part = (type) => parts.find(p => p.type === type)?.value;
    let localHours = part('hour');
    if (localHours === '24') localHours = '00';
    return { day: part('weekday'), time: `${localHours}:${part('minute')}` };
};

const getTimeZoneOffset = (date, timezone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const value = (type) => Number(parts.find(p => p.type === type)?.value || 0);
    const hour = value('hour') === 24 ? 0 : value('hour');
    const asUTC = Date.UTC(value('year'), value('month') - 1, value('day'), hour, value('minute'), value('second'));
    return asUTC - date.getTime();
};

const zonedTimeToDate = (day, time, timezone) => {
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const targetIndex = jsDays.indexOf(day);
    const now = new Date();
    const todayInZone = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const value = (type) => todayInZone.find(p => p.type === type)?.value;
    const currentIndex = jsDays.indexOf(value('weekday'));
    const distance = targetIndex - currentIndex;
    const baseUTC = Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day')) + distance, 12, 0, 0);
    const [hours, minutes] = time.split(':').map(Number);
    const localGuess = new Date(Date.UTC(
        new Date(baseUTC).getUTCFullYear(),
        new Date(baseUTC).getUTCMonth(),
        new Date(baseUTC).getUTCDate(),
        hours,
        minutes,
        0
    ));
    const firstPass = new Date(localGuess.getTime() - getTimeZoneOffset(localGuess, timezone));
    return new Date(localGuess.getTime() - getTimeZoneOffset(firstPass, timezone));
};

export const convertToGMT = (day, time, timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) => {
    const d = zonedTimeToDate(day, time, timezone);
    const jsDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { day: jsDays[d.getUTCDay()], time: `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` };
};

export const writeAuditLog = async (action, detail = '', actor = 'System') => {
    try {
        await addDoc(collection(db, 'audit_logs'), {
            action,
            detail,
            actor,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Audit log failed:', error);
    }
};

export const sortRosterByRole = (rosterList, lookupData = null) => {
    const priority = { 'Manager': 0, 'Head Coach': 1, 'Coach': 2, 'Captain': 3, 'Main': 4, 'Sub': 5, 'Tryout': 6 };
    return [...rosterList].sort((a, b) => {
        const roleA = (lookupData ? lookupData[a]?.role : a.role) || 'Tryout';
        const roleB = (lookupData ? lookupData[b]?.role : b.role) || 'Tryout';
        return (priority[roleA] ?? 99) - (priority[roleB] ?? 99);
    });
};
