import { z } from 'zod';
import { userContext, getUserContextFields } from '../src/config/categorical.js';
import { isZodObject, getObjectShape, getZodTypeName } from '../src/config/zod-utils.js';

const schema = z.object({
  title: z.string(),
  user: userContext(z.object({ id: z.string() }))
});

console.log('\n=== Testing getUserContextFields ===\n');
console.log('✅ Schema is ZodObject:', isZodObject(schema));
console.log('✅ getZodTypeName:', getZodTypeName(schema));

// Check the actual structure
const s = schema as any;
console.log('\n_zod.traits:', s._zod?.traits);

// Try getting shape via getObjectShape
console.log('\n--- getObjectShape result ---');
const shape = getObjectShape(schema);
console.log('getObjectShape(schema):', shape ? Object.keys(shape) : 'undefined');

const fields = getUserContextFields(schema);
console.log('\n✅ getUserContextFields result:', fields);
console.log('Expected: ["user"]');
console.log('Match:', JSON.stringify(fields) === JSON.stringify(['user']));
