import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { dialogFade, drawerSlide } from "./motion";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  className = "",
  children,
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#07080C]/75 backdrop-blur-md"
          />

          {/* Dialog Panel */}
          <motion.div
            {...dialogFade}
            className={`relative w-full max-w-xl rounded-[1.75rem] bg-[#11131A] border border-white/[0.16] p-6 sm:p-8 shadow-admin-floating z-10 max-h-[90vh] overflow-y-auto ${className}`}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 className="text-admin-h2 text-[#F4EFE6] font-semibold tracking-tight">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-admin-meta text-[#F4EFE6]/60 mt-1">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-[#F4EFE6]/70 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  description,
  className = "",
  children,
}) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEsc);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] overflow-hidden">
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#07080C]/75 backdrop-blur-md"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              {...drawerSlide}
              className={`w-screen max-w-lg bg-[#11131A] border-l border-white/[0.14] p-6 sm:p-8 shadow-admin-floating overflow-y-auto flex flex-col justify-between ${className}`}
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-6 border-b border-white/[0.08] pb-5">
                  <div className="min-w-0 flex-1">
                    {title && (
                      <h2 className="text-admin-h2 text-[#F4EFE6] font-semibold tracking-tight">
                        {title}
                      </h2>
                    )}
                    {description && (
                      <p className="text-admin-meta text-[#F4EFE6]/60 mt-1">
                        {description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close drawer"
                    className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-[#F4EFE6]/70 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">{children}</div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
