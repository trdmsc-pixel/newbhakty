import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { SegmentedPills } from "../ui/SegmentedPills";
import AnalyticsDashboard from "../../components/AnalyticsDashboard";

export interface AnalyticsTabProps {
  // Can pass any telemetry overrides if needed
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = () => {
  const [dateRange, setDateRange] = useState("30d");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="AUDIENCE INTELLIGENCE & TELEMETRY"
        title="Visitor Analytics & Film Engagement"
        actions={
          <SegmentedPills
            options={[
              { id: "7d", label: "Last 7 days" },
              { id: "30d", label: "Last 30 days" },
              { id: "90d", label: "Last 90 days" },
            ]}
            activeId={dateRange}
            onChange={setDateRange}
          />
        }
      />

      {/* Embedded Dashboard with Studio Aesthetic */}
      <div className="rounded-[1.75rem] overflow-hidden">
        <AnalyticsDashboard />
      </div>
    </div>
  );
};
