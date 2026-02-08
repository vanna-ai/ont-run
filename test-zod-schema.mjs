import { z } from 'zod';

console.log('\n=== Testing Zod to JSON Schema conversion ===\n');

// Test optional
const optionalSchema = z.string().optional();
console.log('1. z.string().optional():');
console.log(JSON.stringify(optionalSchema.toJSONSchema(), null, 2));

// Test nullable  
const nullableSchema = z.string().nullable();
console.log('\n2. z.string().nullable():');
console.log(JSON.stringify(nullableSchema.toJSONSchema(), null, 2));

// Test nullable + optional
const nullableOptionalSchema = z.string().nullable().optional();
console.log('\n3. z.string().nullable().optional():');
console.log(JSON.stringify(nullableOptionalSchema.toJSONSchema(), null, 2));

// Test in object context
const objectWithOptional = z.object({
  assigner: z.string().optional()
});
console.log('\n4. z.object({ assigner: z.string().optional() }):');
console.log(JSON.stringify(objectWithOptional.toJSONSchema(), null, 2));

const objectWithNullable = z.object({
  assigner: z.string().nullable()
});
console.log('\n5. z.object({ assigner: z.string().nullable() }):');
console.log(JSON.stringify(objectWithNullable.toJSONSchema(), null, 2));

const objectWithBoth = z.object({
  assigner: z.string().nullable().optional()
});
console.log('\n6. z.object({ assigner: z.string().nullable().optional() }):');
console.log(JSON.stringify(objectWithBoth.toJSONSchema(), null, 2));
