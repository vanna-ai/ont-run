// ============================================================================
// Go Backend Templates
// ============================================================================

export const goModTemplate = `module {{PROJECT_NAME}}/backend

go 1.22

require github.com/vanna-ai/ont-run v0.1.0
`;

export const goMainTemplate = `package main

import (
	"log"
	"os"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
	"github.com/vanna-ai/ont-run/pkg/codegen/typescript"
	"github.com/vanna-ai/ont-run/pkg/server"
)

func main() {
	// Load ontology definition
	ontology := DefineOntology()

	// Validate configuration
	if err := ontology.Validate(); err != nil {
		log.Fatalf("Invalid ontology: %v", err)
	}

	// Development mode: auto-generate lock and SDK
	if os.Getenv("NODE_ENV") != "production" {
		log.Println("Generating ont.lock...")
		if err := ontology.WriteLock("../ont.lock"); err != nil {
			log.Fatalf("Failed to generate lock: %v", err)
		}

		log.Println("Generating TypeScript SDK...")
		if err := typescript.GenerateTypeScript(ontology, "../frontend/src/sdk"); err != nil {
			log.Fatalf("Failed to generate SDK: %v", err)
		}
	} else {
		// Production mode: verify lock
		log.Println("Verifying ont.lock...")
		if err := ontology.VerifyLock("../ont.lock"); err != nil {
			log.Fatalf("Ontology verification failed: %v", err)
		}
	}

	// Start server
	log.Println("Starting server on :8080...")
	if err := server.Serve(ontology, ":8080", server.WithLogger(ont.ConsoleLogger())); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
`;

export const goOntologyConfigTemplate = `package main

import (
	ont "github.com/vanna-ai/ont-run/pkg/ontology"
	"{{PROJECT_NAME}}/backend/resolvers"
)

func DefineOntology() *ont.Config {
	return &ont.Config{
		Name:  "{{PROJECT_NAME}}",
		UUID:  "{{UUID}}",  // Unique identifier for cloud registration
		Cloud: true,        // Enable cloud registration with ont-run.com

		AccessGroups: map[string]ont.AccessGroup{
			"public": {
				Description: "Unauthenticated users",
			},
			"support": {
				Description: "Support team with limited access",
			},
			"admin": {
				Description: "Administrators with full access",
			},
		},

		Entities: map[string]ont.Entity{
			"User": {
				Description: "A user account in the system",
			},
			"Sales": {
				Description: "Sales data and metrics",
			},
		},

		Functions: map[string]ont.Function{
			"healthCheck": {
				Description: "Check if the server is running",
				Access:      []string{"public"},
				Entities:    []string{},
				Inputs:      ont.Object(map[string]ont.Schema{}),
				Outputs: ont.Object(map[string]ont.Schema{
					"status":    ont.String(),
					"timestamp": ont.String().DateTime(),
				}),
				Resolver: resolvers.HealthCheck,
			},
			"getUser": {
				Description: "Get user by ID with row-level access control",
				Access:      []string{"support", "admin"},
				Entities:    []string{"User"},
				Inputs: ont.Object(map[string]ont.Schema{
					"id": ont.String().UUID(),
				}),
				Outputs: ont.Object(map[string]ont.Schema{
					"id":    ont.String(),
					"name":  ont.String(),
					"email": ont.String().Email(),
					"role":  ont.String(),
				}),
				Resolver: resolvers.GetUser,
			},
			"deleteUser": {
				Description: "Delete a user (admin only)",
				Access:      []string{"admin"},
				Entities:    []string{"User"},
				Inputs: ont.Object(map[string]ont.Schema{
					"id": ont.String().UUID(),
				}),
				Outputs: ont.Object(map[string]ont.Schema{
					"success": ont.Boolean(),
					"message": ont.String(),
				}),
				Resolver: resolvers.DeleteUser,
			},
			"getSalesData": {
				Description: "Get sales data for the dashboard",
				Access:      []string{"support", "admin"},
				Entities:    []string{"Sales"},
				Inputs: ont.Object(map[string]ont.Schema{
					"startDate": ont.String().Date(),
					"endDate":   ont.String().Date(),
				}).Optional("startDate", "endDate"),
				Outputs: ont.Object(map[string]ont.Schema{
					"data": ont.Array(ont.Object(map[string]ont.Schema{
						"date":    ont.String(),
						"revenue": ont.Number(),
						"orders":  ont.Integer(),
					})),
					"total": ont.Number(),
				}),
				Resolver: resolvers.GetSalesData,
			},
		},
	}
}
`;

