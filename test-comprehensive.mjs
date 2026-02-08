import { z } from 'zod';
import { generateSdk } from './src/sdk/generator.ts';

// Create a simple ontology config to test
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
        assigner: z.string().optional(),
      }),
      outputs: z.object({
        id: z.string(),
        title: z.string(),
        assigner: z.string().optional(),
      }),
    }
  }
};

console.log('Generating SDK...\n');
try {
  const sdk = generateSdk({ config });
  console.log(sdk);
} catch (error) {
  console.error('Error generating SDK:', error.message);
  console.error(error.stack);
}
