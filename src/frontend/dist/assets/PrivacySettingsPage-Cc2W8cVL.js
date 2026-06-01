import { r as reactExports, aG as useComposedRefs, aF as useControllableState, j as jsxRuntimeExports, aE as Primitive, aH as composeEventHandlers, aI as useSize, aJ as createContextScope, z as cn, Z as useActor, aU as Eye, i as Separator, w as Skeleton, aV as EyeOff, b as Button, f as CircleCheck, aW as Copy, l as ue, ad as createActor } from "./index-DiwSGmNR.js";
import { u as usePrevious } from "./index-Hp8SMVjr.js";
import { u as useUserRole } from "./use-user-role-DlEe0uPV.js";
var SWITCH_NAME = "Switch";
var [createSwitchContext] = createContextScope(SWITCH_NAME);
var [SwitchProvider, useSwitchContext] = createSwitchContext(SWITCH_NAME);
var Switch$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeSwitch,
      name,
      checked: checkedProp,
      defaultChecked,
      required,
      disabled,
      value = "on",
      onCheckedChange,
      form,
      ...switchProps
    } = props;
    const [button, setButton] = reactExports.useState(null);
    const composedRefs = useComposedRefs(forwardedRef, (node) => setButton(node));
    const hasConsumerStoppedPropagationRef = reactExports.useRef(false);
    const isFormControl = button ? form || !!button.closest("form") : true;
    const [checked, setChecked] = useControllableState({
      prop: checkedProp,
      defaultProp: defaultChecked ?? false,
      onChange: onCheckedChange,
      caller: SWITCH_NAME
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(SwitchProvider, { scope: __scopeSwitch, checked, disabled, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Primitive.button,
        {
          type: "button",
          role: "switch",
          "aria-checked": checked,
          "aria-required": required,
          "data-state": getState(checked),
          "data-disabled": disabled ? "" : void 0,
          disabled,
          value,
          ...switchProps,
          ref: composedRefs,
          onClick: composeEventHandlers(props.onClick, (event) => {
            setChecked((prevChecked) => !prevChecked);
            if (isFormControl) {
              hasConsumerStoppedPropagationRef.current = event.isPropagationStopped();
              if (!hasConsumerStoppedPropagationRef.current) event.stopPropagation();
            }
          })
        }
      ),
      isFormControl && /* @__PURE__ */ jsxRuntimeExports.jsx(
        SwitchBubbleInput,
        {
          control: button,
          bubbles: !hasConsumerStoppedPropagationRef.current,
          name,
          value,
          checked,
          required,
          disabled,
          form,
          style: { transform: "translateX(-100%)" }
        }
      )
    ] });
  }
);
Switch$1.displayName = SWITCH_NAME;
var THUMB_NAME = "SwitchThumb";
var SwitchThumb = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeSwitch, ...thumbProps } = props;
    const context = useSwitchContext(THUMB_NAME, __scopeSwitch);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.span,
      {
        "data-state": getState(context.checked),
        "data-disabled": context.disabled ? "" : void 0,
        ...thumbProps,
        ref: forwardedRef
      }
    );
  }
);
SwitchThumb.displayName = THUMB_NAME;
var BUBBLE_INPUT_NAME = "SwitchBubbleInput";
var SwitchBubbleInput = reactExports.forwardRef(
  ({
    __scopeSwitch,
    control,
    checked,
    bubbles = true,
    ...props
  }, forwardedRef) => {
    const ref = reactExports.useRef(null);
    const composedRefs = useComposedRefs(ref, forwardedRef);
    const prevChecked = usePrevious(checked);
    const controlSize = useSize(control);
    reactExports.useEffect(() => {
      const input = ref.current;
      if (!input) return;
      const inputProto = window.HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(
        inputProto,
        "checked"
      );
      const setChecked = descriptor.set;
      if (prevChecked !== checked && setChecked) {
        const event = new Event("click", { bubbles });
        setChecked.call(input, checked);
        input.dispatchEvent(event);
      }
    }, [prevChecked, checked, bubbles]);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "input",
      {
        type: "checkbox",
        "aria-hidden": true,
        defaultChecked: checked,
        ...props,
        tabIndex: -1,
        ref: composedRefs,
        style: {
          ...props.style,
          ...controlSize,
          position: "absolute",
          pointerEvents: "none",
          opacity: 0,
          margin: 0
        }
      }
    );
  }
);
SwitchBubbleInput.displayName = BUBBLE_INPUT_NAME;
function getState(checked) {
  return checked ? "checked" : "unchecked";
}
var Root = Switch$1;
var Thumb = SwitchThumb;
function Switch({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Root,
    {
      "data-slot": "switch",
      className: cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        Thumb,
        {
          "data-slot": "switch-thumb",
          className: cn(
            "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
          )
        }
      )
    }
  );
}
function PrivacySettingsPage() {
  const { actor, isFetching } = useActor(createActor);
  const { profile } = useUserRole();
  const applicantId = (() => {
    var _a, _b, _c, _d;
    if (profile && "id" in profile)
      return ((_b = (_a = profile.id) == null ? void 0 : _a.toText) == null ? void 0 : _b.call(_a)) ?? "";
    if (profile && "userId" in profile)
      return ((_d = (_c = profile.userId) == null ? void 0 : _c.toText) == null ? void 0 : _d.call(_c)) ?? "";
    return "";
  })();
  const [settings, setSettings] = reactExports.useState({
    applicantId: "",
    showFinancingAmount: false,
    showIncome: false,
    showMizanScore: false,
    showDirectorNames: false
  });
  const [loading, setLoading] = reactExports.useState(true);
  const [saving, setSaving] = reactExports.useState(false);
  const [copied, setCopied] = reactExports.useState(false);
  const isLLC = profile && "businessTypeEnum" in profile && profile.businessTypeEnum === "llc";
  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/${applicantId}` : `/profile/${applicantId}`;
  reactExports.useEffect(() => {
    if (!actor || isFetching || !applicantId) return;
    actor.get_privacy_settings(applicantId).then((s) => {
      setSettings(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [actor, isFetching, applicantId]);
  const handleToggle = (field) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };
  const handleSave = async () => {
    if (!actor || !applicantId) return;
    setSaving(true);
    try {
      const result = await actor.update_privacy_settings(applicantId, {
        ...settings,
        applicantId
      });
      if ("err" in result) {
        ue.error(result.err);
      } else {
        ue.success("Privacy settings saved.");
      }
    } catch {
      ue.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true);
      ue.success("Profile link copied!");
      setTimeout(() => setCopied(false), 2e3);
    });
  };
  const toggleRows = [
    {
      field: "showFinancingAmount",
      label: "Show Financing Amount",
      description: "Financiers can see the amount of financing you are seeking."
    },
    {
      field: "showIncome",
      label: "Show Monthly Income",
      description: "Financiers can see your declared monthly income on your public profile."
    },
    {
      field: "showMizanScore",
      label: "Show Mizan Score",
      description: "Financiers can see your Mizan risk score and risk classification."
    },
    {
      field: "showDirectorNames",
      label: "Show Director Names",
      description: "Financiers can see the names of company directors on your public profile.",
      llcOnly: true
    }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-2xl space-y-8 px-4 py-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display text-2xl font-bold text-foreground", children: "Privacy Settings" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Control what financiers see on your public profile. All fields are hidden by default." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-card", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "px-5 py-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { className: "h-4 w-4 text-primary" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm font-semibold text-foreground", children: "Public Profile Visibility" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Fields you enable below will be visible to any verified financier who views your profile." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
      loading ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        "div",
        {
          className: "space-y-4 p-5",
          "data-ocid": "privacy_settings.loading_state",
          children: [1, 2, 3].map((i) => /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-14 w-full" }, i))
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "divide-y divide-border", children: toggleRows.map((row) => {
        if (row.llcOnly && !isLLC) return null;
        const value = settings[row.field];
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "flex items-center justify-between gap-4 px-5 py-4",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: row.label }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: row.description })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex shrink-0 items-center gap-2", children: [
                value ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Eye,
                  {
                    className: "h-3.5 w-3.5 text-primary",
                    "aria-hidden": "true"
                  }
                ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
                  EyeOff,
                  {
                    className: "h-3.5 w-3.5 text-muted-foreground",
                    "aria-hidden": "true"
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Switch,
                  {
                    checked: value,
                    onCheckedChange: () => handleToggle(row.field),
                    "aria-label": `Toggle ${row.label}`,
                    "data-ocid": `privacy_settings.${row.field}_switch`
                  }
                )
              ] })
            ]
          },
          row.field
        );
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex justify-end px-5 py-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        Button,
        {
          type: "button",
          onClick: handleSave,
          disabled: saving || loading,
          "data-ocid": "privacy_settings.save_button",
          children: saving ? "Saving…" : "Save Settings"
        }
      ) })
    ] }),
    applicantId && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-border bg-card p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "h-4 w-4 text-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm font-semibold text-foreground", children: "Your Public Profile Link" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-xs text-muted-foreground", children: "Share this link with financiers to let them view your public profile." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "code",
          {
            className: "flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-foreground",
            "data-ocid": "privacy_settings.profile_url",
            children: profileUrl
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            onClick: handleCopy,
            className: "shrink-0 gap-1.5",
            "data-ocid": "privacy_settings.copy_link_button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Copy, { className: "h-3.5 w-3.5" }),
              copied ? "Copied!" : "Copy"
            ]
          }
        )
      ] })
    ] })
  ] });
}
export {
  PrivacySettingsPage as default
};
