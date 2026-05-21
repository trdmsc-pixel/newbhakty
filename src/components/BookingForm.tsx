import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, FileText, Briefcase, Plus, CircleAlert, Sparkles, X, CheckCircle, Check } from "lucide-react";
import { BookingSubmission } from "../types";
import { trackEvent } from "../lib/analytics";
import { useSiteData } from "../context/SiteDataContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";


interface BookingFormProps {
  initialTier: string;
}

export default function BookingForm({ initialTier }: BookingFormProps) {
  const { siteSettings } = useSiteData();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [brief, setBrief] = useState("");
  const [budget, setBudget] = useState("$5,000 - $10,000");
  const [selectedTier, setSelectedTier] = useState("Full Cinematic Production");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Real-time tracking inputs
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [briefTouched, setBriefTouched] = useState(false);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isBriefValid = brief.trim().length >= 15;


  // Synchronize initial prepopulation when user clicks pricing actions
  useEffect(() => {
    if (initialTier) {
      setSelectedTier(initialTier);
      if (initialTier.includes("Short-Form")) {
        setBudget("$2,000 - $5,000");
      } else if (initialTier.includes("Cinematic")) {
        setBudget("$5,000 - $10,000");
      } else {
        setBudget("$10,000+");
      }
    }
  }, [initialTier]);

  const validate = () => {
    const errors: Record<string, string> = {};
    setNameTouched(true);
    setEmailTouched(true);
    setBriefTouched(true);

    if (!isNameValid) {
      errors.name = "Synthesizer ID or Name is required (minimum 2 letters)";
    }
    if (!isEmailValid) {
      errors.email = "Please supply a valid communication mail address";
    }
    if (!isBriefValid) {
      errors.brief = "Please expand your details to at least 15 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const [isOptimizing, setIsOptimizing] = useState(false);

  const optimizeBriefWithAI = async () => {
    if (!brief.trim()) return;
    setIsOptimizing(true);
    trackEvent("click", "Triggered AI Brief Optimization", { length: brief.length });
    try {
      const res = await fetch("/api/gemini/optimize-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (data.text) {
        setBrief(data.text);
        trackEvent("click", "AI Brief Optimizer returned enriched contents", { previousLength: brief.length, nextLength: data.text.length });
      } else {
        console.error("AI error response", data);
      }
    } catch (e) {
      console.error("Failed to call brief optimizer API:", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    trackEvent("click", "Booking Form submit button clicked", { name, email, tier: selectedTier });
    if (!validate()) {
      trackEvent("click", "Booking Form submit interrupted by validation block");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const submissionData = {
        name: name.trim(),
        company: company.trim() || "Independent Venturer",
        email: email.trim(),
        brief: brief.trim(),
        budget: budget,
        selected_tier: selectedTier,
        selectedTier: selectedTier,
        status: "Pending"
      };

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("bookings").insert([submissionData]);
        if (error) {
          throw new Error(error.message);
        }
        trackEvent("click", "Booking proposal successfully inserted into Supabase", { name, email, selectedTier });
      } else {
        const existingSubmissions = localStorage.getItem("bhakty_form_submissions");
        const submissionsList = existingSubmissions ? JSON.parse(existingSubmissions) : [];
        const newSubmission = {
          id: `sub-${Date.now()}`,
          ...submissionData,
          submitted_at: new Date().toISOString()
        };
        submissionsList.push(newSubmission);
        localStorage.setItem("bhakty_form_submissions", JSON.stringify(submissionsList));
        trackEvent("click", "Booking proposal successfully compiled & logged with local store", { id: newSubmission.id, selectedTier });
      }

      // Add a slight delay for high fidelity digital ingestion animation feel
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setIsSubmitting(false);
      setShowSuccess(true);
    } catch (err: any) {
      console.error("Failed to commit booking submission state:", err);
      // Fallback to local storage on error
      try {
        const submissionData = {
          name: name.trim(),
          company: company.trim() || "Independent Venturer",
          email: email.trim(),
          brief: brief.trim(),
          budget: budget,
          selected_tier: selectedTier,
          selectedTier: selectedTier,
          status: "Pending"
        };
        const existingSubmissions = localStorage.getItem("bhakty_form_submissions");
        const submissionsList = existingSubmissions ? JSON.parse(existingSubmissions) : [];
        const newSubmission = {
          id: `sub-${Date.now()}`,
          ...submissionData,
          submitted_at: new Date().toISOString()
        };
        submissionsList.push(newSubmission);
        localStorage.setItem("bhakty_form_submissions", JSON.stringify(submissionsList));
        trackEvent("click", "Booking proposal successfully fallback-saved to local store after DB error");
        
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setShowSuccess(true);
      } catch (fallbackErr) {
        setIsSubmitting(false);
        console.error("Critically failed to save booking submission:", fallbackErr);
        alert("Failed to submit booking. Please try again.");
      }
    }
  };

  const resetForm = () => {
    setName("");
    setCompany("");
    setEmail("");
    setBrief("");
    setShowSuccess(false);
  };

  return (
    <section id="booking-section" className={`py-24 relative z-10 px-4 md:px-8 transition-all duration-500 ${
      siteSettings.website_full_width === "true" 
        ? "max-w-6xl w-full" 
        : "max-w-4xl mx-auto"
    }`}>
      
      {/* GLOW DECORATIVE BLUR ORB INTEGRATION */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[#E6C687]/5 rounded-full filter blur-[100px] pointer-events-none" />

      {/* BLOCK BACKGROUND FORM PANEL WITH FROSTED GLASSMOPHISM */}
      <div className="glass-panel rounded-3xl p-8 md:p-12 shadow-2xl border border-white/10 relative overflow-hidden backdrop-blur-3xl">
        
        {/* UPPER RADIANT BARS */}
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#E6C687]/40 to-transparent" />
        
        <div className="text-center mb-12">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-[#E6C687] bg-[#E6C687]/5 border border-[#E6C687]/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Creative Intake
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl text-white tracking-tight mb-4">
            Book Creative Studio
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            Supply your dimensional brief and budget brackets. Our orchestration model resolves rendering schedules within 12 hours.
          </p>
        </div>

        {/* INPUT LAYOUT FORM */}
        <form onSubmit={handleSubmit} className="space-y-8" id="booking-form-element">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* NAME / INTAKER */}
            <div className="flex flex-col relative">
              <label className="text-[10px] tracking-widest text-[#E6C687] font-mono uppercase mb-1 flex items-center justify-between">
                <span>Your Identity / Name *</span>
                {nameTouched && (
                  isNameValid ? (
                    <span className="text-emerald-400 text-[9px] flex items-center gap-0.5 animate-pulse"><Check className="w-2.5 h-2.5" /> ID OK</span>
                  ) : (
                    <span className="text-red-400 text-[9px]">Identity Empty</span>
                  )
                )}
              </label>
              <input
                type="text"
                value={name}
                id="input-name"
                onBlur={() => setNameTouched(true)}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                  if (formErrors.name) setFormErrors({ ...formErrors, name: "" });
                }}
                placeholder="e.g. Cassian Andor"
                className={`bg-transparent outline-none border-b ${
                  nameTouched && !isNameValid ? "border-red-500 text-red-100 placeholder-red-800" : nameTouched && isNameValid ? "border-emerald-500/50 focus:border-emerald-500 focus:shadow-[0_1px_0_0_#10B981]" : "border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687]"
                } transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base`}
              />
              {formErrors.name && (
                <div className="text-red-400 text-[10px] uppercase mt-1 px-1 font-mono flex items-center gap-1">
                  <CircleAlert className="w-3 h-3" />
                  {formErrors.name}
                </div>
              )}
            </div>

            {/* COMPANY / VENTURE */}
            <div className="flex flex-col relative">
              <label className="text-[10px] tracking-widest text-gray-400 font-mono uppercase mb-1">
                Company / Studio
              </label>
              <input
                type="text"
                value={company}
                id="input-company"
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Coruscant Arts Ltd"
                className="bg-transparent outline-none border-b border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687] transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* EMAIL */}
            <div className="flex flex-col relative">
              <label className="text-[10px] tracking-widest text-[#E6C687] font-mono uppercase mb-1 flex items-center justify-between">
                <span>Communication Mail *</span>
                {emailTouched && (
                  isEmailValid ? (
                    <span className="text-emerald-400 text-[9px] flex items-center gap-0.5 animate-pulse"><Check className="w-2.5 h-2.5" /> Format validated</span>
                  ) : (
                    <span className="text-red-400 text-[9px]">Check format</span>
                  )
                )}
              </label>
              <input
                type="email"
                value={email}
                id="input-email"
                onBlur={() => setEmailTouched(true)}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailTouched(true);
                  if (formErrors.email) setFormErrors({ ...formErrors, email: "" });
                }}
                placeholder="e.g. cassian@bhakty.net"
                className={`bg-transparent outline-none border-b ${
                  emailTouched && !isEmailValid ? "border-red-500 text-red-100 placeholder-red-800" : emailTouched && isEmailValid ? "border-emerald-500/50 focus:border-emerald-500 focus:shadow-[0_1px_0_0_#10B981]" : "border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687]"
                } transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base`}
              />
              {formErrors.email && (
                <div className="text-red-400 text-[10px] uppercase mt-1 px-1 font-mono flex items-center gap-1">
                  <CircleAlert className="w-3 h-3" />
                  {formErrors.email}
                </div>
              )}
            </div>

            {/* ESTIMATED BUDGET */}
            <div className="flex flex-col relative">
              <label className="text-[10px] tracking-widest text-gray-400 font-mono uppercase mb-1">
                Estimated Budget Bracket
              </label>
              <select
                value={budget}
                id="input-budget"
                onChange={(e) => setBudget(e.target.value)}
                className="bg-transparent outline-none border-b border-white/10 focus:border-[#E6C687] transition-all duration-300 py-3 text-white text-sm md:text-base cursor-pointer select-element-custom"
                style={{
                  colorScheme: "dark"
                }}
              >
                <option value="$2,000 - $5,000" className="bg-[#0e0e16] text-white">$2,000 - $5,000 (Creative Short Scale)</option>
                <option value="$5,000 - $10,000" className="bg-[#0e0e16] text-white">$5,000 - $10,000 (Cinematic Focus)</option>
                <option value="$10,000 - $25,000" className="bg-[#0e0e16] text-white">$10,000 - $25,000 (Enterprise Tier)</option>
                <option value="$25,000+" className="bg-[#0e0e16] text-white">$25,000+ (Extended Campaign Setup)</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 gap-8">
            
            {/* CHOSEN PIPELINE TIER */}
            <div className="flex flex-col relative">
              <label className="text-[10px] tracking-widest text-[#E6C687] font-mono uppercase mb-1">
                Target Production Pipeline
              </label>
              <select
                value={selectedTier}
                id="input-tier"
                onChange={(e) => setSelectedTier(e.target.value)}
                className="bg-transparent outline-none border-b border-white/10 focus:border-[#E6C687] transition-all duration-300 py-3 text-white text-sm md:text-base cursor-pointer select-element-custom"
                style={{
                  colorScheme: "dark"
                }}
              >
                <option value="Short-Form Creative" className="bg-[#0e0e16] text-white">Short-Form Creative Package</option>
                <option value="Full Cinematic Production" className="bg-[#0e0e16] text-white">Full Cinematic Studio Suite</option>
                <option value="Enterprise Studio Pipeline" className="bg-[#0e0e16] text-white">Enterprise Bespoke Pipeline</option>
                <option value="Custom Collaborative" className="bg-[#0e0e16] text-white">Bespoke Strategic Collaboration</option>
              </select>
            </div>

            {/* PROJECT BRIEF */}
            <div className="flex flex-col relative font-sans">
              <label className="text-[10px] tracking-widest text-[#E6C687] font-mono uppercase mb-1 flex items-center justify-between">
                <span>Project Dimensional Brief *</span>
                {brief.length > 0 && (
                  brief.length < 15 ? (
                    <span className="text-amber-500 text-[9px]">Need {15 - brief.length} more chars</span>
                  ) : brief.length < 60 ? (
                    <span className="text-emerald-400 text-[9px] flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> Acceptable Cinematic Prompt</span>
                  ) : (
                    <span className="text-purple-400 text-[9px] flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> High Coherence prompt details</span>
                  )
                )}
              </label>
              <textarea
                value={brief}
                id="input-brief"
                onBlur={() => setBriefTouched(true)}
                onChange={(e) => {
                  setBrief(e.target.value);
                  setBriefTouched(true);
                  if (formErrors.brief) setFormErrors({ ...formErrors, brief: "" });
                }}
                rows={4}
                placeholder="Give details about your visual aesthetic, temporal consistency expectations, targeted platforms or dynamic sound direction..."
                className={`bg-transparent outline-none border-b ${
                  briefTouched && !isBriefValid ? "border-red-500 text-red-150 placeholder-red-800" : briefTouched && isBriefValid ? "border-emerald-500/50 focus:border-emerald-500 focus:shadow-[0_1px_0_0_#10B981]" : "border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687]"
                } transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base resize-none`}
              />
              {formErrors.brief ? (
                <div className="text-red-400 text-[10px] uppercase mt-1 px-1 font-mono flex items-center gap-1">
                  <CircleAlert className="w-3 h-3" />
                  {formErrors.brief}
                </div>
              ) : (
                <span className="text-[10px] text-gray-500 font-mono mt-1 flex items-center justify-between w-full">
                  <span>Minimum criteria: 15 chars ({brief.length} active)</span>
                  <button
                    type="button"
                    disabled={isOptimizing || brief.trim().length === 0}
                    onClick={optimizeBriefWithAI}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-purple-500/20 hover:border-purple-500/60 rounded-lg text-[#E6C687] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none select-none text-[10px] ml-auto uppercase"
                  >
                    {isOptimizing ? (
                      <>
                        <Sparkles className="w-3 h-3 animate-pulse text-[#E6C687]" /> Optimizing Brief...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-purple-400" /> Optimize is AI-assisted
                      </>
                    )}
                  </button>
                </span>
              )}
            </div>

          </div>

          {/* JELLY SQUISH SUBMIT BUTTON */}
          <div className="pt-6 text-center">
            <motion.button
              type="submit"
              id="booking-submit-button"
              disabled={isSubmitting}
              whileHover={{ 
                scale: 1.02,
                transition: { type: "spring", stiffness: 350, damping: 10 }
              }}
              whileTap={{ 
                scaleY: 0.9, 
                scaleX: 1.1,
                transition: { type: "spring", stiffness: 450, damping: 14 } 
              }}
              className="w-full md:w-auto md:px-12 py-4 rounded-2xl font-bold font-display tracking-tight text-white bg-gradient-to-r from-[#4A36B3] via-[#7a5ce0] to-[#E6C687] shadow-xl hover:shadow-[#4A36B3]/20 shadow-black/40 hover:opacity-95 transition-all outline-none flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#050508]">
                  <Sparkles className="w-4 h-4 animate-spin" /> Resolving Coordinates...
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  Request Synthesis Pipeline
                </>
              )}
            </motion.button>
          </div>

        </form>

      </div>

      {/* FULL SCREEN CONFIRMATION MODAL */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            id="success-booking-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#050508]/80 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <motion.div
              id="success-booking-card"
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 16 }}
              className="glass-panel-heavy rounded-3xl p-8 max-w-lg w-full text-center border border-[#E6C687]/30 shadow-2xl relative"
            >
              {/* HEADER DECORATION BAR */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#E6C687] to-transparent" />
              
              <button
                _id="close-success-btn"
                onClick={resetForm}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 rounded-full bg-[#E6C687]/10 border border-[#E6C687]/30 flex items-center justify-center text-[#E6C687] mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-[#E6C687] animate-pulse" />
              </div>

              <h3 className="font-display font-medium text-2xl text-white tracking-tight mb-3">
                Ingested Successfully
              </h3>

              <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                Greetings, <span className="text-[#E6C687] font-semibold">{name}</span>. Your creative matrix of metadata for 
                <span className="text-white font-medium"> {company || "Independent Ventures"} </span> has breached our intake loop.
              </p>

              <div className="bg-black/30 border border-white/5 rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-500">Pipeline Level:</span>
                  <span className="text-white font-medium">{selectedTier}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-500">Coordinate Slot:</span>
                  <span className="text-[#E6C687] font-medium">{budget}</span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-500">Lead Resolver:</span>
                  <span className="text-gray-400">bhakty.orchestrator v4</span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 font-mono">
                We are compiling standard response matrices. Expect direct transmission via <span className="text-gray-300">{email}</span> shortly.
              </p>

              <button
                id="success-dismiss-btn"
                onClick={resetForm}
                className="mt-8 w-full py-3.5 bg-white text-black font-semibold font-display tracking-tight rounded-2xl hover:bg-[#E6C687] transition-all duration-300 cursor-pointer text-sm"
              >
                Reset & Access Portfolio
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
