import { j as jsxRuntimeExports, b as Button, ac as ChevronLeft, y as ChevronRight } from "./index-DiwSGmNR.js";
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false
}) {
  if (totalPages <= 1) return null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "flex items-center justify-between gap-4",
      "data-ocid": "pagination",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            variant: "outline",
            size: "sm",
            onClick: () => onPageChange(currentPage - 1),
            disabled: currentPage <= 1 || isLoading,
            className: "gap-1.5",
            "data-ocid": "pagination.prev_button",
            type: "button",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" }),
              "Previous"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "span",
          {
            className: "text-sm text-muted-foreground tabular-nums",
            "data-ocid": "pagination.page_indicator",
            children: [
              "Page ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: currentPage }),
              " ",
              "of ",
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium text-foreground", children: totalPages })
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            variant: "outline",
            size: "sm",
            onClick: () => onPageChange(currentPage + 1),
            disabled: currentPage >= totalPages || isLoading,
            className: "gap-1.5",
            "data-ocid": "pagination.next_button",
            type: "button",
            children: [
              "Next",
              /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" })
            ]
          }
        )
      ]
    }
  );
}
export {
  Pagination as P
};
