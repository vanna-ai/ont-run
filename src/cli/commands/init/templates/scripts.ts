/**
 * SDK Generation Script Template
 * 
 * This script shows how to generate a TypeScript SDK from your ontology configuration.
 */

export const generateSdkScriptTemplate = `import { generateSdk } from 'ont-run';
import config from '../ontology.config.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Generate SDK with all features
const sdkCode = generateSdk({
  config,
  includeReactHooks: true,   // Include React Query hooks
  baseUrl: '/api',            // Base URL for API calls
  includeMiddleware: true,    // Include request/response interceptors
});

// Write to file
const outputPath = './src/generated/api.ts';
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sdkCode, 'utf-8');

console.log('✓ TypeScript SDK generated at', outputPath);
console.log('');
console.log('Usage:');
console.log('  import { api, apiHooks } from './generated/api';');
console.log('');
console.log('  // Vanilla fetch API:');
console.log('  const user = await api.getUser({ userId: '123' });');
console.log('');
console.log('  // React hooks:');
console.log('  const { data } = apiHooks.useGetUser({ userId: '123' });');
`;

export const readmeSdkSectionTemplate = `
## SDK Generation

This project includes automatic TypeScript SDK generation from your ontology.

### Generate SDK

Run the SDK generation script:

\`\`\`bash
npm run generate-sdk
\`\`\`

This will create \`src/generated/api.ts\` with:
- **Type-safe interfaces** for all your functions' inputs and outputs
- **API client class** with methods for each function
- **React Query hooks** for easy integration in React components

### Using the Generated SDK

#### Vanilla TypeScript/JavaScript

\`\`\`typescript
import { api } from './generated/api';

// Call your API functions with full type safety
const user = await api.getUser({ userId: '123' });
console.log(user.name); // TypeScript knows the shape!
\`\`\`

#### React Components

\`\`\`typescript
import { apiHooks } from './generated/api';

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading } = apiHooks.useGetUser({ userId });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.email}</p>
      <Badge>{data.role}</Badge> {/* TypeScript knows about role! */}
    </div>
  );
}
\`\`\`

### Customize SDK Generation

Edit \`scripts/generate-sdk.ts\` to customize:
- \`includeReactHooks\`: Enable/disable React Query hooks
- \`baseUrl\`: Change the API base URL
- \`includeMiddleware\`: Add request/response interceptors

### Benefits

✅ **Single source of truth** - Your ontology defines the API contract  
✅ **Type safety** - Changes to backend schemas are caught at compile time  
✅ **No manual sync** - Regenerate SDK when schemas change  
✅ **IntelliSense** - Full autocomplete in your IDE
`;