export const goHealthCheckResolverTemplate = `package resolvers

import (
	"time"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

type HealthCheckOutput struct {
	Status    string \`json:"status"\`
	Timestamp string \`json:"timestamp"\`
}

func HealthCheck(ctx ont.Context, input any) (any, error) {
	ctx.Logger().Info("Health check requested")

	return HealthCheckOutput{
		Status:    "ok",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}, nil
}
`;

export const goGetUserResolverTemplate = `package resolvers

import (
	"fmt"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

type GetUserOutput struct {
	ID    string \`json:"id"\`
	Name  string \`json:"name"\`
	Email string \`json:"email"\`
	Role  string \`json:"role"\`
}

func GetUser(ctx ont.Context, input any) (any, error) {
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input type")
	}

	userID, _ := inputMap["id"].(string)
	ctx.Logger().Info("Getting user", "id", userID)

	// Example: In a real app, you'd fetch from a database
	// For demo purposes, we return a mock user
	return GetUserOutput{
		ID:    userID,
		Name:  "John Doe",
		Email: "john@example.com",
		Role:  "user",
	}, nil
}
`;

export const goDeleteUserResolverTemplate = `package resolvers

import (
	"fmt"

	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

type DeleteUserOutput struct {
	Success bool   \`json:"success"\`
	Message string \`json:"message"\`
}

func DeleteUser(ctx ont.Context, input any) (any, error) {
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input type")
	}

	userID, _ := inputMap["id"].(string)
	ctx.Logger().Info("Deleting user", "id", userID)

	// Example: In a real app, you'd delete from a database
	// For demo purposes, we simulate success
	return DeleteUserOutput{
		Success: true,
		Message: fmt.Sprintf("User %s has been deleted", userID),
	}, nil
}
`;

export const goGetSalesDataResolverTemplate = `package resolvers

import (
	ont "github.com/vanna-ai/ont-run/pkg/ontology"
)

type SalesDataPoint struct {
	Date    string  \`json:"date"\`
	Revenue float64 \`json:"revenue"\`
	Orders  int     \`json:"orders"\`
}

type GetSalesDataOutput struct {
	Data  []SalesDataPoint \`json:"data"\`
	Total float64          \`json:"total"\`
}

func GetSalesData(ctx ont.Context, input any) (any, error) {
	ctx.Logger().Info("Fetching sales data")

	// Example: In a real app, you'd fetch from a database
	// For demo purposes, we return mock data
	data := []SalesDataPoint{
		{Date: "2024-01-01", Revenue: 12500.00, Orders: 45},
		{Date: "2024-01-02", Revenue: 15800.00, Orders: 52},
		{Date: "2024-01-03", Revenue: 9200.00, Orders: 38},
		{Date: "2024-01-04", Revenue: 18900.00, Orders: 61},
		{Date: "2024-01-05", Revenue: 14300.00, Orders: 49},
		{Date: "2024-01-06", Revenue: 21500.00, Orders: 72},
		{Date: "2024-01-07", Revenue: 16700.00, Orders: 55},
	}

	var total float64
	for _, d := range data {
		total += d.Revenue
	}

	return GetSalesDataOutput{
		Data:  data,
		Total: total,
	}, nil
}
`;

export const airTomlTemplate = `root = "."
tmp_dir = "tmp"

[build]
  cmd = "go build -o ./tmp/main ."
  bin = "tmp/main"
  include_ext = ["go"]
  exclude_dir = ["tmp", "vendor"]
  delay = 1000

[log]
  time = true

[color]
  main = "magenta"
  watcher = "cyan"
  build = "yellow"
  runner = "green"
`;

export const goRootPackageJsonTemplate = (projectName: string) => ({
  name: projectName,
  private: true,
  workspaces: ["frontend"],
  scripts: {
    "postinstall": "cd backend && go mod download",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && go run .",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "cd backend && go build -o ../dist/server",
    "build:frontend": "cd frontend && npm run build",
    "test": "cd backend && go test ./...",
  },
  devDependencies: {
    "concurrently": "^9.0.0",
  },
});

