import React, { useState } from "react";
import { PageHeader } from "../shell/PageHeader";
import { InversePanel } from "../ui/InversePanel";
import { DetailPanel } from "../ui/DetailPanel";
import { ListRow } from "../ui/ListRow";
import { SubTile } from "../ui/SubTile";
import { StickyActionBar } from "../ui/StickyActionBar";
import { FilterBar } from "../ui/FilterBar";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Dialog } from "../ui/Dialog";
import { Field } from "../ui/Field";
import { TextInput, TextArea } from "../ui/TextInput";
import { Select } from "../ui/Select";
import { Chip } from "../ui/Chip";
import {
  Users,
  Plus,
  Trash2,
  ExternalLink,
  FolderOpen,
  CheckCircle2,
  Clock,
  Shield,
  MessageSquare,
} from "lucide-react";

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  client_id: string;
  company_name?: string;
  mobile_number?: string;
  designation?: string;
  purpose?: string;
  source?: string;
  created_at?: string;
}

export interface ClientDeliverable {
  id: string;
  client_id: string;
  title: string;
  asset_url: string;
  type: string;
  version?: string;
  notes?: string;
}

export interface ClientTask {
  id: string;
  client_id: string;
  title: string;
  status: string;
  progress?: number;
}

export interface ClientAccessTabProps {
  clientUsers: ClientUser[];
  selectedClient: ClientUser | null;
  onSelectClient: (client: ClientUser | null) => void;
  deliverables: ClientDeliverable[];
  tasks: ClientTask[];
  onCreateClient: (clientData: any) => Promise<any>;
  onDeleteClient: (id: string) => Promise<boolean>;
  onCreateDeliverable: (d: Partial<ClientDeliverable>) => Promise<any>;
  onDeleteDeliverable: (id: string) => Promise<boolean>;
  onCreateTask: (t: Partial<ClientTask>) => Promise<any>;
  onUpdateTask: (id: string, progress: number, status: string) => Promise<any>;
  onDeleteTask: (id: string) => Promise<boolean>;
}

