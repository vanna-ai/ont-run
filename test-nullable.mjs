import { z } from 'zod';
import { generateSdk } from './src/sdk/generator.ts';

// Create a test with nullable
const config = {
  name: 'test-ontology',
  accessGroups: {
    admin: { description: 'Administrators' }
  },
  functions: {
    createTask: {
      description: 'Create a new task',
      access: ['admin'],
      entities: ['Task'],
      inputs: z.object({
        title: z.string(),
        assigner: z.string().nullable(),
      }),
      outputs: z.object({
        id: z.string(),
        title: z.string(),
        assigner: z.string().nullable(),
      }),
    }
  }
};

console.log('=== With .nullable() ===\n');
const sdk1 = generateSdk({ config });
const types1 = sdk1.split('// ============================================')[1];
console.log(types1.trim());

// Test with nullable().optional()
config.functions.createTask.inputs = z.object({
  title: z.string(),
  assigner: z.string().nullable().optional(),
});
config.functions.createTask.outputs = z.object({
  id: z.string(),
  title: z.string(),
  assigner: z.string().nullable().optional(),
});

console.log('\n\n=== With .nullable().optional() ===\n');
const sdk2 = generateSdk({ config });
const types2 = sdk2.split('// ============================================')[1];
console.log(types2.trim());
