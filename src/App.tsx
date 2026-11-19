import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import Lenis from "lenis";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import ShowreelSection from "./components/ShowreelSection";
import ShowcaseGrid from "./components/ShowcaseGrid";
import StudioSection from "./components/StudioSection";
import ClientsSection from "./components/ClientsSection";
import BookingForm from "./components/BookingForm";
import BrandMarquee from "./components/BrandMarquee";
import Footer from "./components/Footer";
import IntroLoader from "./components/IntroLoader";
import CustomCursor from "./components/CustomCursor";
import FloatingActions from "./components/FloatingActions";
import LegalPage from "./components/LegalPages";
import { SiteDataProvider, useSiteData } from "./context/SiteDataContext";
import { ToastProvider } from "./context/ToastContext";
import { Ring } from "./components/brand/Ring";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

// Code-split heavy administrative and client-portal bundles
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ClientAccessPanel = lazy(() => import("./components/ClientAccessPanel"));

function AppContent() {
  const { siteSettings } = useSiteData();
  const [path, setPath] = useState(() => window.location.pathname);
  const [hash, setHash] = useState(() => window.location.hash);
  const [triggerReelPlay, setTriggerReelPlay] = useState(false);
  const isFirstRender = useRef(true);

  // Initialize Lenis Smooth Scrolling on desktop public homepage only (never hijack wheel on /admin or /client)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isPortalRoute =
      path === "/admin" ||
      hash === "#admin" ||
      path === "/client" ||
      hash === "#client";
    if (isPortalRoute) return;

    const isFine = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isFine || prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [path, hash]);

  // Listen for history and hash navigation
  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
      setHash(window.location.hash);
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    // Redirect retired legacy routes to "/"
    if (window.location.pathname === "/mobile-app" || window.location.pathname === "/cinematic-websites") {
      window.history.replaceState(null, "", "/");
      setPath("/");
    }

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, []);

  // Meta Pixel PageView Tracking (Fired only on subsequent client route/hash changes, skipping first mount to prevent double firing)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const fbq = (window as any).fbq;
    if (fbq) {
      fbq("track", "PageView", {
        path,
        hash,
      });
    }
  }, [path, hash]);

  // Zero-Overhead Geolocation Visitor Logging
  useEffect(() => {
    const trackVisitorLocation = async () => {
      try {
        if (sessionStorage.getItem("session_geo_logged") === "true") return;

        const res = await fetch("/api/edge-sync");
        if (!res.ok) return;

        const data = await res.json();
        const city = data.city || "Unknown City";
        const region = data.region || "Unknown Region";
        const country = data.country || "Unknown Country";

        let deviceType = "desktop";
        if (window.innerWidth < 768) deviceType = "mobile";
        else if (window.innerWidth < 1024) deviceType = "tablet";

        if (isSupabaseConfigured && supabase) {
          await supabase.from("visitor_locations").insert({
            city,
            region,
            country,
            device_type: deviceType,
            source_page: "studio_main",
          });
        }
        sessionStorage.setItem("session_geo_logged", "true");
      } catch (e) {}
    };

    trackVisitorLocation();
  }, []);

  const navigate = (to: string) => {
    if (to.startsWith("#")) {
      const cleanId = to.replace("#", "");
      const el = document.getElementById(cleanId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
      window.history.pushState(null, "", to);
      setHash(to);
    } else {
      window.history.pushState({}, "", to);
      setPath(to);
      setHash("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Route Dispatcher
  if (path === "/privacy" || hash === "#privacy") {
    return <LegalPage type="privacy" onBack={() => navigate("/")} />;
  }

  if (path === "/terms" || hash === "#terms") {
    return <LegalPage type="terms" onBack={() => navigate("/")} />;
  }

  if (path === "/refunds" || hash === "#refunds") {
    return <LegalPage type="refunds" onBack={() => navigate("/")} />;
  }

  if (path === "/admin" || hash === "#admin") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[var(--tcs-night)] flex items-center justify-center">
            <Ring size={48} stroke={4} animate="spin-slow" />
          </div>
        }
      >
        <AdminPanel onNavigateHome={() => navigate("/")} />
      </Suspense>
    );
  }

  if (path === "/client" || hash === "#client") {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[var(--tcs-night)] flex items-center justify-center">
            <Ring size={48} stroke={4} animate="spin-slow" />
          </div>
        }
      >
        <ClientAccessPanel onNavigateHome={() => navigate("/")} />
      </Suspense>
    );
  }

  // Single Responsive Studio Homepage (All Screen Sizes)
  return (
    <div className="min-h-screen bg-[var(--tcs-night)] text-[var(--tcs-offwhite)] relative font-sans selection:bg-[var(--tcs-ember)] selection:text-white">
      {/* Film Grain Texture Overlay */}
      <svg className="film-grain" aria-hidden="true">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      {/* Intro Loader (1.6s max, first session visit only) */}
      <IntroLoader />

      {/* Custom Cursor (Fine pointers only) */}
      <CustomCursor />

      {/* Floating Actions: WhatsApp Pill & Mobile Sticky Button */}
      <FloatingActions whatsappNumber={siteSettings.whatsapp_number} />

      {/* Navigation Header */}
      <Navbar navigate={navigate} />

      {/* Main Sections */}
      <main className="w-full">
        {/* Section 1: Hero */}
        <HeroSection
          eyebrow={siteSettings.hero_eyebrow}
          title={siteSettings.hero_title}
          description={siteSettings.hero_description}
          loopUrl={
            siteSettings.hero_loop_url ||
            siteSettings.hero_video_bg_url ||
            "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781186188643-uz2iudjbk_seedance_2_0___tv_spot_ad___bmw23__bmw2_create_a_hyper_premium_cinematic_tv_spot_commercial_for_the_4k.webm"
          }
          posterUrl={
            siteSettings.hero_poster_url ||
            "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781188194291-p22sxzh5f_3_series_exterior_left_front_three_quarter.avif"
          }
          credit={siteSettings.hero_credit || "BMW 4K TV SPOT • DIRECTED BY THE CHANTING STUDIO"}
          onWatchReel={() => setTriggerReelPlay(true)}
          reelCtaLabel={siteSettings.hero_cta_reel_text || "▶ Watch the reel"}
          projectCtaLabel={siteSettings.hero_cta_project_text || "Start a project"}
          onStartProject={() => navigate("#contact")}
        />

        {/* Section 2: Showreel */}
        <ShowreelSection
          videoUrl={
            siteSettings.showreel_video_url ||
            siteSettings.page2_hero_video_bg_url ||
            "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781188825650-g9hzeknyz_banner.webm"
          }
          posterUrl={
            siteSettings.showreel_poster_url ||
            "https://cdn.jsdelivr.net/gh/trdmsc-pixel/newbhakty@media/1781187896400-j5gl1zley_freepik_high_budget_cinematic_stu_2846789120.jpg"
          }
          duration={siteSettings.showreel_duration || "0:45"}
          aspect={(siteSettings.showreel_aspect as "2.39" | "16:9") || "16:9"}
          eyebrow={siteSettings.showreel_eyebrow || "SHOWREEL 2026"}
          title={siteSettings.showreel_title || "Every frame, directed."}
          onStartProject={() => navigate("#contact")}
          onSeeWork={() => navigate("#work")}
          externalTriggerPlay={triggerReelPlay}
          onResetTrigger={() => setTriggerReelPlay(false)}
        />

        {/* Brand Roster / Partner Marquee */}
        <section className="w-full py-12 border-y border-[var(--tcs-line)] bg-[var(--tcs-night)] overflow-hidden">
          <BrandMarquee />
        </section>

        {/* Section 3: Selected Work */}
        <ShowcaseGrid />

        {/* Section 4: Studio Capabilities & Process */}
        <StudioSection />

        {/* Section 5: Clients & Testimonials */}
        <ClientsSection />

        {/* Section 6: Start a Project (Inquiry Form) */}
        <BookingForm />
      </main>

      {/* Studio Footer */}
      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <SiteDataProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </SiteDataProvider>
  );
}
