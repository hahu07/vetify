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
import { cn } from "@/lib/utils";
import { Link, useRouter } from "@tanstack/react-router";
import { ChevronDown, LogOut, Menu, Moon, Shield, Sun, X } from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, login, logout, isInitializing, isLoggingIn } =
    useAuth();
  const { isDark, toggleDark } = useDarkMode();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.navigate({ to: "/" });
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card shadow-xs">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            data-ocid="nav.brand_link"
          >
            <img
              src="/assets/generated/halalvet-logo-transparent.dim_80x80.png"
              alt="Vetify"
              className="h-8 w-8 object-contain"
            />
            <span className="font-display text-xl font-bold tracking-tight text-primary group-hover:text-primary/80 transition-colors">
              Vetify
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              aria-label="Toggle dark mode"
              className="text-muted-foreground hover:text-foreground"
              data-ocid="nav.dark_mode_toggle"
              type="button"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden gap-1.5 md:flex"
                    data-ocid="nav.account_dropdown"
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
                    data-ocid="nav.logout_button"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                onClick={login}
                disabled={isInitializing || isLoggingIn}
                className="hidden md:flex"
                data-ocid="nav.login_button"
              >
                {isInitializing
                  ? "Loading…"
                  : isLoggingIn
                    ? "Connecting…"
                    : "Sign In"}
              </Button>
            )}

            {/* Mobile Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              data-ocid="nav.mobile_menu_button"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="border-t border-border bg-card px-4 pb-4 pt-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-destructive"
                  onClick={handleLogout}
                  data-ocid="nav.mobile.logout_button"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    login();
                    setMobileOpen(false);
                  }}
                  disabled={isInitializing || isLoggingIn}
                  data-ocid="nav.mobile.login_button"
                >
                  Sign In
                </Button>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-center text-sm text-muted-foreground md:flex-row md:text-left">
          <div className="flex items-center gap-2">
            <img
              src="/assets/generated/halalvet-logo-transparent.dim_80x80.png"
              alt="Vetify"
              className="h-5 w-5 object-contain opacity-70"
            />
            <span className="font-medium text-foreground">Vetify</span>
            <span className="text-border">·</span>
            <span>Trusted Ethical Finance Vetting</span>
          </div>
          <p>
            &copy; {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
