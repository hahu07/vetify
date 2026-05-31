import { NotificationPanel } from "@/components/NotificationPanel";
import { SessionTimeoutModal } from "@/components/SessionTimeoutModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { useIsSuperAdmin } from "@/hooks/use-is-super-admin";
import { cn } from "@/lib/utils";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Scale,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

interface TawthiqSubItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const tawthiqSubItems: TawthiqSubItem[] = [
  { label: "Overview", href: "/admin/tawthiq/overview", icon: ShieldCheck },
  {
    label: "Pending Reviews",
    href: "/admin/tawthiq/pending",
    icon: FileSearch,
  },
  {
    label: "Assessments",
    href: "/admin/tawthiq/assessments",
    icon: ClipboardList,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tawthiqOpen, setTawthiqOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin/tawthiq"),
  );
  const { logout } = useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const { isSuperAdmin } = useIsSuperAdmin();
  const router = useRouter();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    router.navigate({ to: "/" });
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed && !mobile ? "justify-center px-2" : "gap-2.5",
        )}
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 group"
          data-ocid="admin_sidebar.brand_link"
          onClick={() => setMobileOpen(false)}
        >
          <img
            src="/assets/generated/halalvet-logo-transparent.dim_80x80.png"
            alt="Vetify"
            className="h-8 w-8 shrink-0 object-contain"
          />
          {(!collapsed || mobile) && (
            <span className="font-display text-xl font-bold tracking-tight text-primary group-hover:text-primary/80 transition-colors">
              Vetify
            </span>
          )}
        </Link>
      </div>

      {/* Role chip */}
      {(!collapsed || mobile) && (
        <div className="mx-3 mt-3 rounded-md bg-primary/10 px-3 py-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {isSuperAdmin ? "Super Admin" : "Admin"}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-4"
        aria-label="Admin navigation"
      >
        {/* Top nav items */}
        {(
          [
            {
              label: "Dashboard",
              href: "/admin/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Business Applicants",
              href: "/admin/applicants",
              icon: Users,
            },
            { label: "Financiers", href: "/admin/financiers", icon: Shield },
          ] as const
        ).map((item) => {
          const active = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
                collapsed && !mobile ? "justify-center px-2" : "",
                active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              data-ocid={`admin_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || mobile) && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Tawthiq collapsible section */}
        {(!collapsed || mobile) && (
          <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Tawthiq (التوثيق)
          </p>
        )}
        <button
          type="button"
          onClick={() => setTawthiqOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
            collapsed && !mobile ? "justify-center px-2" : "justify-between",
            location.pathname.startsWith("/admin/tawthiq")
              ? "text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          data-ocid="admin_sidebar.tawthiq_section_toggle"
          title={collapsed && !mobile ? "Tawthiq" : undefined}
          aria-expanded={tawthiqOpen}
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {(!collapsed || mobile) && <span>Tawthiq</span>}
          </div>
          {(!collapsed || mobile) && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                tawthiqOpen && "rotate-180",
              )}
            />
          )}
        </button>
        {tawthiqOpen && (!collapsed || mobile) && (
          <div className="ml-2 border-l border-sidebar-border pl-2 space-y-0.5 mb-1">
            {tawthiqSubItems.map((sub) => {
              const subActive = location.pathname === sub.href;
              const SubIcon = sub.icon;
              return (
                <Link
                  key={sub.href}
                  to={sub.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    subActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  data-ocid={`admin_sidebar.tawthiq_${sub.label.toLowerCase().replace(/\s/g, "_")}_link`}
                >
                  <SubIcon className="h-3.5 w-3.5 shrink-0" />
                  {sub.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Agents section label */}
        {(!collapsed || mobile) && (
          <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Kashif (الكاشف)
          </p>
        )}
        {(
          [
            { label: "Mizan Review", href: "/admin/mizan", icon: Scale },
            { label: "Kashif Reports", href: "/admin/kashif", icon: Search },
          ] as const
        ).map((item) => {
          const active = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
                collapsed && !mobile ? "justify-center px-2" : "",
                active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              data-ocid={`admin_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || mobile) && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Bottom items */}
        {(
          [
            { label: "Audit Trail", href: "/admin/audit", icon: ClipboardList },
            { label: "Settings", href: "/admin/settings", icon: Settings },
          ] as const
        ).map((item) => {
          const active = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mb-0.5 mt-0.5",
                collapsed && !mobile ? "justify-center px-2" : "",
                active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              data-ocid={`admin_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || mobile) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {!mobile && (
        <div className="border-t border-sidebar-border p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "w-full gap-2 text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-2" : "justify-start",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            data-ocid="admin_sidebar.collapse_toggle"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <SessionTimeoutModal prefix="admin" />
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-64",
        )}
        data-ocid="admin_sidebar.panel"
      >
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 flex md:hidden m-0 p-0 max-w-none max-h-none w-full h-full border-none bg-transparent"
          aria-label="Navigation sidebar"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
          />
          <aside className="relative flex w-72 flex-col bg-sidebar shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent mobile />
          </aside>
        </dialog>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="hidden text-sm font-medium text-muted-foreground sm:block">
              Admin Console
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationPanel prefix="admin" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="text-muted-foreground hover:text-foreground"
              data-ocid="admin_topbar.dark_mode_toggle"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  data-ocid="admin_topbar.account_dropdown"
                >
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  Account
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-ocid="admin_topbar.logout_button"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