export const goFrontendPackageJsonTemplate = (projectName: string) => ({
  name: "frontend",
  private: true,
  type: "module",
  scripts: {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
  },
  dependencies: {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "lucide-react": "^0.511.0",
    "recharts": "^2.15.3",
  },
  devDependencies: {
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.1.0",
    "@tailwindcss/vite": "^4.1.11",
    "tailwindcss": "^4.1.11",
    "typescript": "^5.5.0",
    "vite": "^7.3.0",
  },
});

export const goGitignoreTemplate = `# Dependencies
node_modules/

# Build outputs
dist/
frontend/dist/
backend/tmp/

# Generated files
ont.lock
frontend/src/sdk/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Go
backend/tmp/
*.exe
*.exe~
*.dll
*.so
*.dylib
`;

export const goReadmeTemplate = `# {{PROJECT_NAME}}

A full-stack ontology-first application with a Go backend and React frontend.

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development servers (backend + frontend)
npm run dev
\`\`\`

The frontend will be available at http://localhost:5173
The API will be available at http://localhost:8080

## Project Structure

\`\`\`
{{PROJECT_NAME}}/
├── backend/                 # Go backend
│   ├── main.go             # Server entry point
│   ├── ontology.config.go  # Ontology definition
│   └── resolvers/          # Function resolvers
│       ├── health_check.go
│       ├── get_user.go
│       ├── delete_user.go
│       └── get_sales_data.go
├── frontend/               # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── routes/
│   │   ├── components/
│   │   └── sdk/           # Auto-generated TypeScript SDK
│   └── package.json
├── ont.lock               # Auto-generated lock file
└── package.json           # Monorepo root
\`\`\`

## Development Workflow

1. Edit \`backend/ontology.config.go\` to define your API
2. The Go server auto-generates:
   - \`ont.lock\` - Lock file for change tracking
   - \`frontend/src/sdk/\` - TypeScript SDK with full type safety
3. Use the SDK in your React components for type-safe API calls

## Scripts

- \`npm run dev\` - Start both backend and frontend in development mode
- \`npm run build\` - Build for production
- \`npm run test\` - Run Go tests

## API Access Control

This project uses ontology-based access control:

- **public** - Unauthenticated users
- **support** - Support team with limited access
- **admin** - Administrators with full access

Configure access groups in \`backend/ontology.config.go\`.

## Cloud Integration

This project integrates with [ont-run.com](https://ont-run.com) for AI agent access control.

### What Gets Sent to ont-run.com

When cloud registration is enabled, the following is sent:

- Function names and descriptions
- Access groups and their descriptions
- Entities and their descriptions
- Input/output schemas (as JSON Schema)

### What is NOT Sent

The following stays local and is never sent to the cloud:

- Resolver code (your business logic)
- Environment variables and configs
- Auth functions and secrets
- Actual data processed by your API

### Configuration

Cloud registration is controlled by two fields in \`backend/ontology.config.go\`:

\`\`\`go
UUID:  "your-project-uuid",  // Unique identifier
Cloud: true,                  // Enable/disable cloud registration
\`\`\`

To authenticate with ont-run.com, set the \`ONT_API_KEY\` environment variable:

\`\`\`bash
export ONT_API_KEY=your-api-key
\`\`\`

Get your API key by running \`npx ont-run login\`.
`;

export const goViteConfigTemplate = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
`;

export const goTsconfigTemplate = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`;

export const goIndexHtmlTemplate = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PROJECT_NAME}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

export const goMainTsxTemplate = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
`;

export const goIndexCssTemplate = `@import "tailwindcss";
`;

export const goSkillTemplate = `# Ont-run Skill

This project uses ont-run, an ontology-first API framework.

## Key Files

- \`backend/ontology.config.go\` - Defines the API ontology (functions, access groups, entities)
- \`backend/resolvers/\` - Go resolver functions for each API endpoint
- \`frontend/src/sdk/\` - Auto-generated TypeScript SDK (do not edit manually)
- \`ont.lock\` - Ontology lock file for change tracking

## Adding a New Function

1. Add the function definition in \`backend/ontology.config.go\`
2. Create a resolver in \`backend/resolvers/\`
3. Restart the Go server to regenerate the SDK
4. Use the new function in the frontend via the SDK

## Access Control

Functions are protected by access groups defined in the ontology.
The \`Access\` field specifies which groups can call each function.

## Cloud Integration

This project can integrate with [ont-run.com](https://ont-run.com) for AI agent access control.

### What Gets Sent to ont-run.com

- Function names and descriptions
- Access groups and their descriptions
- Entities and their descriptions
- Input/output schemas (as JSON Schema)

### What is NOT Sent

- Resolver code (your business logic)
- Environment variables and configs
- Auth functions and secrets
- Actual data processed by your API

### Configuration

Cloud registration is controlled in \`backend/ontology.config.go\`:

\`\`\`go
UUID:  "your-project-uuid",  // Unique identifier
Cloud: true,                  // Enable/disable cloud registration
\`\`\`

Set \`ONT_API_KEY\` environment variable to authenticate with ont-run.com.
`;

