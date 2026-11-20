import React from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { MetricCard } from "../ui/MetricCard";
import { SelectableCardGroup } from "../ui/SelectableCardGroup";
import { AvatarItem } from "../ui/AvatarStack";

export interface OverviewBentoProps {
  // Metric 1: Selected films
  totalFilms: number;
  filmsWithPosters: number;
  filmAvatars: AvatarItem[];

  // Metric 2: Brand logos
  totalLogos: number;
  activeLogos: number;
  logoAvatars: AvatarItem[];

  // Metric 3: Inquiries
  totalInquiries: number;
  repliedInquiries: number;
  inquiryAvatars: AvatarItem[];

  // Right panel: channels
  totalAssets: number;
  clientCount: number;
  analyticsVisitors: number;
  liveChatCount: number;
  mostActiveChannel?: "client_access" | "analytics" | "live_chats";
  onSelectChannel: (tab: string) => void;
  className?: string;
}

export const OverviewBento: React.FC<OverviewBentoProps> = ({
  totalFilms,
  filmsWithPosters,
  filmAvatars,
  totalLogos,
  activeLogos,
  logoAvatars,
  totalInquiries,
  repliedInquiries,
  inquiryAvatars,
  totalAssets,
  clientCount,
  analyticsVisitors,
  liveChatCount,
  mostActiveChannel = "analytics",
  onSelectChannel,
  className = "",
}) => {
  const filmsRatio = totalFilms > 0 ? (filmsWithPosters / totalFilms) * 100 : 0;
  const logosRatio = totalLogos > 0 ? (activeLogos / totalLogos) * 100 : 0;
  const inquiriesRatio = totalInquiries > 0 ? (repliedInquiries / totalInquiries) * 100 : 0;

  const channelCards = [
    {
      id: "client_access",
      caption: "Client Portal",
      title: "Projects",
      count: clientCount,
    },
    {
      id: "analytics",
      caption: "Traffic",
      title: "Visitors",
      count: analyticsVisitors,
    },
    {
      id: "live_chats",
      caption: "Support",
      title: "Live Chats",
      count: liveChatCount,
    },
  ];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 mb-10 ${className}`}>
      {/* Left panel: Website at a glance (7 columns) */}
      <div className="lg:col-span-7 rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-admin-eyebrow text-[#FF6A1F] font-mono tracking-widest mb-1">
              SYSTEM OVERVIEW
            </p>
            <h2 className="text-admin-h2 text-[#F4EFE6] font-semibold tracking-tight">
              Website at a glance
            </h2>
          </div>
          <span className="text-admin-meta text-[#F4EFE6]/50 font-mono text-xs hidden sm:inline-block">
            Realtime database telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Selected films"
            value={totalFilms}
            progress={{
              value: filmsRatio,
              tone: "ember-gold",
            }}
            avatars={filmAvatars}
          />

          <MetricCard
            label="Brand logos"
            value={totalLogos}
            progress={{
              value: logosRatio,
              tone: "spectrum",
            }}
            avatars={logoAvatars}
          />

          <MetricCard
            label="Inquiries"
            value={totalInquiries}
            progress={{
              value: inquiriesRatio,
              tone: "blue-cyan",
            }}
            avatars={inquiryAvatars}
          />
        </div>
      </div>

      {/* Right panel: Studio channels (5 columns) */}
      <div className="lg:col-span-5 rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] p-6 sm:p-8 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-admin-eyebrow text-[#FF6A1F] font-mono tracking-widest mb-1">
                CONNECTED SERVICES
              </p>
              <h2 className="text-admin-h2 text-[#F4EFE6] font-semibold tracking-tight">
                Studio channels
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onSelectChannel("assets")}
              aria-label="View all media assets"
              className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[#F4EFE6] flex items-center justify-center shrink-0 transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-admin-display text-4xl sm:text-5xl font-display font-medium text-[#F4EFE6] mb-6">
            {totalAssets} <span className="text-admin-body text-base text-[#F4EFE6]/50">media assets</span>
          </div>
        </div>

        {/* 3 stacked selectable cards */}
        <div className="space-y-4">
          <SelectableCardGroup
            items={channelCards}
            selectedId={mostActiveChannel}
            onSelect={onSelectChannel}
          />

          <div className="flex justify-end pt-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F4EFE6] hover:bg-white text-[#07080C] text-admin-label font-semibold transition-all shadow-sm hover:shadow-[0_0_24px_rgba(255,106,31,0.3)]"
            >
              <span>Open live site</span>
              <ExternalLink className="w-4 h-4 text-[#FF6A1F]" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
