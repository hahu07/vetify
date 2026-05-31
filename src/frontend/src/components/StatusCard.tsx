import { cn } from "@/lib/utils";
import type { StatusVariant } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  type LucideIcon,
  XCircle,
} from "lucide-react";

interface StatusCardProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  variant: StatusVariant;
  description?: string;
  className?: string;
  "data-ocid"?: string;
}

const variantConfig: Record<
  StatusVariant,
  {
    bg: string;
    border: string;
    badge: string;
    text: string;
    defaultIcon: LucideIcon;
  }
> = {
  success: {
    bg: "bg-primary/5",
    border: "border-primary/20",
    badge: "bg-primary/10 text-primary",
    text: "text-primary",
    defaultIcon: CheckCircle2,
  },
  warning: {
    bg: "bg-secondary/10",
    border: "border-secondary/30",
    badge: "bg-secondary/20 text-secondary-foreground",
    text: "text-secondary-foreground",
    defaultIcon: AlertTriangle,
  },
  pending: {
    bg: "bg-accent/10",
    border: "border-accent/30",
    badge: "bg-accent/20 text-accent-foreground",
    text: "text-accent-foreground",
    defaultIcon: Clock,
  },
  danger: {
    bg: "bg-destructive/5",
    border: "border-destructive/20",
    badge: "bg-destructive/10 text-destructive",
    text: "text-destructive",
    defaultIcon: XCircle,
  },
};

export function StatusCard({
  icon,
  label,
  value,
  variant,
  description,
  className,
  "data-ocid": dataOcid,
}: StatusCardProps) {
  const cfg = variantConfig[variant];
  const Icon = icon ?? cfg.defaultIcon;

  return (
    <div
      data-ocid={dataOcid}
      className={cn("rounded-lg border p-4", cfg.bg, cfg.border, className)}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 rounded-full p-1.5", cfg.badge)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wider",
              cfg.text,
            )}
          >
            {label}
          </p>
          <p className="mt-0.5 text-xl font-bold font-display text-foreground truncate">
            {value}
          </p>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
