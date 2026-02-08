import { z } from 'zod';
import { generateSdk } from './src/sdk/generator.ts';

// Test with nullable
const config1 = {
  name: 'test',
  accessGroups: { admin: { description: 'Administrators' } },
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
const lines1 = sdk1.split('\n');
for (let i = 0; i < lines1.length; i++) {
  if (lines1[i].includes('CreateTaskOutput')) {
    for (let j = i; j < Math.min(i + 10, lines1.length); j++) {
      console.log(lines1[j]);
    }
    break;
  }
}

// Test with nullable().optional()
const config2 = {
  name: 'test',
  accessGroups: { admin: { description: 'Administrators' } },
  functions: {
    createTask: {
      description: 'Create',
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
const lines2 = sdk2.split('\n');
for (let i = 0; i < lines2.length; i++) {
  if (lines2[i].includes('CreateTaskOutput')) {
    for (let j = i; j < Math.min(i + 10, lines2.length); j++) {
      console.log(lines2[j]);
    }
    break;
  }
}
