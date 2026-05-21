import { TEAM_LOGO } from '../lib/constants';

export const TeamLogo = ({ className = "", imageClassName = "" }) => (
    <span className={`relative inline-flex shrink-0 overflow-hidden bg-black border border-white/15 ${className}`}>
        <img src={TEAM_LOGO} alt="SYRIX logo" className={`h-full w-full object-cover ${imageClassName}`} />
    </span>
);

export const GlobalStyles = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&family=Rajdhani:wght@600;700&display=swap');
        
        html, body, #root { 
            width: 100%; 
            margin: 0; 
            padding: 0; 
            overflow-x: hidden;
        }

        .glass-panel {
            background: linear-gradient(180deg, rgba(16, 18, 22, 0.98), rgba(8, 9, 12, 0.98));
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
        }
        .glass-panel::after {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background: linear-gradient(135deg, rgba(255,255,255,0.05), transparent 32%, transparent 72%, rgba(239,68,68,0.06));
            opacity: 0.55;
        }
        .card-shine:hover { border-color: rgba(239, 68, 68, 0.44); background: linear-gradient(180deg, rgba(21, 24, 30, 0.98), rgba(9, 10, 13, 0.98)); box-shadow: 0 20px 52px rgba(0,0,0,0.42); }
        .card-shine > * { position: relative; z-index: 1; }
        .section-kicker { color: #ef4444; font-size: 0.7rem; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase; }
        .section-title { color: #fff; font-size: clamp(2.25rem, 5vw, 4.6rem); line-height: 0.88; font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase; font-style: italic; }
        .surface-band { background: rgba(9, 11, 15, 0.74); border-block: 1px solid rgba(255,255,255,0.06); }
        .org-wordmark { font-family: Rajdhani, Inter, sans-serif; letter-spacing: -0.035em; }
        .org-nav {
            background: rgba(3, 3, 4, 0.92);
            border-bottom: 1px solid rgba(255,255,255,0.12);
            box-shadow: 0 12px 28px rgba(0,0,0,0.32);
        }
        .editorial-band {
            background: #f4f4f1;
            color: #050608;
        }
        .editorial-card {
            background: #f4f4f1;
            color: #050608;
            border: 1px solid rgba(0,0,0,0.12);
        }
        .syrix-cut {
            clip-path: polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%);
        }
        .syrix-redline {
            position: relative;
        }
        .syrix-redline::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            height: 3px;
            width: 4.5rem;
            background: #ef2424;
        }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #ef4444; }
        .mask-fade { -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%); mask-image: linear-gradient(to right, black 90%, transparent 100%); }

        :root { --primary-red: #ef2424; --dark-bg: #030304; --card-bg: #111318; }
        .accent-text { color: var(--primary-red); }
        .accent-bg { background-color: var(--primary-red); transition: background-color 0.3s; }
        .accent-bg:hover { background-color: #e02c2c; }
        
        .hero-section {
            min-height: 100vh;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        
        @media only screen and (min-width: 769px) { 
            .hero-section { background-attachment: fixed; } 
        }

        @keyframes pulse-red { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .live-indicator { animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .player-card { min-height: 350px; }
        .card-inner { position: relative; width: 100%; height: 100%; }
        .card-front { position: relative; width: 100%; height: 100%; border-radius: 0.75rem; }
        .card-back { display: none; }
        .scroll-mouse {
            width: 26px;
            height: 42px;
            border: 2px solid rgba(255, 255, 255, 0.5);
            border-radius: 20px;
            position: relative;
        }
        .scroll-wheel {
            width: 2px;
            height: 6px;
            background: #ef4444;
            border-radius: 2px;
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            animation: scroll-bounce 2s infinite;
        }
        @keyframes scroll-bounce {
            0% { transform: translate(-50%, 0); opacity: 1; }
            50% { transform: translate(-50%, 8px); opacity: 0; }
            100% { transform: translate(-50%, 0); opacity: 1; }
        }    `
    }</style>
);

export const Background = () => (
    <div className="fixed inset-0 w-full h-full z-0 pointer-events-none bg-[#050608]">
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4.5rem_4.5rem]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_8%,rgba(239,36,36,0.16),transparent_28%),linear-gradient(to_bottom,rgba(3,3,4,0.35),#030304_82%)]"></div>
    </div>
);

export const Modal = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/95 z-[150] flex justify-center items-center backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-neutral-900 rounded-lg shadow-2xl shadow-red-900/20 p-6 w-full max-w-md border border-red-900/40 animate-fade-in relative">
                <h3 className="text-2xl font-black text-white mb-4 border-b pb-2 border-red-900/50 uppercase tracking-wide">{title}</h3>
                <div className="text-neutral-300 mb-8">{children}</div>
                <div className="flex justify-end gap-4">
                    <button onClick={onClose} className="bg-black/40 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 py-2 px-4 rounded-lg">Cancel</button>
                    {onConfirm && <button onClick={onConfirm} className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg">Confirm</button>}
                </div>
            </div>
        </div>
    );
};

export const Input = ({ className = '', ...props }) => (
    <input {...props} className={`w-full bg-black/55 border border-neutral-800 rounded-sm p-3 text-white text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all placeholder-neutral-600 shadow-inner hover:border-neutral-700 ${className}`} />
);

export const Select = ({ className = '', children, ...props }) => (
    <select {...props} className={`w-full bg-black/55 border border-neutral-800 rounded-sm p-3 text-white text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all shadow-inner hover:border-neutral-700 ${className}`}>
        {children}
    </select>
);

export const ButtonPrimary = ({ children, onClick, disabled, className = "" }) => (
    <button onClick={onClick} disabled={disabled} className={`bg-red-600 hover:bg-white text-white hover:text-black font-black uppercase tracking-[0.13em] py-3 px-6 rounded-sm shadow-lg shadow-red-950/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed syrix-cut ${className}`}>
        {children}
    </button>
);

export const ButtonSecondary = ({ children, onClick, disabled, className = "" }) => (
    <button onClick={onClick} disabled={disabled} className={`bg-black/55 hover:bg-white border border-neutral-800 hover:border-white text-neutral-400 hover:text-black font-black uppercase tracking-[0.11em] py-2 px-4 rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
        {children}
    </button>
);

export const Card = ({ children, className = "" }) => (
    <div className={`glass-panel rounded-sm p-6 relative overflow-hidden group card-shine transition-all duration-300 ${className}`}>
        {children}
    </div>
);
