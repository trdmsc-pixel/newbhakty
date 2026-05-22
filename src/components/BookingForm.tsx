import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, FileText, Briefcase, Plus, CircleAlert, Sparkles, X, CheckCircle, Check } from "lucide-react";
import { BookingSubmission } from "../types";
import { trackEvent } from "../lib/analytics";
import { useSiteData } from "../context/SiteDataContext";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

const COUNTRIES = [
  { code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
  { code: "US", name: "US / Canada", dialCode: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪" },
  { code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺" },
  { code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬" },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷" }
];

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
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [phoneCountry, setPhoneCountry] = useState<Record<string, string>>({});
  const [activeDropdownFieldId, setActiveDropdownFieldId] = useState<string | null>(null);

  // Parse form schema from settings
  const getFormFields = () => {
    try {
      if (siteSettings.booking_form_fields_json) {
        return JSON.parse(siteSettings.booking_form_fields_json);
      }
    } catch (e) {
      console.error("Failed to parse booking_form_fields_json:", e);
    }
    return [
      { id: "name", label: "Your Identity / Name", type: "text", placeholder: "e.g. Cassian Andor", required: true },
      { id: "company", label: "Company / Studio", type: "text", placeholder: "e.g. Coruscant Arts Ltd", required: false },
      { id: "email", label: "Communication Mail", type: "email", placeholder: "e.g. cassian@bhakty.net", required: true },
      { id: "budget", label: "Estimated Budget Bracket", type: "select", options: ["$2,000 - $5,000", "$5,000 - $10,000", "$10,000 - $25,000", "$25,000+"], required: true },
      { id: "selected_tier", label: "Target Production Pipeline", type: "select", options: ["Short-Form Creative", "Full Cinematic Production", "Enterprise Studio Pipeline", "Custom Collaborative"], required: true },
      { id: "brief", label: "Project Dimensional Brief", type: "textarea", placeholder: "Give details about your visual aesthetic, temporal consistency expectations, targeted platforms or dynamic sound direction...", required: true }
    ];
  };

  const fields = React.useMemo(() => {
    return getFormFields();
  }, [siteSettings.booking_form_fields_json]);

  // Initialize custom fields state
  useEffect(() => {
    const initialCustoms: Record<string, string> = {};
    const initialPhoneCountries: Record<string, string> = {};
    fields.forEach((field: any) => {
      if (!["name", "company", "email", "budget", "selected_tier", "brief"].includes(field.id)) {
        if (field.type === "select" && field.options && field.options.length > 0) {
          initialCustoms[field.id] = field.options[0];
        } else if (field.type === "phone") {
          initialCustoms[field.id] = "";
          initialPhoneCountries[field.id] = "+91"; // Default to India (+91)
        } else {
          initialCustoms[field.id] = "";
        }
      }
    });
    setCustomFields(initialCustoms);
    setPhoneCountry(initialPhoneCountries);
  }, [fields]);

  // Click outside country selection dropdown auto-closer
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeDropdownFieldId) {
        const target = e.target as HTMLElement;
        if (!target.closest(".country-dropdown-container")) {
          setActiveDropdownFieldId(null);
        }
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [activeDropdownFieldId]);

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

  // Real-time tracking inputs
  const [nameTouched, setNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [briefTouched, setBriefTouched] = useState(false);

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isBriefValid = brief.trim().length >= 15;

  const getCustomFieldsText = () => {
    return fields
      .filter((f: any) => !["name", "company", "email", "budget", "selected_tier", "brief"].includes(f.id))
      .map((f: any) => {
        if (f.type === "phone") {
          const code = phoneCountry[f.id] || "+91";
          const val = customFields[f.id] || "";
          return `${f.label}: ${code} ${val}`;
        }
        const val = customFields[f.id] || "";
        return `${f.label}: ${val}`;
      })
      .join("\n");
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    setNameTouched(true);
    setEmailTouched(true);
    setBriefTouched(true);

    fields.forEach((field: any) => {
      let val = "";
      if (field.id === "name") val = name;
      else if (field.id === "company") val = company;
      else if (field.id === "email") val = email;
      else if (field.id === "budget") val = budget;
      else if (field.id === "selected_tier") val = selectedTier;
      else if (field.id === "brief") val = brief;
      else val = customFields[field.id] || "";

      if (field.required && !val.trim()) {
        errors[field.id] = `${field.label} is required`;
      } else if (field.id === "name" && field.required && val.trim().length < 2) {
        errors.name = "Synthesizer ID or Name is required (minimum 2 letters)";
      } else if (field.id === "email" && field.required && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors.email = "Please supply a valid communication mail address";
      } else if (field.id === "brief" && field.required && val.trim().length < 15) {
        errors.brief = "Please expand your details to at least 15 characters";
      } else if (field.type === "phone") {
        const cleaned = val.replace(/\D/g, "");
        if (field.required && !cleaned) {
          errors[field.id] = `${field.label} is required`;
        } else if (cleaned && (cleaned.length < 6 || cleaned.length > 15)) {
          errors[field.id] = `${field.label} must contain between 6 and 15 digits`;
        }
      }
    });

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
      let briefText = brief.trim();
      const customFieldsText = getCustomFieldsText();

      if (customFieldsText) {
        briefText += `\n\n[Additional Details]\n${customFieldsText}`;
      }

      const submissionData = {
        name: name.trim(),
        company: company.trim() || "Independent Venturer",
        email: email.trim(),
        brief: briefText,
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
        let briefText = brief.trim();
        const customFieldsText = getCustomFieldsText();

        if (customFieldsText) {
          briefText += `\n\n[Additional Details]\n${customFieldsText}`;
        }

        const submissionData = {
          name: name.trim(),
          company: company.trim() || "Independent Venturer",
          email: email.trim(),
          brief: briefText,
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
    <section id="booking-section" className={`py-24 relative z-10 px-4 md:px-8 transition-all duration-500 mx-auto ${
      siteSettings.website_full_width === "true" 
        ? "max-w-6xl w-full" 
        : "max-w-4xl"
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
            {siteSettings.booking_form_title || "Book Creative Studio"}
          </h2>
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            {siteSettings.booking_form_subtitle || "Supply your dimensional brief and budget brackets. Our orchestration model resolves rendering schedules within 12 hours."}
          </p>
        </div>

        {/* INPUT LAYOUT FORM */}
        <form onSubmit={handleSubmit} className="space-y-8" id="booking-form-element">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {fields.map((field: any) => {
              const isFullWidth = field.type === "textarea" || field.id === "selected_tier" || field.type === "checkbox";
              return (
                <div key={field.id} className={`flex flex-col relative ${isFullWidth ? "md:col-span-2" : ""}`}>
                  <label className="text-[10px] tracking-widest text-[#E6C687] font-mono uppercase mb-1 flex items-center justify-between">
                    <span>{field.label} {field.required && "*"}</span>
                    {field.id === "name" && nameTouched && (
                      isNameValid ? (
                        <span className="text-emerald-400 text-[9px] flex items-center gap-0.5 animate-pulse"><Check className="w-2.5 h-2.5" /> ID OK</span>
                      ) : (
                        <span className="text-red-400 text-[9px]">Identity Empty</span>
                      )
                    )}
                    {field.id === "email" && emailTouched && (
                      isEmailValid ? (
                        <span className="text-emerald-400 text-[9px] flex items-center gap-0.5 animate-pulse"><Check className="w-2.5 h-2.5" /> Format validated</span>
                      ) : (
                        <span className="text-red-400 text-[9px]">Check format</span>
                      )
                    )}
                    {field.id === "brief" && brief.length > 0 && (
                      brief.length < 15 ? (
                        <span className="text-amber-500 text-[9px]">Need {15 - brief.length} more chars</span>
                      ) : brief.length < 60 ? (
                        <span className="text-emerald-400 text-[9px] flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> Acceptable Cinematic Prompt</span>
                      ) : (
                        <span className="text-purple-400 text-[9px] flex items-center gap-0.5"><Check className="w-2.5 h-2.5" /> High Coherence prompt details</span>
                      )
                    )}
                  </label>

                  {field.type === "textarea" ? (
                    <>
                      <textarea
                        value={field.id === "brief" ? brief : customFields[field.id] || ""}
                        id={`input-${field.id}`}
                        onBlur={() => {
                          if (field.id === "brief") setBriefTouched(true);
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (field.id === "brief") {
                            setBrief(val);
                            setBriefTouched(true);
                          } else {
                            setCustomFields(prev => ({ ...prev, [field.id]: val }));
                          }
                          if (formErrors[field.id]) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy[field.id];
                              return copy;
                            });
                          }
                        }}
                        rows={field.id === "brief" ? 4 : 3}
                        placeholder={field.placeholder || ""}
                        className={`bg-transparent outline-none border-b ${
                          formErrors[field.id] 
                            ? "border-red-500 text-red-150 placeholder-red-800" 
                            : "border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687]"
                        } transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base resize-none`}
                      />
                      {field.id === "brief" && (
                        !formErrors.brief ? (
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
                        ) : null
                      )}
                    </>
                  ) : field.type === "select" ? (
                    <select
                      value={
                        field.id === "budget" ? budget :
                        field.id === "selected_tier" ? selectedTier :
                        customFields[field.id] || ""
                      }
                      id={`input-${field.id}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (field.id === "budget") setBudget(val);
                        else if (field.id === "selected_tier") setSelectedTier(val);
                        else setCustomFields(prev => ({ ...prev, [field.id]: val }));
                        if (formErrors[field.id]) {
                          setFormErrors(prev => {
                            const copy = { ...prev };
                            delete copy[field.id];
                            return copy;
                          });
                        }
                      }}
                      className="bg-transparent outline-none border-b border-white/10 focus:border-[#E6C687] transition-all duration-300 py-3 text-white text-sm md:text-base cursor-pointer select-element-custom"
                      style={{
                        colorScheme: "dark"
                      }}
                    >
                      {(field.options || []).map((opt: string) => (
                        <option key={opt} value={opt} className="bg-[#0e0e16] text-white">
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "phone" ? (
                    <div className="flex gap-3 relative country-dropdown-container">
                      {/* Country Selector */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownFieldId(activeDropdownFieldId === field.id ? null : field.id);
                          }}
                          className={`bg-white/5 hover:bg-white/10 border-b ${
                            formErrors[field.id] ? "border-red-500 text-red-100" : "border-white/10 focus:border-[#E6C687]"
                          } transition-all duration-300 py-3 px-3 text-white text-sm md:text-base flex items-center gap-2 rounded-t-lg cursor-pointer h-full`}
                        >
                          <span>{COUNTRIES.find(c => c.dialCode === (phoneCountry[field.id] || "+91"))?.flag || "🇮🇳"}</span>
                          <span className="font-mono text-xs">{phoneCountry[field.id] || "+91"}</span>
                          <span className="text-[8px] text-gray-500">▼</span>
                        </button>

                        <AnimatePresence>
                          {activeDropdownFieldId === field.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.15 }}
                              className="absolute left-0 top-full mt-2 w-56 max-h-60 overflow-y-auto bg-[#0a0a0f]/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md z-50 py-1.5 custom-scrollbar"
                            >
                              {COUNTRIES.map((country) => (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => {
                                    setPhoneCountry(prev => ({ ...prev, [field.id]: country.dialCode }));
                                    setActiveDropdownFieldId(null);
                                    if (formErrors[field.id]) {
                                      setFormErrors(prev => {
                                        const copy = { ...prev };
                                        delete copy[field.id];
                                        return copy;
                                      });
                                    }
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/5 transition-all flex items-center justify-between font-sans"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-base">{country.flag}</span>
                                    <span>{country.name}</span>
                                  </div>
                                  <span className="font-mono text-gray-500 text-[10px]">{country.dialCode}</span>
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Telephone Input */}
                      <input
                        type="tel"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        value={customFields[field.id] || ""}
                        id={`input-${field.id}`}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setCustomFields(prev => ({ ...prev, [field.id]: val }));
                          if (formErrors[field.id]) {
                            setFormErrors(prev => {
                              const copy = { ...prev };
                              delete copy[field.id];
                              return copy;
                            });
                          }
                        }}
                        placeholder={field.placeholder || "e.g. 9876543210"}
                        className={`flex-1 bg-transparent outline-none border-b ${
                          formErrors[field.id] 
                            ? "border-red-500 text-red-150 placeholder-red-800" 
                            : "border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687]"
                        } transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base font-mono`}
                      />
                    </div>
                  ) : (
                    <input
                      type={field.type}
                      value={
                        field.id === "name" ? name :
                        field.id === "company" ? company :
                        field.id === "email" ? email :
                        customFields[field.id] || ""
                      }
                      id={`input-${field.id}`}
                      onBlur={() => {
                        if (field.id === "name") setNameTouched(true);
                        if (field.id === "email") setEmailTouched(true);
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (field.id === "name") {
                          setName(val);
                          setNameTouched(true);
                        } else if (field.id === "company") {
                          setCompany(val);
                        } else if (field.id === "email") {
                          setEmail(val);
                          setEmailTouched(true);
                        } else {
                          setCustomFields(prev => ({ ...prev, [field.id]: val }));
                        }
                        if (formErrors[field.id]) {
                          setFormErrors(prev => {
                            const copy = { ...prev };
                            delete copy[field.id];
                            return copy;
                          });
                        }
                      }}
                      placeholder={field.placeholder || ""}
                      className={`bg-transparent outline-none border-b ${
                        formErrors[field.id] 
                          ? "border-red-500 text-red-100 placeholder-red-800" 
                          : "border-white/10 focus:border-[#E6C687] focus:shadow-[0_1px_0_0_#E6C687]"
                      } transition-all duration-300 py-3 text-white placeholder-gray-600 text-sm md:text-base`}
                    />
                  )}

                  {formErrors[field.id] && (
                    <div className="text-red-400 text-[10px] uppercase mt-1 px-1 font-mono flex items-center gap-1">
                      <CircleAlert className="w-3 h-3" />
                      {formErrors[field.id]}
                    </div>
                  )}
                </div>
              );
            })}
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
              style={{
                ...(siteSettings.booking_cta_color ? { backgroundColor: siteSettings.booking_cta_color, backgroundImage: 'none' } : {}),
                ...(siteSettings.booking_cta_text_color ? { color: siteSettings.booking_cta_text_color } : {})
              }}
              className="w-full md:w-auto md:px-12 py-4 rounded-2xl font-bold font-display tracking-tight text-white bg-gradient-to-r from-[#4A36B3] via-[#7a5ce0] to-[#E6C687] shadow-xl hover:shadow-[#4A36B3]/20 shadow-black/40 hover:opacity-95 transition-all outline-none flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#050508]">
                  <Sparkles className="w-4 h-4 animate-spin text-[#050508]" /> Resolving Coordinates...
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {siteSettings.booking_cta_text || "Request Synthesis Pipeline"}
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
