import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, CheckCircle, ArrowRight, Instagram, Linkedin, Youtube, ExternalLink } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { trackEvent, trackMetaPixelEvent } from "../lib/analytics";
import { Ring } from "./brand/Ring";

const COUNTRIES = [
  { code: "IN", dialCode: "+91", label: "+91" },
  { code: "US", dialCode: "+1", label: "+1" },
  { code: "GB", dialCode: "+44", label: "+44" },
  { code: "AE", dialCode: "+971", label: "+971" },
  { code: "AU", dialCode: "+61", label: "+61" },
  { code: "SG", dialCode: "+65", label: "+65" },
  { code: "DE", dialCode: "+49", label: "+49" },
];

export default function BookingForm() {
  const { siteSettings } = useSiteData();

  // Field states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [clientType, setClientType] = useState("Brand");
  const [selectedTier, setSelectedTier] = useState("Brand film / TVC");
  const [budget, setBudget] = useState("Not sure yet");
  const [timeline, setTimeline] = useState("Within a month");
  const [brief, setBrief] = useState("");
  const [references, setReferences] = useState("");

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Settings
  const contactEmail = siteSettings.contact_email || "studio@thechantingstudio.in";
  const rawWhatsApp = siteSettings.whatsapp_number || "+91 9958194155";
  const digitsOnly = rawWhatsApp.replace(/[^0-9]/g, "");
  const cleanWhatsApp = !digitsOnly || digitsOnly === "919999999999" ? "919958194155" : digitsOnly;
  const whatsappUrl = `https://wa.me/${cleanWhatsApp}`;
  const successMsg = siteSettings.booking_success_message || "Your brief is with us. We'll be in touch shortly.";

  const clientTypeOptions = ["Brand", "Agency", "Production house", "Other"];
  const projectTypeOptions = [
    "Brand film / TVC",
    "AI commercial",
    "Trailer / teaser",
    "Hybrid live-action + VFX",
    "Music video",
    "Something else",
  ];
  const budgetOptions = [
    "Not sure yet",
    "Under ₹3 lakh",
    "₹3–10 lakh",
    "₹10–25 lakh",
    "₹25 lakh+",
    "International (USD)",
  ];
  const timelineOptions = ["ASAP", "Within a month", "1–3 months", "Just exploring"];

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Please provide your name";
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) errors.email = "Please provide a valid business email";
    if (!selectedTier) errors.selectedTier = "Please choose what we are making";
    if (!brief.trim()) errors.brief = "Please provide a few details about your project";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      trackEvent("click", "Inquiry Form validation error");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build additional details
      const additionalDetails = [
        `[You are]: ${clientType}`,
        phone.trim() ? `[Phone]: ${countryCode} ${phone.trim()}` : "",
        `[Timeline]: ${timeline}`,
        references.trim() ? `[Reference links]: ${references.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const fullBrief = brief.trim() + (additionalDetails ? `\n\n[Additional Details]\n${additionalDetails}` : "");

      const submissionData = {
        name: name.trim(),
        company: company.trim() || "Independent",
        email: email.trim(),
        brief: fullBrief,
        budget: budget,
        selected_tier: selectedTier,
        selectedTier: selectedTier,
        status: "Pending",
      };

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("bookings").insert([submissionData]);
        if (error) {
          console.warn("Supabase insert error, falling back to localStorage:", error);
          saveToLocalStorage(submissionData);
        } else {
          trackEvent("click", "Inquiry submitted to Supabase", { name, email, selectedTier });
        }
      } else {
        saveToLocalStorage(submissionData);
      }

      // Studio OS Phase 3: hand the inquiry to the server, which HMAC-signs it for /api/ingest/website
      // (creates Client + Lead project + "Reply to inquiry within 24h"). Never blocks the visitor.
      fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          brief: brief.trim(),
          budget,
          selected_tier: selectedTier,
          phone: phone.trim() ? `${countryCode} ${phone.trim()}` : "",
          timeline,
        }),
      }).catch(() => {});

      // Parse budget currency and value
      const isINR = budget.includes("₹") || budget.includes("lakh");
      const currency = isINR ? "INR" : "USD";

      let numericValue: number | undefined = undefined;
      const parsedNum = budget.match(/\d+/);
      if (parsedNum) {
        let val = parseInt(parsedNum[0], 10);
        if (isINR) {
          val = val * 100000; // convert lakh to full amount
        }
        numericValue = val;
      }

      // Track Meta Pixel Lead with accurate currency and value
      trackMetaPixelEvent(
        "Lead",
        {
          ...(numericValue ? { value: numericValue } : {}),
          currency,
          content_name: "Project Inquiry",
          content_category: selectedTier,
        },
        {
          em: email.trim().toLowerCase(),
          fn: name.trim().toLowerCase(),
          ph: phone.trim() ? `${countryCode}${phone.trim()}`.replace(/\D/g, "") : undefined,
        }
      );

      // Delay for aesthetic transition
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsSubmitting(false);
      setShowSuccess(true);
    } catch (err: any) {
      console.error("Booking submission error:", err);
      setIsSubmitting(false);
    }
  };

  const saveToLocalStorage = (data: any) => {
    try {
      const existing = localStorage.getItem("bhakty_form_submissions");
      const list = existing ? JSON.parse(existing) : [];
      list.push({ id: `sub-${Date.now()}`, ...data, submitted_at: new Date().toISOString() });
      localStorage.setItem("bhakty_form_submissions", JSON.stringify(list));
    } catch (e) {}
  };

  const firstName = name.trim().split(" ")[0] || "there";

  return (
    <section id="contact" className="relative w-full py-28 bg-[var(--tcs-night)] select-none">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* ========================================= */}
          {/* LEFT COLUMN (5 cols): Studio Direct Info */}
          {/* ========================================= */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--tcs-dim)] mb-3">
                START A PROJECT
              </p>
              <h2 className="tcs-h2 text-[var(--tcs-offwhite)] mb-4">
                Tell us what you're making.
              </h2>
              <p className="font-sans text-[var(--tcs-muted)] text-base leading-relaxed mb-10 max-w-md">
                We read every brief and reply personally.
              </p>

              {/* Direct Contacts */}
              <div className="space-y-6 pt-6 border-t border-[var(--tcs-line)]">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-1">
                    EMAIL
                  </p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-mono text-sm text-[var(--tcs-offwhite)] hover:text-white transition-colors"
                  >
                    {contactEmail}
                  </a>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-1">
                    WHATSAPP DIRECT
                  </p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-[var(--tcs-offwhite)] hover:text-white transition-colors inline-flex items-center gap-1.5"
                  >
                    Chat with Director <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </a>
                </div>

                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-1">
                    STUDIO BASE
                  </p>
                  <p className="font-mono text-sm text-[var(--tcs-muted)]">
                    Delhi, India → Worldwide
                  </p>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="pt-10 mt-10 border-t border-[var(--tcs-line)] flex items-center gap-5">
              {siteSettings.instagram_url && (
                <a
                  href={siteSettings.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-[var(--tcs-dim)] hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {siteSettings.linkedin_url && (
                <a
                  href={siteSettings.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="text-[var(--tcs-dim)] hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
              )}
              {siteSettings.youtube_url && (
                <a
                  href={siteSettings.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="text-[var(--tcs-dim)] hover:text-[var(--tcs-offwhite)] transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* ========================================= */}
          {/* RIGHT COLUMN (7 cols): The Inquiry Form  */}
          {/* ========================================= */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {!showSuccess ? (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* Name */}
                  <div className="relative group">
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                      NAME *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: "" }));
                      }}
                      placeholder="Your full name"
                      className="w-full bg-transparent border-0 border-b border-[var(--tcs-line)] pb-3 text-base text-[var(--tcs-offwhite)] placeholder-[var(--tcs-dim)] focus:outline-none focus:border-transparent transition-all font-sans"
                    />
                    {/* Spectral focus draw line */}
                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                    {formErrors.name && (
                      <p className="font-mono text-[10px] text-[var(--tcs-crimson)] mt-1.5 uppercase tracking-wide">
                        {formErrors.name}
                      </p>
                    )}
                  </div>

                  {/* Email & Company */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="relative group">
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                        EMAIL *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: "" }));
                        }}
                        placeholder="name@company.com"
                        className="w-full bg-transparent border-0 border-b border-[var(--tcs-line)] pb-3 text-base text-[var(--tcs-offwhite)] placeholder-[var(--tcs-dim)] focus:outline-none focus:border-transparent transition-all font-sans"
                      />
                      <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                      {formErrors.email && (
                        <p className="font-mono text-[10px] text-[var(--tcs-crimson)] mt-1.5 uppercase tracking-wide">
                          {formErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="relative group">
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                        COMPANY / BRAND
                      </label>
                      <input
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Company or brand"
                        className="w-full bg-transparent border-0 border-b border-[var(--tcs-line)] pb-3 text-base text-[var(--tcs-offwhite)] placeholder-[var(--tcs-dim)] focus:outline-none focus:border-transparent transition-all font-sans"
                      />
                      <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                    </div>
                  </div>

                  {/* WhatsApp / Phone with country select */}
                  <div className="relative group">
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                      WHATSAPP / PHONE
                    </label>
                    <div className="flex items-baseline gap-3 border-b border-[var(--tcs-line)] pb-3">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-transparent text-[var(--tcs-muted)] font-mono text-sm focus:outline-none cursor-pointer"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.dialCode} className="bg-[var(--tcs-night)] text-[var(--tcs-offwhite)]">
                            {c.code} ({c.dialCode})
                          </option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full bg-transparent border-0 text-base text-[var(--tcs-offwhite)] placeholder-[var(--tcs-dim)] focus:outline-none font-sans"
                      />
                    </div>
                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                  </div>

                  {/* You are — chips */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-3">
                      YOU ARE
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {clientTypeOptions.map((opt) => {
                        const isSelected = clientType === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setClientType(opt)}
                            className={`px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.12em] border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] border-[var(--tcs-offwhite)] font-bold shadow-md"
                                : "border-[var(--tcs-line)] text-[var(--tcs-muted)] hover:border-[var(--tcs-offwhite)]/40 hover:text-white"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* What are we making?* — chips */}
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-3">
                      WHAT ARE WE MAKING? *
                    </label>
                    <div className="flex flex-wrap gap-2.5">
                      {projectTypeOptions.map((opt) => {
                        const isSelected = selectedTier === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setSelectedTier(opt);
                              if (formErrors.selectedTier) setFormErrors((prev) => ({ ...prev, selectedTier: "" }));
                            }}
                            className={`px-4 py-2 rounded-full font-mono text-[11px] uppercase tracking-[0.12em] border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] border-[var(--tcs-offwhite)] font-bold shadow-md"
                                : "border-[var(--tcs-line)] text-[var(--tcs-muted)] hover:border-[var(--tcs-offwhite)]/40 hover:text-white"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {formErrors.selectedTier && (
                      <p className="font-mono text-[10px] text-[var(--tcs-crimson)] mt-1.5 uppercase tracking-wide">
                        {formErrors.selectedTier}
                      </p>
                    )}
                  </div>

                  {/* Budget range & Timeline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="relative group">
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                        BUDGET RANGE
                      </label>
                      <select
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="w-full bg-transparent border-0 border-b border-[var(--tcs-line)] pb-3 text-sm text-[var(--tcs-offwhite)] focus:outline-none cursor-pointer font-mono"
                      >
                        {budgetOptions.map((b) => (
                          <option key={b} value={b} className="bg-[var(--tcs-night)] text-[var(--tcs-offwhite)]">
                            {b}
                          </option>
                        ))}
                      </select>
                      <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-3">
                        TIMELINE
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {timelineOptions.map((t) => {
                          const isSelected = timeline === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTimeline(t)}
                              className={`px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider border transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] border-[var(--tcs-offwhite)] font-bold"
                                  : "border-[var(--tcs-line)] text-[var(--tcs-muted)] hover:border-white/40 hover:text-white"
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Tell us about the project* */}
                  <div className="relative group">
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                      TELL US ABOUT THE PROJECT *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={brief}
                      onChange={(e) => {
                        setBrief(e.target.value);
                        if (formErrors.brief) setFormErrors((prev) => ({ ...prev, brief: "" }));
                      }}
                      placeholder="The story, where it will run, any references or deadlines."
                      className="w-full bg-transparent border-0 border-b border-[var(--tcs-line)] pb-3 text-base text-[var(--tcs-offwhite)] placeholder-[var(--tcs-dim)] focus:outline-none focus:border-transparent transition-all font-sans resize-none"
                    />
                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                    {formErrors.brief && (
                      <p className="font-mono text-[10px] text-[var(--tcs-crimson)] mt-1.5 uppercase tracking-wide">
                        {formErrors.brief}
                      </p>
                    )}
                  </div>

                  {/* Reference links */}
                  <div className="relative group">
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--tcs-dim)] mb-2">
                      REFERENCE LINKS (OPTIONAL)
                    </label>
                    <input
                      type="url"
                      value={references}
                      onChange={(e) => setReferences(e.target.value)}
                      placeholder="https://vimeo.com/... or Google Drive link"
                      className="w-full bg-transparent border-0 border-b border-[var(--tcs-line)] pb-3 text-sm text-[var(--tcs-offwhite)] placeholder-[var(--tcs-dim)] focus:outline-none font-mono"
                    />
                    <div className="absolute bottom-0 left-0 w-full h-[1.5px] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-400 ease-[0.16,1,0.3,1] origin-left pointer-events-none" style={{ background: "var(--tcs-spectrum-linear)" }} />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full md:w-auto px-10 py-4 rounded bg-[var(--tcs-offwhite)] text-[var(--tcs-night)] font-mono text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-3 hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Ring size={18} stroke={2.5} animate="spin-slow" />
                          <span>Sending inquiry...</span>
                        </>
                      ) : (
                        <span>Send inquiry</span>
                      )}
                    </button>
                  </div>
                </motion.form>
              ) : (
                /* Success State */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="py-16 px-8 rounded border border-[var(--tcs-line)] bg-[var(--tcs-night-2)]/60 text-center flex flex-col items-center"
                >
                  <div className="mb-6 relative">
                    <Ring size={72} stroke={4} glow={true} animate="spin-slow" />
                  </div>
                  <h3 className="font-display font-medium text-2xl md:text-3xl text-[var(--tcs-offwhite)] mb-3">
                    Thank you, {firstName}.
                  </h3>
                  <p className="font-sans text-[var(--tcs-muted)] text-base max-w-md mx-auto mb-8 leading-relaxed">
                    {successMsg}
                  </p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded border border-[var(--tcs-line)] text-[var(--tcs-offwhite)] font-mono text-xs uppercase tracking-widest hover:border-white transition-all cursor-pointer"
                  >
                    <span>Urgent brief? Chat on WhatsApp</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
