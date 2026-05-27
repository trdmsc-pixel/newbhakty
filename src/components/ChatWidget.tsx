import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, Send, Mic, MicOff, X, Plus, Loader2, Image, AlertCircle, Paperclip, Check, CheckCheck
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { useSiteData } from "../context/SiteDataContext";
import { useToast } from "../context/ToastContext";
import { trackMetaPixelEvent, trackMetaPixelCustomEvent } from "../lib/analytics";

interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "admin" | "bot";
  text: string;
  media_url?: string;
  created_at: string;
  status?: "sending" | "delivered" | "read";
}

function playPingSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn("AudioContext failed to play ping:", err);
  }
}

export default function ChatWidget() {
  const { siteSettings } = useSiteData();
  const toast = useToast();
  
  // Scoped layout styles from settings
  const isLiveTheme = typeof document !== "undefined" && document.body.classList.contains("theme-live");
  
  const auraColor1 = isLiveTheme ? "#ff007f" : (siteSettings.chat_aura_color_1 || "#06b6d4");
  const auraColor2 = isLiveTheme ? "#77003c" : (siteSettings.chat_aura_color_2 || "#8b5cf6");
  const auraColor3 = isLiveTheme ? "#000000" : (siteSettings.chat_aura_color_3 || "#3b82f6");
  const launcherLabel = siteSettings.chat_launcher_label || "Chat Support";
  
  const themePrimary = isLiveTheme ? "#ff007f" : (siteSettings.chat_theme_primary || "#7342e2");
  const themeBg = siteSettings.chat_theme_bg || "#0c0c16";
  const bubbleUser = isLiveTheme ? "rgba(255, 0, 127, 0.25)" : (siteSettings.chat_theme_bubble_user || "rgba(115, 66, 226, 0.25)");
  const bubbleAi = siteSettings.chat_theme_bubble_ai || "rgba(255, 255, 255, 0.05)";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
  
  // Session & Form Lead Data states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0 = pre-chat form
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadErrors, setLeadErrors] = useState<Record<string, string>>({});
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Show invitation tooltip after 2.5 seconds when closed
  useEffect(() => {
    if (isOpen || tooltipDismissed) {
      setShowTooltip(false);
      return;
    }
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, [isOpen, tooltipDismissed]);

  // Helper to calculate current step based on session info
  const determineBotStep = (session: any): number => {
    if (!session) return 0;
    if (!session.production_type) return 1;
    if (session.production_type === "AI" && !session.production_grade) return 2;
    if (!session.budget) return 3;
    if (!session.requirements_brief) return 4;
    return 5; // Free-chat with producer takeover
  };

  // Initialize and check session
  useEffect(() => {
    const initializeSession = async () => {
      let savedSessionId = localStorage.getItem("chat_session_id");
      
      if (isSupabaseConfigured && supabase) {
        try {
          if (savedSessionId) {
            const { data: session } = await supabase
              .from("chat_sessions")
              .select("*")
              .eq("id", savedSessionId)
              .single();
            
            if (session) {
              setSessionId(session.id);
              setSessionData(session);
              const step = determineBotStep(session);
              setCurrentStep(step);
              
              // Load historical messages
              const { data: msgs } = await supabase
                .from("chat_messages")
                .select("*")
                .eq("session_id", session.id)
                .order("created_at", { ascending: true });
              
              if (msgs) {
                setMessages(msgs);
              }
            } else {
              localStorage.removeItem("chat_session_id");
              savedSessionId = null;
            }
          }
        } catch (err) {
          console.warn("Supabase session check failed, using local storage:", err);
          savedSessionId = null;
        }
      }
      
      if (!savedSessionId) {
        const localSessId = localStorage.getItem("local_chat_session_id");
        if (localSessId) {
          setSessionId(localSessId);
          const localSess = localStorage.getItem(`local_chat_session_${localSessId}`);
          if (localSess) {
            const parsed = JSON.parse(localSess);
            setSessionData(parsed);
            setCurrentStep(determineBotStep(parsed));
          }
          const localMsgs = localStorage.getItem(`local_chat_messages_${localSessId}`);
          if (localMsgs) {
            setMessages(JSON.parse(localMsgs));
          }
        } else {
          setCurrentStep(0);
        }
      }
    };

    initializeSession();
  }, []);

  // Sync / Real-time postgres subscriptions
  useEffect(() => {
    if (!sessionId) return;

    // Clear unread count when widget opens & mark admin messages as read
    if (isOpen) {
      setUnreadCount(0);
      const markAsRead = async () => {
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase
              .from("chat_messages")
              .update({ status: "read" })
              .eq("session_id", sessionId)
              .eq("sender", "admin")
              .neq("status", "read");
          } catch (e) {
            console.warn("Error marking messages as read:", e);
          }
        } else {
          // Local storage read updates
          const localMsgs = localStorage.getItem(`local_chat_messages_${sessionId}`);
          if (localMsgs) {
            const parsed = JSON.parse(localMsgs) as ChatMessage[];
            const updated = parsed.map(m => m.sender === "admin" ? { ...m, status: "read" as const } : m);
            localStorage.setItem(`local_chat_messages_${sessionId}`, JSON.stringify(updated));
            localStorage.setItem(`local_chat_messages_updated_${sessionId}`, Date.now().toString());
          }
        }
      };
      markAsRead();
    }

    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`chat_session_${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
            filter: `session_id=eq.${sessionId}`,
          },
          async (payload) => {
            if (payload.eventType === "INSERT") {
              const newMsg = payload.new as ChatMessage;
              
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.sender === "admin") {
                if (!isOpen || document.hidden) {
                  setUnreadCount((prev) => prev + 1);
                  playPingSound();
                } else {
                  try {
                    await supabase
                      .from("chat_messages")
                      .update({ status: "read" })
                      .eq("id", newMsg.id);
                  } catch (e) {
                    console.warn("Failed to mark message as read:", e);
                  }
                }
              }
            } else if (payload.eventType === "UPDATE") {
              const updatedMsg = payload.new as ChatMessage;
              setMessages((prev) =>
                prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
              );
            }
          }
        )
        .subscribe();

      // Listen for updates on the session row to see if admin pauses or changes session properties
      const sessionChannel = supabase
        .channel(`chat_session_row_${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "chat_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const updatedSess = payload.new;
            setSessionData(updatedSess);
            setCurrentStep(determineBotStep(updatedSess));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(sessionChannel);
      };
    } else {
      // Local storage fallback drivers - listen to window storage events
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === `local_chat_messages_updated_${sessionId}` || e.key === "local_chat_session_updated") {
          const localMsgs = localStorage.getItem(`local_chat_messages_${sessionId}`);
          if (localMsgs) {
            const parsed = JSON.parse(localMsgs) as ChatMessage[];
            setMessages((prev) => {
              const newAdminMsgs = parsed.filter(
                (m) => m.sender === "admin" && !prev.some((pm) => pm.id === m.id)
              );
              if (newAdminMsgs.length > 0 && (!isOpen || document.hidden)) {
                setUnreadCount((prevCount) => prevCount + newAdminMsgs.length);
                playPingSound();
              }
              return parsed;
            });
          }
          
          const localSess = localStorage.getItem(`local_chat_session_${sessionId}`);
          if (localSess) {
            const parsedSess = JSON.parse(localSess);
            setSessionData(parsedSess);
            setCurrentStep(determineBotStep(parsedSess));
          }
        }
      };

      window.addEventListener("storage", handleStorageChange);
      return () => window.removeEventListener("storage", handleStorageChange);
    }
  }, [sessionId, isOpen]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isVoiceMode]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onstart = () => {
        setIsListening(true);
        setSpeechTranscript("");
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setSpeechTranscript(final || interim);
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e);
        setIsListening(false);
        setIsVoiceMode(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const startVoiceRecognition = () => {
    if (recognitionRef.current) {
      setIsVoiceMode(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Speech Recognition already active:", err);
      }
    } else {
      toast.error("Web Speech API is not supported on this browser.");
    }
  };

  const stopVoiceAndSubmit = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsVoiceMode(false);
    
    if (speechTranscript.trim()) {
      if (currentStep === 4) {
        handleBotStepAnswer(speechTranscript.trim(), { requirements_brief: speechTranscript.trim(), status: "active" });
      } else {
        handleSendMessage(speechTranscript.trim());
      }
    }
    setSpeechTranscript("");
  };

  const cancelVoiceRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setIsVoiceMode(false);
    setSpeechTranscript("");
  };

  // Media file change loader
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    setIsUploading(true);
    const tempUrl = URL.createObjectURL(file);
    setPendingImageUrl(tempUrl);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setPendingImageBase64(reader.result as string);
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const path = `chat-media-${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from("chat-media")
          .upload(path, file);

        if (error) throw error;

        const { data: publicData } = supabase.storage
          .from("chat-media")
          .getPublicUrl(path);

        if (publicData?.publicUrl) {
          setPendingImageUrl(publicData.publicUrl);
        }
      } catch (err) {
        console.warn("Storage upload failed, fallback to local URL:", err);
      }
    }
    setIsUploading(false);
  };

  // Pre-chat Form Submission Handler
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!leadName.trim()) errors.name = "Name is required";
    if (!leadEmail.trim() || !/\S+@\S+\.\S+/.test(leadEmail)) errors.email = "Valid email is required";
    if (!leadPhone.trim() || leadPhone.replace(/\D/g, "").length < 6) errors.phone = "Phone must be at least 6 digits";

    if (Object.keys(errors).length > 0) {
      setLeadErrors(errors);
      return;
    }

    setIsSending(true);
    let newUserId = "";
    let newSessId = "";
    let sessionObj: any = null;

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Insert chat user
        const { data: userData, error: userErr } = await supabase
          .from("chat_users")
          .insert([{ name: leadName.trim(), email: leadEmail.trim(), phone: leadPhone.trim() }])
          .select()
          .single();

        if (userErr) throw userErr;
        newUserId = userData.id;

        // 2. Insert session
        const { data: sessData, error: sessErr } = await supabase
          .from("chat_sessions")
          .insert([{ user_id: newUserId, status: "active", pause_ai: true, unread_count: 0 }])
          .select()
          .single();

        if (sessErr) throw sessErr;
        newSessId = sessData.id;
        sessionObj = sessData;

        // 3. Insert first greeting bot message
        const botMsg = {
          session_id: newSessId,
          sender: "bot",
          text: "Welcome to The Chanting Studio. Are you looking for AI production or Live-Action production?",
          status: "delivered"
        };
        await supabase.from("chat_messages").insert([botMsg]);
      } catch (err: any) {
        toast.error(`Database initialization failed: ${err.message || err}`);
        setIsSending(false);
        return;
      }
    } else {
      // Local Storage Fallback
      newUserId = `usr-${Date.now()}`;
      newSessId = `sess-${Date.now()}`;
      
      const userObj = { id: newUserId, name: leadName.trim(), email: leadEmail.trim(), phone: leadPhone.trim() };
      sessionObj = {
        id: newSessId,
        user_id: newUserId,
        status: "active",
        pause_ai: true,
        unread_count: 0,
        production_type: null,
        production_grade: null,
        budget: null,
        requirements_brief: null
      };

      const greetingMsg: ChatMessage = {
        id: `msg-bot-g-${Date.now()}`,
        sender: "bot",
        text: "Welcome to The Chanting Studio. Are you looking for AI production or Live-Action production?",
        created_at: new Date().toISOString(),
        status: "delivered"
      };

      localStorage.setItem(`local_chat_user_${newUserId}`, JSON.stringify(userObj));
      localStorage.setItem(`local_chat_session_${newSessId}`, JSON.stringify(sessionObj));
      localStorage.setItem(`local_chat_messages_${newSessId}`, JSON.stringify([greetingMsg]));
      localStorage.setItem("local_chat_session_id", newSessId);
      
      setMessages([greetingMsg]);
    }

    // Track Meta Pixel Lead Event on Pre-chat submit
    trackMetaPixelEvent(
      "Lead", 
      {
        content_name: "Pre-chat Lead Capture Submit"
      }, 
      {
        em: leadEmail.trim().toLowerCase(),
        fn: leadName.trim().toLowerCase(),
        ph: leadPhone.trim().replace(/\D/g, "")
      }
    );

    setSessionId(newSessId);
    setSessionData(sessionObj);
    setCurrentStep(1);
    setIsSending(false);
    localStorage.setItem("chat_session_id", newSessId);
  };

  // State Machine Trigger to Answer Bot Questions
  const handleBotStepAnswer = async (answerText: string, updates: Record<string, any>) => {
    if (!sessionId) return;
    setIsSending(true);

    const userMsg = {
      session_id: sessionId,
      sender: "user" as const,
      text: answerText,
      media_url: pendingImageUrl || undefined,
      status: "delivered" as const
    };

    let insertedUserMsg: ChatMessage | null = null;
    const updatedSess = { ...sessionData, ...updates };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: userMsgData } = await supabase
          .from("chat_messages")
          .insert([userMsg])
          .select()
          .single();
        insertedUserMsg = userMsgData;

        await supabase
          .from("chat_sessions")
          .update(updates)
          .eq("id", sessionId);
      } catch (err) {
        console.error("Database update error:", err);
      }
    } else {
      // Local Storage
      insertedUserMsg = {
        ...userMsg,
        id: `msg-user-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      localStorage.setItem(`local_chat_session_${sessionId}`, JSON.stringify(updatedSess));
      localStorage.setItem("local_chat_session_updated", Date.now().toString());
    }

    setSessionData(updatedSess);
    const nextStep = determineBotStep(updatedSess);
    setCurrentStep(nextStep);

    let botText = "";
    if (nextStep === 2) {
      botText = "Which level of production do you need?";
    } else if (nextStep === 3) {
      botText = "What is your estimated budget for this project?";
    } else if (nextStep === 4) {
      botText = "Please provide a brief overview of your requirements.";
    } else if (nextStep === 5) {
      botText = "Thank you. Our producer will contact you shortly.";
    }

    if (botText) {
      const botMsg = {
        session_id: sessionId,
        sender: "bot" as const,
        text: botText,
        status: "delivered" as const
      };

      if (isSupabaseConfigured && supabase) {
        try {
          const { data: botMsgData } = await supabase
            .from("chat_messages")
            .insert([botMsg])
            .select()
            .single();
          if (botMsgData) {
            setMessages((prev) => [...prev, botMsgData]);
          }
        } catch (err) {
          console.error("Error inserting bot response:", err);
        }
      } else {
        const botMsgObj: ChatMessage = {
          ...botMsg,
          id: `msg-bot-${Date.now()}`,
          created_at: new Date().toISOString()
        };
        const localMsgs = JSON.parse(localStorage.getItem(`local_chat_messages_${sessionId}`) || "[]");
        const finalMsgs = [...localMsgs, insertedUserMsg, botMsgObj].filter(Boolean);
        localStorage.setItem(`local_chat_messages_${sessionId}`, JSON.stringify(finalMsgs));
        localStorage.setItem(`local_chat_messages_updated_${sessionId}`, Date.now().toString());
        setMessages(finalMsgs);
      }
    }

    setPendingImageUrl(null);
    setPendingImageBase64(null);
    setIsSending(false);
  };

  // Free-form Message Sender (Activated after Bot Flow completes)
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputText;
    if (!textToSend.trim() && !pendingImageUrl) return;
    if (!sessionId) return;

    setIsSending(true);
    setInputText("");
    const mediaUrl = pendingImageUrl;

    const userMsg = {
      session_id: sessionId,
      sender: "user" as const,
      text: textToSend,
      media_url: mediaUrl || undefined,
      status: "delivered" as const
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from("chat_messages").insert([userMsg]);
        
        // Update last message timestamp and admin unread badge count
        const { data: sess } = await supabase
          .from("chat_sessions")
          .select("unread_count")
          .eq("id", sessionId)
          .single();
        
        await supabase
          .from("chat_sessions")
          .update({
            last_message_at: new Date().toISOString(),
            unread_count: (sess?.unread_count || 0) + 1
          })
          .eq("id", sessionId);
      } catch (err) {
        console.error("Failed to send user message:", err);
      }
    } else {
      // Local Storage
      const userMsgObj: ChatMessage = {
        ...userMsg,
        id: `msg-user-${Date.now()}`,
        created_at: new Date().toISOString()
      };
      const localMsgs = JSON.parse(localStorage.getItem(`local_chat_messages_${sessionId}`) || "[]");
      const finalMsgs = [...localMsgs, userMsgObj];
      localStorage.setItem(`local_chat_messages_${sessionId}`, JSON.stringify(finalMsgs));
      localStorage.setItem(`local_chat_messages_updated_${sessionId}`, Date.now().toString());
      setMessages(finalMsgs);

      // Trigger local storage session update for unread counter
      const sessionObj = JSON.parse(localStorage.getItem(`local_chat_session_${sessionId}`) || "{}");
      sessionObj.unread_count = (sessionObj.unread_count || 0) + 1;
      sessionObj.last_message_at = new Date().toISOString();
      localStorage.setItem(`local_chat_session_${sessionId}`, JSON.stringify(sessionObj));
      localStorage.setItem("local_chat_session_updated", Date.now().toString());
    }

    setPendingImageUrl(null);
    setPendingImageBase64(null);
    setIsSending(false);
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --chat-aura-1: ${auraColor1};
          --chat-aura-2: ${auraColor2};
          --chat-aura-3: ${auraColor3};
          --chat-theme-bg: ${themeBg};
          --chat-theme-primary: ${themePrimary};
          --chat-bubble-user: ${bubbleUser};
          --chat-bubble-ai: ${bubbleAi};
        }
        @keyframes voiceOrbPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 35px var(--chat-aura-2), 0 0 70px var(--chat-aura-1); }
          50% { transform: scale(1.06); box-shadow: 0 0 55px var(--chat-aura-2), 0 0 110px var(--chat-aura-3); }
        }
        .animate-voice-orb {
          animation: voiceOrbPulse 2.5s infinite ease-in-out;
        }
      `}} />

      {/* FLOAT CHAT LAUNCHER BUTTON */}
      <div className="fixed bottom-6 right-6 z-[99999] flex flex-col items-end gap-3 pointer-events-none">
        {/* Tooltip speech bubble */}
        <AnimatePresence>
          {!isOpen && showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="bg-[#0b0c16]/95 backdrop-blur-md border border-white/10 rounded-2xl pl-4 pr-8 py-3 text-xs text-white shadow-2xl pointer-events-auto max-w-[240px] text-right font-sans relative mr-2 cursor-pointer hover:border-white/20 transition-colors"
              onClick={() => {
                setIsOpen(true);
                setShowTooltip(false);
              }}
            >
              
              {/* Close/Cross button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltipDismissed(true);
                  setShowTooltip(false);
                }}
                className="absolute top-2.5 right-2.5 text-gray-400 hover:text-white transition-colors p-0.5 rounded-full hover:bg-white/10"
                aria-label="Dismiss tooltip"
              >
                <X className="w-3 h-3" />
              </button>

              <div className="flex gap-2 items-start text-left">
                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 animate-ping shrink-0" />
                <div>
                  <span className="font-semibold block mb-0.5 text-white">
                    {sessionId ? "Resume Chat" : "Start a Chat"}
                  </span>
                  <span className="text-gray-400 text-[11px] leading-relaxed block">
                    {sessionId 
                      ? "Click to resume your conversation with our production team." 
                      : "Let's discuss your project. We'll need a few details to connect you."}
                  </span>
                </div>
              </div>
              
              {/* Little triangle arrow at the bottom right pointing down to the launcher */}
              <div className="absolute right-6 -bottom-1.5 w-3 h-3 bg-[#0b0c16] border-r border-b border-white/10 rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3">
          <AnimatePresence>
            {!isOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-xl cursor-pointer hover:border-white/20 transition-all select-none hidden sm:block pointer-events-auto font-sans"
                onClick={() => {
                  setIsOpen(true);
                  setShowTooltip(false);
                }}
              >
                <span>{launcherLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => {
              setIsOpen(!isOpen);
              setShowTooltip(false);
            }}
            className="relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer overflow-visible pointer-events-auto shadow-2xl border border-white/5 bg-black"
          >
          
          <div className="absolute inset-[2px] rounded-full bg-zinc-950 flex items-center justify-center">
            {isOpen ? (
              <X className="w-5 h-5 text-white" />
            ) : (
              <MessageSquare className="w-5 h-5 text-white" />
            )}
          </div>

          {/* Unread Message Badge Notification */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white font-mono text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-black shadow">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </div>

      {/* MAIN CHAT INTERACTION VIEWPORT PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] sm:w-[400px] h-[550px] z-[99999] flex flex-col rounded-3xl overflow-hidden border border-white/10 shadow-2xl pointer-events-auto"
            style={{ backgroundColor: "var(--chat-theme-bg)", backgroundImage: "radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.05) 0%, transparent 40%)" }}
          >
            {/* PANEL HEADER */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/35 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--chat-aura-1)] to-[var(--chat-aura-2)] flex items-center justify-center relative overflow-hidden shrink-0">
                  <div className="absolute inset-[1.5px] bg-[#050508] rounded-full flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                    <span>Studio Concierge</span>
                  </h3>
                  <p className="text-[10px] text-gray-400 font-sans mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                    <span>Real-time Producer Link</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SCREEN CONTENT */}
            <div className="flex-1 overflow-y-auto flex flex-col justify-between">
              {currentStep === 0 ? (
                /* PRE-CHAT FORM SCREEN */
                <form onSubmit={handleLeadSubmit} className="flex-1 flex flex-col justify-center p-6 space-y-4">
                  {/* Bot greeting bubble */}
                  <div className="flex flex-col items-start mb-2">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs font-sans leading-relaxed text-white bg-white/[0.03] border border-white/5 shadow-md">
                      <span>👋 Hello! Welcome to the support console. Please enter your name, email, and phone number to start the chat.</span>
                    </div>
                    <div className="mt-1 pl-1">
                      <span className="text-[8px] font-mono text-gray-500 uppercase">Studio Assistant</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-gray-500">Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Christopher Nolan"
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className={`w-full bg-white/5 border ${leadErrors.name ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-[var(--chat-theme-primary)]"} rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-sans`}
                    />
                    {leadErrors.name && <span className="text-[9px] text-red-500 font-mono">{leadErrors.name}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-gray-500">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. christopher@sync.com"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className={`w-full bg-white/5 border ${leadErrors.email ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-[var(--chat-theme-primary)]"} rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-sans`}
                    />
                    {leadErrors.email && <span className="text-[9px] text-red-500 font-mono">{leadErrors.email}</span>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-gray-500">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="e.g. +1 555-0199"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className={`w-full bg-white/5 border ${leadErrors.phone ? "border-red-500 focus:border-red-500" : "border-white/10 focus:border-[var(--chat-theme-primary)]"} rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none transition-all font-sans`}
                    />
                    {leadErrors.phone && <span className="text-[9px] text-red-500 font-mono">{leadErrors.phone}</span>}
                  </div>

                  <button 
                    type="submit"
                    disabled={isSending}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--chat-aura-1)] to-[var(--chat-theme-primary)] text-white hover:opacity-90 font-semibold font-display tracking-tight text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4 uppercase border border-white/10 transition-all"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting Ingestion...
                      </>
                    ) : (
                      "Start Producer Chat"
                    )}
                  </button>
                </form>
              ) : isVoiceMode ? (
                /* VOICE MODE LAYOUT */
                <div className="flex-1 flex flex-col justify-center items-center p-6 text-center gap-8 relative overflow-hidden">
                  <p className="text-xs text-gray-500 font-sans max-w-[280px] leading-relaxed italic">
                    "Speak your creative parameters clearly"
                  </p>

                  <div 
                    onClick={stopVoiceAndSubmit}
                    className="relative w-36 h-36 rounded-full flex items-center justify-center cursor-pointer pointer-events-auto animate-voice-orb"
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-[var(--chat-aura-1)] via-[var(--chat-aura-2)] to-indigo-950 opacity-80 blur-[1px] rounded-full" />
                    <div className="absolute inset-1.5 bg-gradient-to-bl from-pink-500/20 via-violet-600/30 to-cyan-500/20 rounded-full mix-blend-color-dodge animate-spin" style={{ animationDuration: "12s" }} />
                    <div className="absolute top-3 left-5 w-16 h-8 bg-white/20 rounded-full filter blur-[1px] transform -rotate-[20deg]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.45),transparent_65%)] rounded-full" />
                    
                    <Mic className="w-7 h-7 text-white relative z-10 animate-bounce" />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-white uppercase tracking-wider font-display">
                      {isListening ? "Listening..." : "Processing Speech..."}
                    </p>
                    {speechTranscript ? (
                      <p className="text-xs text-gray-300 font-sans max-w-[280px] line-clamp-3 bg-white/5 border border-white/5 rounded-2xl px-4 py-2 border-dashed">
                        {speechTranscript}
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-500 font-mono">Audio capture pipeline ready</p>
                    )}
                  </div>

                  <div className="flex gap-4 w-full justify-center pt-4">
                    <button 
                      onClick={cancelVoiceRecognition}
                      className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={stopVoiceAndSubmit}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-white hover:bg-gray-200 cursor-pointer shadow-lg"
                    >
                      Use Transcript
                    </button>
                  </div>
                </div>
              ) : (
                /* CHAT HISTORY & INPUT CONTAINER */
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  {/* Messages list */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {messages.map((msg) => {
                      const isUser = msg.sender === "user";
                      const isBot = msg.sender === "bot";
                      
                      let receiptIcon = null;
                      if (isUser) {
                        if (msg.status === "sending") {
                          receiptIcon = <Loader2 className="w-2.5 h-2.5 animate-spin text-gray-500" />;
                        } else if (msg.status === "read") {
                          receiptIcon = <CheckCheck className="w-3 h-3 text-emerald-500" />;
                        } else {
                          receiptIcon = <Check className="w-3 h-3 text-cyan-500" />;
                        }
                      }

                      return (
                        <div 
                          key={msg.id}
                          className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                        >
                          <div 
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed text-white relative border border-white/5 shadow-md ${
                              isUser 
                                ? "bg-[var(--chat-bubble-user)]" 
                                : isBot 
                                ? "bg-white/[0.03] border-dashed border-white/10" 
                                : "bg-[var(--chat-bubble-ai)]"
                            }`}
                          >
                            {msg.media_url && (
                              <div className="mb-2 max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/40">
                                <img src={msg.media_url} alt="Uploaded Media" className="w-full h-auto object-cover max-h-40" referrerPolicy="no-referrer" />
                              </div>
                            )}
                            <span className="whitespace-pre-wrap">{msg.text}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 pl-1 pr-1">
                            <span className="text-[8px] font-mono text-gray-500 uppercase">
                              {isUser ? "You" : isBot ? "Studio Assistant" : "Studio Producer"} • {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now"}
                            </span>
                            {receiptIcon}
                          </div>
                        </div>
                      );
                    })}
                    {isSending && (
                      <div className="flex items-center gap-2 text-gray-500 font-mono text-[9px] uppercase pl-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Updating pipeline...</span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Dynamic Action / Input bar */}
                  <div className="p-4 bg-black/25 border-t border-white/10 flex flex-col gap-3">
                    {/* Media upload pending preview */}
                    {pendingImageUrl && (
                      <div className="relative w-16 h-16 rounded-xl border border-white/10 overflow-hidden bg-black/55 group shrink-0">
                        <img src={pendingImageUrl} alt="Upload Thumbnail" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => {
                            setPendingImageUrl(null);
                            setPendingImageBase64(null);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-red-400 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {currentStep === 1 ? (
                      /* STEP 1 BUTTONS */
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            trackMetaPixelCustomEvent("SelectedDigitalPipeline", { source: "chat" });
                            handleBotStepAnswer("AI Production", { production_type: "AI" });
                          }}
                          className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--chat-theme-primary)] hover:bg-white/10 text-xs font-semibold text-white uppercase tracking-wider font-display cursor-pointer transition-all active:scale-95"
                        >
                          AI Production
                        </button>
                        <button 
                          onClick={() => {
                            trackMetaPixelCustomEvent("SelectedPhysicalPipeline", { source: "chat" });
                            handleBotStepAnswer("Live-Action Production", { production_type: "Live-Action", production_grade: "N/A" });
                          }}
                          className="py-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--chat-theme-primary)] hover:bg-white/10 text-xs font-semibold text-white uppercase tracking-wider font-display cursor-pointer transition-all active:scale-95"
                        >
                          Live-Action
                        </button>
                      </div>
                    ) : currentStep === 2 ? (
                      /* STEP 2 BUTTONS */
                      <div className="grid grid-cols-3 gap-1.5">
                        <button 
                          onClick={() => handleBotStepAnswer("Cinema-Grade", { production_grade: "Cinema-Grade" })}
                          className="py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--chat-theme-primary)] text-[10px] font-semibold text-white uppercase tracking-wider font-display cursor-pointer transition-all"
                        >
                          Cinema
                        </button>
                        <button 
                          onClick={() => handleBotStepAnswer("Studio-Grade", { production_grade: "Studio-Grade" })}
                          className="py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--chat-theme-primary)] text-[10px] font-semibold text-white uppercase tracking-wider font-display cursor-pointer transition-all"
                        >
                          Studio
                        </button>
                        <button 
                          onClick={() => handleBotStepAnswer("Content-Grade", { production_grade: "Content-Grade" })}
                          className="py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[var(--chat-theme-primary)] text-[10px] font-semibold text-white uppercase tracking-wider font-display cursor-pointer transition-all"
                        >
                          Content
                        </button>
                      </div>
                    ) : currentStep === 3 ? (
                      /* STEP 3 INPUT */
                      <div className="flex items-center gap-2">
                        <div className="flex-1 relative flex items-center bg-black/40 border border-white/10 hover:border-white/20 rounded-full px-4 h-9 transition-all">
                          <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && inputText.trim()) {
                                const parseBudgetNumber = (val: string): number => {
                                  let normalized = val.toLowerCase();
                                  if (normalized.endsWith("k")) {
                                    normalized = normalized.replace("k", "000");
                                  }
                                  const digits = normalized.replace(/\D/g, "");
                                  return digits ? parseInt(digits, 10) : 0;
                                };
                                const budgetNum = parseBudgetNumber(inputText.trim());
                                if (budgetNum < 10000) {
                                  toast.error("Our minimum production budget is ₹10,000. Please enter a higher value.");
                                  return;
                                }
                                handleBotStepAnswer(inputText.trim(), { budget: inputText.trim() });
                                setInputText("");
                              }
                            }}
                            placeholder="Estimated Budget (min. ₹10,000)..."
                            className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none pr-8 font-sans"
                          />
                          <button
                            onClick={() => {
                              if (inputText.trim()) {
                                const parseBudgetNumber = (val: string): number => {
                                  let normalized = val.toLowerCase();
                                  if (normalized.endsWith("k")) {
                                    normalized = normalized.replace("k", "000");
                                  }
                                  const digits = normalized.replace(/\D/g, "");
                                  return digits ? parseInt(digits, 10) : 0;
                                };
                                const budgetNum = parseBudgetNumber(inputText.trim());
                                if (budgetNum < 10000) {
                                  toast.error("Our minimum production budget is ₹10,000. Please enter a higher value.");
                                  return;
                                }
                                handleBotStepAnswer(inputText.trim(), { budget: inputText.trim() });
                                setInputText("");
                              }
                            }}
                            disabled={!inputText.trim()}
                            className="absolute right-2 text-gray-400 hover:text-white cursor-pointer disabled:opacity-30 transition-colors"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* STEP 4 & STEP 5 FREE INPUT */
                      <div className="flex items-center gap-2.5">
                        {/* Plus media button */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer shrink-0 disabled:opacity-45"
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                          ) : (
                            <Plus className="w-4 h-4 text-white" />
                          )}
                        </button>
                        
                        <input 
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />

                        {/* Input field */}
                        <div className="flex-1 relative flex items-center bg-black/40 border border-white/10 hover:border-white/20 rounded-full px-4 h-9 transition-all">
                          <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                if (currentStep === 4) {
                                  handleBotStepAnswer(inputText.trim(), { requirements_brief: inputText.trim(), status: "active" });
                                } else {
                                  handleSendMessage();
                                }
                                setInputText("");
                              }
                            }}
                            placeholder={currentStep === 4 ? "Explain your requirements brief..." : "Enter Message..."}
                            className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none pr-8 font-sans"
                          />
                          <button
                            onClick={() => {
                              if (currentStep === 4) {
                                handleBotStepAnswer(inputText.trim(), { requirements_brief: inputText.trim(), status: "active" });
                              } else {
                                handleSendMessage();
                              }
                              setInputText("");
                            }}
                            disabled={isSending || (!inputText.trim() && !pendingImageUrl)}
                            className="absolute right-2 text-gray-400 hover:text-white cursor-pointer disabled:opacity-30 transition-colors"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Mic button */}
                        <button
                          onClick={startVoiceRecognition}
                          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer shrink-0"
                        >
                          <Mic className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
