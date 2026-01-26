// ============================================================================
// Gitignore Template
// ============================================================================

export const gitignoreTemplate = `# Dependencies
node_modules/

# Environment variables
.env
.env.*
!.env.example

# Build output
dist/

# Logs
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Bun
bun.lockb

# TypeScript
*.tsbuildinfo
`;
