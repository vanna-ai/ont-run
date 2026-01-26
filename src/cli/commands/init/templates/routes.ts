// ============================================================================
// Route Templates
// ============================================================================

export const homeRouteTemplate = `import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Zap, Shield, Code, ArrowRight, Activity, Bot, Key } from "lucide-react";
import { VannaButton } from "../components/VannaButton";
import { VannaCard } from "../components/VannaCard";

interface HealthStatus {
  status: string;
  env: string;
  timestamp: string;
}

const features = [
  {
    icon: Bot,
    title: "Built-in MCP Server",
    description: "AI-ready API with Model Context Protocol. Connect Claude or any MCP client instantly.",
  },
  {
    icon: Key,
    title: "Bring Your Own Auth",
    description: "Plug in any auth system - JWTs, API keys, sessions. You control authentication.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Built on Bun for incredible performance and instant hot reloading.",
  },
  {
    icon: Shield,
    title: "Type Safe",
    description: "Full TypeScript support with Zod schema validation.",
  },
  {
    icon: Code,
    title: "Modern Stack",
    description: "React 19, React Router 7, and Tailwind CSS 4.",
  },
];

export function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/health")
      .then(res => res.json())
      .then(setHealth)
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-5xl font-bold font-serif text-navy">
          Welcome to <span className="text-teal">Ontology</span>
        </h1>
        <p className="mt-4 text-xl text-navy/70 max-w-2xl mx-auto">
          Your full-stack Bun + React application is ready. Start building something amazing.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link to="/dashboard">
            <VannaButton variant="primary" size="lg">
              View Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </VannaButton>
          </Link>
          <a href="/api" target="_blank" rel="noopener noreferrer">
            <VannaButton variant="outline" size="lg">
              Explore API
            </VannaButton>
          </a>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, description }) => (
          <VannaCard key={title} hover>
            <div className="p-3 bg-teal/10 rounded-lg w-fit text-teal">
              <Icon className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-lg font-semibold font-serif text-navy">{title}</h3>
            <p className="mt-2 text-navy/60">{description}</p>
          </VannaCard>
        ))}
      </div>

      {/* API Status */}
      <VannaCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-teal/10 rounded-lg text-teal">
            <Activity className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold font-serif text-navy">API Status</h2>
        </div>
        {health ? (
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-navy/50">Status</span>
              <p className="font-medium text-teal">{health.status}</p>
            </div>
            <div>
              <span className="text-navy/50">Environment</span>
              <p className="font-medium text-navy">{health.env}</p>
            </div>
            <div>
              <span className="text-navy/50">Timestamp</span>
              <p className="font-medium text-navy font-mono text-xs">{health.timestamp}</p>
            </div>
          </div>
        ) : (
          <p className="text-navy/50">Loading...</p>
        )}
      </VannaCard>
    </div>
  );
}
`;

export const dashboardRouteTemplate = `import { Activity, Users, Zap, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { StatsCard } from "../components/StatsCard";
import { VannaCard } from "../components/VannaCard";
import { VannaButton } from "../components/VannaButton";

const weeklyData = [
  { day: "Mon", requests: 2400 },
  { day: "Tue", requests: 1398 },
  { day: "Wed", requests: 9800 },
  { day: "Thu", requests: 3908 },
  { day: "Fri", requests: 4800 },
  { day: "Sat", requests: 3800 },
  { day: "Sun", requests: 4300 },
];

export function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif text-navy">Dashboard</h1>
        <p className="mt-2 text-navy/60">Monitor your API performance and usage.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Requests"
          value="28,406"
          change={12.5}
          icon={<Activity className="w-5 h-5" />}
        />
        <StatsCard
          title="Active Users"
          value="1,234"
          change={8.2}
          icon={<Users className="w-5 h-5" />}
        />
        <StatsCard
          title="Avg Response"
          value="45ms"
          change={-5.1}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatsCard
          title="Uptime"
          value="99.9%"
          icon={<Clock className="w-5 h-5" />}
        />
      </div>

      {/* Chart */}
      <VannaCard>
        <h2 className="text-lg font-semibold font-serif text-navy mb-6">Weekly Requests</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#15a8a8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#15a8a8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#023d6020" />
              <XAxis dataKey="day" stroke="#023d6060" fontSize={12} />
              <YAxis stroke="#023d6060" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "none",
                  borderRadius: "8px",
                  boxShadow: "0 4px 14px 0 rgba(21, 168, 168, 0.15)",
                }}
              />
              <Area
                type="monotone"
                dataKey="requests"
                stroke="#15a8a8"
                strokeWidth={2}
                fill="url(#colorRequests)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </VannaCard>

      {/* Button Gallery */}
      <VannaCard>
        <h2 className="text-lg font-semibold font-serif text-navy mb-6">Component Gallery</h2>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-navy/50 mb-3">Button Variants</p>
            <div className="flex flex-wrap gap-3">
              <VannaButton variant="primary">Primary</VannaButton>
              <VannaButton variant="secondary">Secondary</VannaButton>
              <VannaButton variant="outline">Outline</VannaButton>
              <VannaButton variant="ghost">Ghost</VannaButton>
            </div>
          </div>
          <div>
            <p className="text-sm text-navy/50 mb-3">Button Sizes</p>
            <div className="flex flex-wrap items-center gap-3">
              <VannaButton size="sm">Small</VannaButton>
              <VannaButton size="md">Medium</VannaButton>
              <VannaButton size="lg">Large</VannaButton>
            </div>
          </div>
        </div>
      </VannaCard>
    </div>
  );
}
`;

