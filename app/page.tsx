"use client";

import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Clock3,
  EyeOff,
  Home as HomeIcon,
  LogOut,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  UserRound,
  UsersRound
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { createClient as createSupabaseClient } from "../utils/supabase/client";

type Status = "Ready" | "In progress" | "Queries" | "Review" | "Filed" | "Complete" | "Urgent";
type Priority = "Normal" | "Action" | "Urgent" | "Complete";
type ActiveView = "dashboard" | "clients" | "settings" | string;
type ClientStatus = "pending" | "approved" | "rejected";
type AlertKind = "overdue" | "today" | "soon";
type TrackerGroupId = "tax" | "companies" | "bookkeeping" | "payroll" | "compliance";
type QuarterCycle = "jan-apr-jul-oct" | "feb-may-aug-nov" | "mar-jun-sep-dec";
type PayrollFrequency = "weekly" | "biweekly" | "monthly";

type ServiceRecurrence = {
  isMonthly: boolean;
  quarterCycle: QuarterCycle | null;
  payrollFrequency: PayrollFrequency | null;
};

type Profile = {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string;
  isAdmin: boolean;
  isActive: boolean;
};

type ClientContact = {
  id: string;
  fullName: string;
  role: string;
  email: string;
};

type SharedClient = {
  id: string;
  name: string;
  type: string;
  mainContactId: string | null;
  notes: string;
  status: ClientStatus;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string;
  serviceIds: string[];
  serviceRecurrences: Record<string, ServiceRecurrence>;
  serviceAssigneeIds: Record<string, string | null>;
  contacts: ClientContact[];
  isDraft?: boolean;
};

type PlannerRow = {
  id: string;
  clientId: string;
  client: string;
  assigneeId: string;
  assignee: string;
  team: string;
  trackerId: string;
  status: Status;
  priority: Priority;
  deadlineDate: string | null;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  isRecurring: boolean;
  recurrenceKey: string | null;
  notes: string;
  details: Record<string, string>;
};

type Tracker = {
  id: string;
  name: string;
  sourceSheet: string;
  group: TrackerGroupId;
  team: string;
  accent: string;
  description: string;
  detailFields: string[];
};

type PeriodColumn = {
  key: string;
  label: string;
  start: string | null;
  end: string | null;
};

type SpreadsheetTrackerGroup = {
  key: string;
  client: string;
  assigneeId: string;
  assignee: string;
  rows: PlannerRow[];
  rowsByPeriod: Map<string, PlannerRow>;
};

type TrackerFilters = {
  assigneeId: string;
  status: string;
  priority: string;
  completion: "all" | "open" | "complete";
  period: string;
};

type DeadlineAlert = {
  id: string;
  kind: AlertKind;
  row: PlannerRow;
  daysUntil: number;
};

type NewTask = {
  clientId: string;
  assigneeId: string;
  status: Status;
  priority: Priority;
  deadlineDate: string;
  notes: string;
};

type ProfileRecord = {
  id: string;
  email: string;
  display_name: string;
  job_title: string;
  is_admin: boolean;
  is_active: boolean;
};

