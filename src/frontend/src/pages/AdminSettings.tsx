import { AdminLayout } from "@/components/AdminLayout";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/hooks/use-backend";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ── Masked Input with Show/Hide Toggle ───────────────────────────────────────

interface MaskedInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  dataOcid?: string;
}

function MaskedInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  dataOcid,
}: MaskedInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
          data-ocid={dataOcid}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide" : "Show"}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Invite Link Status Badge ────────────────────────────────────────────────

function inviteStatusBadge(status: string) {
  switch (status) {
    case "active":
      return (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/25"
        >
          Active
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          Expired
        </Badge>
      );
    case "used":
      return (
        <Badge
          variant="outline"
          className="bg-chart-4/10 text-foreground border-chart-4/25"
        >
          Used
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-muted text-muted-foreground">
          {status}
        </Badge>
      );
  }
}

function formatDate(ts: bigint): string {
  try {
    return new Date(Number(ts) / 1_000_000).toLocaleDateString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

// ── AdminSettings ───────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { actor } = useBackend();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isSuperAdmin, isLoading: isSuperAdminLoading } = useIsSuperAdmin();

  // Credentials form state — always start empty; populated from fetched data
  // Kashif config state
  const [kashifConfig, setKashifConfig] = useState<{
    riskKeywords: Array<[string, bigint]>;
    instrumentWeights: Array<[string, bigint]>;
    defaultScore: bigint;
  } | null>(null);
  const [kashifSaveStatus, setKashifSaveStatus] = useState<
    Record<string, "idle" | "saving" | "saved" | "error">
  >({});

  const [monoSecretKey, setMonoSecretKey] = useState("");
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [twilioAccountSid, setTwilioAccountSid] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [twilioWhatsappFrom, setTwilioWhatsappFrom] = useState("");

  // Invite link modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────

  const credentialsQuery = useQuery({
    queryKey: ["credentials"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getCredentials();
    },
    enabled: !!actor,
  });

  const kashifConfigQuery = useQuery({
    queryKey: ["kashif_scoring_config"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getKashifScoringConfig();
    },
    enabled: !!actor,
  });

  // Populate local Kashif config state from fetched data (once)
  if (kashifConfigQuery.data && !kashifConfig) {
    setKashifConfig({
      riskKeywords: [...kashifConfigQuery.data.riskKeywords],
      instrumentWeights: [...kashifConfigQuery.data.instrumentWeights],
      defaultScore: kashifConfigQuery.data.defaultScore,
    });
  }

  const inviteLinksQuery = useQuery({
    queryKey: ["admin_invite_links"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.listAdminInviteLinks();
    },
    enabled: !!actor,
  });

  // Populate form when credentials load — only set fields that are still empty
  // (masked bullet strings from backend are treated as placeholders, not real values)
  const creds = credentialsQuery.data;
  if (creds) {
    if (
      monoSecretKey === "" &&
      creds.monoSecretKey &&
      !creds.monoSecretKey.includes("•")
    ) {
      setMonoSecretKey(creds.monoSecretKey);
    }
    if (
      openAiApiKey === "" &&
      creds.openAiApiKey &&
      !creds.openAiApiKey.includes("•")
    ) {
      setOpenAiApiKey(creds.openAiApiKey);
    }
    if (
      twilioAccountSid === "" &&
      creds.twilioAccountSid &&
      !creds.twilioAccountSid.includes("•")
    ) {
      setTwilioAccountSid(creds.twilioAccountSid);
    }
    if (
      twilioAuthToken === "" &&
      creds.twilioAuthToken &&
      !creds.twilioAuthToken.includes("•")
    ) {
      setTwilioAuthToken(creds.twilioAuthToken);
    }
    if (
      twilioWhatsappFrom === "" &&
      creds.twilioWhatsappFrom &&
      !creds.twilioWhatsappFrom.includes("•")
    ) {
      setTwilioWhatsappFrom(creds.twilioWhatsappFrom);
    }
  }

  // ── Per-credential save mutations ────────────────────────────────────────

  const saveMonoMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const current = creds ?? {
        monoSecretKey: "",
        openAiApiKey: "",
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioWhatsappFrom: "",
      };
      return actor.setCredentials({ ...current, monoSecretKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("Mono Secret Key saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });

  const saveOpenAiMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const current = creds ?? {
        monoSecretKey: "",
        openAiApiKey: "",
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioWhatsappFrom: "",
      };
      return actor.setCredentials({ ...current, openAiApiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("OpenAI API Key saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });

  const saveTwilioSidMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const current = creds ?? {
        monoSecretKey: "",
        openAiApiKey: "",
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioWhatsappFrom: "",
      };
      return actor.setCredentials({ ...current, twilioAccountSid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("Twilio Account SID saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });

  const saveTwilioTokenMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const current = creds ?? {
        monoSecretKey: "",
        openAiApiKey: "",
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioWhatsappFrom: "",
      };
      return actor.setCredentials({ ...current, twilioAuthToken });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("Twilio Auth Token saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });

  const saveTwilioFromMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      const current = creds ?? {
        monoSecretKey: "",
        openAiApiKey: "",
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioWhatsappFrom: "",
      };
      return actor.setCredentials({ ...current, twilioWhatsappFrom });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      toast.success("Twilio WhatsApp Number saved");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save"),
  });
  async function saveKashifRow(
    section: "riskKeywords" | "instrumentWeights",
    idx: number,
  ) {
    if (!actor || !kashifConfig) return;
    const key = `${section}.${idx}`;
    setKashifSaveStatus((s) => ({ ...s, [key]: "saving" }));
    try {
      const result = await actor.updateKashifScoringConfig(kashifConfig);
      if (result.__kind__ === "err") throw new Error(result.err);
      setKashifSaveStatus((s) => ({ ...s, [key]: "saved" }));
      queryClient.invalidateQueries({ queryKey: ["kashif_scoring_config"] });
      setTimeout(
        () => setKashifSaveStatus((s) => ({ ...s, [key]: "idle" })),
        2500,
      );
    } catch (err) {
      setKashifSaveStatus((s) => ({ ...s, [key]: "error" }));
      toast.error(err instanceof Error ? err.message : "Failed to save");
      setTimeout(
        () => setKashifSaveStatus((s) => ({ ...s, [key]: "idle" })),
        3000,
      );
    }
  }

  function updateKashifEntry(
    section: "riskKeywords" | "instrumentWeights",
    idx: number,
    field: 0 | 1,
    value: string,
  ) {
    if (!kashifConfig) return;
    const updated = kashifConfig[section].map((row, i): [string, bigint] => {
      if (i !== idx) return row;
      return field === 0
        ? [value, row[1]]
        : [row[0], BigInt(Math.max(0, Math.min(100, Number(value) || 0)))];
    });
    setKashifConfig({ ...kashifConfig, [section]: updated });
  }

  function addKashifRow(section: "riskKeywords" | "instrumentWeights") {
    if (!kashifConfig) return;
    setKashifConfig({
      ...kashifConfig,
      [section]: [...kashifConfig[section], ["", BigInt(50)]],
    });
  }

  function removeKashifRow(
    section: "riskKeywords" | "instrumentWeights",
    idx: number,
  ) {
    if (!kashifConfig) return;
    setKashifConfig({
      ...kashifConfig,
      [section]: kashifConfig[section].filter((_, i) => i !== idx),
    });
  }

  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Not connected");
      return actor.generateAdminInviteLink();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin_invite_links"] });
      if (result.__kind__ === "ok") {
        const code = result.ok;
        const url = `${window.location.origin}/admin/register?code=${encodeURIComponent(code)}`;
        setGeneratedLink(url);
        setInviteModalOpen(true);
        toast.success("Invite link generated");
      } else {
        toast.error(result.err);
      }
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to generate invite link",
      ),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!actor) throw new Error("Not connected");
      return actor.revokeAdminInviteLink(code);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin_invite_links"] });
      if (result.__kind__ === "ok") {
        toast.success("Invite link revoked");
      } else {
        toast.error(result.err);
      }
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke invite link",
      ),
  });

  // Super-admin guard — show access denied if not super-admin
  if (!isSuperAdminLoading && !isSuperAdmin) {
    return (
      <AdminLayout>
        <div className="container mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Shield className="h-12 w-12 text-muted-foreground/40" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              This page is only accessible to the super-admin.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: "/admin/dashboard" })}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const isLoading = credentialsQuery.isLoading || inviteLinksQuery.isLoading;

  const inviteLinks = inviteLinksQuery.data ?? [];

  return (
    <AdminLayout>
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <PageHeader
          title="Admin Settings"
          subtitle="Manage API credentials and admin invite links."
          breadcrumbs={[{ label: "Admin" }, { label: "Settings" }]}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: "/admin/dashboard" })}
              className="gap-1.5"
              type="button"
              data-ocid="admin.settings.back_button"
            >
              <Shield className="h-4 w-4" />
              Back to Dashboard
            </Button>
          }
        />

        {/* API Credentials Section */}
        <section
          className="mb-10"
          data-ocid="admin.settings.credentials_section"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <KeyRound className="h-5 w-5 text-primary" />
                API Credentials
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {["a", "b", "c", "d", "e"].map((k) => (
                    <Skeleton key={k} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Mono */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <MaskedInput
                        id="mono-secret-key"
                        label="Mono Secret Key"
                        value={monoSecretKey}
                        onChange={setMonoSecretKey}
                        placeholder="sk_live_..."
                        disabled={saveMonoMutation.isPending}
                        dataOcid="admin.settings.mono_secret_key_input"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveMonoMutation.mutate()}
                      disabled={saveMonoMutation.isPending || !monoSecretKey}
                      className="shrink-0 gap-1.5"
                      data-ocid="admin.settings.save_mono_button"
                    >
                      {saveMonoMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>

                  {/* OpenAI */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <MaskedInput
                        id="openai-api-key"
                        label="OpenAI API Key"
                        value={openAiApiKey}
                        onChange={setOpenAiApiKey}
                        placeholder="sk-..."
                        disabled={saveOpenAiMutation.isPending}
                        dataOcid="admin.settings.openai_api_key_input"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveOpenAiMutation.mutate()}
                      disabled={saveOpenAiMutation.isPending || !openAiApiKey}
                      className="shrink-0 gap-1.5"
                      data-ocid="admin.settings.save_openai_button"
                    >
                      {saveOpenAiMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>

                  <Separator className="my-1" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Twilio WhatsApp
                  </p>

                  {/* Twilio SID */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <MaskedInput
                        id="twilio-account-sid"
                        label="Twilio Account SID"
                        value={twilioAccountSid}
                        onChange={setTwilioAccountSid}
                        placeholder="AC..."
                        disabled={saveTwilioSidMutation.isPending}
                        dataOcid="admin.settings.twilio_account_sid_input"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveTwilioSidMutation.mutate()}
                      disabled={
                        saveTwilioSidMutation.isPending || !twilioAccountSid
                      }
                      className="shrink-0 gap-1.5"
                      data-ocid="admin.settings.save_twilio_sid_button"
                    >
                      {saveTwilioSidMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>

                  {/* Twilio Auth Token */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <MaskedInput
                        id="twilio-auth-token"
                        label="Twilio Auth Token"
                        value={twilioAuthToken}
                        onChange={setTwilioAuthToken}
                        placeholder="..."
                        disabled={saveTwilioTokenMutation.isPending}
                        dataOcid="admin.settings.twilio_auth_token_input"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveTwilioTokenMutation.mutate()}
                      disabled={
                        saveTwilioTokenMutation.isPending || !twilioAuthToken
                      }
                      className="shrink-0 gap-1.5"
                      data-ocid="admin.settings.save_twilio_token_button"
                    >
                      {saveTwilioTokenMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>

                  {/* Twilio WhatsApp From */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <MaskedInput
                        id="twilio-whatsapp-from"
                        label="Twilio WhatsApp Number"
                        value={twilioWhatsappFrom}
                        onChange={setTwilioWhatsappFrom}
                        placeholder="+234..."
                        disabled={saveTwilioFromMutation.isPending}
                        dataOcid="admin.settings.twilio_whatsapp_from_input"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => saveTwilioFromMutation.mutate()}
                      disabled={
                        saveTwilioFromMutation.isPending || !twilioWhatsappFrom
                      }
                      className="shrink-0 gap-1.5"
                      data-ocid="admin.settings.save_twilio_from_button"
                    >
                      {saveTwilioFromMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Kashif Matching Configuration Section */}
        <section
          className="mb-10"
          data-ocid="admin.settings.kashif_config_section"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Settings2 className="h-5 w-5 text-primary" />
                Kashif Matching Configuration
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure how Kashif (الكاشف) scores and matches businesses to
                financiers. Edit keywords and weights, then save each row
                individually.
              </p>
            </CardHeader>
            <CardContent>
              {kashifConfigQuery.isLoading || !kashifConfig ? (
                <div className="space-y-4">
                  {["a", "b", "c"].map((k) => (
                    <Skeleton key={k} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Risk Keywords */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Risk Keywords
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => addKashifRow("riskKeywords")}
                        data-ocid="admin.settings.kashif.add_keyword_button"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Keyword
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Keyword</th>
                            <th className="pb-2 pr-4 font-medium w-28">
                              Weight (0–100)
                            </th>
                            <th className="pb-2 text-right font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {kashifConfig.riskKeywords.map((row, idx) => {
                            const rowKey = `riskKeywords.${idx}`;
                            const saveStatus =
                              kashifSaveStatus[rowKey] ?? "idle";
                            return (
                              <tr
                                key={`rk-${row[0]}-${idx}`}
                                className="border-b border-border/50 last:border-0"
                                data-ocid={`admin.settings.kashif.risk_keyword.item.${idx + 1}`}
                              >
                                <td className="py-2 pr-3">
                                  <input
                                    type="text"
                                    value={row[0]}
                                    onChange={(e) =>
                                      updateKashifEntry(
                                        "riskKeywords",
                                        idx,
                                        0,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                                    placeholder="e.g. equity"
                                    data-ocid={`admin.settings.kashif.risk_keyword.input.${idx + 1}`}
                                  />
                                </td>
                                <td className="py-2 pr-3 w-28">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={Number(row[1])}
                                    onChange={(e) =>
                                      updateKashifEntry(
                                        "riskKeywords",
                                        idx,
                                        1,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                                    data-ocid={`admin.settings.kashif.risk_keyword.weight.${idx + 1}`}
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    {saveStatus === "saved" && (
                                      <span
                                        className="text-xs text-primary"
                                        data-ocid={`admin.settings.kashif.risk_keyword.success_state.${idx + 1}`}
                                      >
                                        Saved ✓
                                      </span>
                                    )}
                                    {saveStatus === "error" && (
                                      <span
                                        className="text-xs text-destructive"
                                        data-ocid={`admin.settings.kashif.risk_keyword.error_state.${idx + 1}`}
                                      >
                                        Error
                                      </span>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="gap-1"
                                      disabled={
                                        saveStatus === "saving" || !row[0]
                                      }
                                      onClick={() =>
                                        saveKashifRow("riskKeywords", idx)
                                      }
                                      data-ocid={`admin.settings.kashif.risk_keyword.save_button.${idx + 1}`}
                                    >
                                      {saveStatus === "saving" ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Save className="h-3 w-3" />
                                      )}
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        removeKashifRow("riskKeywords", idx)
                                      }
                                      aria-label="Remove"
                                      data-ocid={`admin.settings.kashif.risk_keyword.delete_button.${idx + 1}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Separator />

                  {/* Instrument Weights */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Instrument Weights
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => addKashifRow("instrumentWeights")}
                        data-ocid="admin.settings.kashif.add_instrument_button"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Instrument
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">
                              Instrument
                            </th>
                            <th className="pb-2 pr-4 font-medium w-28">
                              Weight (0–100)
                            </th>
                            <th className="pb-2 text-right font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {kashifConfig.instrumentWeights.map((row, idx) => {
                            const rowKey = `instrumentWeights.${idx}`;
                            const saveStatus =
                              kashifSaveStatus[rowKey] ?? "idle";
                            return (
                              <tr
                                key={`iw-${row[0]}-${idx}`}
                                className="border-b border-border/50 last:border-0"
                                data-ocid={`admin.settings.kashif.instrument.item.${idx + 1}`}
                              >
                                <td className="py-2 pr-3">
                                  <input
                                    type="text"
                                    value={row[0]}
                                    onChange={(e) =>
                                      updateKashifEntry(
                                        "instrumentWeights",
                                        idx,
                                        0,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                                    placeholder="e.g. murabaha"
                                    data-ocid={`admin.settings.kashif.instrument.input.${idx + 1}`}
                                  />
                                </td>
                                <td className="py-2 pr-3 w-28">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={Number(row[1])}
                                    onChange={(e) =>
                                      updateKashifEntry(
                                        "instrumentWeights",
                                        idx,
                                        1,
                                        e.target.value,
                                      )
                                    }
                                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                                    data-ocid={`admin.settings.kashif.instrument.weight.${idx + 1}`}
                                  />
                                </td>
                                <td className="py-2 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    {saveStatus === "saved" && (
                                      <span
                                        className="text-xs text-primary"
                                        data-ocid={`admin.settings.kashif.instrument.success_state.${idx + 1}`}
                                      >
                                        Saved ✓
                                      </span>
                                    )}
                                    {saveStatus === "error" && (
                                      <span
                                        className="text-xs text-destructive"
                                        data-ocid={`admin.settings.kashif.instrument.error_state.${idx + 1}`}
                                      >
                                        Error
                                      </span>
                                    )}
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="gap-1"
                                      disabled={
                                        saveStatus === "saving" || !row[0]
                                      }
                                      onClick={() =>
                                        saveKashifRow("instrumentWeights", idx)
                                      }
                                      data-ocid={`admin.settings.kashif.instrument.save_button.${idx + 1}`}
                                    >
                                      {saveStatus === "saving" ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Save className="h-3 w-3" />
                                      )}
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-muted-foreground hover:text-destructive"
                                      onClick={() =>
                                        removeKashifRow(
                                          "instrumentWeights",
                                          idx,
                                        )
                                      }
                                      aria-label="Remove"
                                      data-ocid={`admin.settings.kashif.instrument.delete_button.${idx + 1}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Admin Invite Links Section */}
        <section data-ocid="admin.settings.invite_links_section">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 font-display">
                <Link2 className="h-5 w-5 text-primary" />
                Admin Invite Links
              </CardTitle>
              <Button
                type="button"
                size="sm"
                onClick={() => generateInviteMutation.mutate()}
                disabled={generateInviteMutation.isPending}
                className="gap-1.5"
                data-ocid="admin.settings.generate_invite_button"
              >
                {generateInviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Generate New Invite Link
              </Button>
            </CardHeader>
            <CardContent>
              {inviteLinksQuery.isLoading ? (
                <div className="space-y-3">
                  {["a", "b", "c"].map((k) => (
                    <Skeleton key={k} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : inviteLinks.length === 0 ? (
                <div
                  className="py-10 text-center text-sm text-muted-foreground"
                  data-ocid="admin.settings.invite_links_empty_state"
                >
                  <Link2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  No invite links generated yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Code</th>
                        <th className="pb-2 pr-4 font-medium">Created</th>
                        <th className="pb-2 pr-4 font-medium">Expires</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inviteLinks.map((link, idx) => (
                        <tr
                          key={link.code}
                          className="border-b border-border/50 last:border-0"
                          data-ocid={`admin.settings.invite_link.item.${idx + 1}`}
                        >
                          <td className="py-3 pr-4 font-mono text-xs text-foreground">
                            {link.code.slice(0, 12)}…
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(link.createdAt)}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(link.expiresAt)}
                          </td>
                          <td className="py-3 pr-4">
                            {inviteStatusBadge(link.status)}
                          </td>
                          <td className="py-3 text-right">
                            {link.status === "active" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  revokeInviteMutation.mutate(link.code)
                                }
                                disabled={revokeInviteMutation.isPending}
                                data-ocid={`admin.settings.invite_link.revoke_button.${idx + 1}`}
                              >
                                Revoke
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Generated Link Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent
          className="sm:max-w-lg"
          data-ocid="admin.settings.invite_link_modal"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Admin Invite Link Generated
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Share this link with the person you want to invite as an admin. It
              is single-use and expires in 7 days.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <code className="flex-1 break-all text-xs text-foreground">
                {generatedLink}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (generatedLink) {
                    void navigator.clipboard.writeText(generatedLink);
                    toast.success("Link copied to clipboard");
                  }
                }}
                className="shrink-0 gap-1"
                data-ocid="admin.settings.invite_link_modal.copy_button"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              data-ocid="admin.settings.invite_link_modal.close_button"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