export const aboutRouteTemplate = `import { VannaCard } from "../components/VannaCard";
import { Bot, Key, ExternalLink } from "lucide-react";

const stack = [
  { name: "Runtime", value: "Bun" },
  { name: "Frontend", value: "React 19 + React Router 7" },
  { name: "Styling", value: "Tailwind CSS 4" },
  { name: "API", value: "Ontology (ont-run)" },
  { name: "Icons", value: "Lucide React" },
  { name: "Charts", value: "Recharts" },
];

const designTokens = [
  { name: "Navy", value: "#023d60", className: "bg-navy" },
  { name: "Cream", value: "#e7e1cf", className: "bg-cream border border-navy/20" },
  { name: "Teal", value: "#15a8a8", className: "bg-teal" },
  { name: "Orange", value: "#fe5d26", className: "bg-orange" },
  { name: "Magenta", value: "#bf1363", className: "bg-magenta" },
];

export function About() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif text-navy">About</h1>
        <p className="mt-2 text-navy/60">
          Learn about the stack and design system powering this application.
        </p>
      </div>

      {/* Stack */}
      <VannaCard>
        <h2 className="text-lg font-semibold font-serif text-navy mb-4">Tech Stack</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {stack.map(({ name, value }) => (
            <div key={name} className="flex justify-between py-2 border-b border-navy/10 last:border-0">
              <span className="text-navy/60">{name}</span>
              <span className="font-medium text-navy">{value}</span>
            </div>
          ))}
        </div>
      </VannaCard>

      {/* MCP Server */}
      <VannaCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-teal/10 rounded-lg text-teal">
            <Bot className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold font-serif text-navy">Built-in MCP Server</h2>
        </div>
        <p className="text-navy/60 mb-4">
          Your API is automatically exposed as a Model Context Protocol (MCP) server.
          Connect AI assistants like Claude Desktop directly to your API functions.
        </p>
        <div className="bg-navy/5 rounded-lg p-4 font-mono text-sm">
          <p className="text-navy/50 mb-2"># Add to Claude Desktop config:</p>
          <p className="text-navy">"my-api": {"{"}</p>
          <p className="text-navy pl-4">"command": "bunx",</p>
          <p className="text-navy pl-4">"args": ["ont-run", "mcp"]</p>
          <p className="text-navy">{"}"}</p>
        </div>
        <a
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-4 text-teal hover:underline text-sm"
        >
          Learn more about MCP <ExternalLink className="w-3 h-3" />
        </a>
      </VannaCard>

      {/* Authentication */}
      <VannaCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange/10 rounded-lg text-orange">
            <Key className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold font-serif text-navy">Bring Your Own Auth</h2>
        </div>
        <p className="text-navy/60 mb-4">
          Ontology doesn't impose an auth system. Customize the <code className="bg-navy/5 px-1.5 py-0.5 rounded text-sm">auth</code> function
          in <code className="bg-navy/5 px-1.5 py-0.5 rounded text-sm">ontology.config.ts</code> to integrate any authentication method.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="bg-navy/5 rounded-lg p-3">
            <p className="font-medium text-navy">JWTs</p>
            <p className="text-navy/50">Verify tokens from Auth0, Clerk, etc.</p>
          </div>
          <div className="bg-navy/5 rounded-lg p-3">
            <p className="font-medium text-navy">API Keys</p>
            <p className="text-navy/50">Simple key-based access control</p>
          </div>
          <div className="bg-navy/5 rounded-lg p-3">
            <p className="font-medium text-navy">Sessions</p>
            <p className="text-navy/50">Cookie-based session auth</p>
          </div>
        </div>
      </VannaCard>

      {/* Design Tokens */}
      <VannaCard>
        <h2 className="text-lg font-semibold font-serif text-navy mb-4">Vanna Design System</h2>
        <p className="text-navy/60 mb-6">
          A cohesive color palette designed for clarity and visual harmony.
        </p>
        <div className="grid sm:grid-cols-5 gap-4">
          {designTokens.map(({ name, value, className }) => (
            <div key={name} className="text-center">
              <div className={\`w-full h-20 rounded-lg \${className}\`} />
              <p className="mt-2 font-medium text-navy">{name}</p>
              <p className="text-sm text-navy/50 font-mono">{value}</p>
            </div>
          ))}
        </div>
      </VannaCard>

      {/* Typography */}
      <VannaCard>
        <h2 className="text-lg font-semibold font-serif text-navy mb-4">Typography</h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-navy/50 mb-1">Serif (Headlines)</p>
            <p className="text-2xl font-serif text-navy">Roboto Slab - The quick brown fox</p>
          </div>
          <div>
            <p className="text-sm text-navy/50 mb-1">Sans (Body)</p>
            <p className="text-lg font-sans text-navy">Space Grotesk - The quick brown fox</p>
          </div>
          <div>
            <p className="text-sm text-navy/50 mb-1">Mono (Code)</p>
            <p className="text-lg font-mono text-navy">Space Mono - The quick brown fox</p>
          </div>
        </div>
      </VannaCard>
    </div>
  );
}
`;
