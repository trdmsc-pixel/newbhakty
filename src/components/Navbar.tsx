import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wordmark } from "./brand/Wordmark";
import { Ring } from "./brand/Ring";

interface NavbarProps {
  navigate?: (to: string) => void;
}

export default function Navbar({ navigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("top");

  useEffect(() => {
    let scrollTimeout: any = null;
    let lastScrollTime = 0;
    const throttleDelay = 80;

    const handleScroll = () => {
      const now = Date.now();
      const run = () => {
        setIsScrolled(window.scrollY > 80);

        const sections = ["top", "reel", "work", "studio", "clients", "contact"];
        const scrollPos = window.scrollY + 160;

        for (let i = sections.length - 1; i >= 0; i--) {
          const el = document.getElementById(sections[i]);
          if (el && scrollPos >= el.offsetTop) {
            setActiveSection(sections[i]);
            break;
          }
        }
      };

      if (now - lastScrollTime >= throttleDelay) {
        run();
        lastScrollTime = now;
      } else {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          run();
          lastScrollTime = Date.now();
        }, throttleDelay - (now - lastScrollTime));
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  const scrollTo = (targetId: string) => {
    setMobileOpen(false);
    const cleanId = targetId.replace("#", "");
    const el = document.getElementById(cleanId);
    if (el) {
      const navOffset = 70;
      const top = el.getBoundingClientRect().top + window.pageYOffset - navOffset;
      window.scrollTo({ top, behavior: "smooth" });
      window.history.pushState(null, "", `#${cleanId}`);
    } else if (cleanId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.history.pushState(null, "", "#");
    }
  };

  const navLinks = [
    { label: "Reel", target: "#reel" },
    { label: "Work", target: "#work" },
    { label: "Studio", target: "#studio" },
    { label: "Contact", target: "#contact" },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${
          isScrolled
            ? "bg-[var(--tcs-night)]/85 backdrop-blur-[12px] border-b border-[var(--tcs-line)] py-3.5"
            : "bg-transparent py-5"
        }`}
      >
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 flex items-center justify-between">
          {/* Left: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              scrollTo("top");
            }}
            className="group flex items-center transition-opacity hover:opacity-90"
          >
            <Wordmark capHeight={15} />
          </a>

          {/* Right: Desktop Navigation Items */}
          <nav className="hidden md:flex items-center gap-7">
            <div className="flex items-center gap-6">
              {navLinks.map((link) => {
                const isActive = activeSection === link.target.replace("#", "");
                return (
                  <a
                    key={link.target}
                    href={link.target}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollTo(link.target);
                    }}
                    className={`font-mono text-xs uppercase tracking-[0.14em] transition-colors relative py-1 ${
                      isActive
                        ? "text-[var(--tcs-offwhite)] font-semibold"
                        : "text-[var(--tcs-offwhite)]/60 hover:text-[var(--tcs-offwhite)]"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 w-full h-[1px] bg-[var(--tcs-offwhite)]" />
                    )}
                  </a>
                );
              })}

              {/* Direct Portal Access */}
              <button
                type="button"
                onClick={() => (navigate ? navigate("/client") : (window.location.pathname = "/client"))}
                className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-offwhite)]/60 hover:text-[var(--tcs-offwhite)] transition-colors cursor-pointer"
                title="Client Portal Access"
              >
                Client Access
              </button>

              <button
                type="button"
                onClick={() => (navigate ? navigate("/admin") : (window.location.pathname = "/admin"))}
                className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-offwhite)]/60 hover:text-[var(--tcs-offwhite)] transition-colors flex items-center gap-1 cursor-pointer"
                title="Studio Administrator Login"
              >
                <span className="text-[10px]">🔒</span>
                <span>Admin</span>
              </button>
            </div>

            {/* Primary CTA: Start a project */}
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                scrollTo("#contact");
              }}
              className="relative group px-4 py-2 border border-[var(--tcs-offwhite)]/80 text-[var(--tcs-offwhite)] font-mono text-xs uppercase tracking-[0.12em] rounded transition-all duration-300 hover:bg-[var(--tcs-offwhite)] hover:text-[var(--tcs-night)]"
            >
              <span>Start a project</span>
              {/* Subtle spectral underline glow on hover */}
              <span
                className="absolute -bottom-[2px] left-2 right-2 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "var(--tcs-spectrum-linear)" }}
              />
            </a>
          </nav>

          {/* Mobile Menu Button: Two-line Minimalist Icon */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-1.5 z-50 text-[var(--tcs-offwhite)] focus:outline-none"
          >
            <span
              className={`w-6 h-[1.5px] bg-[var(--tcs-offwhite)] transition-transform duration-300 ${
                mobileOpen ? "rotate-45 translate-y-[4.5px]" : ""
              }`}
            />
            <span
              className={`w-6 h-[1.5px] bg-[var(--tcs-offwhite)] transition-transform duration-300 ${
                mobileOpen ? "-rotate-45 -translate-y-[4.5px]" : ""
              }`}
            />
          </button>
        </div>
      </header>

      {/* Mobile Full-Screen Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-40 bg-[var(--tcs-night)] flex flex-col justify-between p-8 pt-28 md:hidden"
          >
            {/* Nav links */}
            <div className="flex flex-col gap-5">
              {navLinks.map((link, idx) => (
                <motion.a
                  key={link.target}
                  href={link.target}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(link.target);
                  }}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.05, duration: 0.35 }}
                  className="font-display font-light text-3xl uppercase tracking-wider text-[var(--tcs-offwhite)] hover:text-white"
                >
                  {link.label}
                </motion.a>
              ))}

              <div className="pt-4 border-t border-[var(--tcs-line)] flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate ? navigate("/client") : (window.location.pathname = "/client");
                  }}
                  className="text-left font-mono text-xs uppercase tracking-widest text-[var(--tcs-offwhite)]/80 hover:text-white py-1.5 flex items-center gap-2 cursor-pointer"
                >
                  <span>🌐</span> Client Access Panel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    navigate ? navigate("/admin") : (window.location.pathname = "/admin");
                  }}
                  className="text-left font-mono text-xs uppercase tracking-widest text-[var(--tcs-offwhite)]/80 hover:text-white py-1.5 flex items-center gap-2 cursor-pointer"
                >
                  <span>🔐</span> Studio Administrator
                </button>
              </div>

              <motion.a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo("#contact");
                }}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.35 }}
                className="mt-2 inline-block font-display font-bold text-2xl uppercase tracking-wider text-[var(--tcs-offwhite)] border-b border-[var(--tcs-offwhite)] pb-2"
              >
                Start a project →
              </motion.a>
            </div>

            {/* Bottom Meta & Decorative Rotating Ring */}
            <div className="flex items-end justify-between relative pt-8 border-t border-[var(--tcs-line)]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)]">
                  DELHI → WORLDWIDE
                </p>
                <p className="font-mono text-xs text-[var(--tcs-muted)] mt-1">
                  studio@thechantingstudio.in
                </p>
              </div>

              {/* Rotating Ring in bottom right corner */}
              <div className="relative">
                <Ring size={72} stroke={4} animate="spin-slow" glow={true} className="opacity-50" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
