import React, { useEffect } from "react";
import { ArrowLeft, Shield, FileText, BadgePercent } from "lucide-react";
import { useSiteData } from "../context/SiteDataContext";
import { getActiveTheme } from "../lib/themes";

interface LegalPageProps {
  type: "privacy" | "terms" | "refunds";
  onBack: () => void;
}

export default function LegalPage({ type, onBack }: LegalPageProps) {
  const { siteSettings } = useSiteData();
  const theme = getActiveTheme(siteSettings.website_theme);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  const renderContent = () => {
    switch (type) {
      case "privacy":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-display font-medium text-white tracking-tight">Privacy Policy</h1>
            </div>
            
            <p className="text-gray-400 font-mono text-xs mb-8 uppercase tracking-widest">
              Last Updated // May 28, 2026
            </p>

            <div className="space-y-8 text-gray-300 font-sans text-sm leading-relaxed max-w-3xl">
              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">1. Information Collection</h2>
                <p>
                  We only collect user contact information (such as name, email address, phone number, and project descriptions) when you explicitly initiate a business inquiry or submit a booking proposal through our studio forms. We do not scrape, harvest, or request non-essential personal identifiers.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">2. Data Security & Storage</h2>
                <p>
                  All project details and user contact records are stored securely utilizing Supabase's encrypted relational database infrastructure. We apply strict Row Level Security (RLS) policies to safeguard raw inquiry telemetry and communication logs from unauthorized access.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">3. Anonymized Traffic Tracking</h2>
                <p>
                  We track website traffic parameters anonymously to analyze browser interaction percentages, device preferences, and regional visual preferences (using zero-overhead edge network headers). No persistent cookies or target trackers map your physical browser identity outside of the studio's operational parameters.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">4. Third-Party Sharing</h2>
                <p>
                  We strictly operate on an anti-broker protocol. The Chanting Studio will never sell, lease, trade, or distribute your personal details, contact lists, or project assets to any third-party marketing firms or external platforms.
                </p>
              </section>
            </div>
          </>
        );

      case "terms":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-[#E6C687]/10 rounded-xl border border-[#E6C687]/20 text-[#E6C687]">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-display font-medium text-white tracking-tight">Terms of Service</h1>
            </div>

            <p className="text-gray-400 font-mono text-xs mb-8 uppercase tracking-widest">
              Standard Service Agreement
            </p>

            <div className="space-y-8 text-gray-300 font-sans text-sm leading-relaxed max-w-3xl">
              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">1. Retainer & Asset Ownership</h2>
                <p>
                  <strong>The Chanting Studio</strong> retains absolute legal ownership, intellectual property rights, and copyright titles of all media assets, generative AI layers, base fine-tuned weights, draft compilations, and final video edits until all project invoices, milestone fees, and outstanding retainers are settled in full by the client.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">2. Revision Rounds & Variations</h2>
                <p>
                  Each contracted package or project agreement includes a set number of structured revision rounds as specified in the individual statement of work. Any additional design variations, prompt adjustments, rendering runs, or structural modifications requested beyond this allowance will incur additional computational fees at our current studio hourly rendering rates.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">3. Client Responsibilities</h2>
                <p>
                  The client must supply brand assets, legal clearances, and specific creative inputs in a timely manner. The Chanting Studio is not responsible for project delays caused by late feedback, corrupted source inputs, or missing brand assets.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">4. Intellectual Property</h2>
                <p>
                  Upon final payment settlement, the studio grants the client the agreed media distribution licenses. The studio retains the right to display the final work and behind-the-scenes material in public curation portfolios and showreels, unless a strict NDA fee is agreed upon beforehand.
                </p>
              </section>
            </div>
          </>
        );

      case "refunds":
        return (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
                <BadgePercent className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-display font-medium text-white tracking-tight">Refund Policy</h1>
            </div>

            <p className="text-gray-400 font-mono text-xs mb-8 uppercase tracking-widest">
              Standard Client Disclosures
            </p>

            <div className="space-y-8 text-gray-300 font-sans text-sm leading-relaxed max-w-3xl">
              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">1. Retainer Policy</h2>
                <p>
                  Due to the highly resource-intensive nature of custom video engineering, fine-tuned model training, GPU rendering runs, and the booking of physical production assets, all upfront retainers and project milestone payments are <strong>strictly non-refundable</strong> once project kickoff and ideation sessions begin.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">2. Mutual Cancellation</h2>
                <p>
                  In the event of project cancellation before production begins, only unallocated funds for scheduled physical production booking assets (if any) may be refunded, subject to the terms of the signed statement of work. Completed design milestones and generative prompt setups remain non-refundable.
                </p>
              </section>

              <section className="border-t border-white/5 pt-6">
                <h2 className="text-white font-display font-semibold text-lg mb-3">3. Work Stoppage</h2>
                <p>
                  If a project is halted or paused by the client for more than 30 consecutive calendar days, the studio reserves the right to terminate the contract. All payments received to date will be forfeited to cover scheduling blocks and server capacity reservations.
                </p>
              </section>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen ${theme.style.bodyBg} flex flex-col justify-between py-12 px-4 md:px-8 relative`}>
      {/* Mesh glow grid matching main site styling */}
      <div 
        className={`absolute inset-0 bg-gradient-to-b ${theme.style.glowGrad} pointer-events-none opacity-40`} 
        style={{ zIndex: 0 }}
      />

      <div className="max-w-3xl w-full mx-auto relative z-10 flex-grow">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#E6C687] hover:text-[#ffea00] mb-12 transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> 
          Return to Odyssey
        </button>

        {/* Content Box */}
        <div className="bg-white/[0.01] border border-white/5 rounded-3xl p-6 md:p-10 backdrop-blur-md shadow-2xl">
          {renderContent()}
        </div>
        
        {/* Secondary Back Button at Bottom */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-gray-500 hover:text-white transition-all cursor-pointer py-2 px-4 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Studio
          </button>
        </div>
      </div>

      <footer className="max-w-3xl w-full mx-auto mt-16 text-center border-t border-white/5 pt-6 text-[10px] font-mono text-gray-600 relative z-10">
        <p>© 2026 bhakty.studio // Compliance Verification Framework // Safe-IP Edge Route</p>
      </footer>
    </div>
  );
}
