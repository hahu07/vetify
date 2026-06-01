import { createActor } from "@/backend";
import { NotificationPanel } from "@/components/NotificationPanel";
import { SessionTimeoutModal } from "@/components/SessionTimeoutModal";
import { Badge } from "@/components/ui/badge";
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
import { useUserRole } from "@/hooks/use-user-role";
import { cn } from "@/lib/utils";
import { useActor } from "@caffeineai/core-infrastructure";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import {
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Shield,
  Sun,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { label: "Overview", href: "/individual/dashboard", icon: LayoutDashboard },
  { label: "KYC Status", href: "/individual/kyc", icon: Shield },
  {
    label: "Tawthiq Assessment",
    href: "/individual/scores",
    icon: BrainCircuit,
  },
  { label: "Bank Linking", href: "/individual/bank", icon: CreditCard },
  { label: "My Profile", href: "/individual/profile", icon: User },
  { label: "Messages", href: "/messages", icon: MessageCircle },
];

interface IndividualLayoutProps {
  children: React.ReactNode;
}

export function IndividualLayout({ children }: IndividualLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { logout } = useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const { profile } = useUserRole();
  const router = useRouter();
  const location = useLocation();
  const { actor, isFetching } = useActor(createActor);

  useEffect(() => {
    if (!actor || isFetching) return;
    const fetchUnread = () => {
      actor
        .get_unread_count()
        .then((n) => setUnreadCount(Number(n)))
        .catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 10_000);
    return () => clearInterval(id);
  }, [actor, isFetching]);

  const fullName =
    profile && "fullName" in profile
      ? (profile.fullName as string)
      : "Individual";

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
          data-ocid="individual_sidebar.brand_link"
          onClick={() => setMobileOpen(false)}
        >
          <img
            src="/assets/generated/halalvet-logo-transparent.dim_80x80.png"
            alt="Vetify"
            className="h-8 w-8 shrink-0 object-contain"
          />
          {(!collapsed || mobile) && (
            <span className="font-display text-xl font-bold tracking-tight text-[var(--individual-accent,oklch(0.65_0.18_60))] group-hover:opacity-80 transition-opacity">
              Vetify
            </span>
          )}
        </Link>
      </div>

      {/* User chip */}
      {(!collapsed || mobile) && (
        <div className="mx-3 mt-3 rounded-md bg-[var(--individual-accent,oklch(0.75_0.16_60))]/10 px-3 py-1.5">
          <p className="truncate text-xs font-semibold text-[var(--individual-accent,oklch(0.65_0.18_60))]">
            {fullName}
          </p>
          <p className="text-xs text-muted-foreground">Individual Applicant</p>
        </div>
      )}

      {/* Nav */}
      <nav
        className="flex-1 space-y-1 overflow-y-auto px-2 py-4"
        aria-label="Individual navigation"
      >
        {navItems.map((item) => {
          const active = location.pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && !mobile ? "justify-center px-2" : "",
                active
                  ? "bg-[var(--individual-accent,oklch(0.65_0.18_60))] text-white shadow-xs"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              data-ocid={`individual_sidebar.${item.label.toLowerCase().replace(/\s/g, "_")}_link`}
              title={collapsed && !mobile ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || mobile) && (
                <span className="flex-1">{item.label}</span>
              )}
              {(!collapsed || mobile) &&
                item.label === "Messages" &&
                unreadCount > 0 && (
                  <Badge className="ml-auto h-4 min-w-4 rounded-full px-1 text-[9px] leading-none">
                    {unreadCount}
                  </Badge>
                )}
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
            data-ocid="individual_sidebar.collapse_toggle"
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
      <SessionTimeoutModal prefix="individual" />
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-20" : "w-64",
        )}
        data-ocid="individual_sidebar.panel"
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
              data-ocid="individual_topbar.mobile_menu_button"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="hidden text-sm font-medium text-muted-foreground sm:block">
              Individual Portal
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NotificationPanel prefix="individual" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="text-muted-foreground hover:text-foreground"
              data-ocid="individual_topbar.dark_mode_toggle"
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
                  className="gap-1.5 border-[var(--individual-accent,oklch(0.75_0.16_60))]/40 hover:border-[var(--individual-accent,oklch(0.75_0.16_60))]"
                  data-ocid="individual_topbar.account_dropdown"
                >
                  <User className="h-3.5 w-3.5 text-[var(--individual-accent,oklch(0.65_0.18_60))]" />
                  Account
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive focus:text-destructive"
                  data-ocid="individual_topbar.logout_button"
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
