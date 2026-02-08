import { z } from 'zod';
import { generateSdk } from './src/sdk/generator.ts';

// Test with nullable
const config1 = {
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
const sdk1 = generateSdk({ config: config1 });
const match1 = sdk1.match(/export type CreateTaskOutput = ([^;]+);/s);
if (match1) {
  console.log('CreateTaskOutput:', match1[1].trim());
}

// Test with nullable().optional()
const config2 = {
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
        assigner: z.string().nullable().optional(),
      }),
      outputs: z.object({
        id: z.string(),
        title: z.string(),
        assigner: z.string().nullable().optional(),
      }),
    }
  }
};

console.log('\n=== With .nullable().optional() ===\n');
const sdk2 = generateSdk({ config: config2 });
const match2 = sdk2.match(/export type CreateTaskOutput = ([^;]+);/s);
if (match2) {
  console.log('CreateTaskOutput:', match2[1].trim());
}
