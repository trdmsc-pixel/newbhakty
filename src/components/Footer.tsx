import React from "react";
import { useSiteData } from "../context/SiteDataContext";
import { Wordmark } from "./brand/Wordmark";

interface FooterProps {
  navigate?: (to: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate }) => {
  const { siteSettings } = useSiteData();

  const contactEmail = siteSettings.contact_email || "studio@thechantingstudio.in";
  const rawWhatsApp = siteSettings.whatsapp_number || "+919999999999";
  const cleanWhatsApp = rawWhatsApp.replace(/[^0-9]/g, "");
  const whatsappUrl = `https://wa.me/${cleanWhatsApp}`;

  const scrollTo = (targetId: string) => {
    const cleanId = targetId.replace("#", "");
    const el = document.getElementById(cleanId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      window.history.pushState(null, "", `#${cleanId}`);
    } else if (cleanId === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const followLinks = [
    { label: "Instagram", url: siteSettings.instagram_url },
    { label: "LinkedIn", url: siteSettings.linkedin_url },
    { label: "YouTube", url: siteSettings.youtube_url },
    { label: "Vimeo", url: siteSettings.vimeo_url },
    { label: "Behance", url: siteSettings.behance_url },
  ].filter((f) => Boolean(f.url));

  const handleLegalClick = (e: React.MouseEvent, route: string) => {
    e.preventDefault();
    if (navigate) {
      navigate(route);
    } else {
      window.location.pathname = route;
    }
  };

  return (
    <footer className="w-full bg-[var(--tcs-night)] border-t border-[var(--tcs-line)] pt-20 pb-12 select-none overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        {/* Giant Logo / Wordmark above footer — controllable from Admin Panel */}
        <div className="w-full mb-16 md:mb-20 flex justify-center py-4 px-1">
          {(siteSettings.footer_logo_url || siteSettings.logo_img_url) ? (
            <img
              src={siteSettings.footer_logo_url || siteSettings.logo_img_url}
              alt="The Chanting Studio"
              style={{
                height: siteSettings.footer_logo_height
                  ? `${parseInt(siteSettings.footer_logo_height, 10)}px`
                  : undefined,
              }}
              className="max-h-36 sm:max-h-48 md:max-h-60 w-auto max-w-full object-contain transition-all duration-150"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Wordmark
              ringAnimation="spin-slow"
              glow={true}
              className="text-[clamp(1rem,4.1vw,4.4rem)] tracking-[0.09em] sm:tracking-[0.12em] max-w-full"
            />
          )}
        </div>

        {/* Three Columns in Mono */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-16 border-b border-[var(--tcs-line)]">
          {/* Column 1: Studio Anchors */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-dim)] mb-4">
              STUDIO
            </p>
            <ul className="space-y-2.5 font-mono text-xs uppercase tracking-wider text-[var(--tcs-muted)]">
              <li>
                <a
                  href="#reel"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("reel");
                  }}
                  className="hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  Showreel 2026
                </a>
              </li>
              <li>
                <a
                  href="#work"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("work");
                  }}
                  className="hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  Selected Work
                </a>
              </li>
              <li>
                <a
                  href="#studio"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("studio");
                  }}
                  className="hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  Capabilities & Process
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo("contact");
                  }}
                  className="hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  Start a Project
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Direct Contacts */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-dim)] mb-4">
              CONTACT
            </p>
            <ul className="space-y-2.5 font-mono text-xs text-[var(--tcs-muted)]">
              <li>
                <a
                  href={`mailto:${contactEmail}`}
                  className="hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  {contactEmail}
                </a>
              </li>
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  WhatsApp Studio Line
                </a>
              </li>
              <li className="text-[var(--tcs-dim)] uppercase tracking-wider">
                Delhi, India → Worldwide
              </li>
            </ul>
          </div>

          {/* Column 3: Follow Links */}
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--tcs-dim)] mb-4">
              FOLLOW
            </p>
            {followLinks.length > 0 ? (
              <ul className="space-y-2.5 font-mono text-xs uppercase tracking-wider text-[var(--tcs-muted)]">
                {followLinks.map((f, i) => (
                  <li key={i}>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--tcs-offwhite)] transition-colors"
                    >
                      {f.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2.5 font-mono text-xs uppercase tracking-wider text-[var(--tcs-muted)]">
                <li>
                  <a
                    href="https://instagram.com/thechantingstudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--tcs-offwhite)] transition-colors"
                  >
                    Instagram ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/company/thechantingstudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--tcs-offwhite)] transition-colors"
                  >
                    LinkedIn ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://youtube.com/@thechantingstudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--tcs-offwhite)] transition-colors"
                  >
                    YouTube ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://vimeo.com/thechantingstudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--tcs-offwhite)] transition-colors"
                  >
                    Vimeo ↗
                  </a>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Direct Studio Portals Row */}
        <div className="py-8 my-4 border-b border-[var(--tcs-line)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)]">
              Direct Studio Access & Client Portals
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => (navigate ? navigate("/portal") : (window.location.pathname = "/portal"))}
              className="px-5 py-2.5 rounded-full bg-[var(--tcs-carbon)] border border-[var(--tcs-line)] hover:border-[var(--tcs-offwhite)]/60 text-[var(--tcs-offwhite)] font-mono text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/[0.04] transition-all cursor-pointer shadow-lg"
            >
              <span className="text-emerald-400 text-sm">🌐</span>
              <span>Client Portal</span>
            </button>

            <button
              type="button"
              onClick={() => (navigate ? navigate("/admin") : (window.location.pathname = "/admin"))}
              className="px-5 py-2.5 rounded-full bg-[var(--tcs-carbon)] border border-[var(--tcs-line)] hover:border-[var(--tcs-offwhite)]/60 text-[var(--tcs-offwhite)] font-mono text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/[0.04] transition-all cursor-pointer shadow-lg"
            >
              <span className="text-amber-400 text-sm">🔐</span>
              <span>Studio Administrator</span>
            </button>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Legal */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[11px] text-[var(--tcs-dim)]">
          <div className="flex items-center gap-3">
            {siteSettings.logo_img_url && (
              <img
                src={siteSettings.logo_img_url}
                alt="Studio Logo"
                className="h-6 w-auto object-contain mix-blend-screen brightness-125"
              />
            )}
            <p>© 2026 Chaitravarna Ventures Pvt. Ltd. — The Chanting Studio</p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="/privacy"
              onClick={(e) => handleLegalClick(e, "/privacy")}
              className="hover:text-[var(--tcs-muted)] transition-colors"
            >
              Privacy Policy
            </a>
            <span>•</span>
            <a
              href="/terms"
              onClick={(e) => handleLegalClick(e, "/terms")}
              className="hover:text-[var(--tcs-muted)] transition-colors"
            >
              Terms of Service
            </a>
            <span>•</span>
            <a
              href="/refunds"
              onClick={(e) => handleLegalClick(e, "/refunds")}
              className="hover:text-[var(--tcs-muted)] transition-colors"
            >
              Refund Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