export const ClientAccessTab: React.FC<ClientAccessTabProps> = ({
  clientUsers,
  selectedClient,
  onSelectClient,
  deliverables,
  tasks,
  onCreateClient,
  onDeleteClient,
  onCreateDeliverable,
  onDeleteDeliverable,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [search, setSearch] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addDeliverableOpen, setAddDeliverableOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  // New Client Form State
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    password: "",
    mobile: "",
    company: "",
    designation: "",
    purpose: "",
  });

  // New Deliverable Form State
  const [newDeliverable, setNewDeliverable] = useState({
    title: "",
    asset_url: "",
    type: "video",
    version: "v1.0",
    notes: "",
  });

  // New Task Form State
  const [newTask, setNewTask] = useState({
    title: "",
    status: "In Progress",
    progress: 25,
  });

  const filteredClients = clientUsers.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.company_name?.toLowerCase().includes(q) ||
      u.client_id?.toLowerCase().includes(q)
    );
  });

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.email || !newClient.password) return;

    await onCreateClient(newClient);
    setNewClient({
      name: "",
      email: "",
      password: "",
      mobile: "",
      company: "",
      designation: "",
      purpose: "",
    });
    setAddClientOpen(false);
  };

  const handleAddDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newDeliverable.title || !newDeliverable.asset_url) return;

    await onCreateDeliverable({
      client_id: selectedClient.client_id,
      ...newDeliverable,
    });
    setNewDeliverable({
      title: "",
      asset_url: "",
      type: "video",
      version: "v1.0",
      notes: "",
    });
    setAddDeliverableOpen(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newTask.title) return;

    await onCreateTask({
      client_id: selectedClient.client_id,
      ...newTask,
    });
    setNewTask({
      title: "",
      status: "In Progress",
      progress: 25,
    });
    setAddTaskOpen(false);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="ENTERPRISE PORTAL MANAGEMENT"
        title="Client Access & Review Studio"
        actions={
          <Button
            variant="accent"
            onClick={() => setAddClientOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            Register client account
          </Button>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter clients by name, ID, brand..."
        activeCount={search ? 1 : 0}
        onClearFilters={() => setSearch("")}
      />

      {/* 5 / 7 Columns Master-Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: InversePanel (5 columns) */}
        <div className="lg:col-span-5">
          <InversePanel
            eyebrow="CLIENT ROSTER"
            title={`Active Accounts (${filteredClients.length})`}
            headerBorder={true}
          >
            <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
              {filteredClients.length === 0 ? (
                <div className="py-16 text-center text-[#07080C]/55">
                  No registered clients found.
                </div>
              ) : (
                filteredClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id;
                  const initials = client.name
                    ? client.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "CL";

                  return (
                    <ListRow
                      key={client.id}
                      id={client.id}
                      primary={client.name}
                      secondary={`${client.company_name || "Enterprise"} · ID: ${
                        client.client_id
                      }`}
                      isSelected={isSelected}
                      onClick={() => onSelectClient(client)}
                      avatar={
                        <span className="font-mono font-bold text-xs">
                          {initials}
                        </span>
                      }
                      badge={{
                        status: isSelected ? "inverse" : "live",
                        label: client.client_id,
                      }}
                    />
                  );
                })
              )}
            </div>
          </InversePanel>
        </div>

        {/* Right Column: DetailPanel (7 columns) */}
        <div className="lg:col-span-7">
          {selectedClient ? (
            <DetailPanel
              columns={[
                {
                  label: "Client Account",
                  value: selectedClient.name,
                },
                {
                  label: "Company / Brand",
                  value: selectedClient.company_name || "Independent",
                },
                {
                  label: "Client Portal ID",
                  value: (
                    <span className="font-mono text-base text-[#FFC93C]">
                      {selectedClient.client_id}
                    </span>
                  ),
                },
              ]}
            >
              {/* Quick SubTiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SubTile
                  label="Direct Email"
                  value={<span className="text-sm font-mono">{selectedClient.email}</span>}
                />
                <SubTile
                  label="Mobile Contact"
                  value={selectedClient.mobile_number || "Not provided"}
                />
                <SubTile
                  label="Deliverables"
                  value={`${deliverables.length} assigned`}
                />
                <SubTile
                  label="Milestones"
                  value={`${tasks.length} tasks`}
                />
              </div>

              {/* Deliverables Section */}
              <div className="rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-admin-h3 text-[#F4EFE6] font-semibold">
                      Production Deliverables & Review Links
                    </h3>
                    <p className="text-admin-meta text-[#F4EFE6]/50">
                      Work streams uploaded for private client review
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => setAddDeliverableOpen(true)}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add link
                  </Button>
                </div>

                <div className="space-y-3">
                  {deliverables.length === 0 ? (
                    <p className="text-admin-meta text-[#F4EFE6]/40 text-center py-6">
                      No deliverables assigned to this client yet.
                    </p>
                  ) : (
                    deliverables.map((d) => (
                      <div
                        key={d.id}
                        className="p-4 rounded-xl bg-[#11131A] border border-white/10 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-admin-label font-semibold text-[#F4EFE6] truncate">
                              {d.title}
                            </span>
                            {d.version && (
                              <Chip status="draft" label={d.version} />
                            )}
                          </div>
                          <p className="text-admin-meta font-mono text-xs text-[#F4EFE6]/50 truncate">
                            {d.asset_url}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={d.asset_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/10 text-white transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>

                          <button
                            type="button"
                            onClick={() => onDeleteDeliverable(d.id)}
                            className="p-2 rounded-full text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Milestones / Tasks Section */}
              <div className="rounded-[1.25rem] bg-[#181B24] border border-white/[0.08] p-6 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-admin-h3 text-[#F4EFE6] font-semibold">
                      Production Tasks & Milestones
                    </h3>
                    <p className="text-admin-meta text-[#F4EFE6]/50">
                      Track delivery phases visible in the client review studio
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => setAddTaskOpen(true)}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add milestone
                  </Button>
                </div>

                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <p className="text-admin-meta text-[#F4EFE6]/40 text-center py-6">
                      No milestone tasks created yet.
                    </p>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-xl bg-[#11131A] border border-white/10 flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-admin-label font-semibold text-[#F4EFE6] truncate">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-admin-meta text-[#F4EFE6]/60 text-xs">
                              Progress: {task.progress || 0}%
                            </span>
                            <div className="w-32 h-1.5 rounded-full bg-black/40 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#FF6A1F] to-[#FFC93C]"
                                style={{ width: `${task.progress || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Select
                            compact
                            value={task.status}
                            onChange={(val) =>
                              onUpdateTask(task.id, task.progress || 50, val)
                            }
                            options={[
                              { value: "Pending", label: "Pending" },
                              { value: "In Progress", label: "In Progress" },
                              { value: "Review", label: "In Review" },
                              { value: "Completed", label: "Completed" },
                            ]}
                          />

                          <button
                            type="button"
                            onClick={() => onDeleteTask(task.id)}
                            className="p-2 rounded-full text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Sticky Action Bar */}
              <StickyActionBar
                summaries={[
                  {
                    label: "Selected Client",
                    value: selectedClient.name,
                  },
                  {
                    label: "Portal Link",
                    value: `/client?id=${selectedClient.client_id}`,
                  },
                ]}
                actions={
                  <div className="flex items-center gap-3">
                    <IconButton
                      label="Delete client account"
                      variant="danger"
                      onClick={() => onDeleteClient(selectedClient.id)}
                    >
                      <Trash2 className="w-5 h-5" />
                    </IconButton>

                    <a
                      href={`/client?id=${selectedClient.client_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-[3rem] px-6 rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#E8332A] text-white text-admin-label font-semibold shadow-md hover:brightness-110 transition-all"
                    >
                      <Shield className="w-4 h-4" />
                      <span>Open client view ↗</span>
                    </a>
                  </div>
                }
              />
            </DetailPanel>
          ) : (
            <div className="rounded-[1.75rem] bg-[#11131A] border border-white/[0.08] p-12 text-center text-[#F4EFE6]/50">
              No client account selected. Choose a client from the list or register a new one.
            </div>
          )}
        </div>
      </div>

      {/* Register Client Dialog */}
      <Dialog
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        title="Register Client Account"
        description="Create credentials for private client portal access and asset review"
      >
        <form onSubmit={handleRegisterClient} className="space-y-4">
          <Field label="Client Full Name">
            <TextInput
              value={newClient.name}
              onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
              placeholder="e.g. Marcus Vance"
              required
            />
          </Field>

          <Field label="Client Email Address">
            <TextInput
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
              placeholder="e.g. marcus@brand.com"
              required
            />
          </Field>

          <Field label="Portal Access Key (Password)">
            <TextInput
              type="password"
              value={newClient.password}
              onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
              placeholder="Enter secure access password..."
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Company / Brand">
              <TextInput
                value={newClient.company}
                onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                placeholder="e.g. Prestige Films"
              />
            </Field>

            <Field label="Mobile Number">
              <TextInput
                value={newClient.mobile}
                onChange={(e) => setNewClient({ ...newClient, mobile: e.target.value })}
                placeholder="+91..."
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddClientOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit">
              Register Account
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Deliverable Dialog */}
      <Dialog
        open={addDeliverableOpen}
        onClose={() => setAddDeliverableOpen(false)}
        title="Assign Deliverable Link"
        description="Attach video stream link or document for this client"
      >
        <form onSubmit={handleAddDeliverable} className="space-y-4">
          <Field label="Deliverable Title">
            <TextInput
              value={newDeliverable.title}
              onChange={(e) =>
                setNewDeliverable({ ...newDeliverable, title: e.target.value })
              }
              placeholder="e.g. Commercial Master Cut v2"
              required
            />
          </Field>

          <Field label="Direct Media / Document URL">
            <TextInput
              value={newDeliverable.asset_url}
              onChange={(e) =>
                setNewDeliverable({ ...newDeliverable, asset_url: e.target.value })
              }
              placeholder="https://...mp4"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Version Tag">
              <TextInput
                value={newDeliverable.version}
                onChange={(e) =>
                  setNewDeliverable({ ...newDeliverable, version: e.target.value })
                }
                placeholder="v1.0"
              />
            </Field>

            <Field label="Deliverable Type">
              <Select
                value={newDeliverable.type}
                onChange={(val) =>
                  setNewDeliverable({ ...newDeliverable, type: val })
                }
                options={[
                  { value: "video", label: "Video Cut" },
                  { value: "image", label: "Visual Stills" },
                  { value: "document", label: "Document / Contract" },
                ]}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddDeliverableOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit">
              Assign Link
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog
        open={addTaskOpen}
        onClose={() => setAddTaskOpen(false)}
        title="Add Production Milestone"
        description="Create trackable phase in client review studio"
      >
        <form onSubmit={handleAddTask} className="space-y-4">
          <Field label="Milestone Title">
            <TextInput
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="e.g. 4K Post-Grading & Color Sync"
              required
            />
          </Field>

          <Field label="Initial Progress (%)">
            <TextInput
              type="number"
              min="0"
              max="100"
              value={newTask.progress}
              onChange={(e) =>
                setNewTask({
                  ...newTask,
                  progress: parseInt(e.target.value, 10) || 0,
                })
              }
            />
          </Field>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAddTaskOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="accent" type="submit">
              Create Milestone
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