type ClientRecord = {
  id: string;
  name: string;
  type: string;
  main_contact_id: string | null;
  notes: string | null;
  status: ClientStatus;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

type ClientServiceRecord = {
  client_id: string;
  tracker_id: string;
  assignee_id?: string | null;
  is_monthly?: boolean | null;
  quarter_cycle?: QuarterCycle | PayrollFrequency | null;
};

type ClientContactRecord = {
  id: string;
  client_id: string;
  full_name: string;
  role: string | null;
  email: string | null;
};

type PlannerRowRecord = {
  id: string;
  client_id: string;
  client: string;
  assignee_id: string;
  assignee: string;
  team: string;
  tracker_id: string;
  status: Status;
  priority: Priority;
  deadline_date: string | null;
  period_label?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  is_recurring?: boolean | null;
  recurrence_key?: string | null;
  notes: string | null;
  details: Record<string, string> | null;
};

const HIDDEN_ITEMS_KEY = "tilleys-hidden-dashboard-items:v2";
const FILTERS_KEY = "tilleys-selected-assignee:v2";
const ALERT_WINDOW_DAYS = 14;
const statusOptions: Status[] = ["Ready", "In progress", "Queries", "Review", "Urgent", "Filed", "Complete"];
const priorityOptions: Priority[] = ["Normal", "Action", "Urgent", "Complete"];
const clientTypes = ["Limited Company", "Sole Trader", "Self Assessment", "Partnership", "LLP", "Other"];
const defaultTrackerFilters: TrackerFilters = { assigneeId: "all", status: "all", priority: "all", completion: "all", period: "all" };

const trackerGroups: Record<TrackerGroupId, string> = {
  tax: "Tax",
  companies: "Companies",
  bookkeeping: "Bookkeeping",
  payroll: "Payroll",
  compliance: "Compliance"
};

const trackers: Tracker[] = [
  tracker("mtd-itsa", "MTD ITSA", "MTD ITSA Enrolment 50k Plus", "tax", "Tax", "#92d050", "MTD enrolment and software checks.", ["Check TR", "Advise", "HMRC", "Xero Link", "Software", "BK Client"]),
  tracker("personal-tax", "Personal Tax", "Personal Tax Returns", "tax", "Tax", "#92d050", "Self assessment checklist, review and filing workflow.", ["Books", "Queries", "Review", "Sent", "Filed", "Turnover Check", "P11D"]),
  tracker("company-accounts", "Accounts & CT600", "Limited Company Accounts / CT600", "companies", "Accounts", "#ffc000", "Company accounts and corporation tax return progress.", ["Year End", "First Chase", "Info In", "Review", "Filed", "P11D Y/N"]),
  tracker("vat-returns", "VAT Registered", "VAT Returns", "bookkeeping", "Bookkeeping", "#5b9bd5", "VAT returns, schemes and monthly work.", ["VAT Qtr", "Year End", "VAT Scheme", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]),
  tracker("monthly-bk-vat", "Monthly BK VAT", "Monthly Bookkeeping VAT Clients", "bookkeeping", "Bookkeeping", "#00b0f0", "Monthly bookkeeping clients who are VAT registered.", ["Quarterly", "VAT Qtr", "Year End", "Scheme"]),
  tracker("monthly-bk-non-vat", "Monthly BK Non VAT", "Bookkeeping Non VAT Reg", "bookkeeping", "Bookkeeping", "#4472c4", "Monthly bookkeeping clients who are not VAT registered.", ["Quarterly", "Monthly BK", "Year End"]),
  tracker("payroll", "Payroll", "Payroll", "payroll", "Payroll", "#7030a0", "Weekly, fortnightly and monthly payroll tracking.", ["Software", "Wk1", "Wk2", "Wk3", "Wk4", "Monthly", "Pension", "Employees"]),
  tracker("cis", "CIS", "CIS", "compliance", "Compliance", "#7030a0", "CIS monthly income, subcontractor and submission progress.", ["Refund Due", "M1 Income", "M1 Subs", "M2 Income", "M2 Subs"]),
  tracker("cis-refunds", "CIS Refunds", "CIS Refunds", "compliance", "Compliance", "#ffc000", "RTI submission, refund application and receipt.", ["RTI Reported", "Refund Applied", "Refund Received", "Amount", "Tax Year"]),
  tracker("confirmation-statements", "Confirmations", "Confirmation Statements", "companies", "Accounts", "#00b0f0", "Companies House confirmation statement deadlines.", ["Due Date", "Deadline", "2026", "Invoiced", "Emailed"]),
  tracker("p11ds", "P11Ds", "P11DS", "tax", "Payroll", "#92d050", "P11D tracker with review and filing stages.", ["Employees", "Y/E", "Accounts Due", "P11D Y/N"]),
  tracker("onboarding", "Onboarding", "Onboarding", "compliance", "Compliance", "#00b0f0", "New client setup, proposal, ID and HMRC checklist.", ["Proposal", "LOE", "ID", "Risk", "HMRC", "Companies House", "Xero"]),
  tracker("incorporations", "Incorporations", "Incorporations", "companies", "Accounts", "#ffc000", "New limited company checklist.", ["Incorp Date", "Form", "Apply Ltd", "Folder", "Bank", "PAYE"]),
  tracker("id-checks", "ID Checks", "CH ID Limited Companies / ID Self Assessment", "compliance", "Compliance", "#ff0000", "Companies House and self assessment ID checks.", ["Client Type", "ID Type", "ID Expiry", "Utility Bill", "Verify ID"])
];

const trackerById = Object.fromEntries(trackers.map((item) => [item.id, item]));
const serviceTrackers = trackers;
const completeStatuses = new Set<Status>(["Filed", "Complete"]);
const recurringRolloverStatuses = new Set<Status>(["Review", "Filed", "Complete"]);
const recurringTrackerIds = new Set(["mtd-itsa", "vat-returns", "monthly-bk-vat", "monthly-bk-non-vat", "payroll", "cis"]);
const monthlyTrackerIds = new Set(["vat-returns", "monthly-bk-vat", "monthly-bk-non-vat", "cis"]);
const defaultMonthlyTrackerIds = new Set(["monthly-bk-vat", "monthly-bk-non-vat"]);
const quarterlyTrackerIds = new Set(["mtd-itsa", "vat-returns"]);
const defaultQuarterCycleByTracker: Partial<Record<string, QuarterCycle>> = {
  "mtd-itsa": "mar-jun-sep-dec"
};
const quarterCycles: { id: QuarterCycle; label: string; months: number[] }[] = [
  { id: "jan-apr-jul-oct", label: "Jan, Apr, Jul, Oct", months: [0, 3, 6, 9] },
  { id: "feb-may-aug-nov", label: "Feb, May, Aug, Nov", months: [1, 4, 7, 10] },
  { id: "mar-jun-sep-dec", label: "Mar, Jun, Sep, Dec", months: [2, 5, 8, 11] }
];
const payrollFrequencyOptions: { id: PayrollFrequency; label: string }[] = [
  { id: "weekly", label: "Weekly pay" },
  { id: "biweekly", label: "Biweekly pay" },
  { id: "monthly", label: "Monthly pay" }
];

export default function Home() {
  const supabase = useMemo(() => createSupabaseClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [clients, setClients] = useState<SharedClient[]>([]);
  const [rows, setRows] = useState<PlannerRow[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [trackersOpen, setTrackersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [draftClient, setDraftClient] = useState<SharedClient | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<NewTask | null>(null);
  const [notice, setNotice] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [recurringSchemaReady, setRecurringSchemaReady] = useState(true);
  const [serviceAssignmentSchemaReady, setServiceAssignmentSchemaReady] = useState(true);

  const isAdmin = Boolean(profile?.isAdmin);
  const activeProfiles = profiles.filter((staff) => staff.isActive);
  const approvedClients = clients.filter((client) => client.status === "approved");
  const pendingCount = clients.filter((client) => client.status === "pending").length;

  const loadSharedData = useCallback(async () => {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setErrorMessage(userError?.message ?? "Your session has expired.");
      return;
    }

    const ownProfileResult = await supabase
      .from("profiles")
      .select("id, email, display_name, job_title, is_admin, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (ownProfileResult.error || !ownProfileResult.data) {
      setErrorMessage(`Could not load your staff profile: ${ownProfileResult.error?.message ?? "Profile not found"}. Run the admin staff management upgrade SQL first.`);
      return;
    }

    const currentProfile = recordToProfile(ownProfileResult.data);
    setProfile(currentProfile);

    if (!currentProfile.isActive) {
      setProfiles([currentProfile]);
      setClients([]);
      setRows([]);
      setDraftClient(null);
      setNewTask(null);
      setErrorMessage("");
      return;
    }

    let nextRecurringSchemaReady = true;
    let nextServiceAssignmentSchemaReady = true;
    let [profileResult, clientsResult, servicesResult, contactsResult, rowsResult]: any[] = await Promise.all([
      supabase.from("profiles").select("id, email, display_name, job_title, is_admin, is_active").order("display_name"),
      supabase.from("clients").select("id, name, type, main_contact_id, notes, status, requested_by, reviewed_by, reviewed_at, rejection_reason").order("name"),
      supabase.from("client_services").select("client_id, tracker_id, assignee_id, is_monthly, quarter_cycle"),
      supabase.from("client_contacts").select("id, client_id, full_name, role, email").order("full_name"),
      supabase.from("planner_rows").select("id, client_id, client, assignee_id, assignee, team, tracker_id, status, priority, deadline_date, period_label, period_start, period_end, is_recurring, recurrence_key, notes, details").order("period_start", { ascending: true, nullsFirst: false }).order("deadline_date", { ascending: true, nullsFirst: false })
    ]);

    const serviceAssignmentSchemaMissing = servicesResult.error?.message.includes("assignee_id");
    if (serviceAssignmentSchemaMissing) {
      nextServiceAssignmentSchemaReady = false;
      servicesResult = await supabase.from("client_services").select("client_id, tracker_id, is_monthly, quarter_cycle");
    }

    const recurringSchemaMissing = [servicesResult.error, rowsResult.error].some((error) => error?.message.includes("does not exist"));
    if (recurringSchemaMissing) {
      nextRecurringSchemaReady = false;
      [profileResult, clientsResult, servicesResult, contactsResult, rowsResult] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name, job_title, is_admin, is_active").order("display_name"),
        supabase.from("clients").select("id, name, type, main_contact_id, notes, status, requested_by, reviewed_by, reviewed_at, rejection_reason").order("name"),
        supabase.from("client_services").select("client_id, tracker_id"),
        supabase.from("client_contacts").select("id, client_id, full_name, role, email").order("full_name"),
        supabase.from("planner_rows").select("id, client_id, client, assignee_id, assignee, team, tracker_id, status, priority, deadline_date, notes, details").order("deadline_date", { ascending: true, nullsFirst: false })
      ]);
    }

    if (servicesResult.error) {
      setErrorMessage(`Could not load client services: ${servicesResult.error.message}. Run the client services and recurring tracker upgrade SQL first.`);
      return;
    }

    if (contactsResult.error) {
      setErrorMessage(`Could not load client contact details: ${contactsResult.error.message}. Run the client contacts upgrade SQL first.`);
      return;
    }

    const failure = profileResult.error ?? clientsResult.error ?? rowsResult.error;
    if (failure) {
      setErrorMessage(`Could not load shared data: ${failure.message}. Run the admin staff management upgrade SQL first.`);
      return;
    }

    const loadedProfiles = ((profileResult.data ?? []) as ProfileRecord[]).map(recordToProfile);
    const loadedServices = (servicesResult.data ?? []) as ClientServiceRecord[];
    const loadedContacts = (contactsResult.data ?? []) as ClientContactRecord[];
    const loadedClients = ((clientsResult.data ?? []) as ClientRecord[]).map((client) => recordToClient(client, loadedServices, loadedContacts));
    const loadedRows = ((rowsResult.data ?? []) as PlannerRowRecord[]).map((row) => recordToRow(row, loadedProfiles, loadedClients)).filter(isAllowedTrackerPeriod);
    setRecurringSchemaReady(nextRecurringSchemaReady);
    setServiceAssignmentSchemaReady(nextServiceAssignmentSchemaReady);
    setProfile(loadedProfiles.find((staff) => staff.id === user.id) ?? currentProfile);
    setProfiles(loadedProfiles);
    setClients(loadedClients);
    setRows(loadedRows);
    setSelectedClientId((selected) => selected || loadedClients[0]?.id || "");
    setDraftClient((draft) => {
      if (draft?.isDraft) return draft;
      const selected = loadedClients.find((client) => client.id === (draft?.id || selectedClientId));
      return selected ? { ...selected } : loadedClients[0] ? { ...loadedClients[0] } : null;
    });
    setErrorMessage(
      !nextRecurringSchemaReady
        ? "Recurring tracker setup is not active yet. Run supabase/recurring_tracker_periods_upgrade.sql in Supabase, then refresh."
        : !nextServiceAssignmentSchemaReady
          ? "Service assignment setup is not active yet. Run supabase/service_assignments_upgrade.sql in Supabase, then refresh."
          : ""
    );
  }, [selectedClientId, supabase]);

  useEffect(() => {
    try {
      const hidden = JSON.parse(window.localStorage.getItem(HIDDEN_ITEMS_KEY) ?? "[]") as string[];
      const filters = JSON.parse(window.localStorage.getItem(FILTERS_KEY) ?? "[]") as string[];
      setHiddenIds(Array.isArray(hidden) ? hidden : []);
      setSelectedStaffIds(Array.isArray(filters) ? filters : []);
    } catch {
      setHiddenIds([]);
      setSelectedStaffIds([]);
    }
    void loadSharedData();
  }, [loadSharedData]);

  useEffect(() => {
    window.localStorage.setItem(HIDDEN_ITEMS_KEY, JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  useEffect(() => {
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(selectedStaffIds));
  }, [selectedStaffIds]);

  useEffect(() => {
    const channel = supabase
      .channel("shared-planner-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "planner_rows" }, () => void loadSharedData())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => void loadSharedData())
      .on("postgres_changes", { event: "*", schema: "public", table: "client_services" }, () => void loadSharedData())
      .on("postgres_changes", { event: "*", schema: "public", table: "client_contacts" }, () => void loadSharedData())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void loadSharedData())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSharedData, supabase]);

  useEffect(() => {
    setSelectedStaffIds((current) => current.filter((id) => profiles.some((staff) => staff.id === id)));
  }, [profiles]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (!savedClientId) return;
    const id = window.setTimeout(() => setSavedClientId(null), 2000);
    return () => window.clearTimeout(id);
  }, [savedClientId]);

  const filteredRows = rows.filter((row) => !selectedStaffIds.length || selectedStaffIds.includes(row.assigneeId));
  const visibleRows = filteredRows.filter((row) => !hiddenIds.includes(row.id));
  const hiddenRows = filteredRows.filter((row) => hiddenIds.includes(row.id) && !completeStatuses.has(row.status));
  const alerts = deriveAlerts(visibleRows);
  const activeTracker =
    activeView === "dashboard" || activeView === "clients" || activeView === "settings"
      ? null
      : trackerById[activeView] ?? trackers[0];
  const eligibleClientsForTracker = activeTracker
    ? approvedClients.filter((client) => (client.serviceIds ?? []).includes(activeTracker.id))
    : [];
  const trackerRows = activeTracker
    ? sortTrackerRows(filteredRows.filter((row) => row.trackerId === activeTracker.id && matchesQuery(row, query)))
    : [];

  function canEditRow(row: PlannerRow) {
    return isAdmin || row.assigneeId === profile?.id;
  }

  function selectClient(id: string) {
    const client = clients.find((candidate) => candidate.id === id);
    setSelectedClientId(id);
    setDraftClient(client ? { ...client } : null);
  }

  function beginClient() {
    if (!profile) return;
    setSelectedClientId("");
    setDraftClient({
      id: crypto.randomUUID(),
      name: "",
      type: "Limited Company",
      mainContactId: profile.id,
      notes: "",
      status: isAdmin ? "approved" : "pending",
      requestedBy: profile.id,
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: "",
      serviceIds: [],
      serviceRecurrences: {},
      serviceAssigneeIds: {},
      contacts: [],
      isDraft: true
    });
  }

  async function saveClient() {
    if (!draftClient || !profile || !draftClient.name.trim()) return;
    const contactsToSave = (draftClient.contacts ?? []).filter((contact) => contact.fullName.trim() || contact.role.trim() || contact.email.trim());

    if (contactsToSave.some((contact) => !contact.fullName.trim())) {
      setErrorMessage("Please enter a name for each client contact before saving.");
      return;
    }

    const payload = {
      id: draftClient.id,
      name: draftClient.name.trim(),
      type: draftClient.type,
      main_contact_id: draftClient.mainContactId,
      notes: draftClient.notes,
      status: draftClient.status,
      requested_by: draftClient.requestedBy
    };
    const result = draftClient.isDraft
      ? await supabase.from("clients").insert(payload)
      : await supabase
          .from("clients")
          .update({ name: payload.name, type: payload.type, main_contact_id: payload.main_contact_id, notes: payload.notes })
          .eq("id", payload.id);
    if (result.error) {
      setErrorMessage(`Could not save client: ${result.error.message}`);
      return;
    }

    const savedClient = clients.find((client) => client.id === draftClient.id);
    const savedServices = savedClient?.serviceIds ?? [];
    const draftServices = draftClient.serviceIds ?? [];
    const servicesToRemove = savedServices.filter((serviceId) => !draftServices.includes(serviceId));

    for (const serviceId of servicesToRemove) {
      const { error } = await supabase.from("client_services").delete().eq("client_id", draftClient.id).eq("tracker_id", serviceId);
      if (error) {
        setErrorMessage(`Client saved, but services could not be updated: ${error.message}. Run the client services upgrade SQL first.`);
        await loadSharedData();
        return;
      }
    }

    if (draftServices.length) {
      const { error } = await supabase
        .from("client_services")
        .upsert(
          draftServices.map((serviceId) => {
            const recurrence = normalizeRecurrence(serviceId, draftClient.serviceRecurrences[serviceId]);
            const serviceAssigneeId = resolveServiceAssigneeId(draftClient, serviceId, activeProfiles, profile);
            return recurringSchemaReady ? {
              client_id: draftClient.id,
              tracker_id: serviceId,
              ...(serviceAssignmentSchemaReady ? { assignee_id: serviceAssigneeId } : {}),
              is_monthly: recurrence.isMonthly,
              quarter_cycle: serviceId === "payroll" ? recurrence.payrollFrequency : recurrence.quarterCycle
            } : {
              client_id: draftClient.id,
              tracker_id: serviceId,
              ...(serviceAssignmentSchemaReady ? { assignee_id: serviceAssigneeId } : {})
            };
          }),
          { onConflict: "client_id,tracker_id" }
        );
      if (error) {
        setErrorMessage(`Client saved, but services could not be linked: ${error.message}. Run the client services and recurring tracker upgrade SQL first.`);
        await loadSharedData();
        return;
      }
    }

    const serviceAssignmentError = await syncOpenServiceAssignments(draftClient, draftServices);
    if (serviceAssignmentError) {
      setErrorMessage(`Client saved, but open tracker assignments could not be updated: ${serviceAssignmentError}`);
      await loadSharedData();
      return;
    }

    const contactIdsToKeep = new Set(contactsToSave.map((contact) => contact.id));
    const contactsToDelete = (savedClient?.contacts ?? []).filter((contact) => !contactIdsToKeep.has(contact.id));

    for (const contact of contactsToDelete) {
      const { error } = await supabase.from("client_contacts").delete().eq("id", contact.id);
      if (error) {
        setErrorMessage(`Client saved, but contact details could not be updated: ${error.message}. Run the client contacts upgrade SQL first.`);
        await loadSharedData();
        return;
      }
    }

    if (contactsToSave.length) {
      const { error } = await supabase.from("client_contacts").upsert(
        contactsToSave.map((contact) => ({
          id: contact.id,
          client_id: draftClient.id,
          full_name: contact.fullName.trim(),
          role: contact.role.trim(),
          email: contact.email.trim()
        })),
        { onConflict: "id" }
      );
      if (error) {
        setErrorMessage(`Client saved, but contact details could not be saved: ${error.message}. Run the client contacts upgrade SQL first.`);
        await loadSharedData();
        return;
      }
    }

    const trackerProvisioningError = await createMissingTrackerRows({ ...draftClient, isDraft: false }, draftServices);
    if (trackerProvisioningError) {
      setErrorMessage(`Client saved, but selected trackers could not be populated: ${trackerProvisioningError}`);
      await loadSharedData();
      return;
    }

    setSavedClientId(draftClient.id);
    setNotice(isAdmin ? "Client saved." : "Client request sent for administrator approval.");
    await loadSharedData();
  }

  async function reviewClient(clientId: string, status: "approved" | "rejected", reason: string) {
    if (!profile || !isAdmin) return;
    const { error } = await supabase
      .from("clients")
      .update({
        status,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: status === "rejected" ? reason.trim() || null : null
      })
      .eq("id", clientId);
    if (error) {
      setErrorMessage(`Could not review client: ${error.message}`);
      return;
    }
    const approvedClient = clients.find((client) => client.id === clientId);
    if (status === "approved" && approvedClient) {
      const trackerProvisioningError = await createMissingTrackerRows({ ...approvedClient, status: "approved" }, approvedClient.serviceIds);
      if (trackerProvisioningError) {
        setErrorMessage(`Client approved, but selected trackers could not be populated: ${trackerProvisioningError}`);
        await loadSharedData();
        return;
      }
    }
    setNotice(status === "approved" ? "Client approved for work." : "Client request rejected.");
    await loadSharedData();
  }

  async function deleteClient(clientId: string) {
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) {
      setErrorMessage(`Could not delete client: ${error.message}`);
      return;
    }
    setDraftClient(null);
    setSelectedClientId("");
    setNotice("Client deleted.");
    await loadSharedData();
  }

  function beginNewTask() {
    if (!activeTracker || !profile || !eligibleClientsForTracker.length) {
      setNotice(activeTracker ? `Select ${activeTracker.name} in an approved client's services before adding work here.` : "An approved client is required before work can be added.");
      return;
    }
    setNewTask({
      clientId: eligibleClientsForTracker[0].id,
      assigneeId: profile.id,
      status: "Ready",
      priority: "Normal",
      deadlineDate: new Date().toISOString().slice(0, 10),
      notes: ""
    });
  }

  async function createTask() {
    if (!newTask || !activeTracker || !profile) return;
    const client = eligibleClientsForTracker.find((candidate) => candidate.id === newTask.clientId);
    const assignee = activeProfiles.find((candidate) => candidate.id === newTask.assigneeId);
    if (!client || !assignee) return;
    const newRow: PlannerRow = {
      id: crypto.randomUUID(),
      clientId: client.id,
      client: client.name,
      assigneeId: assignee.id,
      assignee: assignee.displayName,
      team: activeTracker.team,
      trackerId: activeTracker.id,
      status: newTask.status,
      priority: newTask.priority,
      deadlineDate: newTask.deadlineDate || null,
      periodLabel: "",
      periodStart: null,
      periodEnd: null,
      isRecurring: false,
      recurrenceKey: null,
      notes: newTask.notes,
      details: Object.fromEntries(activeTracker.detailFields.map((field) => [field, ""]))
    };
    const { error } = await supabase.from("planner_rows").insert(recurringSchemaReady ? rowToRecord(newRow, profile.id) : legacyRowToRecord(newRow, profile.id));
    if (error) {
      setErrorMessage(`Could not add work: ${error.message}`);
      return;
    }
    setNewTask(null);
    setNotice("Work item created.");
    await loadSharedData();
  }

  async function syncOpenServiceAssignments(client: SharedClient, serviceIds: string[]) {
    if (!profile || !isAdmin || !serviceIds.length) return null;

    for (const serviceId of serviceIds) {
      const assignee = getServiceAssigneeProfile(client, serviceId, activeProfiles, profile);
      const { error } = await supabase
        .from("planner_rows")
        .update({ assignee_id: assignee.id, assignee: assignee.displayName })
        .eq("client_id", client.id)
        .eq("tracker_id", serviceId)
        .not("status", "in", "(Filed,Complete)");
      if (error) return error.message;
    }

    return null;
  }

  async function createMissingTrackerRows(client: SharedClient, serviceIds: string[]) {
    if (!profile || client.status !== "approved") return null;
    const selectedTrackers = serviceTrackers.filter((tracker) => serviceIds.includes(tracker.id));
    if (!selectedTrackers.length) return null;

    if (!recurringSchemaReady) {
      const { data, error } = await supabase
        .from("planner_rows")
        .select("tracker_id")
        .eq("client_id", client.id)
        .in("tracker_id", selectedTrackers.map((tracker) => tracker.id));
      if (error) return error.message;

      const existingTrackerIds = new Set((data ?? []).map((row) => row.tracker_id));
      const starterRows = selectedTrackers
        .filter((tracker) => !existingTrackerIds.has(tracker.id))
        .map((tracker) => createStarterRow(client, getServiceAssigneeProfile(client, tracker.id, activeProfiles, profile), tracker));
      if (!starterRows.length) return null;

      const { error: insertError } = await supabase
        .from("planner_rows")
        .insert(starterRows.map((row) => legacyRowToRecord(row, profile.id)));
      return insertError?.message ?? null;
    }

    const { data, error } = await supabase
      .from("planner_rows")
      .select("tracker_id, recurrence_key")
      .eq("client_id", client.id)
      .in("tracker_id", selectedTrackers.map((tracker) => tracker.id));
    if (error) return error.message;

    const existingTrackerIds = new Set((data ?? []).map((row) => row.tracker_id));
    const existingRecurrenceKeys = new Set((data ?? []).map((row) => row.recurrence_key).filter(Boolean));
    const starterRows = selectedTrackers.flatMap((tracker) => {
      const assignee = getServiceAssigneeProfile(client, tracker.id, activeProfiles, profile);
      const recurrence = normalizeRecurrence(tracker.id, client.serviceRecurrences[tracker.id]);
      const periods = createPeriodsForTracker(tracker.id, recurrence);

      if (!periods.length) {
        return existingTrackerIds.has(tracker.id) ? [] : [createStarterRow(client, assignee, tracker)];
      }

      return periods
        .filter((period) => !existingRecurrenceKeys.has(`${client.id}:${period.recurrenceKey}`))
        .map((period) => createStarterRow(client, assignee, tracker, period));
    });
    if (!starterRows.length) return null;

    const { error: insertError } = await supabase
      .from("planner_rows")
      .insert(starterRows.map((row) => rowToRecord(row, profile.id)));
    return insertError?.message ?? null;
  }

  async function updateRow(rowId: string, patch: Partial<PlannerRow>) {
    const current = rows.find((row) => row.id === rowId);
    if (!current || !canEditRow(current)) return;
    if (patch.assigneeId && !isAdmin) {
      setNotice("Only the administrator can reassign existing work.");
      return;
    }
    const assignee = patch.assigneeId ? activeProfiles.find((staff) => staff.id === patch.assigneeId) : null;
    const updated = { ...current, ...patch, ...(assignee ? { assignee: assignee.displayName } : {}) };
    const databasePatch = {
      status: updated.status,
      priority: updated.priority,
      deadline_date: updated.deadlineDate,
      notes: updated.notes,
      details: updated.details,
      ...(isAdmin ? { assignee_id: updated.assigneeId, assignee: updated.assignee } : {})
    };
    setRows((items) => items.map((row) => (row.id === rowId ? updated : row)));
    const { error } = await supabase.from("planner_rows").update(databasePatch).eq("id", rowId);
    if (error) {
      setErrorMessage(`Could not save work: ${error.message}`);
      await loadSharedData();
      return;
    }

    if (patch.status && recurringRolloverStatuses.has(updated.status) && !recurringRolloverStatuses.has(current.status)) {
      const nextError = await createNextRecurringTrackerRow(updated);
      if (nextError) {
        setErrorMessage(`Work saved, but the next recurring deadline could not be created: ${nextError}`);
      }
    }
  }

  async function createNextRecurringTrackerRow(row: PlannerRow) {
    if (!profile || !recurringSchemaReady || !row.isRecurring || !row.recurrenceKey) return null;
    const tracker = trackerById[row.trackerId];
    if (!tracker || !recurringTrackerIds.has(tracker.id)) return null;

    const nextPeriod = createNextPeriodForRow(row);
    if (!nextPeriod) return null;

    const nextRecurrenceKey = `${row.clientId}:${nextPeriod.recurrenceKey}`;
    const existsInState = rows.some((item) => item.clientId === row.clientId && item.trackerId === row.trackerId && item.recurrenceKey === nextRecurrenceKey);
    if (existsInState) return null;

    const { data, error } = await supabase
      .from("planner_rows")
      .select("id")
      .eq("client_id", row.clientId)
      .eq("tracker_id", row.trackerId)
      .eq("recurrence_key", nextRecurrenceKey)
      .maybeSingle();
    if (error) return error.message;
    if (data) return null;

    const nextRow: PlannerRow = {
      id: crypto.randomUUID(),
      clientId: row.clientId,
      client: row.client,
      assigneeId: row.assigneeId,
      assignee: row.assignee,
      team: row.team,
      trackerId: row.trackerId,
      status: "Ready",
      priority: "Normal",
      deadlineDate: defaultDeadlineForPeriod(row.trackerId, nextPeriod.end),
      periodLabel: nextPeriod.label,
      periodStart: nextPeriod.start,
      periodEnd: nextPeriod.end,
      isRecurring: true,
      recurrenceKey: nextRecurrenceKey,
      notes: "",
      details: { ...row.details }
    };

    const { error: insertError } = await supabase.from("planner_rows").insert(rowToRecord(nextRow, profile.id));
    if (insertError) return insertError.message;

    setRows((items) => [...items, nextRow]);
    setNotice(`Next ${tracker.name} deadline created.`);
    return null;
  }

  async function updateDetail(rowId: string, field: string, value: string) {
    const current = rows.find((row) => row.id === rowId);
    if (!current || !canEditRow(current)) return;
    await updateRow(rowId, { details: { ...current.details, [field]: value } });
  }

  async function deleteRow(rowId: string) {
    const current = rows.find((row) => row.id === rowId);
    if (!current || !canEditRow(current)) return;
    const { error } = await supabase.from("planner_rows").delete().eq("id", rowId);
    if (error) {
      setErrorMessage(`Could not delete work: ${error.message}`);
      return;
    }
    setRows((items) => items.filter((row) => row.id !== rowId));
    setExpandedRows((items) => items.filter((id) => id !== rowId));
    setHiddenIds((items) => items.filter((id) => id !== rowId));
  }

  async function manageProfile(nextProfile: Profile, replacementAssigneeId: string | null = null) {
    if (!isAdmin || !nextProfile.displayName.trim()) return;
    const { error } = await supabase.rpc("manage_planner_profile", {
      p_profile_id: nextProfile.id,
      p_display_name: nextProfile.displayName.trim(),
      p_job_title: nextProfile.jobTitle.trim(),
      p_is_admin: nextProfile.isAdmin,
      p_is_active: nextProfile.isActive,
      p_replacement_assignee_id: replacementAssigneeId
    });
    if (error) {
      setErrorMessage(`Could not update staff member: ${error.message}`);
      return;
    }
    setNotice(nextProfile.isActive ? "Staff member updated." : "Staff member deactivated and open work reassigned.");
    await loadSharedData();
  }

  async function signOut() {
    await supabase.auth.signOut({ scope: "local" });
    window.location.assign("/login");
  }

  if (profile && !profile.isActive) {
    return <InactiveAccount profile={profile} onSignOut={() => void signOut()} />;
  }

  return (
    <main className="plannerShell">
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandMark"><img src="/tilleyslogo.png" alt="Tilleys Accountancy" /></div>
          <div><p className="eyebrow">Tilleys Accountancy</p><h1>Work Planner</h1></div>
        </div>
        <NavButton active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} icon={<HomeIcon size={18} />} label="Work Dashboard" />
        <NavButton active={activeView === "clients"} onClick={() => setActiveView("clients")} icon={<BriefcaseBusiness size={18} />} label={`Clients${isAdmin && pendingCount ? ` (${pendingCount})` : ""}`} />
        <NavButton active={trackersOpen} onClick={() => setTrackersOpen((open) => !open)} icon={trackersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />} label="Trackers" />
        <NavButton active={activeView === "settings"} onClick={() => setActiveView("settings")} icon={<Settings size={18} />} label="Account settings" />
        {trackersOpen ? (
          <nav className="groupNav compactTrackers" aria-label="Planner trackers">
            {(Object.keys(trackerGroups) as TrackerGroupId[]).map((group) => (
              <div className="navGroup" key={group}>
                <p>{trackerGroups[group]}</p>
                {trackers.filter((item) => item.group === group).map((item) => (
                  <button key={item.id} className={activeView === item.id ? "streamButton active" : "streamButton"} style={{ "--accent": item.accent } as React.CSSProperties} onClick={() => setActiveView(item.id)}>
                    <span>{item.name}</span><ChevronRight size={15} />
                  </button>
                ))}
              </div>
            ))}
          </nav>
        ) : null}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeTracker ? `Based on ${activeTracker.sourceSheet}` : "Shared staff workspace"}</p>
            <h2>{activeTracker?.name ?? (activeView === "clients" ? "Clients" : activeView === "settings" ? "Account Settings" : "Work Dashboard")}</h2>
          </div>
          <div className="topbarActions">
            <StaffFilter profiles={profiles} selectedIds={selectedStaffIds} onChange={setSelectedStaffIds} />
            {profile ? <div className="signedInAs"><UserRound size={16} /><span>Signed in as <strong>{profile.displayName}</strong></span>{profile.isAdmin ? <small>Admin</small> : null}</div> : null}
            <button className="secondaryButton" onClick={() => void signOut()}><LogOut size={16} />Sign out</button>
            {activeTracker ? (
              <>
                <label className="searchBox"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tracker" /></label>
                <button className="primaryButton" onClick={beginNewTask}><CirclePlus size={18} />Add row</button>
              </>
            ) : null}
          </div>
        </header>

        {errorMessage ? <div className="appNotice error" role="alert"><AlertTriangle size={16} />{errorMessage}</div> : null}
        {notice ? <div className="appNotice" role="status"><CheckCircle2 size={16} />{notice}</div> : null}

        {activeView === "clients" ? (
          <ClientsView
            clients={clients}
            profiles={profiles}
            draft={draftClient}
            selectedId={selectedClientId}
            search={clientSearch}
            currentProfile={profile}
            isAdmin={isAdmin}
            recurringSchemaReady={recurringSchemaReady}
            serviceAssignmentSchemaReady={serviceAssignmentSchemaReady}
            savedId={savedClientId}
            onSearch={setClientSearch}
            onSelect={selectClient}
            onAdd={beginClient}
            onChange={setDraftClient}
            onSave={() => void saveClient()}
            onReview={(id, status, reason) => void reviewClient(id, status, reason)}
            onDelete={(id) => void deleteClient(id)}
          />
        ) : activeView === "settings" ? (
          <SettingsView profiles={profiles} rows={rows} currentProfile={profile} isAdmin={isAdmin} onManage={(next, replacement) => void manageProfile(next, replacement)} />
        ) : activeTracker ? (
          <>
            {newTask ? (
              <NewTaskPanel tracker={activeTracker} draft={newTask} clients={eligibleClientsForTracker} profiles={activeProfiles} onChange={setNewTask} onSave={() => void createTask()} onCancel={() => setNewTask(null)} />
            ) : null}
            <TrackerView
              tracker={activeTracker}
              rows={trackerRows}
              profiles={profiles}
              isAdmin={isAdmin}
              canEdit={canEditRow}
              expandedRows={expandedRows}
              onToggle={(id) => setExpandedRows((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])}
              onUpdate={(id, patch) => void updateRow(id, patch)}
              onDetail={(id, field, value) => void updateDetail(id, field, value)}
              onDelete={(id) => void deleteRow(id)}
            />
          </>
        ) : (
          <DashboardView
            rows={visibleRows}
            hiddenRows={hiddenRows}
            alerts={alerts}
            canEdit={canEditRow}
            onHide={(id) => setHiddenIds((items) => Array.from(new Set([...items, id])))}
            onRestore={(id) => setHiddenIds((items) => items.filter((item) => item !== id))}
            onOpenTracker={setActiveView}
            onUpdate={(id, patch) => void updateRow(id, patch)}
          />
        )}
      </section>
    </main>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button className={active ? "homeButton active" : "homeButton"} onClick={onClick}>{icon}{label}</button>;
}

