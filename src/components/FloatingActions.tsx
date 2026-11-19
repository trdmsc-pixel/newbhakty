import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Ring } from "./brand/Ring";

interface FloatingActionsProps {
  whatsappNumber?: string;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({ whatsappNumber = "+91 9958194155" }) => {
  const [showFloating, setShowFloating] = useState(false);
  const [contactInView, setContactInView] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Appear after hero (approx 500px)
      setShowFloating(window.scrollY > 450);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    // Observe contact section
    const contactEl = document.getElementById("contact");
    if (!contactEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setContactInView(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );

    observer.observe(contactEl);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  const digitsOnly = whatsappNumber.replace(/[^0-9]/g, "");
  const cleanNumber = !digitsOnly || digitsOnly === "919999999999" ? "919958194155" : digitsOnly;
  const whatsappUrl = `https://wa.me/${cleanNumber}`;

  const isVisible = showFloating && !contactInView;

  return (
    <>
      {/* Desktop: WhatsApp Pill (Bottom-Right) */}
      <AnimatePresence>
        {isVisible && (
          <motion.a
            key="whatsapp-pill"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            className="hidden lg:inline-flex fixed bottom-8 right-8 z-40 items-center gap-3 px-4 py-2.5 rounded-full bg-[var(--tcs-night-2)]/90 border border-[var(--tcs-line)] backdrop-blur-md shadow-2xl group hover:border-[var(--tcs-offwhite)]/40 transition-all cursor-pointer"
          >
            <Ring size={16} stroke={2} animate="spin-slow" />
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--tcs-offwhite)] font-medium">
              WHATSAPP
            </span>
          </motion.a>
        )}
      </AnimatePresence>

      {/* Mobile: Sticky Bottom Bar with "Start a project" */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="mobile-bar"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed bottom-0 left-0 w-full z-40 p-4 bg-[var(--tcs-night)]/95 border-t border-[var(--tcs-line)] backdrop-blur-lg flex gap-3"
          >
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("contact");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="flex-1 py-3 text-center rounded bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] font-mono text-xs uppercase tracking-widest font-semibold"
            >
              Start a project
            </a>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with Director on WhatsApp"
              className="px-3.5 py-3 rounded border border-[var(--tcs-line)] bg-[var(--tcs-night-2)] flex items-center justify-center text-[var(--tcs-offwhite)]"
            >
              <Ring size={16} stroke={2} />
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingActions;