// Go-specific route templates that use the generated SDK

export const goHomeRouteTemplate = `import { useState, useEffect } from "react";
import { Loader2, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { VannaCard } from "../components/VannaCard";
import { VannaButton } from "../components/VannaButton";
import { OntologyClient, type HealthCheckOutput } from "../sdk";

const client = new OntologyClient("http://localhost:8080");

export function Home() {
  const [health, setHealth] = useState<HealthCheckOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.healthCheck({})
      .then((data) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold font-serif text-navy">Welcome to ont-run</h1>
        <p className="mt-4 text-lg text-navy/70">
          Your Go backend is ready. Edit <code className="px-2 py-1 bg-teal/10 rounded font-mono text-sm">backend/ontology.config.go</code> to define your API.
        </p>
      </div>

      <VannaCard title="Backend Status" className="max-w-md">
        <div className="flex items-center gap-3">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-teal" />
              <span className="text-navy/70">Checking backend...</span>
            </>
          ) : error ? (
            <>
              <XCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-600">Backend not responding</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-700">Backend is healthy</span>
              <span className="text-navy/50 text-sm">({health?.timestamp})</span>
            </>
          )}
        </div>
      </VannaCard>

      <div className="flex gap-4">
        <Link to="/dashboard">
          <VannaButton>
            View Dashboard <ChevronRight className="w-4 h-4 ml-1" />
          </VannaButton>
        </Link>
      </div>
    </div>
  );
}
`;

export const goDashboardRouteTemplate = `import { useState, useEffect } from "react";
import { Activity, Users, Zap, Clock, BarChart3, Bot, Loader2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { StatsCard } from "../components/StatsCard";
import { VannaCard } from "../components/VannaCard";
import { VannaButton } from "../components/VannaButton";
import { OntologyClient, type GetSalesDataOutput } from "../sdk";

const client = new OntologyClient("http://localhost:8080");

interface ChartDataPoint {
  month: string;
  sales: number;
  orders: number;
}

export function Dashboard() {
  const [salesData, setSalesData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.getSalesData({})
      .then((data: GetSalesDataOutput) => {
        // Transform the data to match chart format
        const chartData = data.data.map((d) => ({
          month: d.date,
          sales: d.revenue,
          orders: d.orders,
        }));
        setSalesData(chartData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Calculate stats from sales data
  const totalSales = salesData.reduce((sum, d) => sum + d.sales, 0);
  const totalOrders = salesData.reduce((sum, d) => sum + d.orders, 0);
  const avgSales = salesData.length > 0 ? Math.round(totalSales / salesData.length) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-serif text-navy">Dashboard</h1>
        <p className="mt-2 text-navy/60">Sales data fetched from your Ontology API via the generated SDK.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Revenue"
          value={\`$\${totalSales.toLocaleString()}\`}
          icon={Activity}
          change={12}
          loading={loading}
        />
        <StatsCard
          title="Total Orders"
          value={totalOrders.toString()}
          icon={Users}
          change={8}
          loading={loading}
        />
        <StatsCard
          title="Avg Revenue"
          value={\`$\${avgSales.toLocaleString()}\`}
          icon={Zap}
          change={-3}
          loading={loading}
        />
        <StatsCard
          title="Data Points"
          value={salesData.length.toString()}
          icon={Clock}
          loading={loading}
        />
      </div>

      {error && (
        <VannaCard title="Error" className="border-red-200 bg-red-50">
          <p className="text-red-600">{error}</p>
          <p className="text-sm text-red-500 mt-2">Make sure the Go backend is running on port 8080.</p>
        </VannaCard>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VannaCard title="Revenue Trend" icon={BarChart3}>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#15a8a8"
                  fill="#15a8a8"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </VannaCard>

        <VannaCard title="Orders by Period" icon={Bot}>
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-teal" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="orders" fill="#1a2f4a" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </VannaCard>
      </div>
    </div>
  );
}
`;
