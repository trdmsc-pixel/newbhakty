import React from "react";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { MetricCard } from "../ui/MetricCard";
import { SelectableCardGroup } from "../ui/SelectableCardGroup";
import { AvatarItem } from "../ui/AvatarStack";

export interface OverviewBentoProps {
  totalFilms: number;
  filmsWithPosters: number;
  filmAvatars: AvatarItem[];

  totalLogos: number;
  activeLogos: number;
  logoAvatars: AvatarItem[];

  totalInquiries: number;
  repliedInquiries: number;
  inquiryAvatars: AvatarItem[];

  totalAssets: number;
  analyticsVisitors: number;
  mostActiveChannel?: "submissions" | "assets" | "analytics";
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
  analyticsVisitors,
  mostActiveChannel = "analytics",
  onSelectChannel,
  className = "",
}) => {
  const filmsRatio = totalFilms > 0 ? (filmsWithPosters / totalFilms) * 100 : 0;
  const logosRatio = totalLogos > 0 ? (activeLogos / totalLogos) * 100 : 0;
  const inquiriesRatio = totalInquiries > 0 ? (repliedInquiries / totalInquiries) * 100 : 0;

  const channelCards = [
    {
      id: "submissions",
      caption: "Website Leads",
      title: "Inquiries",
      count: totalInquiries,
    },
    {
      id: "assets",
      caption: "CDN Library",
      title: "Media Assets",
      count: totalAssets,
    },
    {
      id: "analytics",
      caption: "Traffic",
      title: "Visitors",
      count: analyticsVisitors,
    },
  ];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8 ${className}`}>
      {/* Left panel: Website at a glance (7 columns) */}
      <div className="lg:col-span-7 admin-card-surface p-6 sm:p-7 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-admin-eyebrow mb-1" style={{ color: "var(--a-accent)" }}>
              System Overview
            </p>
            <h2 className="text-admin-h2" style={{ color: "var(--a-text)" }}>
              Website at a glance
            </h2>
          </div>
          <span
            className="px-3 py-1 rounded-full text-[12px] font-medium hidden sm:inline-block"
            style={{ background: "var(--a-surface-2)", color: "var(--a-text-2)" }}
          >
            Live CMS telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Selected films"
            value={totalFilms}
            progress={{ value: filmsRatio, tone: "ember-gold" }}
            avatars={filmAvatars}
          />

          <MetricCard
            label="Brand logos"
            value={totalLogos}
            progress={{ value: logosRatio, tone: "spectrum" }}
            avatars={logoAvatars}
          />

          <MetricCard
            label="Inquiries"
            value={totalInquiries}
            progress={{ value: inquiriesRatio, tone: "blue-cyan" }}
            avatars={inquiryAvatars}
          />
        </div>
      </div>

      {/* Right panel: Studio channels (5 columns) */}
      <div className="lg:col-span-5 admin-card-surface p-6 sm:p-7 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-admin-eyebrow mb-1" style={{ color: "var(--a-accent)" }}>
                Connected Services
              </p>
              <h2 className="text-admin-h2" style={{ color: "var(--a-text)" }}>
                Studio channels
              </h2>
            </div>

            <button
              type="button"
              onClick={() => onSelectChannel("assets")}
              aria-label="View all media assets"
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 cursor-pointer"
              style={{ background: "var(--a-surface-2)", color: "var(--a-text)" }}
            >
              <ArrowUpRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-admin-display mb-5" style={{ color: "var(--a-text)" }}>
            {totalAssets}{" "}
            <span className="text-admin-body text-sm font-medium" style={{ color: "var(--a-text-3)" }}>
              media assets
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <SelectableCardGroup
            items={channelCards}
            selectedId={mostActiveChannel}
            onSelect={onSelectChannel}
          />

          <div className="flex justify-end pt-1">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-admin-label font-semibold transition-transform hover:-translate-y-[1px]"
              style={{ background: "var(--a-inverse)", color: "var(--a-inverse-text)" }}
            >
              <span>Open live site</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
