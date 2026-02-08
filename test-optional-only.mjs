import { z } from 'zod';
import { generateSdk } from './src/sdk/generator.ts';

const config = {
  name: 'test',
  accessGroups: { admin: { description: 'Administrators' } },
  functions: {
    createTask: {
      description: 'Create',
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

console.log('=== With .optional() ONLY ===\n');
const sdk = generateSdk({ config });
const lines = sdk.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('CreateTaskOutput')) {
    for (let j = i; j < Math.min(i + 10, lines.length); j++) {
      console.log(lines[j]);
    }
    break;
  }
}

// Also print the JSON schema being generated
console.log('\n=== JSON Schema ===\n');
const jsonSchema = config.functions.createTask.outputs.toJSONSchema();
console.log(JSON.stringify(jsonSchema, null, 2));
