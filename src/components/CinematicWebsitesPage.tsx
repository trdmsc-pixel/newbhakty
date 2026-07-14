import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Film, Laptop, Code, Cpu, Shield, Search, Terminal, 
  HelpCircle, MessageSquare, Star, ArrowRight, Check, 
  ChevronRight, ChevronDown, Sparkles, Server, CheckCircle2,
  Clock, Award, BarChart3, Database, Globe
} from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import Navbar from "./Navbar";
import ChatWidget from "./ChatWidget";
import { getActiveTheme } from "../lib/themes";

interface CinematicWebsitesPageProps {
  onNavigateHome: () => void;
  navigate: (to: string) => void;
  themeMode: "dark" | "light";
  setThemeMode: React.Dispatch<React.SetStateAction<"dark" | "light">>;
}

export default function CinematicWebsitesPage({ 
  onNavigateHome, 
  navigate, 
  themeMode, 
  setThemeMode 
}: CinematicWebsitesPageProps) {
  const { siteSettings, activePage } = useSiteData();
  const theme = getActiveTheme(siteSettings.website_theme);
  
  const isNavbarFullWidth = activePage === "live"
    ? siteSettings.page2_navbar_full_width === "true"
    : siteSettings.navbar_full_width === "true";

  // Testimonials state
  const testimonials = [
    {
      id: 1,
      quote: "The Chanting Studio completely redefined how our work is experienced online. We aren't just showing videos; our website feels like a cinematic gallery. The custom admin panel lets us swap out 4K clips in seconds.",
      author: "Aarav Mehta",
      role: "Founder & Lead Director",
      company: "Aura Cinematic Films"
    },
    {
      id: 2,
      quote: "Before this, our portfolio looked like every other WordPress template. Now, we have a custom website that loads instantly and reflects the premium nature of our luxury brand. Clients comment on the website layout before even booking us.",
      author: "Elena Rostova",
      role: "Creative Director",
      company: "Rostova Agency"
    },
    {
      id: 3,
      quote: "The speed and fluid animations are unlike anything I've seen on the web. Our conversion rate increased by 40% after launching the Signature Cinematic site. It is a masterpiece of technology and design.",
      author: "Vikram Malhotra",
      role: "Lead Designer",
      company: "Luxe Couture Studio"
    }
  ];
  
  const [activeTestimonialIdx, setActiveTestimonialIdx] = useState(0);

  // FAQ state
  const faqs = [
    {
      question: "How long does development take?",
      answer: "A standard Premium WordPress Website takes 2-4 weeks, while our fully custom Signature Cinematic Website typically requires 4-8 weeks. This allows time for custom creative direction, UI/UX prototyping, high-performance coding, and integrating the custom admin dashboard."
    },
    {
      question: "Can I update content myself?",
      answer: "Yes, absolutely. Both packages allow you to update content. The Signature Cinematic Website includes a custom-coded admin panel tailored precisely to your site's structure, allowing you to drag-and-drop media, update galleries, and edit copy without writing a single line of code or dealing with complex editor plugins."
    },
    {
      question: "Do you redesign existing websites?",
      answer: "Yes. We can take your existing website and completely rebuild it with modern performance optimizations, premium typography, and cinema-grade layouts to bring it up to modern design standards."
    },
    {
      question: "Can you migrate my existing website?",
      answer: "Yes, we handle the entire migration process, including transferring text copy, image assets, portfolios, domain redirects, and SEO metadata, ensuring zero downtime for your brand."
    },
    {
      question: "Do you provide support?",
      answer: "Yes, all projects come with 30 days of comprehensive post-launch support to handle edits, training, and performance tuning. We also offer ongoing monthly maintenance agreements for premium hosting, security updates, and regular visual refreshes."
    }
  ];

  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`relative min-h-screen font-sans ${theme.style.bodyBg} transition-all duration-500 ease-in-out overflow-hidden pb-16 ${isNavbarFullWidth ? "pt-0" : "pt-24 md:pt-28"}`}>
      
      {/* Dynamic Background Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[10%] left-[20%] w-[350px] md:w-[600px] h-[350px] md:h-[600px] rounded-full bg-accent/5 filter blur-[120px] animate-mesh-1" />
        <div className="absolute top-[40%] right-[10%] w-[400px] md:w-[700px] h-[400px] md:h-[700px] rounded-full bg-violet-500/5 filter blur-[150px] animate-mesh-2" />
        <div className="absolute bottom-[10%] left-[15%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full bg-accent/3 filter blur-[100px]" />
      </div>

      {/* Floating Navbar */}
      <Navbar themeMode={themeMode} setThemeMode={setThemeMode} navigate={navigate} />

      {/* SECTION 1: HERO */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 md:px-8 py-20 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-6 max-w-4xl"
        >
          <span className="text-xs uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-2">
            Aesthetic Web Engineering
          </span>
          <h1 className="font-display font-medium text-4xl sm:text-6xl md:text-8xl tracking-tight text-white leading-none">
            Websites That <br />
            <span className="font-serif italic text-accent">Feel Like Films</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-base sm:text-lg md:text-xl font-light leading-relaxed">
            We create premium custom websites that combine cinematic storytelling, modern technology and exceptional user experience.
          </p>
          <p className="text-gray-500 max-w-3xl mx-auto text-sm sm:text-base font-light leading-relaxed">
            Whether you're a wedding filmmaker, photographer, creative studio, startup or premium brand, we craft digital experiences that leave lasting impressions.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <button
              onClick={() => {
                window.location.href = "/#booking-section";
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold font-display tracking-tight text-black bg-accent hover-glow-yellow shadow-xl shadow-accent/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Start Your Project
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                window.location.href = "/#work-section";
              }}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold font-display tracking-tight text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              View Portfolio
            </button>
          </div>
        </motion.div>

        {/* Ambient Video Mock / Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] pointer-events-none -z-10" />
      </section>

      {/* SECTION 2: WHY CHOOSE */}
      <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Our Philosophies
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Not Just Websites. <br />
            <span className="font-serif italic text-accent">Digital Experiences.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: <Laptop className="w-5 h-5 text-accent" />,
              title: "Custom Designed",
              desc: "Every website is individually crafted for your brand. No templates. No generic layouts."
            },
            {
              icon: <Cpu className="w-5 h-5 text-purple-400" />,
              title: "Performance First",
              desc: "Fast loading. Responsive. SEO optimized. Built using modern architecture."
            },
            {
              icon: <Film className="w-5 h-5 text-pink-400" />,
              title: "Cinematic Design",
              desc: "Beautiful layouts. Thoughtful animations. Luxury user experience."
            },
            {
              icon: <Server className="w-5 h-5 text-blue-400" />,
              title: "Scalable",
              desc: "Built for future growth and expansion."
            }
          ].map((item, idx) => (
            <div key={idx} className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col gap-4 text-left transition-all duration-300 hover:translate-y-[-4px]">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                {item.icon}
              </div>
              <h3 className="font-display font-medium text-lg text-white mt-2">{item.title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed font-light">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: SERVICES */}
      <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            What We Build
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Custom Visual Tailoring
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-xs md:text-sm font-light">
            We architect visual-first web platforms for filmmakers, photographers, design agencies, and luxury products.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            "Wedding Photography",
            "Wedding Cinematography",
            "Creative Portfolio",
            "Creative Agency",
            "Luxury Brand",
            "Business Platforms",
            "Startup Layouts",
            "High-end Landing Pages",
            "Corporate Hubs",
            "Personal Portfolios"
          ].map((service, idx) => (
            <div 
              key={idx} 
              className="liquid-glass rounded-2xl p-5 border border-white/5 flex flex-col justify-between min-h-[140px] text-left hover:bg-white/[0.03] transition-colors"
            >
              <span className="font-mono text-gray-600 text-xs">{(idx + 1).toString().padStart(2, '0')}</span>
              <h3 className="font-display font-semibold text-sm text-white tracking-wide mt-6 leading-snug">
                {service} <br />
                <span className="text-[10px] font-mono font-normal uppercase tracking-wider text-accent">Websites</span>
              </h3>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4: PROCESS */}
      <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-20">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Workflow Roadmap
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white">
            Our Architectural Process
          </h2>
        </div>

        {/* Timeline Layout */}
        <div className="relative max-w-4xl mx-auto space-y-16">
          <div className="absolute left-4 md:left-1/2 top-4 bottom-4 w-[1px] bg-white/10 -z-10" />
          
          {[
            {
              num: "01",
              title: "Discovery",
              desc: "Understanding your business, audience and goals."
            },
            {
              num: "02",
              title: "Creative Direction",
              desc: "Moodboards, Wireframes, References, Creative planning."
            },
            {
              num: "03",
              title: "UI / UX Design",
              desc: "Pixel-perfect visual design tailored specifically to your visual layouts."
            },
            {
              num: "04",
              title: "Development",
              desc: "Modern frontend development. High performance. Responsive. SEO friendly."
            },
            {
              num: "05",
              title: "Custom Admin Dashboard",
              desc: "Simple content management. Upload images, upload videos, manage galleries, update text, update homepage. No technical knowledge required."
            },
            {
              num: "06",
              title: "Testing & Launch",
              desc: "Testing, Optimization, Deployment, Training."
            }
          ].map((step, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <div key={idx} className="flex flex-col md:flex-row items-start md:items-center relative">
                {/* Node indicator */}
                <div className="absolute left-4 md:left-1/2 -translate-x-[7px] md:-translate-x-1/2 w-3.5 h-3.5 rounded-full bg-accent border border-black z-10 shadow-[0_0_10px_var(--color-accent-glow)]" />
                
                {/* Left/Right Container */}
                <div className={`pl-12 md:pl-0 w-full md:w-1/2 flex ${isEven ? "md:justify-end md:pr-12" : "md:order-last md:pl-12"}`}>
                  <motion.div 
                    initial={{ opacity: 0, x: isEven ? -20 : 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="glass-panel rounded-2xl p-6 max-w-md w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs text-accent font-bold">{step.num}</span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Milestone Stage</span>
                    </div>
                    <h4 className="font-display font-medium text-base text-white mb-2">{step.title}</h4>
                    <p className="text-gray-400 text-xs font-light leading-relaxed">{step.desc}</p>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 5: FEATURES */}
      <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Component Toolkit
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Engineered Capabilities
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: "Premium UI Design", icon: <Sparkles className="w-4 h-4 text-amber-300" /> },
            { label: "Responsive Design", icon: <Laptop className="w-4 h-4 text-purple-400" /> },
            { label: "Lightning Fast", icon: <Cpu className="w-4 h-4 text-pink-400" /> },
            { label: "SEO Ready", icon: <Search className="w-4 h-4 text-blue-400" /> },
            { label: "Contact Forms", icon: <MessageSquare className="w-4 h-4 text-teal-400" /> },
            { label: "Portfolio Galleries", icon: <Award className="w-4 h-4 text-yellow-400" /> },
            { label: "Video Showcase", icon: <Film className="w-4 h-4 text-red-400" /> },
            { label: "Admin Dashboard", icon: <Terminal className="w-4 h-4 text-emerald-400" /> },
            { label: "Image Management", icon: <Database className="w-4 h-4 text-cyan-400" /> },
            { label: "Video Management", icon: <Film className="w-4 h-4 text-indigo-400" /> },
            { label: "Google Analytics", icon: <BarChart3 className="w-4 h-4 text-violet-400" /> },
            { label: "SSL Certification", icon: <Shield className="w-4 h-4 text-rose-400" /> },
            { label: "Quick Deployment", icon: <Server className="w-4 h-4 text-sky-400" /> },
            { label: "Performance Tuning", icon: <Cpu className="w-4 h-4 text-green-400" /> },
            { label: "30 Days Support", icon: <Clock className="w-4 h-4 text-amber-400" /> }
          ].map((feat, idx) => (
            <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 hover:bg-white/[0.04] transition-colors">
              <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white">
                {feat.icon}
              </div>
              <span className="text-[10.5px] text-gray-300 font-mono tracking-wide leading-tight">{feat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 6: PACKAGES */}
      <section className="py-24 px-4 md:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Investments
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Transparent Pricing
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Package 1 */}
          <div className="glass-panel rounded-3xl p-8 md:p-10 flex flex-col justify-between text-left relative overflow-hidden">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block mb-1">Standard CMS Option</span>
                <h3 className="font-display font-medium text-xl text-white">Premium WordPress Website</h3>
              </div>
              
              <p className="text-gray-400 text-xs font-light leading-relaxed">
                Perfect for businesses needing a professional website with a flexible CMS.
              </p>

              <div className="pt-4 border-t border-white/5">
                <span className="text-[10px] font-mono text-gray-500 block">Starting at</span>
                <span className="text-3xl font-display font-semibold text-white">₹50,000</span>
              </div>

              <div className="space-y-3 pt-6">
                <span className="text-[10px] font-mono uppercase text-gray-400 block tracking-wider">Features Included:</span>
                {[
                  "Premium Design Layout",
                  "Fully Responsive across Viewports",
                  "Basic SEO Meta Optimization",
                  "Secure Contact Forms",
                  "Portfolio Grid Modules",
                  "Cloud Deployment setup"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs text-gray-400">
                    <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => { window.location.href = "/#booking-section"; }}
              className="mt-10 w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white font-semibold text-xs uppercase tracking-wider hover:bg-white/10 transition-all cursor-pointer text-center"
            >
              Start Your Project
            </button>
          </div>

          {/* Package 2 */}
          <div className="glass-panel rounded-3xl p-8 md:p-10 flex flex-col justify-between text-left relative overflow-hidden border-accent/40 shadow-[0_0_40px_rgba(var(--color-accent-rgb-custom),0.07)]">
            <div className="absolute top-4 right-4 bg-accent text-black font-mono text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-accent/20 shadow-md">
              Recommended
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-accent block mb-1">Unmatched Premium Spec</span>
                <h3 className="font-display font-medium text-xl text-white">Signature Cinematic Website</h3>
              </div>
              
              <p className="text-gray-400 text-xs font-light leading-relaxed">
                Fully custom coded premium website crafted block-by-block with bespoke rendering modules.
              </p>

              <div className="pt-4 border-t border-white/5">
                <span className="text-[10px] font-mono text-gray-500 block">Starting at</span>
                <span className="text-3xl font-display font-semibold text-accent">₹70,000</span>
              </div>

              <div className="space-y-3 pt-6">
                <span className="text-[10px] font-mono uppercase text-gray-400 block tracking-wider">Features Included:</span>
                {[
                  "Completely Custom Design from scratch",
                  "Custom Admin Content Dashboard",
                  "Modern Headless Frontend Codebase",
                  "Premium Smooth Micro-Animations",
                  "Supercharged Core Performance Index",
                  "Future Scalability Architectures",
                  "Advanced SEO & Social Graph Metas",
                  "Hosting CDN Configuration"
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs text-gray-200">
                    <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => { window.location.href = "/#booking-section"; }}
              className="mt-10 w-full py-3.5 rounded-2xl bg-accent text-black font-semibold text-xs uppercase tracking-wider hover-glow-yellow transition-all cursor-pointer text-center"
            >
              Start Your Project
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 7: COMPARISON TABLE */}
      <section className="py-24 px-4 md:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Stack comparison
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Compare The Architectures
          </h2>
        </div>

        <div className="overflow-x-auto glass-panel rounded-3xl border border-white/5">
          <table className="w-full text-left font-sans text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.01]">
                <th className="p-6 font-mono text-[10px] uppercase tracking-widest text-gray-400 font-semibold w-1/3">Architecture Spec</th>
                <th className="p-6 font-mono text-[10px] uppercase tracking-widest text-gray-400 font-semibold w-1/3">WordPress Site</th>
                <th className="p-6 font-mono text-[10px] uppercase tracking-widest text-accent font-semibold w-1/3">Signature Cinematic (Custom)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                { spec: "Design Execution", wp: "Structured layouts using base theme structures", custom: "Infinite layout design freedom built block-by-block" },
                { spec: "Page Performance", wp: "Good (highly optimized plugin setups)", custom: "Flawless (95+ Lighthouse Score using Next.js/Vite)" },
                { spec: "Content Management", wp: "WordPress Dashboard editor module", custom: "Custom-made minimalist dashboard tailored to your layout" },
                { spec: "Animations & Transitions", wp: "Standard CSS / fade animations", custom: "Cinema-grade transitions & scroll-driven motion mechanics" },
                { spec: "Security Structure", wp: "Relies on core updates and plugin guardrails", custom: "Ultra-secure headless stack with static edge delivery" },
                { spec: "Scalability Scope", wp: "Supports plugins, blocks, and plugins suites", custom: "Clean structure ready to extend with any digital systems" }
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                  <td className="p-6 font-semibold text-white">{row.spec}</td>
                  <td className="p-6 text-gray-400 font-light leading-relaxed">{row.wp}</td>
                  <td className="p-6 text-gray-200 font-light leading-relaxed">{row.custom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 8: TESTIMONIALS */}
      <section className="py-24 px-4 md:px-8 max-w-4xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Endorsements
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Client Voices
          </h2>
        </div>

        {/* Beautiful Testimonial Slider */}
        <div className="glass-panel rounded-3xl p-8 md:p-12 relative text-left">
          <div className="absolute top-8 right-8 font-serif text-accent text-6xl opacity-20 select-none">“</div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTestimonialIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <p className="text-white text-base md:text-lg font-light leading-relaxed italic pr-6">
                {testimonials[activeTestimonialIdx].quote}
              </p>
              
              <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                <div>
                  <h4 className="font-display font-semibold text-sm text-white">{testimonials[activeTestimonialIdx].author}</h4>
                  <p className="text-[10px] font-mono uppercase text-gray-500 mt-0.5">
                    {testimonials[activeTestimonialIdx].role} // <span className="text-accent">{testimonials[activeTestimonialIdx].company}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Slider Controls */}
          <div className="flex gap-2 justify-end mt-8">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTestimonialIdx(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  activeTestimonialIdx === idx ? "bg-accent w-6" : "bg-white/10 hover:bg-white/30"
                }`}
                title={`Go to testimonial ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 9: FAQ */}
      <section className="py-24 px-4 md:px-8 max-w-4xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <span className="text-[10px] uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block mb-4">
            Inquiries
          </span>
          <h2 className="font-display font-medium text-3xl md:text-5xl tracking-tight text-white mb-6">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIdx === idx;
            return (
              <div key={idx} className="glass-panel rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-6 text-left cursor-pointer text-white font-display font-medium text-sm md:text-base hover:bg-white/[0.01]"
                >
                  <span>{faq.question}</span>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-accent rotate-180 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-300" />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 pt-2 text-xs md:text-sm text-gray-400 font-light leading-relaxed border-t border-white/5">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 10: FINAL CTA */}
      <section className="py-32 px-4 md:px-8 text-center max-w-5xl mx-auto border-t border-white/5 relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--color-accent-rgb-custom),0.05)_0%,transparent_60%)] pointer-events-none -z-10" />
        
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <span className="text-xs uppercase font-mono font-medium tracking-widest text-accent bg-accent/5 border border-accent/15 rounded-full px-4 py-1.5 inline-block">
            Start Your Journey
          </span>
          <h2 className="font-display font-medium text-3xl sm:text-5xl md:text-7xl tracking-tight text-white leading-tight">
            Ready To Build <br />
            <span className="font-serif italic text-accent">Something Extraordinary?</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm md:text-base font-light leading-relaxed">
            Let's create a digital experience that represents your brand with the same level of craftsmanship as your work.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <button
              onClick={() => { window.location.href = "/#booking-section"; }}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold font-display tracking-tight text-black bg-accent hover-glow-yellow shadow-xl shadow-accent/10 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              Book a Discovery Call
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => { window.location.href = "/#booking-section"; }}
              className="w-full sm:w-auto px-8 py-4 rounded-full font-bold font-display tracking-tight text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              Start Your Project
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer Match */}
      <footer className={`mt-20 border-t border-white/10 pt-12 px-4 md:px-8 relative z-10 transition-all duration-500 ${
        siteSettings.website_full_width === "true" 
          ? "max-w-none w-full" 
          : "max-w-7xl mx-auto"
      }`}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-10 pb-6 border-b border-white/5">
          
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5 mb-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              {siteSettings.logo_img_url ? (
                <img 
                  src={siteSettings.logo_img_url} 
                  alt="Footer Logo" 
                  className="object-contain"
                  style={{
                    height: "28px",
                    width: "auto"
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <div className="w-6 h-6 rounded bg-gradient-to-r from-amber-300 to-violet-500" />
                  <span className="font-display font-medium text-lg text-white tracking-tight">thechantingstudio.in</span>
                </>
              )}
            </div>
            <p className="text-gray-500 text-xs max-w-sm mt-1">
              Premium computational visualizers translating neural dimensions to pristine cinema assets.
            </p>
          </div>

          {/* Metric Chips / Internals */}
          <div className="flex flex-wrap gap-4 justify-center">
            <span className="text-[10px] uppercase font-mono tracking-widest text-gray-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              {siteSettings.footer_copyright || "© 2026 thechantingstudio.in"}
            </span>
            <span 
              onClick={() => navigate("#admin")}
              className="text-[10px] uppercase font-mono tracking-widest text-accent bg-accent/5 px-3 py-1.5 rounded-full border border-accent/20 hover:bg-accent/15 transition-all cursor-pointer"
            >
              🔐 Administrator Login
            </span>
            <span 
              onClick={() => navigate("#client")}
              className="text-[10px] uppercase font-mono tracking-widest text-violet-300 bg-violet-600/5 px-3 py-1.5 rounded-full border border-violet-500/20 hover:bg-violet-600/15 transition-all cursor-pointer"
            >
              🌐 Client Access Panel
            </span>
          </div>

        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-gray-600">
          <div>
            All generative pipelines run on proprietary fine-tunes. Real-time media licensed under CC-BY v4.0.
          </div>
          <div className="flex gap-4 flex-wrap justify-center">
            <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="hover:text-gray-400 transition-colors">Return top</button>
            <span>•</span>
            <button onClick={() => { window.location.href = "/#work-section"; }} className="hover:text-gray-400 transition-colors">Portfolios</button>
            <span>•</span>
            <button onClick={() => { window.location.href = "/#pricing-section"; }} className="hover:text-gray-400 transition-colors">Licensing packages</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono text-gray-600 border-t border-white/5 pt-4 mt-4 w-full">
          <div>
            The Chanting Studio // Computational Visualizer Curation Framework.
          </div>
          <div className="flex gap-4 flex-wrap justify-center">
            <button onClick={() => navigate("/privacy")} className="hover:text-gray-400 transition-colors">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => navigate("/terms")} className="hover:text-gray-400 transition-colors">Terms of Service</button>
            <span>•</span>
            <button onClick={() => navigate("/refunds")} className="hover:text-gray-400 transition-colors">Refund Policy</button>
          </div>
        </div>
      </footer>

      {/* Concierge Support Widget */}
      <ChatWidget />
    </div>
  );
}
