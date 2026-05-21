import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, AlertOctagon, Info, AlertTriangle, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextProps {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const toast = {
    success: (message: string, duration?: number) => addToast(message, "success", duration),
    error: (message: string, duration?: number) => addToast(message, "error", duration),
    info: (message: string, duration?: number) => addToast(message, "info", duration),
    warning: (message: string, duration?: number) => addToast(message, "warning", duration),
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
      case "error":
        return <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />;
      case "info":
        return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return "border-emerald-500/20 bg-emerald-500/5";
      case "error":
        return "border-red-500/20 bg-red-500/5";
      case "info":
        return "border-sky-500/20 bg-sky-500/5";
      case "warning":
        return "border-amber-500/20 bg-amber-500/5";
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      
      {/* Toast rendering portal / element overlay */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              layout
              key={t.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className={`p-4 rounded-xl border backdrop-blur-md shadow-2xl flex items-start gap-3 pointer-events-auto overflow-hidden relative ${getBorderColor(
                t.type
              )}`}
            >
              <div className="pt-0.5">{getIcon(t.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white break-words leading-relaxed font-sans select-none">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded hover:bg-white/5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context.toast;
};
