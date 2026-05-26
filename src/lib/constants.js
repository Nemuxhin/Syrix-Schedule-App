export const ADMIN_UIDS = [
    "ouEH5sdcZKPsOnXx1UnVt4cpcgi1",
    "SiPLxB20VzVGBZL3rTM42FsgEy52",
    "pmXgTX5dxbVns0nnO54kl1BR07A3",
    "lJU8T8l3jwZ33g1WKdBC4SiaIQ02",
    "M9FzRywhRIdUveh5JKUfQgJtlIB3"
];
export const ADMIN_ROLES = ["Manager"];
export const ADMIN_ACCESS_ROLES = ["Owner", "Admin", "Manager"];
export const STAFF_ACCESS_ROLES = ["Owner", "Admin", "Manager", "Head Coach", "Coach"];
export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const SHORT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MAPS = ["Ascent", "Bind", "Breeze", "Fracture", "Haven", "Icebox", "Lotus", "Pearl", "Split", "Sunset", "Abyss", "Corrode"];
export const ROLES = ["Flex", "Duelist", "Initiator", "Controller", "Sentinel", "Coach", "Head Coach", "Manager"];
export const RANKS = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
export const AGENT_NAMES = ["Jett", "Raze", "Reyna", "Yoru", "Phoenix", "Neon", "Iso", "Tejo", "Vyse", "Waylay", "Omen", "Astra", "Brimstone", "Viper", "Harbor", "Clove", "Sova", "Fade", "Skye", "Breach", "KAY/O", "Gekko", "Killjoy", "Cypher", "Sage", "Chamber", "Deadlock", "Miks", "Veto"];
export const ROLE_ABBREVIATIONS = { Flex: "FLX", Duelist: "DUEL", Initiator: "INIT", Controller: "CTRL", Sentinel: "SENT", Coach: "C", "Head Coach": "HC", Manager: "MGR" };
export const TEAM_LOGO = "/syrix-logo.jpeg";
export const TEAM_LOGOS = {
    red: "/syrix-logo.jpeg",
    blue: "/syrix-blue-logo.png"
};
export const DEFAULT_TEAM_ID = "red";
export const DEFAULT_TEAMS = [
    { id: "red", name: "Syrix Red", color: "#dc2626", logo: TEAM_LOGOS.red, isDefault: true },
    { id: "blue", name: "Syrix Blue", color: "#2563eb", logo: TEAM_LOGOS.blue }
];

export const UTILITY_TYPES = [
    { id: 'smoke', color: 'rgba(209, 213, 219, 0.3)', border: '#d1d5db', label: 'Smoke', shape: 'ring' },
    { id: 'molly', color: 'rgba(239, 68, 68, 0.3)', border: '#ef4444', label: 'Molly', shape: 'ring' },
    { id: 'flash', color: '#facc15', border: '#facc15', label: 'Flash', shape: 'star' },
    { id: 'recon', color: '#3b82f6', border: '#3b82f6', label: 'Recon', shape: 'triangle' },
    { id: 'stun', color: 'rgba(249, 115, 22, 0.3)', border: '#f97316', label: 'Stun', shape: 'square' },
    { id: 'barrier', color: 'rgba(45, 212, 191, 0.3)', border: '#2dd4bf', label: 'Barrier', shape: 'rect' },
    { id: 'trap', color: 'rgba(168, 85, 247, 0.5)', border: '#a855f7', label: 'Trap', shape: 'cross' },
    { id: 'ult', color: 'rgba(16, 185, 129, 0.2)', border: '#10b981', label: 'Ult', shape: 'diamond' }
];

export const timezones = ["UTC", "GMT", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"];
