// ============================================================================
// Component Templates
// ============================================================================

export const layoutTemplate = `import { Link, Outlet, useLocation } from "react-router-dom";
import { Home, LayoutDashboard, Info } from "lucide-react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/about", label: "About", icon: Info },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-cream">
      <nav className="glass sticky top-0 z-50 border-b border-navy/10">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold font-serif text-navy">
              My App
            </Link>
            <div className="flex gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const isActive = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={\`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors \${
                      isActive
                        ? "bg-teal text-white"
                        : "text-navy/70 hover:text-navy hover:bg-navy/5"
                    }\`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
`;

export const vannaButtonTemplate = `import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface VannaButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-teal text-white hover:bg-teal/90 shadow-vanna",
  secondary: "bg-orange text-white hover:bg-orange/90",
  outline: "border-2 border-teal text-teal hover:bg-teal/10",
  ghost: "text-navy hover:bg-navy/10",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function VannaButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: VannaButtonProps) {
  return (
    <button
      className={\`inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal/50 disabled:opacity-50 disabled:cursor-not-allowed \${variantStyles[variant]} \${sizeStyles[size]} \${className}\`}
      {...props}
    >
      {children}
    </button>
  );
}
`;

export const vannaCardTemplate = `import type { ReactNode, ComponentType } from "react";

interface VannaCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  title?: string;
  icon?: ComponentType<{ className?: string }>;
}

export function VannaCard({ children, className = "", hover = false, title, icon: Icon }: VannaCardProps) {
  return (
    <div
      className={\`bg-white rounded-xl p-6 shadow-vanna \${
        hover ? "transition-shadow hover:shadow-vanna-lg" : ""
      } \${className}\`}
    >
      {(title || Icon) && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon className="w-5 h-5 text-teal" />}
          {title && <h3 className="font-semibold text-navy">{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
}
`;

export const statsCardTemplate = `import type { ComponentType } from "react";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  change?: number;
  icon?: ComponentType<{ className?: string }>;
  loading?: boolean;
}

export function StatsCard({ title, value, change, icon: Icon, loading }: StatsCardProps) {
  const isPositive = change !== undefined && change >= 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-vanna">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-navy/10 rounded animate-pulse" />
            <div className="h-8 w-28 bg-navy/10 rounded animate-pulse" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-teal" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-vanna">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-navy/60 font-medium">{title}</p>
          <p className="mt-2 text-3xl font-bold font-serif text-navy">{value}</p>
          {change !== undefined && (
            <div className={\`flex items-center gap-1 mt-2 text-sm font-medium \${isPositive ? "text-teal" : "text-magenta"}\`}>
              {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{isPositive ? "+" : ""}{change}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-3 bg-teal/10 rounded-lg text-teal">
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
`;
