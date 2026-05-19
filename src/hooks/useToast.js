import { useContext } from 'react';
import { ToastContext } from '../lib/toastContext';

export const useToast = () => useContext(ToastContext);
