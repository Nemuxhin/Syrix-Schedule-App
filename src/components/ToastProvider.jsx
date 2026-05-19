import { useState } from 'react';
import { ToastContext } from '../lib/toastContext';

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const addToast = (message, type = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };
    return (
        <ToastContext.Provider value={addToast}>
            {children}
            <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`pointer-events-auto min-w-[240px] backdrop-blur-xl border-l-4 p-4 rounded-r-lg shadow-2xl animate-slide-in flex items-center gap-3 ${t.type === 'success' ? 'bg-green-900/80 border-green-500 text-white' : 'bg-red-900/80 border-red-500 text-white'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${t.type === 'success' ? 'bg-green-500 text-black' : 'bg-red-500 text-white'}`}>{t.type === 'success' ? '✓' : '!'}</div>
                        <span className="font-bold text-sm">{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
