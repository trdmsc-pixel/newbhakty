import React from "react";
import { PageHeader } from "../shell/PageHeader";
import { Panel } from "../ui/Panel";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { TextInput, TextArea } from "../ui/TextInput";
import { Toggle } from "../ui/Toggle";
import { Save, Bot, MessageSquare, Sparkles } from "lucide-react";

export interface ChatSettingsTabProps {
  editSettings: Record<string, string>;
  onSettingChange: (key: string, val: string) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  hasUnsaved: boolean;
}

export const ChatSettingsTab: React.FC<ChatSettingsTabProps> = ({
  editSettings,
  onSettingChange,
  onSave,
  isSaving,
  hasUnsaved,
}) => {
  const isEnabled = editSettings.chat_widget_enabled !== "false";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="STUDIO CONCIERGE"
        title="Chat Widget & Bot Configuration"
        hasUnsavedChanges={hasUnsaved}
        actions={
          <Button
            variant="accent"
            loading={isSaving}
            onClick={onSave}
            icon={<Save className="w-4 h-4" />}
          >
            {isSaving ? "Saving..." : "Save chat settings"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Settings Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Panel
            eyebrow="WIDGET BEHAVIOR"
            title="Studio Concierge Controls"
          >
            <div className="space-y-6 pt-2">
              <div className="p-5 rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-admin-label font-semibold text-[#F4EFE6]">
                    Enable Live Floating Concierge
                  </h4>
                  <p className="text-admin-meta text-[#F4EFE6]/50 mt-0.5">
                    Render the obsidian glass chat trigger widget on the public website
                  </p>
                </div>

                <Toggle
                  checked={isEnabled}
                  onChange={(val) =>
                    onSettingChange("chat_widget_enabled", val ? "true" : "false")
                  }
                  label={isEnabled ? "Active" : "Disabled"}
                />
              </div>

              <Field label="Concierge Identity / Bot Name">
                <TextInput
                  value={editSettings.chat_bot_name || "Studio Concierge"}
                  onChange={(e) =>
                    onSettingChange("chat_bot_name", e.target.value)
                  }
                  placeholder="e.g. Studio Concierge, Producer Assistant"
                />
              </Field>

              <Field label="Welcome Greeting Message">
                <TextArea
                  value={
                    editSettings.chat_welcome_message ||
                    "Welcome to The Chanting Studio. How can we direct your production inquiry?"
                  }
                  onChange={(e) =>
                    onSettingChange("chat_welcome_message", e.target.value)
                  }
                  placeholder="Enter greeting text..."
                />
              </Field>

              <Field
                label="AI Knowledge Base & System Directives"
                help="Instructions that guide synthetic concierge responses before human takeover"
              >
                <TextArea
                  value={
                    editSettings.chat_system_prompt ||
                    "You are the executive assistant for The Chanting Studio, a luxury AI production house in Delhi..."
                  }
                  onChange={(e) =>
                    onSettingChange("chat_system_prompt", e.target.value)
                  }
                  placeholder="System prompt directives..."
                  className="min-h-[140px]"
                />
              </Field>
            </div>
          </Panel>
        </div>

        {/* Right Column: Live Chat Widget Visual Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-[1.75rem] bg-[#11131A] border-2 border-white/20 p-6 sm:p-8 shadow-admin-floating space-y-6">
            <div className="border-b border-white/10 pb-4 flex items-center justify-between gap-2">
              <div>
                <span className="text-admin-eyebrow text-[#FF6A1F] font-mono">
                  WIDGET LIVE SIMULATION
                </span>
                <h4 className="text-admin-h3 text-[#F4EFE6] font-semibold mt-1">
                  Floating Concierge
                </h4>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            {/* Simulated Chat Bubble & Panel */}
            <div className="rounded-[1.25rem] bg-[#07080C] border border-white/10 p-5 space-y-4 shadow-inner">
              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-admin-label font-semibold text-[#F4EFE6]">
                    {editSettings.chat_bot_name || "Studio Concierge"}
                  </p>
                  <p className="text-[11px] font-mono text-emerald-400">● Online</p>
                </div>
              </div>

              <div className="space-y-3 py-2">
                <div className="max-w-[85%] rounded-[1.25rem] rounded-tl-sm bg-[#181B24] border border-white/[0.08] p-4 text-admin-body text-xs text-[#F4EFE6] leading-relaxed">
                  {editSettings.chat_welcome_message ||
                    "Welcome to The Chanting Studio. How can we direct your production inquiry?"}
                </div>
              </div>

              <div className="h-10 rounded-full bg-[#181B24] border border-white/10 px-4 flex items-center justify-between text-admin-meta text-xs text-[#F4EFE6]/40">
                <span>Type inquiry...</span>
                <span>↵</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
