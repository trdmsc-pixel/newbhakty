import React, { useState, useMemo } from "react";
import { PageHeader } from "../shell/PageHeader";
import { InversePanel } from "../ui/InversePanel";
import { DetailPanel } from "../ui/DetailPanel";
import { ListRow } from "../ui/ListRow";
import { SegmentedPills } from "../ui/SegmentedPills";
import { SubTile } from "../ui/SubTile";
import { StickyActionBar } from "../ui/StickyActionBar";
import { FilterBar } from "../ui/FilterBar";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Chip } from "../ui/Chip";
import {
  Mail,
  MessageCircle,
  Archive,
  Trash2,
  Copy,
  ExternalLink,
  Calendar,
  DollarSign,
  Briefcase,
  Check,
} from "lucide-react";

export interface SubmissionItem {
  id: string;
  full_name: string;
  email: string;
  company?: string;
  budget?: string;
  grade_selected?: string;
  project_brief?: string;
  status?: string;
  created_at: string;
  source?: string;
}

export interface InquiriesTabProps {
  submissions: SubmissionItem[];
  onUpdateStatus: (id: string, status: string) => Promise<any>;
  onDeleteSubmission: (id: string) => Promise<boolean>;
}

export const InquiriesTab: React.FC<InquiriesTabProps> = ({
  submissions,
  onUpdateStatus,
  onDeleteSubmission,
}) => {
  const [activeSegment, setActiveSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(
    submissions[0]?.id || ""
  );
  const [copied, setCopied] = useState(false);

  // Status segmentation counts
  const newCount = submissions.filter(
    (s) => !s.status || s.status.toLowerCase() === "new" || s.status.toLowerCase() === "pending"
  ).length;
  const repliedCount = submissions.filter(
    (s) => s.status?.toLowerCase() === "replied"
  ).length;
  const archivedCount = submissions.filter(
    (s) => s.status?.toLowerCase() === "archived"
  ).length;

  const segmentPills = [
    { id: "all", label: "All Inquiries", count: submissions.length },
    { id: "new", label: "New", count: newCount },
    { id: "replied", label: "Replied", count: repliedCount },
    { id: "archived", label: "Archived", count: archivedCount },
  ];

  const filteredInquiries = useMemo(() => {
    return submissions.filter((item) => {
      // Segment filter
      const st = (item.status || "new").toLowerCase();
      if (activeSegment === "new" && st !== "new" && st !== "pending") return false;
      if (activeSegment === "replied" && st !== "replied") return false;
      if (activeSegment === "archived" && st !== "archived") return false;

      // Keyword search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.full_name?.toLowerCase().includes(q);
        const matchEmail = item.email?.toLowerCase().includes(q);
        const matchCompany = item.company?.toLowerCase().includes(q);
        const matchBrief = item.project_brief?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCompany && !matchBrief) return false;
      }
      return true;
    });
  }, [submissions, activeSegment, search]);

  const selectedInquiry =
    submissions.find((s) => s.id === selectedId) || filteredInquiries[0] || null;

  const handleCopyEmail = () => {
    if (!selectedInquiry?.email) return;
    navigator.clipboard.writeText(selectedInquiry.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRelativeTime = (iso: string) => {
    try {
      const date = new Date(iso);
      const diffMs = Date.now() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours < 1) return "Just now";
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="CLIENT ENGAGEMENT PIPELINE"
        title="Project Inquiries"
        statusChip={<Chip status="live" dot label={`${newCount} new`} />}
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter inquiries by client, email, brief..."
        activeCount={search ? 1 : 0}
        onClearFilters={() => setSearch("")}
      />

      {/* Flagship Master-Detail Layout (5 / 7 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: InversePanel (5 columns) */}
        <div className="lg:col-span-5 relative pt-4">
          <SegmentedPills
            options={segmentPills}
            activeId={activeSegment}
            onChange={setActiveSegment}
            variant="floating"
          />

          <InversePanel
            eyebrow="DIRECT INBOX"
            title={`Inquiries (${filteredInquiries.length})`}
            headerBorder={true}
          >
            <div className="space-y-2 max-h-[780px] overflow-y-auto pr-1">
              {filteredInquiries.length === 0 ? (
                <div className="py-16 text-center text-[var(--a-inverse-text)]/55 font-medium">
                  No inquiries match your criteria.
                </div>
              ) : (
                filteredInquiries.map((item) => {
                  const isSelected = selectedInquiry?.id === item.id;
                  const initials = item.full_name
                    ? item.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "CL";

                  const st = (item.status || "new").toLowerCase();
                  const chipStatus =
                    st === "replied"
                      ? "replied"
                      : st === "archived"
                      ? "archived"
                      : "new";

                  return (
                    <ListRow
                      key={item.id}
                      id={item.id}
                      primary={item.full_name || "Anonymous Client"}
                      secondary={`${item.company || "Enterprise"} · ${getRelativeTime(
                        item.created_at
                      )}`}
                      isSelected={isSelected}
                      onClick={() => setSelectedId(item.id)}
                      avatar={
                        <span className="font-mono font-bold text-xs">
                          {initials}
                        </span>
                      }
                      badge={{
                        status: isSelected ? "inverse" : chipStatus,
                        label: item.status || "New",
                      }}
                      value={item.budget}
                    />
                  );
                })
              )}
            </div>
          </InversePanel>
        </div>

        {/* Right Column: DetailPanel (7 columns) */}
        <div className="lg:col-span-7">
          {selectedInquiry ? (
            <DetailPanel
              columns={[
                {
                  label: "Client / Lead",
                  value: selectedInquiry.full_name,
                },
                {
                  label: "Company / Brand",
                  value: selectedInquiry.company || "Not provided",
                },
                {
                  label: "Direct Email",
                  value: (
                    <span className="text-base font-mono">
                      {selectedInquiry.email}
                    </span>
                  ),
                },
              ]}
            >
              {/* SubTiles for Project Type / Budget / Timeline / Source */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SubTile
                  label="Selected Scope"
                  value={selectedInquiry.grade_selected || "Commercial"}
                  actionLabel="Filter scope"
                />
                <SubTile
                  label="Budget Allocation"
                  value={selectedInquiry.budget || "₹25L–₹50L"}
                />
                <SubTile
                  label="Received"
                  value={getRelativeTime(selectedInquiry.created_at)}
                />
                <SubTile
                  label="Ingestion Source"
                  value={selectedInquiry.source || "Landing Page"}
                />
              </div>

              {/* Project Brief Section */}
              <div className="rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-6 space-y-3">
                <p className="text-admin-meta text-[var(--a-accent)] font-mono tracking-widest uppercase text-xs font-semibold">
                  PROJECT BRIEF & VISION STATEMENT
                </p>
                <div className="text-admin-body text-[var(--a-text)] leading-relaxed whitespace-pre-wrap">
                  {selectedInquiry.project_brief ||
                    "No additional brief text provided by the client."}
                </div>
              </div>

              {/* Status Change Selector */}
              <div className="rounded-[1.25rem] bg-[var(--a-surface-2)] border border-[var(--a-line)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-admin-label font-semibold text-[var(--a-text)]">
                    Inquiry Engagement Status
                  </p>
                  <p className="text-admin-meta text-[var(--a-text-3)] mt-0.5">
                    Update pipeline state to track replies and executive outreach
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {["New", "Replied", "Archived"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => onUpdateStatus(selectedInquiry.id, st)}
                      className={`px-4 py-2 rounded-full text-admin-meta font-semibold cursor-pointer transition-all ${
                        (selectedInquiry.status || "New").toLowerCase() ===
                        st.toLowerCase()
                          ? "bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] text-white shadow-md"
                          : "bg-[var(--a-surface-2)] hover:bg-[var(--a-surface-2)] text-[var(--a-text-2)] hover:text-[var(--a-text)]"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sticky Action Bar */}
              <StickyActionBar
                summaries={[
                  {
                    label: "Inquiry ID",
                    value: `#${selectedInquiry.id.slice(0, 8)}`,
                  },
                  {
                    label: "Budget Tier",
                    value: selectedInquiry.budget || "Unspecified",
                  },
                  {
                    label: "Status",
                    value: (
                      <Chip
                        status={
                          selectedInquiry.status?.toLowerCase() === "replied"
                            ? "replied"
                            : selectedInquiry.status?.toLowerCase() === "archived"
                            ? "archived"
                            : "new"
                        }
                        label={selectedInquiry.status || "New"}
                      />
                    ),
                  },
                ]}
                actions={
                  <div className="flex items-center gap-2.5">
                    <IconButton
                      label="Copy client email"
                      onClick={handleCopyEmail}
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-[var(--a-ok-text)]" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </IconButton>

                    <IconButton
                      label="Delete Inquiry"
                      variant="danger"
                      onClick={() => onDeleteSubmission(selectedInquiry.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </IconButton>

                    <a
                      href={`mailto:${selectedInquiry.email}?subject=${encodeURIComponent(
                        "The Chanting Studio — Project Inquiry Brief"
                      )}`}
                      className="inline-flex items-center gap-2 h-[3rem] px-6 rounded-full bg-gradient-to-r from-[var(--a-accent)] to-[var(--a-blue)] text-white text-admin-label font-semibold shadow-md hover:brightness-110 transition-all"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Reply by email</span>
                    </a>
                  </div>
                }
              />
            </DetailPanel>
          ) : (
            <div className="rounded-[1.75rem] bg-[var(--a-surface-1)] border border-[var(--a-line)] p-12 text-center text-[var(--a-text-3)]">
              No inquiry selected. Select an item from the inbox.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