function InactiveAccount({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  return (
    <main className="loginPage">
      <section className="loginPanel inactivePanel" aria-label="Account deactivated">
        <div className="loginBrand">
          <img src="/tilleyslogo.png" alt="Tilleys Accountancy" />
          <div><p className="eyebrow">Tilleys Accountancy</p><h1>Work Planner</h1></div>
        </div>
        <div className="loginHeading">
          <AlertTriangle size={23} />
          <div><h2>Account deactivated</h2><p>{profile.displayName}, your planner access has been disabled.</p></div>
        </div>
        <p className="readOnlyMessage">Please contact an administrator if you need access restored.</p>
        <button className="secondaryButton inactiveSignOut" onClick={onSignOut}><LogOut size={16} />Sign out</button>
      </section>
    </main>
  );
}

function StaffFilter({ profiles, selectedIds, onChange }: { profiles: Profile[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const label = selectedIds.length ? profiles.filter((item) => selectedIds.includes(item.id)).map((item) => item.displayName).join(", ") : "All";
  function applyFilter(ids: string[]) {
    onChange(ids);
    setOpen(false);
  }

  return (
    <div className="staffFilter">
      <button className="staffFilterButton" onClick={() => setOpen(!open)}><UserRound size={16} /><span>{label}</span><ChevronRight size={16} /></button>
      {open ? <div className="staffFilterMenu">
        <button className={!selectedIds.length ? "staffFilterOption selected" : "staffFilterOption"} onClick={() => applyFilter([])}><Check size={15} />All</button>
        {profiles.map((item) => <button key={item.id} className={selectedIds.includes(item.id) ? "staffFilterOption selected" : "staffFilterOption"} onClick={() => applyFilter(selectedIds.includes(item.id) ? selectedIds.filter((id) => id !== item.id) : [...selectedIds, item.id])}><Check size={15} />{item.displayName}</button>)}
      </div> : null}
    </div>
  );
}

function DashboardView({ rows, hiddenRows, alerts, canEdit, onHide, onRestore, onOpenTracker, onUpdate }: {
  rows: PlannerRow[]; hiddenRows: PlannerRow[]; alerts: DeadlineAlert[]; canEdit: (row: PlannerRow) => boolean;
  onHide: (id: string) => void; onRestore: (id: string) => void; onOpenTracker: (id: string) => void; onUpdate: (id: string, patch: Partial<PlannerRow>) => void;
}) {
  const [showHidden, setShowHidden] = useState(false);
  const alertIds = new Set(alerts.map((alert) => alert.row.id));
  const actionRows = rows.filter((row) => !completeStatuses.has(row.status) && (row.priority === "Action" || row.priority === "Urgent") && !alertIds.has(row.id));
  const groups = [
    { title: "Overdue", rows: alerts.filter((item) => item.kind === "overdue").map((item) => item.row), tone: "overdue" },
    { title: "Due today", rows: alerts.filter((item) => item.kind === "today").map((item) => item.row), tone: "today" },
    { title: "Due soon", rows: alerts.filter((item) => item.kind === "soon").map((item) => item.row), tone: "soon" },
    { title: "Needs action", rows: actionRows, tone: "action" }
  ];
  return <>
    <section className="summaryGrid" aria-label="Deadline summary">
      <MetricCard icon={<AlertTriangle size={20} />} label="Overdue" value={groups[0].rows.length} tone="red" />
      <MetricCard icon={<Clock3 size={20} />} label="Due today" value={groups[1].rows.length} tone="orange" />
      <MetricCard icon={<CalendarDays size={20} />} label="Due in 14 days" value={groups[2].rows.length} tone="yellow" />
      <MetricCard icon={<Bell size={20} />} label="Needs action" value={actionRows.length} tone="blue" />
    </section>
    <section className="dashboardGrid">
      <div className="deadlinePanel">
        <div className="sectionTitle"><div><p className="eyebrow">Shared workload</p><h3>Work To Do</h3></div><span>{rows.filter((row) => !completeStatuses.has(row.status)).length} open items</span></div>
        <div className="taskGroups">
          {groups.some((group) => group.rows.length) ? groups.map((group) => group.rows.length ? <section className="taskGroup" key={group.title}><div className="miniSectionTitle"><h4>{group.title}</h4><span>{group.rows.length}</span></div><div className="taskCardList">{group.rows.map((row) => <TaskCard key={row.id} row={row} editable={canEdit(row)} tone={group.tone} onOpen={onOpenTracker} onHide={onHide} onUpdate={onUpdate} />)}</div></section> : null) : <div className="emptyState"><CheckCircle2 size={26} /><strong>No open work in this view</strong></div>}
        </div>
        <section className="hiddenWorkPanel">
          <button className="hiddenWorkToggle" onClick={() => setShowHidden(!showHidden)}><span>{showHidden ? <ChevronDown size={16} /> : <ChevronRight size={16} />}Hidden work</span><strong>{hiddenRows.length}</strong></button>
          {showHidden ? <div className="hiddenWorkList">{hiddenRows.map((row) => <article className="hiddenWorkItem" key={row.id}><div><strong>{row.client}</strong><span>{row.assignee}</span></div><div className="hiddenWorkActions"><button onClick={() => onRestore(row.id)}><RotateCcw size={15} />Restore</button></div></article>)}</div> : null}
        </section>
      </div>
      <div className="teamPanel"><div className="sectionTitle"><div><p className="eyebrow">At a glance</p><h3>Workload</h3></div><UsersRound size={19} /></div><div className="focusList"><span>Open work</span><strong>{rows.filter((row) => !completeStatuses.has(row.status)).length}</strong><span>Ready for review</span><strong>{rows.filter((row) => row.status === "Review").length}</strong><span>Urgent priority</span><strong>{rows.filter((row) => row.priority === "Urgent").length}</strong></div></div>
    </section>
  </>;
}

function TaskCard({ row, editable, tone, onOpen, onHide, onUpdate }: { row: PlannerRow; editable: boolean; tone: string; onOpen: (id: string) => void; onHide: (id: string) => void; onUpdate: (id: string, patch: Partial<PlannerRow>) => void }) {
  return <article className={`taskCard ${tone}`}>
    <div className="taskCardHeader"><div><strong>{row.client}</strong><p><span>{trackerById[row.trackerId]?.name}</span><span className="assigneePill">{row.assignee}</span></p></div><div className="taskCardActions"><button onClick={() => onOpen(row.trackerId)}>Tracker</button><button onClick={() => onHide(row.id)}><EyeOff size={15} />Hide</button></div></div>
    {!editable ? <p className="readOnlyMessage">View only: this work is assigned to {row.assignee}.</p> : null}
    <div className="taskEditGrid"><label><span>Deadline</span><input disabled={!editable} type="date" value={row.deadlineDate ?? ""} onChange={(event) => onUpdate(row.id, { deadlineDate: event.target.value || null })} /></label><label><span>Status</span><select disabled={!editable} value={row.status} onChange={(event) => onUpdate(row.id, { status: event.target.value as Status })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label><label><span>Notes</span><input disabled={!editable} value={row.notes} onChange={(event) => onUpdate(row.id, { notes: event.target.value })} /></label></div>
  </article>;
}

function ClientsView({ clients, profiles, draft, selectedId, search, currentProfile, isAdmin, recurringSchemaReady, serviceAssignmentSchemaReady, savedId, onSearch, onSelect, onAdd, onChange, onSave, onReview, onDelete }: {
  clients: SharedClient[]; profiles: Profile[]; draft: SharedClient | null; selectedId: string; search: string; currentProfile: Profile | null; isAdmin: boolean; recurringSchemaReady: boolean; serviceAssignmentSchemaReady: boolean; savedId: string | null;
  onSearch: (value: string) => void; onSelect: (id: string) => void; onAdd: () => void; onChange: (value: SharedClient) => void; onSave: () => void; onReview: (id: string, status: "approved" | "rejected", reason: string) => void; onDelete: (id: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingCount = clients.filter((client) => client.status === "pending").length;
  const displayed = clients
    .filter((client) => [client.name, client.type, client.status].some((value) => value.toLowerCase().includes(search.toLowerCase())))
    .sort((left, right) => {
      if (left.status === "pending" && right.status !== "pending") return -1;
      if (right.status === "pending" && left.status !== "pending") return 1;
      return left.name.localeCompare(right.name);
    });
  const editable = Boolean(draft && (isAdmin || (draft.status === "pending" && draft.requestedBy === currentProfile?.id)));
  const draftServices = draft?.serviceIds ?? [];
  const activeProfiles = profiles.filter((profile) => profile.isActive);
  const assigneeProfiles = activeProfiles.length ? activeProfiles : profiles;
  return <section className="clientsGrid">
    <div className="clientsPanel">
      <div className="sectionTitle"><div><p className="eyebrow">{isAdmin ? "Approvals and clients" : "Shared clients"}</p><h3>All Clients</h3></div><button className="compactButton" onClick={onAdd}><CirclePlus size={16} />{isAdmin ? "Add" : "Request"}</button></div>
      {isAdmin && pendingCount ? <div className="approvalInboxNotice" role="status"><Bell size={16} /><strong>{pendingCount}</strong> client request{pendingCount === 1 ? "" : "s"} waiting for review</div> : null}
      <label className="workSearch clientSearch"><Search size={15} /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search clients" /></label>
      <div className="clientList">{displayed.map((client) => <button key={client.id} className={selectedId === client.id ? "clientListItem active" : "clientListItem"} onClick={() => { setReason(client.rejectionReason); setConfirmDelete(false); onSelect(client.id); }}><strong>{client.name}<ClientStatusBadge status={client.status} /></strong><span>{client.type}</span><small>{(client.serviceIds ?? []).length} linked service{(client.serviceIds ?? []).length === 1 ? "" : "s"}</small><small>Requested by {profiles.find((profile) => profile.id === client.requestedBy)?.displayName ?? "Staff member"}</small></button>)}</div>
    </div>
    <div className="clientsPanel clientEditorPanel">
      {draft ? <>
        <div className="sectionTitle"><div><p className="eyebrow">Client profile</p><h3>{draft.name || "New client request"}</h3></div><ClientStatusBadge status={draft.status} /></div>
        {draft.status === "rejected" && draft.rejectionReason ? <div className="clientDeleteNotice">Reason: {draft.rejectionReason}</div> : null}
        <div className="clientFormGrid">
          <label><span>Client name</span><input disabled={!editable} value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></label>
          <label><span>Client type</span><select disabled={!editable} value={draft.type} onChange={(event) => onChange({ ...draft, type: event.target.value })}>{clientTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label><span>Main contact / owner</span><select disabled={!editable} value={draft.mainContactId ?? ""} onChange={(event) => onChange({ ...draft, mainContactId: event.target.value || null })}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></label>
          <label><span>Notes</span><input disabled={!editable} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label>
        </div>
        <section className="clientSubsection" aria-label="Client contacts">
          <div className="serviceHeader">
            <div><p className="eyebrow">Contacts</p><h3>People At This Client</h3></div>
            {editable ? <button className="secondaryButton compactAction" onClick={() => onChange({ ...draft, contacts: [...(draft.contacts ?? []), { id: crypto.randomUUID(), fullName: "", role: "", email: "" }] })}><CirclePlus size={15} />Add person</button> : null}
          </div>
          {(draft.contacts ?? []).length ? <div className="contactList">
            {(draft.contacts ?? []).map((contact) => (
              <div className="contactRow" key={contact.id}>
                <label><span>Name</span><input disabled={!editable} value={contact.fullName} onChange={(event) => onChange({ ...draft, contacts: (draft.contacts ?? []).map((item) => item.id === contact.id ? { ...item, fullName: event.target.value } : item) })} /></label>
                <label><span>Role</span><input disabled={!editable} placeholder="Director, owner..." value={contact.role} onChange={(event) => onChange({ ...draft, contacts: (draft.contacts ?? []).map((item) => item.id === contact.id ? { ...item, role: event.target.value } : item) })} /></label>
                <label><span>Email address</span><input disabled={!editable} type="email" value={contact.email} onChange={(event) => onChange({ ...draft, contacts: (draft.contacts ?? []).map((item) => item.id === contact.id ? { ...item, email: event.target.value } : item) })} /></label>
                {editable ? <button className="iconDeleteButton" aria-label={`Remove ${contact.fullName || "contact"}`} onClick={() => onChange({ ...draft, contacts: (draft.contacts ?? []).filter((item) => item.id !== contact.id) })}><Trash2 size={16} /></button> : null}
              </div>
            ))}
          </div> : <p className="servicesHelp">No client contacts have been entered yet.</p>}
        </section>
        <section className="clientServices" aria-label="Client services">
          <div className="serviceHeader">
            <div><p className="eyebrow">Services</p><h3>What We Do For This Client</h3></div>
            <span>{draftServices.length} selected</span>
          </div>
          <p className="servicesHelp">Tick a service, then save. Once the client is approved, a starting row is automatically added to each matching tracker.</p>
          {!recurringSchemaReady ? <p className="servicesHelp upgradeHelp">Recurring period controls will appear after the recurring tracker upgrade SQL has been run.</p> : null}
          {!serviceAssignmentSchemaReady ? <p className="servicesHelp upgradeHelp">Service assignment controls will save after the service assignments upgrade SQL has been run.</p> : null}
          <div className="serviceGrid">
            {serviceTrackers.map((service) => {
              const selected = draftServices.includes(service.id);
              const recurrence = normalizeRecurrence(service.id, draft.serviceRecurrences[service.id]);
              const serviceAssigneeId = resolveServiceAssigneeId(draft, service.id, assigneeProfiles, currentProfile);
              return (
                <article key={service.id} className={selected ? "serviceCard active" : "serviceCard"} style={{ "--accent": service.accent } as React.CSSProperties}>
                  <label className="serviceToggle">
                    <input
                      type="checkbox"
                      disabled={!editable}
                      checked={selected}
                      onChange={(event) => onChange({
                        ...draft,
                        serviceIds: event.target.checked
                          ? [...draftServices, service.id]
                          : draftServices.filter((serviceId) => serviceId !== service.id),
                        serviceAssigneeIds: event.target.checked
                          ? { ...draft.serviceAssigneeIds, [service.id]: serviceAssigneeId }
                          : Object.fromEntries(Object.entries(draft.serviceAssigneeIds).filter(([serviceId]) => serviceId !== service.id))
                      })}
                    />
                    <span>{service.name}</span>
                  </label>
                  <p>{trackerGroups[service.group]}</p>
                  {selected ? (
                    <label className="serviceAssignee">
                      <span>Assign work to</span>
                      <select
                        disabled={!editable || !serviceAssignmentSchemaReady}
                        value={serviceAssigneeId}
                        onChange={(event) => onChange({
                          ...draft,
                          serviceAssigneeIds: {
                            ...draft.serviceAssigneeIds,
                            [service.id]: event.target.value
                          }
                        })}
                      >
                        {assigneeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {recurringSchemaReady && selected && recurringTrackerIds.has(service.id) ? (
                    <div className="recurrenceControls">
                      {service.id === "payroll" ? (
                        <div className="quarterCycleBlock">
                          <span className="recurrenceLabel">Payroll frequency</span>
                          <div className="quarterCycleGroup" aria-label="Payroll frequency">
                            {payrollFrequencyOptions.map((frequency) => (
                              <label className="recurrenceOption" key={frequency.id}>
                                <input
                                  type="radio"
                                  name={`${draft.id}-${service.id}-payroll-frequency`}
                                  disabled={!editable}
                                  checked={recurrence.payrollFrequency === frequency.id}
                                  onChange={() => onChange({
                                    ...draft,
                                    serviceRecurrences: {
                                      ...draft.serviceRecurrences,
                                      [service.id]: normalizeRecurrence(service.id, { ...recurrence, payrollFrequency: frequency.id })
                                    }
                                  })}
                                />
                                <span>{frequency.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : monthlyTrackerIds.has(service.id) ? (
                        <label className="recurrenceOption">
                          <input
                            type="checkbox"
                            disabled={!editable}
                            checked={recurrence.isMonthly}
                            onChange={(event) => onChange({
                              ...draft,
                              serviceRecurrences: {
                                ...draft.serviceRecurrences,
                                [service.id]: normalizeRecurrence(service.id, { ...recurrence, isMonthly: event.target.checked })
                              }
                            })}
                          />
                          <span>Monthly</span>
                        </label>
                      ) : null}
                      {quarterlyTrackerIds.has(service.id) ? (
                        <div className="quarterCycleBlock">
                          <span className="recurrenceLabel">Quarterly cycle</span>
                          <div className="quarterCycleGroup" aria-label={`${service.name} quarterly cycle`}>
                            {quarterCycles.map((cycle) => (
                              <label className="recurrenceOption" key={cycle.id}>
                                <input
                                  type="radio"
                                  name={`${draft.id}-${service.id}-quarter-cycle`}
                                  disabled={!editable}
                                  checked={recurrence.quarterCycle === cycle.id}
                                  onChange={() => onChange({
                                    ...draft,
                                    serviceRecurrences: {
                                      ...draft.serviceRecurrences,
                                      [service.id]: normalizeRecurrence(service.id, { ...recurrence, quarterCycle: cycle.id })
                                    }
                                  })}
                                />
                                <span>{cycle.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
        {editable ? <div className="saveClientActions"><button className={savedId === draft.id ? "primaryButton saved" : "primaryButton"} onClick={onSave}>{savedId === draft.id ? "Saved" : draft.isDraft && !isAdmin ? "Submit request" : "Save client"}</button></div> : <p className="readOnlyMessage">This client is view only for your account.</p>}
        {isAdmin && draft.status === "pending" && !draft.isDraft ? <div className="approvalPanel"><label><span>Optional rejection reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="saveClientActions"><button className="dangerButton" onClick={() => onReview(draft.id, "rejected", reason)}>Reject</button><button className="primaryButton" onClick={() => onReview(draft.id, "approved", "")}>Approve client</button></div></div> : null}
        {isAdmin && !draft.isDraft ? <div className="saveClientActions clientDeleteActions"><button className="dangerButton" onClick={() => { if (confirmDelete) onDelete(draft.id); else setConfirmDelete(true); }}><Trash2 size={15} />{confirmDelete ? "Confirm delete" : "Delete client"}</button></div> : null}
      </> : <div className="emptyState"><BriefcaseBusiness size={26} /><strong>No client selected</strong><p>Add a new client request or choose one from the list.</p></div>}
    </div>
  </section>;
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <span className={`clientStatus ${status}`}>{status}</span>;
}

function SettingsView({ profiles, rows, currentProfile, isAdmin, onManage }: {
  profiles: Profile[];
  rows: PlannerRow[];
  currentProfile: Profile | null;
  isAdmin: boolean;
  onManage: (profile: Profile, replacementAssigneeId?: string | null) => void;
}) {
  const openWorkByProfile = Object.fromEntries(profiles.map((staff) => [
    staff.id,
    rows.filter((row) => row.assigneeId === staff.id && !completeStatuses.has(row.status)).length
  ]));
  return (
    <section className="settingsGrid settingsStaffOnly">
      <div className="settingsPanel">
        <div className="sectionTitle"><div><p className="eyebrow">Staff administration</p><h3>Staff Members</h3></div><UsersRound size={19} /></div>
        {!isAdmin ? <p className="readOnlyMessage">Only an administrator can edit staff profiles and access.</p> : <p className="settingsHelp">Create logins and reset passwords in Supabase Authentication. Manage planner access here.</p>}
        <div className="staffList">
          {profiles.map((staff) => (
            <StaffSettingsCard
              key={staff.id}
              staff={staff}
              currentProfile={currentProfile}
              profiles={profiles}
              openWorkCount={openWorkByProfile[staff.id] ?? 0}
              isAdmin={isAdmin}
              onManage={onManage}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function StaffSettingsCard({ staff, currentProfile, profiles, openWorkCount, isAdmin, onManage }: {
  staff: Profile;
  currentProfile: Profile | null;
  profiles: Profile[];
  openWorkCount: number;
  isAdmin: boolean;
  onManage: (profile: Profile, replacementAssigneeId?: string | null) => void;
}) {
  const [draft, setDraft] = useState(staff);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const replacements = profiles.filter((candidate) => candidate.isActive && candidate.id !== staff.id);
  const [replacementId, setReplacementId] = useState(replacements[0]?.id ?? "");
  const isSelf = currentProfile?.id === staff.id;

  useEffect(() => {
    setDraft(staff);
    setShowDeactivate(false);
  }, [staff]);

  useEffect(() => {
    if (!replacements.some((candidate) => candidate.id === replacementId)) {
      setReplacementId(replacements[0]?.id ?? "");
    }
  }, [replacementId, replacements]);

  function deactivate() {
    if (openWorkCount > 0) {
      setShowDeactivate(true);
      return;
    }
    onManage({ ...draft, isActive: false });
  }

  return (
    <article className={staff.isActive ? "staffListItem staffManageCard" : "staffListItem staffManageCard inactive"}>
      <div className="staffCardHeader">
        <div><strong>{staff.displayName}</strong><small>{staff.email}</small></div>
        <div className="staffBadges">
          <span className={staff.isActive ? "staffStatus active" : "staffStatus inactive"}>{staff.isActive ? "Active" : "Inactive"}</span>
          {staff.isAdmin ? <span className="staffRole">Administrator</span> : null}
        </div>
      </div>
      <div className="staffFields">
        <label><span>Name</span><input disabled={!isAdmin} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} /></label>
        <label><span>Job title</span><input disabled={!isAdmin} placeholder="Optional" value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} /></label>
      </div>
      <div className="staffWorkSummary"><strong>{openWorkCount}</strong> open work item{openWorkCount === 1 ? "" : "s"}</div>
      {isAdmin ? (
        <div className="staffManageActions">
          <button className="secondaryButton" onClick={() => onManage(draft)}>Save details</button>
          <button className="secondaryButton" disabled={isSelf} onClick={() => onManage({ ...draft, isAdmin: !staff.isAdmin })}>{staff.isAdmin ? "Remove admin" : "Make admin"}</button>
          {staff.isActive ? <button className="dangerButton" disabled={isSelf} onClick={deactivate}>Deactivate</button> : <button className="primaryButton" onClick={() => onManage({ ...draft, isActive: true })}>Reactivate</button>}
        </div>
      ) : null}
      {showDeactivate ? (
        <div className="staffDeactivatePanel">
          <p>Reassign {openWorkCount} unfinished work item{openWorkCount === 1 ? "" : "s"} before deactivating {staff.displayName}.</p>
          <label><span>Replacement staff member</span><select value={replacementId} onChange={(event) => setReplacementId(event.target.value)}>{replacements.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.displayName}</option>)}</select></label>
          <div className="staffManageActions">
            <button className="secondaryButton" onClick={() => setShowDeactivate(false)}>Cancel</button>
            <button className="dangerButton" disabled={!replacementId} onClick={() => onManage({ ...draft, isActive: false }, replacementId)}>Confirm deactivation</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function NewTaskPanel({ tracker, draft, clients, profiles, onChange, onSave, onCancel }: { tracker: Tracker; draft: NewTask; clients: SharedClient[]; profiles: Profile[]; onChange: (draft: NewTask) => void; onSave: () => void; onCancel: () => void }) {
  return <section className="newTaskPanel"><div className="sectionTitle"><div><p className="eyebrow">New work</p><h3>Add to {tracker.name}</h3></div></div><div className="clientFormGrid"><label><span>Approved client</span><select value={draft.clientId} onChange={(event) => onChange({ ...draft, clientId: event.target.value })}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label><span>Assign to</span><select value={draft.assigneeId} onChange={(event) => onChange({ ...draft, assigneeId: event.target.value })}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></label><label><span>Deadline</span><input type="date" value={draft.deadlineDate} onChange={(event) => onChange({ ...draft, deadlineDate: event.target.value })} /></label><label><span>Priority</span><select value={draft.priority} onChange={(event) => onChange({ ...draft, priority: event.target.value as Priority })}>{priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label><span>Notes</span><input value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label></div><div className="saveClientActions"><button className="secondaryButton" onClick={onCancel}>Cancel</button><button className="primaryButton" onClick={onSave}>Create work item</button></div></section>;
}

function TrackerView({ tracker, rows, profiles, isAdmin, canEdit, expandedRows, onToggle, onUpdate, onDetail, onDelete }: {
  tracker: Tracker; rows: PlannerRow[]; profiles: Profile[]; isAdmin: boolean; canEdit: (row: PlannerRow) => boolean; expandedRows: string[];
  onToggle: (id: string) => void; onUpdate: (id: string, patch: Partial<PlannerRow>) => void; onDetail: (id: string, field: string, value: string) => void; onDelete: (id: string) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TrackerFilters>(defaultTrackerFilters);
  const filteredRows = filterTrackerRows(rows, filters);
  const spreadsheetLayout = recurringTrackerIds.has(tracker.id);

  useEffect(() => {
    setFilters(defaultTrackerFilters);
    setConfirmId(null);
  }, [tracker.id]);

  if (spreadsheetLayout) {
    return (
      <RecurringTrackerTable
        tracker={tracker}
        rows={filteredRows}
        allRows={rows}
        allRowsCount={rows.length}
        profiles={profiles}
        isAdmin={isAdmin}
        canEdit={canEdit}
        expandedRows={expandedRows}
        confirmId={confirmId}
        onConfirm={setConfirmId}
        filters={filters}
        onFiltersChange={setFilters}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDetail={onDetail}
        onDelete={onDelete}
      />
    );
  }

  return <section className="trackerPanel"><div className="trackerHeader" style={{ "--accent": tracker.accent } as React.CSSProperties}><div><h3>{tracker.name}</h3><p>{tracker.description}</p></div><span>{filteredRows.length} of {rows.length} rows</span></div><TrackerFilterBar filters={filters} rows={rows} profiles={profiles} onChange={setFilters} /><div className="simpleTableWrap"><table className="simpleTable"><thead><tr><th>Client</th><th>Assignee</th><th>Tracker</th><th>Status</th><th>Period</th><th>Deadline</th><th>Priority</th><th>Notes</th><th>Details</th><th>Actions</th></tr></thead><tbody>{filteredRows.map((row) => {
    const editable = canEdit(row);
    const expanded = expandedRows.includes(row.id);
    const assignmentProfiles = profiles.filter((staff) => staff.isActive || staff.id === row.assigneeId);
    return <Fragment key={row.id}><tr><td data-label="Client">{row.client}</td><td data-label="Assignee"><select disabled={!isAdmin} value={row.assigneeId} onChange={(event) => onUpdate(row.id, { assigneeId: event.target.value })}>{assignmentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}{profile.isActive ? "" : " (inactive)"}</option>)}</select></td><td data-label="Tracker">{tracker.name}</td><td data-label="Status"><select disabled={!editable} value={row.status} onChange={(event) => onUpdate(row.id, { status: event.target.value as Status })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></td><td data-label="Period"><span className={row.isRecurring ? "periodPill recurring" : "periodPill"}>{row.periodLabel || "Once"}</span></td><td data-label="Deadline"><input disabled={!editable} type="date" value={row.deadlineDate ?? ""} onChange={(event) => onUpdate(row.id, { deadlineDate: event.target.value || null })} /></td><td data-label="Priority"><select disabled={!editable} value={row.priority} onChange={(event) => onUpdate(row.id, { priority: event.target.value as Priority })}>{priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select></td><td data-label="Notes"><textarea disabled={!editable} value={row.notes} onChange={(event) => onUpdate(row.id, { notes: event.target.value })} /></td><td data-label="Details"><button className="detailsButton" onClick={() => onToggle(row.id)}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}Details</button></td><td data-label="Actions">{editable ? <button className="trackerDeleteButton" onClick={() => { if (confirmId === row.id) onDelete(row.id); else setConfirmId(row.id); }}><Trash2 size={15} />{confirmId === row.id ? "Confirm" : "Delete"}</button> : <span className="readOnlyTag">View only</span>}</td></tr>{expanded ? <tr className="detailsRow"><td colSpan={10}><div className="detailsGrid">{tracker.detailFields.map((field) => <label key={field}><span>{field}</span><input disabled={!editable} value={row.details[field] ?? ""} onChange={(event) => onDetail(row.id, field, event.target.value)} /></label>)}</div></td></tr> : null}</Fragment>;
  })}</tbody></table></div></section>;
}

function TrackerFilterBar({ filters, rows, profiles, onChange }: {
  filters: TrackerFilters;
  rows: PlannerRow[];
  profiles: Profile[];
  onChange: (filters: TrackerFilters) => void;
}) {
  const assigneeOptions = profiles.filter((profile) => rows.some((row) => row.assigneeId === profile.id));
  const periodOptions = getTrackerPeriodFilterOptions(rows);
  return (
    <div className="trackerFilters" aria-label="Tracker filters">
      <label><span>Assignee</span><select value={filters.assigneeId} onChange={(event) => onChange({ ...filters, assigneeId: event.target.value })}><option value="all">All</option>{assigneeOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</select></label>
      <label><span>Period</span><select value={filters.period} onChange={(event) => onChange({ ...filters, period: event.target.value })}><option value="all">(Select All)</option>{periodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label><span>Status</span><select value={filters.status} onChange={(event) => onChange({ ...filters, status: event.target.value })}><option value="all">All</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label><span>Priority</span><select value={filters.priority} onChange={(event) => onChange({ ...filters, priority: event.target.value })}><option value="all">All</option>{priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
      <label><span>Work</span><select value={filters.completion} onChange={(event) => onChange({ ...filters, completion: event.target.value as TrackerFilters["completion"] })}><option value="all">All</option><option value="open">Open</option><option value="complete">Complete</option></select></label>
      <button className="secondaryButton trackerFilterReset" onClick={() => onChange(defaultTrackerFilters)}>Reset</button>
    </div>
  );
}

function RecurringTrackerTable({ tracker, rows, allRows, allRowsCount, profiles, isAdmin, canEdit, expandedRows, confirmId, onConfirm, filters, onFiltersChange, onToggle, onUpdate, onDetail, onDelete }: {
  tracker: Tracker;
  rows: PlannerRow[];
  allRows: PlannerRow[];
  allRowsCount: number;
  profiles: Profile[];
  isAdmin: boolean;
  canEdit: (row: PlannerRow) => boolean;
  expandedRows: string[];
  confirmId: string | null;
  onConfirm: (id: string | null) => void;
  filters: TrackerFilters;
  onFiltersChange: (filters: TrackerFilters) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PlannerRow>) => void;
  onDetail: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const fixedFields = fixedDetailFieldsForTracker(tracker);
  const periodColumns = getPeriodColumns(rows);
  const groups = groupRowsForSpreadsheet(rows, periodColumns);
  const colSpan = 2 + fixedFields.length + periodColumns.length;

  return (
    <section className="trackerPanel spreadsheetTrackerPanel">
      <div className="trackerHeader" style={{ "--accent": tracker.accent } as React.CSSProperties}>
        <div><h3>{tracker.name}</h3><p>{tracker.description}</p></div>
        <span>{groups.length} client{groups.length === 1 ? "" : "s"} | {rows.length} of {allRowsCount} periods</span>
      </div>
      <TrackerFilterBar filters={filters} rows={allRows} profiles={profiles} onChange={onFiltersChange} />
      <div className="statusLegend" aria-label="Tracker status legend">
        {statusOptions.map((status, index) => <span key={status}><strong>{index + 1}</strong>{status}</span>)}
      </div>
      <div className="simpleTableWrap spreadsheetTableWrap">
        {groups.length ? (
          <table className="spreadsheetTrackerTable">
            <thead>
              <tr>
                <th className="stickyColumn clientColumn">Client</th>
                <th className="stickyColumn assigneeColumn">Assignee</th>
                {fixedFields.map((field) => <th key={field} className="fixedDetailColumn">{field}</th>)}
                {periodColumns.map((period) => <th key={period.key} className="periodColumn">{period.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const assignmentProfiles = profiles.filter((staff) => staff.isActive || staff.id === group.assigneeId);
                const primaryRow = group.rows[0];
                const expanded = group.rows.filter((row) => expandedRows.includes(row.id));
                return (
                  <Fragment key={group.key}>
                    <tr>
                      <td className="stickyColumn clientColumn"><strong>{group.client}</strong></td>
                      <td className="stickyColumn assigneeColumn">
                        <select disabled={!isAdmin || !primaryRow} value={group.assigneeId} onChange={(event) => group.rows.forEach((row) => onUpdate(row.id, { assigneeId: event.target.value }))}>
                          {assignmentProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}{profile.isActive ? "" : " (inactive)"}</option>)}
                        </select>
                      </td>
                      {fixedFields.map((field) => (
                        <td className="fixedDetailColumn" key={field}>
                          <input
                            disabled={!primaryRow || !canEdit(primaryRow)}
                            value={primaryRow?.details[field] ?? ""}
                            onChange={(event) => group.rows.filter((row) => canEdit(row)).forEach((row) => onDetail(row.id, field, event.target.value))}
                          />
                        </td>
                      ))}
                      {periodColumns.map((period) => {
                        const row = group.rowsByPeriod.get(period.key);
                        return <td className="periodWorkCell" key={period.key}>{row ? (
                          <PeriodWorkCell
                            row={row}
                            editable={canEdit(row)}
                            expanded={expandedRows.includes(row.id)}
                            confirming={confirmId === row.id}
                            onToggle={onToggle}
                            onUpdate={onUpdate}
                            onConfirm={onConfirm}
                            onDelete={onDelete}
                          />
                        ) : <span className="emptyPeriodCell">-</span>}</td>;
                      })}
                    </tr>
                    {expanded.length ? (
                      <tr className="spreadsheetDetailsRow">
                        <td colSpan={colSpan}>
                          {expanded.map((row) => (
                            <div className="spreadsheetDetailsPanel" key={row.id}>
                              <strong>{row.periodLabel || "Once"}</strong>
                              <div className="detailsGrid">
                                {tracker.detailFields.map((field) => <label key={field}><span>{field}</span><input disabled={!canEdit(row)} value={row.details[field] ?? ""} onChange={(event) => onDetail(row.id, field, event.target.value)} /></label>)}
                              </div>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        ) : <div className="emptyState"><Search size={24} /><strong>No tracker rows match these filters</strong></div>}
      </div>
    </section>
  );
}

function PeriodWorkCell({ row, editable, expanded, confirming, onToggle, onUpdate, onConfirm, onDelete }: {
  row: PlannerRow;
  editable: boolean;
  expanded: boolean;
  confirming: boolean;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PlannerRow>) => void;
  onConfirm: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const statusTone = statusClass(row.status);
  return (
    <div className={`periodWork ${statusTone}`}>
      <select className={`statusSelect ${statusTone}`} disabled={!editable} value={row.status} onChange={(event) => onUpdate(row.id, { status: event.target.value as Status })}>
        {statusOptions.map((status, index) => <option key={status} value={status}>{index + 1} - {status}</option>)}
      </select>
      <input disabled={!editable} type="date" value={row.deadlineDate ?? ""} onChange={(event) => onUpdate(row.id, { deadlineDate: event.target.value || null })} />
      <select disabled={!editable} value={row.priority} onChange={(event) => onUpdate(row.id, { priority: event.target.value as Priority })}>
        {priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
      </select>
      <textarea disabled={!editable} value={row.notes} placeholder={formatDateCompact(row.periodEnd)} onChange={(event) => onUpdate(row.id, { notes: event.target.value })} />
      <div className="periodCellActions">
        <button className="detailsButton" onClick={() => onToggle(row.id)}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}Details</button>
        {editable ? <button className="trackerDeleteButton" onClick={() => { if (confirming) onDelete(row.id); else onConfirm(row.id); }}><Trash2 size={14} />{confirming ? "Confirm" : "Delete"}</button> : <span className="readOnlyTag">View only</span>}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "yellow" | "red" | "orange" }) {
  return <article className={`metricCard ${tone}`}><div className="metricIcon">{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function tracker(id: string, name: string, sourceSheet: string, group: TrackerGroupId, team: string, accent: string, description: string, detailFields: string[]): Tracker {
  return { id, name, sourceSheet, group, team, accent, description, detailFields };
}

function normalizeRecurrence(trackerId: string, recurrence?: Partial<ServiceRecurrence> | null): ServiceRecurrence {
  const rawCycle = recurrence?.quarterCycle;
  const rawPayrollFrequency = recurrence?.payrollFrequency ?? (typeof rawCycle === "string" && isPayrollFrequency(rawCycle) ? rawCycle : null);
  return {
    isMonthly: monthlyTrackerIds.has(trackerId) ? defaultMonthlyTrackerIds.has(trackerId) ? recurrence?.isMonthly !== false : Boolean(recurrence?.isMonthly) : false,
    quarterCycle: quarterlyTrackerIds.has(trackerId) ? isQuarterCycle(rawCycle) ? rawCycle : defaultQuarterCycleByTracker[trackerId] ?? null : null,
    payrollFrequency: trackerId === "payroll" ? rawPayrollFrequency ?? "monthly" : null
  };
}

function createStarterRow(client: SharedClient, assignee: Profile, tracker: Tracker, period?: { label: string; start: string; end: string; recurrenceKey: string }): PlannerRow {
  return {
    id: crypto.randomUUID(),
    clientId: client.id,
    client: client.name,
    assigneeId: assignee.id,
    assignee: assignee.displayName,
    team: tracker.team,
    trackerId: tracker.id,
    status: "Ready",
    priority: "Normal",
    deadlineDate: period ? defaultDeadlineForPeriod(tracker.id, period.end) : null,
    periodLabel: period?.label ?? "",
    periodStart: period?.start ?? null,
    periodEnd: period?.end ?? null,
    isRecurring: Boolean(period),
    recurrenceKey: period ? `${client.id}:${period.recurrenceKey}` : null,
    notes: "",
    details: Object.fromEntries(tracker.detailFields.map((field) => [field, ""]))
  };
}

function fixedDetailFieldsForTracker(tracker: Tracker) {
  const fieldsByTracker: Record<string, string[]> = {
    "vat-returns": ["VAT Qtr", "Year End", "VAT Scheme"],
    "monthly-bk-vat": ["Quarterly", "VAT Qtr", "Year End", "Scheme"],
    "monthly-bk-non-vat": ["Quarterly", "Monthly BK", "Year End"],
    payroll: ["Software", "Pension", "Employees"],
    cis: ["Refund Due"]
  };
  return fieldsByTracker[tracker.id] ?? tracker.detailFields.filter((field) => !monthShortNames().includes(field) && !/^Wk\d+$/i.test(field));
}

function isQuarterCycle(value: unknown): value is QuarterCycle {
  return quarterCycles.some((cycle) => cycle.id === value);
}

function isPayrollFrequency(value: unknown): value is PayrollFrequency {
  return payrollFrequencyOptions.some((frequency) => frequency.id === value);
}

function filterTrackerRows(rows: PlannerRow[], filters: TrackerFilters) {
  return rows.filter((row) => {
    if (filters.assigneeId !== "all" && row.assigneeId !== filters.assigneeId) return false;
    if (filters.period !== "all" && !matchesTrackerPeriodFilter(row, filters.period)) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.priority !== "all" && row.priority !== filters.priority) return false;
    if (filters.completion === "open" && completeStatuses.has(row.status)) return false;
    if (filters.completion === "complete" && !completeStatuses.has(row.status)) return false;
    return true;
  });
}

function getTrackerPeriodFilterOptions(rows: PlannerRow[]) {
  const options = [
    { value: "cycle:feb-may-aug-nov", label: "Feb, May, Aug, Nov" },
    { value: "cycle:jan-apr-jul-oct", label: "Jan,Apr,Jul,Oct" },
    { value: "cycle:mar-jun-sep-dec", label: "Mar, Jun, Sep, Dec" },
    { value: "monthly", label: "Monthly" }
  ];
  return options.filter((option) => rows.some((row) => matchesTrackerPeriodFilter(row, option.value)));
}

function matchesTrackerPeriodFilter(row: PlannerRow, filter: string) {
  if (filter === "monthly") {
    return row.recurrenceKey?.includes(":monthly:") ?? false;
  }

  if (filter.startsWith("cycle:")) {
    const cycleId = filter.replace("cycle:", "") as QuarterCycle;
    return row.recurrenceKey?.includes(`:quarterly:${cycleId}:`) ?? matchesQuarterCycleByEndMonth(row, cycleId);
  }

  return true;
}

function matchesQuarterCycleByEndMonth(row: PlannerRow, cycleId: QuarterCycle) {
  const date = row.periodEnd ?? row.periodStart ?? row.deadlineDate;
  if (!date) return false;
  const monthIndex = Number(date.split("-")[1]) - 1;
  return quarterCycles.find((cycle) => cycle.id === cycleId)?.months.includes(monthIndex) ?? false;
}

function isAllowedTrackerPeriod(row: PlannerRow) {
  if ((row.trackerId === "monthly-bk-vat" || row.trackerId === "monthly-bk-non-vat") && row.isRecurring) {
    return !row.recurrenceKey?.includes(":quarterly:") && !/^Q\d\b/.test(row.periodLabel);
  }
  return true;
}

function getPeriodColumns(rows: PlannerRow[]): PeriodColumn[] {
  const columns = new Map<string, PeriodColumn>();
  rows.forEach((row) => {
    const key = periodColumnKey(row);
    if (!columns.has(key)) {
      columns.set(key, { key, label: row.periodLabel || "Once", start: row.periodStart, end: row.periodEnd });
    }
  });
  return Array.from(columns.values()).sort((left, right) => {
    const leftDate = dateSortValue(left.start ?? left.end);
    const rightDate = dateSortValue(right.start ?? right.end);
    if (leftDate !== rightDate) return leftDate - rightDate;
    return left.label.localeCompare(right.label);
  });
}

function groupRowsForSpreadsheet(rows: PlannerRow[], periodColumns: PeriodColumn[]): SpreadsheetTrackerGroup[] {
  const periodOrder = new Map(periodColumns.map((period, index) => [period.key, index]));
  const groups = new Map<string, SpreadsheetTrackerGroup>();

  rows.forEach((row) => {
    const key = row.clientId || row.client;
    const existing = groups.get(key);
    const group = existing ?? {
      key,
      client: row.client,
      assigneeId: row.assigneeId,
      assignee: row.assignee,
      rows: [],
      rowsByPeriod: new Map<string, PlannerRow>()
    };
    group.rows.push(row);
    group.rowsByPeriod.set(periodColumnKey(row), row);
    groups.set(key, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => (periodOrder.get(periodColumnKey(left)) ?? 0) - (periodOrder.get(periodColumnKey(right)) ?? 0))
    }))
    .sort((left, right) => left.client.localeCompare(right.client));
}

function periodColumnKey(row: PlannerRow) {
  return `${row.periodStart ?? "none"}:${row.periodEnd ?? "none"}:${row.periodLabel || "Once"}`;
}

function defaultDeadlineForPeriod(trackerId: string, periodEnd: string) {
  const [year, month, day] = periodEnd.split("-").map(Number);
  const endDate = new Date(year, month - 1, day);

  if (trackerId === "vat-returns" || trackerId === "monthly-bk-vat" || trackerId === "mtd-itsa") {
    return addMonthsAndDays(endDate, 1, 7);
  }

  if (trackerId === "cis") {
    return toDateString(endDate.getMonth() === 11 ? endDate.getFullYear() + 1 : endDate.getFullYear(), (endDate.getMonth() + 1) % 12, 19);
  }

  if (trackerId === "monthly-bk-non-vat") {
    return addMonthsAndDays(endDate, 1, 0);
  }

  if (trackerId === "payroll") {
    return periodEnd;
  }

  return periodEnd;
}

function addMonthsAndDays(date: Date, months: number, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth() + months, date.getDate() + days);
  return toDateString(next.getFullYear(), next.getMonth(), next.getDate());
}

function createPeriodsForTracker(trackerId: string, recurrence: ServiceRecurrence) {
  const periods: { label: string; start: string; end: string; recurrenceKey: string }[] = [];
  const { startYear, endYear } = currentTaxYear();

  if (trackerId === "payroll") {
    const frequency = recurrence.payrollFrequency ?? "monthly";
    if (frequency === "monthly") {
      taxYearMonths(startYear, endYear).forEach(({ year, month }) => {
        const start = toDateString(year, month, 1);
        const end = toDateString(year, month, lastDayOfMonth(year, month));
        periods.push({ label: monthLabel(year, month), start, end, recurrenceKey: `${trackerId}:monthly:${start}` });
      });
      return periods;
    }

    return createRollingPayrollPeriods(trackerId, frequency, startYear, endYear);
  }

  if (recurrence.isMonthly) {
    taxYearMonths(startYear, endYear).forEach(({ year, month }) => {
      const start = toDateString(year, month, 1);
      const end = toDateString(year, month, lastDayOfMonth(year, month));
      const label = trackerId === "cis" ? `M${taxMonthNumber(month)} ${monthLabel(year, month)}` : monthLabel(year, month);
      periods.push({ label, start, end, recurrenceKey: `${trackerId}:monthly:${start}` });
    });
  }

  if (recurrence.quarterCycle) {
    const cycle = quarterCycles.find((item) => item.id === recurrence.quarterCycle);
    const cycleMonths = cycle?.months
      .map((endMonth) => ({ endMonth, year: endMonth >= 3 ? startYear : endYear }))
      .sort((a, b) => new Date(a.year, a.endMonth).getTime() - new Date(b.year, b.endMonth).getTime());
    cycleMonths?.forEach(({ endMonth, year }, index) => {
      const startDate = new Date(year, endMonth - 2, 1);
      const end = toDateString(year, endMonth, lastDayOfMonth(year, endMonth));
      const start = toDateString(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const label = `Q${index + 1} ${monthShort(startDate.getMonth())}-${monthShort(endMonth)} ${year}`;
      periods.push({ label, start, end, recurrenceKey: `${trackerId}:quarterly:${recurrence.quarterCycle}:${end}` });
    });
  }

  return periods;
}

function createNextPeriodForRow(row: PlannerRow) {
  if (!row.periodStart || !row.periodEnd || !row.recurrenceKey) return null;
  const startDate = parseDateString(row.periodStart);
  const endDate = parseDateString(row.periodEnd);
  if (!startDate || !endDate) return null;

  if (row.recurrenceKey.includes(":weekly:")) {
    const nextStart = addDays(startDate, 7);
    const nextEnd = addDays(endDate, 7);
    return payrollPeriod(row.trackerId, "weekly", nextStart, nextEnd);
  }

  if (row.recurrenceKey.includes(":biweekly:")) {
    const nextStart = addDays(startDate, 14);
    const nextEnd = addDays(endDate, 14);
    return payrollPeriod(row.trackerId, "biweekly", nextStart, nextEnd);
  }

  if (row.recurrenceKey.includes(":monthly:")) {
    const nextStart = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth(), lastDayOfMonth(nextStart.getFullYear(), nextStart.getMonth()));
    const label = row.trackerId === "cis" ? `M${taxMonthNumber(nextStart.getMonth())} ${monthLabel(nextStart.getFullYear(), nextStart.getMonth())}` : monthLabel(nextStart.getFullYear(), nextStart.getMonth());
    return {
      label,
      start: toDateString(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate()),
      end: toDateString(nextEnd.getFullYear(), nextEnd.getMonth(), nextEnd.getDate()),
      recurrenceKey: `${row.trackerId}:monthly:${toDateString(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate())}`
    };
  }

  const cycleId = quarterCycles.find((cycle) => row.recurrenceKey?.includes(`:quarterly:${cycle.id}:`))?.id;
  if (cycleId) {
    const nextQuarter = nextQuarterPeriod(row.trackerId, cycleId, endDate);
    if (nextQuarter) return nextQuarter;
  }

  return null;
}

function nextQuarterPeriod(trackerId: string, cycleId: QuarterCycle, currentEndDate: Date) {
  const cycle = quarterCycles.find((item) => item.id === cycleId);
  if (!cycle) return null;

  const candidates = cycle.months
    .flatMap((month) => [currentEndDate.getFullYear(), currentEndDate.getFullYear() + 1].map((year) => ({ month, year })))
    .map(({ month, year }) => new Date(year, month, lastDayOfMonth(year, month)))
    .filter((date) => date > currentEndDate)
    .sort((left, right) => left.getTime() - right.getTime());
  const nextEnd = candidates[0];
  if (!nextEnd) return null;

  const nextStart = new Date(nextEnd.getFullYear(), nextEnd.getMonth() - 2, 1);
  const start = toDateString(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate());
  const end = toDateString(nextEnd.getFullYear(), nextEnd.getMonth(), nextEnd.getDate());
  return {
    label: quarterPeriodLabel(cycleId, nextEnd),
    start,
    end,
    recurrenceKey: `${trackerId}:quarterly:${cycleId}:${end}`
  };
}

function quarterPeriodLabel(cycleId: QuarterCycle, endDate: Date) {
  const cycle = quarterCycles.find((item) => item.id === cycleId);
  const startYear = endDate.getMonth() >= 3 ? endDate.getFullYear() : endDate.getFullYear() - 1;
  const cycleMonths = (cycle?.months ?? [])
    .map((endMonth) => ({ endMonth, year: endMonth >= 3 ? startYear : startYear + 1 }))
    .sort((left, right) => new Date(left.year, left.endMonth).getTime() - new Date(right.year, right.endMonth).getTime());
  const index = Math.max(0, cycleMonths.findIndex((item) => item.endMonth === endDate.getMonth() && item.year === endDate.getFullYear()));
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1);
  return `Q${index + 1} ${monthShort(startDate.getMonth())}-${monthShort(endDate.getMonth())} ${endDate.getFullYear()}`;
}

function payrollPeriod(trackerId: string, frequency: Exclude<PayrollFrequency, "monthly">, startDate: Date, endDate: Date) {
  const prefix = frequency === "weekly" ? "Wk" : "BW";
  const taxYearStart = startDate.getMonth() >= 3 ? new Date(startDate.getFullYear(), 3, 1) : new Date(startDate.getFullYear() - 1, 3, 1);
  const stepDays = frequency === "weekly" ? 7 : 14;
  const index = Math.floor((startDate.getTime() - taxYearStart.getTime()) / (stepDays * 86400000)) + 1;
  const start = toDateString(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = toDateString(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return {
    label: `${prefix} ${index} ${monthShort(startDate.getMonth())} ${startDate.getDate()}-${monthShort(endDate.getMonth())} ${endDate.getDate()}`,
    start,
    end,
    recurrenceKey: `${trackerId}:${frequency}:${start}`
  };
}

function createRollingPayrollPeriods(trackerId: string, frequency: Exclude<PayrollFrequency, "monthly">, startYear: number, endYear: number) {
  const periods: { label: string; start: string; end: string; recurrenceKey: string }[] = [];
  const stepDays = frequency === "weekly" ? 7 : 14;
  const prefix = frequency === "weekly" ? "Wk" : "BW";
  const taxYearEnd = new Date(endYear, 2, 31);
  let startDate = new Date(startYear, 3, 1);
  let index = 1;

  while (startDate <= taxYearEnd) {
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + stepDays - 1);
    const cappedEndDate = endDate > taxYearEnd ? taxYearEnd : endDate;
    const start = toDateString(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = toDateString(cappedEndDate.getFullYear(), cappedEndDate.getMonth(), cappedEndDate.getDate());
    periods.push({ label: `${prefix} ${index} ${monthShort(startDate.getMonth())} ${startDate.getDate()}-${monthShort(cappedEndDate.getMonth())} ${cappedEndDate.getDate()}`, start, end, recurrenceKey: `${trackerId}:${frequency}:${start}` });
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + stepDays);
    index += 1;
  }

  return periods;
}

function currentTaxYear() {
  const today = new Date();
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return { startYear, endYear: startYear + 1 };
}

function taxYearMonths(startYear: number, endYear: number) {
  return [3, 4, 5, 6, 7, 8, 9, 10, 11].map((month) => ({ year: startYear, month }))
    .concat([0, 1, 2].map((month) => ({ year: endYear, month })));
}

function monthLabel(year: number, month: number) {
  return `${monthShort(month)} ${year}`;
}

function monthShort(month: number) {
  return monthShortNames()[month];
}

function monthShortNames() {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

function taxMonthNumber(month: number) {
  return month >= 3 ? month - 2 : month + 10;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function parseDateString(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toDateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function deriveAlerts(rows: PlannerRow[]): DeadlineAlert[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.filter((row) => row.deadlineDate && !completeStatuses.has(row.status)).map((row) => {
    const parts = row.deadlineDate!.split("-").map(Number);
    const deadline = new Date(parts[0], parts[1] - 1, parts[2]);
    const daysUntil = Math.round((deadline.getTime() - today.getTime()) / 86400000);
    const kind: AlertKind | null = daysUntil < 0 ? "overdue" : daysUntil === 0 ? "today" : daysUntil <= ALERT_WINDOW_DAYS ? "soon" : null;
    return kind ? { id: `${kind}:${row.id}`, kind, row, daysUntil } : null;
  }).filter(Boolean) as DeadlineAlert[];
}

function matchesQuery(row: PlannerRow, query: string) {
  const term = query.trim().toLowerCase();
  return !term || [row.client, row.assignee, row.notes, row.status, row.periodLabel, ...Object.values(row.details)].some((value) => value.toLowerCase().includes(term));
}

function matchesPeriodFilter(row: PlannerRow, filter: string) {
  if (filter === "all") return true;
  return periodFilterValue(row) === filter;
}

function getPeriodFilterOptions(tracker: Tracker, rows: PlannerRow[]) {
  const options = new Map<string, string>();
  if (recurringTrackerIds.has(tracker.id)) {
    currentTaxYearQuarterOptions().forEach((option) => options.set(option.value, option.label));
  }
  rows.forEach((row) => {
    const value = periodFilterValue(row);
    if (value) options.set(value, periodFilterLabel(row));
  });
  return Array.from(options, ([value, label]) => ({ value, label }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function periodFilterValue(row: PlannerRow) {
  const date = row.periodEnd ?? row.periodStart ?? row.deadlineDate;
  if (!date) return "";
  const [year, month] = date.split("-").map(Number);
  const startYear = month >= 4 ? year : year - 1;
  const quarter = month >= 4 && month <= 6 ? 1 : month >= 7 && month <= 9 ? 2 : month >= 10 && month <= 12 ? 3 : 4;
  return `${startYear}-tq${quarter}`;
}

function monthFilterValuesForRow(row: PlannerRow) {
  const start = row.periodStart ?? row.periodEnd ?? row.deadlineDate;
  const end = row.periodEnd ?? row.periodStart ?? row.deadlineDate;
  if (!start || !end) return [];

  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  const values: string[] = [];
  let cursor = new Date(startYear, startMonth - 1, 1);
  const endCursor = new Date(endYear, endMonth - 1, 1);

  while (cursor <= endCursor) {
    values.push(`month:${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return values;
}

function monthFilterLabel(value: string) {
  const [, date] = value.split(":");
  const [year, month] = date.split("-").map(Number);
  return `Month: ${monthShort(month - 1)} ${year}`;
}

function periodOptionSortValue(value: string) {
  if (value.startsWith("month:")) {
    const [, date] = value.split(":");
    const [year, month] = date.split("-").map(Number);
    return new Date(year, month - 1, 1).getTime();
  }

  if (value.startsWith("quarter:")) {
    const [, quarterValue] = value.split(":");
    const [yearText, quarterText] = quarterValue.split("-tq");
    return new Date(Number(yearText), (Number(quarterText) - 1) * 3 + 3, 1).getTime() + 1;
  }

  return Number.MAX_SAFE_INTEGER;
}

function periodFilterLabel(row: PlannerRow) {
  const value = periodFilterValue(row);
  if (!value) return "Unperioded";
  return currentTaxYearQuarterOptions(value).find((option) => option.value === value)?.label ?? value;
}

function currentTaxYearQuarterOptions(onlyValue?: string) {
  const { startYear, endYear } = currentTaxYear();
  const options = [
    { value: `${startYear}-tq1`, label: `Q1 Apr-Jun ${startYear}` },
    { value: `${startYear}-tq2`, label: `Q2 Jul-Sep ${startYear}` },
    { value: `${startYear}-tq3`, label: `Q3 Oct-Dec ${startYear}` },
    { value: `${startYear}-tq4`, label: `Q4 Jan-Mar ${endYear}` }
  ];
  return onlyValue ? options.filter((option) => option.value === onlyValue) : options;
}

function sortTrackerRows(rows: PlannerRow[]) {
  return [...rows].sort((left, right) => {
    const leftDeadline = dateSortValue(left.deadlineDate);
    const rightDeadline = dateSortValue(right.deadlineDate);
    if (leftDeadline !== rightDeadline) return leftDeadline - rightDeadline;

    const leftPeriod = dateSortValue(left.periodStart);
    const rightPeriod = dateSortValue(right.periodStart);
    if (leftPeriod !== rightPeriod) return leftPeriod - rightPeriod;

    return left.client.localeCompare(right.client);
  });
}

function dateSortValue(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function formatDateCompact(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${monthShort(month - 1)} ${year}`;
}

function statusClass(status: Status) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function recordToProfile(record: ProfileRecord): Profile {
  return { id: record.id, email: record.email, displayName: record.display_name, jobTitle: record.job_title, isAdmin: record.is_admin, isActive: record.is_active };
}

function resolveServiceAssigneeId(client: SharedClient, serviceId: string, profiles: Profile[], fallbackProfile: Profile | null) {
  const candidateId = client.serviceAssigneeIds[serviceId] ?? client.mainContactId ?? fallbackProfile?.id ?? profiles[0]?.id ?? "";
  return profiles.some((profile) => profile.id === candidateId) ? candidateId : fallbackProfile?.id ?? profiles[0]?.id ?? "";
}

function getServiceAssigneeProfile(client: SharedClient, serviceId: string, profiles: Profile[], fallbackProfile: Profile) {
  const assigneeId = resolveServiceAssigneeId(client, serviceId, profiles, fallbackProfile);
  return profiles.find((profile) => profile.id === assigneeId) ?? fallbackProfile;
}

function recordToClient(record: ClientRecord, services: ClientServiceRecord[], contacts: ClientContactRecord[]): SharedClient {
  const clientServices = services.filter((service) => service.client_id === record.id);
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    mainContactId: record.main_contact_id,
    notes: record.notes ?? "",
    status: record.status,
    requestedBy: record.requested_by,
    reviewedBy: record.reviewed_by,
    reviewedAt: record.reviewed_at,
    rejectionReason: record.rejection_reason ?? "",
    serviceIds: clientServices.map((service) => service.tracker_id),
    serviceRecurrences: Object.fromEntries(clientServices.map((service) => [service.tracker_id, normalizeRecurrence(service.tracker_id, { isMonthly: Boolean(service.is_monthly), quarterCycle: isQuarterCycle(service.quarter_cycle) ? service.quarter_cycle : null, payrollFrequency: isPayrollFrequency(service.quarter_cycle) ? service.quarter_cycle : null })])),
    serviceAssigneeIds: Object.fromEntries(clientServices.map((service) => [service.tracker_id, service.assignee_id ?? record.main_contact_id])),
    contacts: contacts.filter((contact) => contact.client_id === record.id).map((contact) => ({ id: contact.id, fullName: contact.full_name, role: contact.role ?? "", email: contact.email ?? "" }))
  };
}

function recordToRow(record: PlannerRowRecord, profiles: Profile[], clients: SharedClient[]): PlannerRow {
  const periodEnd = record.period_end ?? null;
  return { id: record.id, clientId: record.client_id, client: clients.find((client) => client.id === record.client_id)?.name ?? record.client, assigneeId: record.assignee_id, assignee: profiles.find((profile) => profile.id === record.assignee_id)?.displayName ?? record.assignee, team: record.team, trackerId: record.tracker_id, status: record.status, priority: record.priority, deadlineDate: record.deadline_date ?? (record.is_recurring && periodEnd ? defaultDeadlineForPeriod(record.tracker_id, periodEnd) : null), periodLabel: record.period_label ?? "", periodStart: record.period_start ?? null, periodEnd, isRecurring: Boolean(record.is_recurring), recurrenceKey: record.recurrence_key ?? null, notes: record.notes ?? "", details: record.details ?? {} };
}

function rowToRecord(row: PlannerRow, createdBy: string) {
  return { id: row.id, client_id: row.clientId, client: row.client, assignee_id: row.assigneeId, assignee: row.assignee, created_by: createdBy, team: row.team, tracker_id: row.trackerId, status: row.status, priority: row.priority, deadline_date: row.deadlineDate, period_label: row.periodLabel || null, period_start: row.periodStart, period_end: row.periodEnd, is_recurring: row.isRecurring, recurrence_key: row.recurrenceKey, notes: row.notes, details: row.details };
}

function legacyRowToRecord(row: PlannerRow, createdBy: string) {
  return { id: row.id, client_id: row.clientId, client: row.client, assignee_id: row.assigneeId, assignee: row.assignee, created_by: createdBy, team: row.team, tracker_id: row.trackerId, status: row.status, priority: row.priority, deadline_date: row.deadlineDate, notes: row.notes, details: row.details };
}
