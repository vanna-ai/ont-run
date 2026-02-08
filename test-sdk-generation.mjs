import { z } from 'zod';

// Simulate the jsonSchemaToTypeScript function behavior
function jsonSchemaToTypeScript(schema) {
  if (!schema) return 'unknown';

  // Handle object types
  if (schema.type === 'object') {
    const props = schema.properties || {};
    const required = new Set(schema.required || []);
    
    const fields = Object.entries(props).map(([key, value]) => {
      const optional = !required.has(key);
      const propType = jsonSchemaToTypeScript(value);
      return `  ${key}${optional ? '?' : ''}: ${propType};`;
    });

    if (fields.length === 0) {
      return 'Record<string, unknown>';
    }

    return `{\n${fields.join('\n')}\n}`;
  }

  // Handle array types
  if (schema.type === 'array') {
    const itemType = jsonSchemaToTypeScript(schema.items || {});
    return `Array<${itemType}>`;
  }

  // Handle union types (anyOf, oneOf)
  if (schema.anyOf || schema.oneOf) {
    const options = schema.anyOf || schema.oneOf;
    return options.map((s) => jsonSchemaToTypeScript(s)).join(' | ');
  }

  // Handle enum types
  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(' | ');
  }

  // Handle primitive types
  switch (schema.type) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    default: return 'unknown';
  }
}

console.log('\n=== Testing SDK Generation Logic ===\n');

const testCases = [
  {
    name: 'z.string().optional()',
    schema: z.object({ assigner: z.string().optional() })
  },
  {
    name: 'z.string().nullable()',
    schema: z.object({ assigner: z.string().nullable() })
  },
  {
    name: 'z.string().nullable().optional()',
    schema: z.object({ assigner: z.string().nullable().optional() })
  }
];

for (const testCase of testCases) {
  console.log(`\n${testCase.name}:`);
  const jsonSchema = testCase.schema.toJSONSchema();
  const tsType = jsonSchemaToTypeScript(jsonSchema);
  console.log('TypeScript output:', tsType);
}
