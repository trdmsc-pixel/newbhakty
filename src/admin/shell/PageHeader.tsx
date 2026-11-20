import React from "react";
import { ArrowLeft } from "lucide-react";
import { Chip } from "../ui/Chip";

export interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  statusChip?: React.ReactNode;
  actions?: React.ReactNode;
  hasUnsavedChanges?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  eyebrow,
  onBack,
  statusChip,
  actions,
  hasUnsavedChanges = false,
}) => {
  return (
    <div className="py-6 sm:py-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.08] mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-admin-eyebrow text-[#FF6A1F] font-mono tracking-widest mb-2">
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="w-11 h-11 rounded-full bg-[#181B24] border border-white/[0.08] hover:bg-[#20242F] text-[#F4EFE6] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <h1 className="text-admin-display text-[#F4EFE6] font-display font-medium tracking-tight">
            {title}
          </h1>

          <div className="flex items-center gap-2">
            {statusChip ? (
              statusChip
            ) : (
              <Chip status="live" dot label="Live sync" />
            )}

            {hasUnsavedChanges && (
              <Chip status="warning" label="Unsaved changes" />
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start md:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};
