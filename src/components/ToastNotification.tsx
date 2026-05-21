import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, AlertTriangle, Info, X, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
type ToastVariant = "success" | "error" | "saving" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number; // 0 = manual dismiss only
}

interface ToastContextProps {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const scheduleAutoDismiss = useCallback((id: string, duration: number) => {
    if (duration <= 0) return;
    const existing = timersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      dismissToast(id);
    }, duration);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  const showToast = useCallback((message: string, variant: ToastVariant = "info", duration?: number): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const autoDuration = duration ?? (variant === "error" ? 5000 : variant === "saving" ? 0 : 3500);
    const newToast: Toast = { id, message, variant, duration: autoDuration };
    setToasts(prev => [...prev.slice(-4), newToast]); // Keep max 5 toasts
    scheduleAutoDismiss(id, autoDuration);
    return id;
  }, [scheduleAutoDismiss]);

  const updateToast = useCallback((id: string, message: string, variant?: ToastVariant, duration?: number) => {
    setToasts(prev => prev.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, message, variant: variant ?? t.variant };
      return updated;
    }));
    if (duration !== undefined && duration > 0) {
      scheduleAutoDismiss(id, duration);
    }
  }, [scheduleAutoDismiss]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, updateToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};

// ─── Icons & Colors per variant ──────────────────────────────
const VARIANT_CONFIG: Record<ToastVariant, {
  icon: React.ReactNode;
  bg: string;
  border: string;
  text: string;
  accent: string;
}> = {
  success: {
    icon: <Check className="w-4 h-4" />,
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    text: "text-emerald-300",
    accent: "bg-emerald-500",
  },
  error: {
    icon: <AlertTriangle className="w-4 h-4" />,
    bg: "bg-red-500/10",
    border: "border-red-500/25",
    text: "text-red-300",
    accent: "bg-red-500",
  },
  saving: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    text: "text-amber-300",
    accent: "bg-amber-500",
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    text: "text-sky-300",
    accent: "bg-sky-500",
  },
};

// ─── Render Layer ────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const cfg = VARIANT_CONFIG[toast.variant];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={`pointer-events-auto relative flex items-start gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl ${cfg.bg} ${cfg.border}`}
            >
              {/* Accent bar */}
              <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${cfg.accent}`} />

              {/* Icon */}
              <div className={`shrink-0 mt-0.5 ${cfg.text}`}>
                {cfg.icon}
              </div>

              {/* Message */}
              <p className={`text-xs font-medium leading-relaxed flex-1 pr-4 ${cfg.text}`}>
                {toast.message}
              </p>

              {/* Close */}
              <button
                onClick={() => onDismiss(toast.id)}
                className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
