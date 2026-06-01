import { createActor } from "@/backend";
import type { ProfilePrivacySettings } from "@/backend";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useUserRole } from "@/hooks/use-user-role";
import { useActor } from "@caffeineai/core-infrastructure";
import { CheckCircle2, Copy, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function PrivacySettingsPage() {
  const { actor, isFetching } = useActor(createActor);
  const { profile } = useUserRole();

  const applicantId: string = (() => {
    if (profile && "id" in profile)
      return (profile.id as { toText?: () => string })?.toText?.() ?? "";
    if (profile && "userId" in profile)
      return (profile.userId as { toText?: () => string })?.toText?.() ?? "";
    return "";
  })();

  const [settings, setSettings] = useState<ProfilePrivacySettings>({
    applicantId: "",
    showFinancingAmount: false,
    showIncome: false,
    showMizanScore: false,
    showDirectorNames: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLLC =
    profile &&
    "businessTypeEnum" in profile &&
    (profile as { businessTypeEnum?: string }).businessTypeEnum === "llc";

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/profile/${applicantId}`
      : `/profile/${applicantId}`;

  useEffect(() => {
    if (!actor || isFetching || !applicantId) return;
    actor
      .get_privacy_settings(applicantId)
      .then((s) => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [actor, isFetching, applicantId]);

  const handleToggle = (
    field: keyof Omit<ProfilePrivacySettings, "applicantId">,
  ) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    if (!actor || !applicantId) return;
    setSaving(true);
    try {
      const result = await actor.update_privacy_settings(applicantId, {
        ...settings,
        applicantId,
      });
      if ("err" in result) {
        toast.error(result.err);
      } else {
        toast.success("Privacy settings saved.");
      }
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true);
      toast.success("Profile link copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleRows: {
    field: keyof Omit<ProfilePrivacySettings, "applicantId">;
    label: string;
    description: string;
    llcOnly?: boolean;
  }[] = [
    {
      field: "showFinancingAmount",
      label: "Show Financing Amount",
      description:
        "Financiers can see the amount of financing you are seeking.",
    },
    {
      field: "showIncome",
      label: "Show Monthly Income",
      description:
        "Financiers can see your declared monthly income on your public profile.",
    },
    {
      field: "showMizanScore",
      label: "Show Mizan Score",
      description:
        "Financiers can see your Mizan risk score and risk classification.",
    },
    {
      field: "showDirectorNames",
      label: "Show Director Names",
      description:
        "Financiers can see the names of company directors on your public profile.",
      llcOnly: true,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Privacy Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control what financiers see on your public profile. All fields are
          hidden by default.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Public Profile Visibility
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Fields you enable below will be visible to any verified financier
            who views your profile.
          </p>
        </div>
        <Separator />

        {loading ? (
          <div
            className="space-y-4 p-5"
            data-ocid="privacy_settings.loading_state"
          >
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {toggleRows.map((row) => {
              if (row.llcOnly && !isLLC) return null;
              const value = settings[row.field];
              return (
                <div
                  key={row.field}
                  className="flex items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {row.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {value ? (
                      <Eye
                        className="h-3.5 w-3.5 text-primary"
                        aria-hidden="true"
                      />
                    ) : (
                      <EyeOff
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <Switch
                      checked={value}
                      onCheckedChange={() => handleToggle(row.field)}
                      aria-label={`Toggle ${row.label}`}
                      data-ocid={`privacy_settings.${row.field}_switch`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Separator />
        <div className="flex justify-end px-5 py-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            data-ocid="privacy_settings.save_button"
          >
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Public profile link */}
      {applicantId && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Your Public Profile Link
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Share this link with financiers to let them view your public
            profile.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code
              className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-foreground"
              data-ocid="privacy_settings.profile_url"
            >
              {profileUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="shrink-0 gap-1.5"
              data-ocid="privacy_settings.copy_link_button"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
