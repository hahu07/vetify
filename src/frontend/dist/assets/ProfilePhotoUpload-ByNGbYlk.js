import { v as createLucideIcon, g as useBackend, r as reactExports, j as jsxRuntimeExports, ah as LoaderCircle, z as cn, l as ue, aK as ExternalBlob } from "./index-DiwSGmNR.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  [
    "path",
    {
      d: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",
      key: "1tc9qg"
    }
  ],
  ["circle", { cx: "12", cy: "13", r: "3", key: "1vg3eu" }]
];
const Camera = createLucideIcon("camera", __iconNode);
const sizeClasses = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-lg",
  lg: "h-24 w-24 text-2xl"
};
const iconSizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10"
};
const editButtonSizes = {
  sm: "h-5 w-5 -bottom-0.5 -right-0.5",
  md: "h-6 w-6 -bottom-1 -right-1",
  lg: "h-8 w-8 -bottom-1.5 -right-1.5"
};
const editIconSizes = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-4 w-4"
};
function getInitials(name) {
  return name.split(" ").map((n) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function ProfilePhotoUpload({
  userId: _userId,
  displayName,
  currentPhotoUrl,
  size = "md",
  onPhotoUpdated
}) {
  const { actor } = useBackend();
  const [uploading, setUploading] = reactExports.useState(false);
  const [photoUrl, setPhotoUrl] = reactExports.useState(currentPhotoUrl ?? null);
  const inputRef = reactExports.useRef(null);
  const handleFile = async (file) => {
    var _a;
    if (!actor) {
      ue.error("Backend not connected. Please try again.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      ue.error("Please select an image file.");
      return;
    }
    setUploading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const blob = ExternalBlob.fromBytes(bytes);
      const doc = await actor.uploadDocument(
        "governmentId",
        blob
      );
      const url = (_a = doc.storageRef) == null ? void 0 : _a.getDirectURL();
      if (!url) {
        throw new Error("Upload succeeded but no URL returned.");
      }
      const result = await actor.setProfilePhoto(url);
      if ("__kind__" in result && result.__kind__ === "err") {
        throw new Error(result.err);
      }
      setPhotoUrl(url);
      onPhotoUpdated == null ? void 0 : onPhotoUpdated(url);
      ue.success("Profile photo updated successfully.");
    } catch (err) {
      ue.error(
        err instanceof Error ? err.message : "Failed to upload photo."
      );
    } finally {
      setUploading(false);
    }
  };
  const handleChange = (e) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "relative inline-block",
      "data-ocid": "profile_photo.upload_zone",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: cn(
              "avatar-upload-zone relative flex items-center justify-center rounded-full overflow-hidden bg-muted border-2 border-border transition-smooth",
              sizeClasses[size],
              uploading && "opacity-60"
            ),
            children: [
              photoUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                "img",
                {
                  src: photoUrl,
                  alt: `${displayName} profile`,
                  className: "h-full w-full object-cover"
                }
              ) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-display font-semibold text-muted-foreground select-none", children: getInitials(displayName) }),
              uploading && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-background/60", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                LoaderCircle,
                {
                  className: cn("animate-spin text-primary", iconSizes[size])
                }
              ) })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            onClick: () => {
              var _a;
              return !uploading && ((_a = inputRef.current) == null ? void 0 : _a.click());
            },
            disabled: uploading,
            className: cn(
              "absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-smooth border-2 border-background",
              editButtonSizes[size]
            ),
            "aria-label": "Change profile photo",
            "data-ocid": "profile_photo.edit_button",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Camera, { className: editIconSizes[size] })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            ref: inputRef,
            type: "file",
            accept: "image/*",
            className: "sr-only",
            onChange: handleChange,
            "data-ocid": "profile_photo.file_input"
          }
        )
      ]
    }
  );
}
export {
  ProfilePhotoUpload as P
};
