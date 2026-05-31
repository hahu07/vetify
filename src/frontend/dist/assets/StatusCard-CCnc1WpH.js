import { s as CircleX, aa as TriangleAlert, f as CircleCheck, j as jsxRuntimeExports, y as cn } from "./index-CPnZ4-ee.js";
import { C as Clock } from "./clock-BRCXs4iw.js";
const variantConfig = {
  success: {
    bg: "bg-primary/5",
    border: "border-primary/20",
    badge: "bg-primary/10 text-primary",
    text: "text-primary",
    defaultIcon: CircleCheck
  },
  warning: {
    bg: "bg-secondary/10",
    border: "border-secondary/30",
    badge: "bg-secondary/20 text-secondary-foreground",
    text: "text-secondary-foreground",
    defaultIcon: TriangleAlert
  },
  pending: {
    bg: "bg-accent/10",
    border: "border-accent/30",
    badge: "bg-accent/20 text-accent-foreground",
    text: "text-accent-foreground",
    defaultIcon: Clock
  },
  danger: {
    bg: "bg-destructive/5",
    border: "border-destructive/20",
    badge: "bg-destructive/10 text-destructive",
    text: "text-destructive",
    defaultIcon: CircleX
  }
};
function StatusCard({
  icon,
  label,
  value,
  variant,
  description,
  className,
  "data-ocid": dataOcid
}) {
  const cfg = variantConfig[variant];
  const Icon = icon ?? cfg.defaultIcon;
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      "data-ocid": dataOcid,
      className: cn("rounded-lg border p-4", cfg.bg, cfg.border, className),
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("mt-0.5 rounded-full p-1.5", cfg.badge), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "h-4 w-4" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              className: cn(
                "text-xs font-medium uppercase tracking-wider",
                cfg.text
              ),
              children: label
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xl font-bold font-display text-foreground truncate", children: value }),
          description && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: description })
        ] })
      ] })
    }
  );
}
export {
  StatusCard as S
};
