// Test what TypeScript's optional operator means

type Test1 = { field?: string };
type Test2 = { field: string | undefined };
type Test3 = { field?: string | null };

// These should be assignable
const t1a: Test1 = {};
const t1b: Test1 = { field: undefined };
const t1c: Test1 = { field: "hello" };

const t2a: Test2 = { field: undefined };
const t2b: Test2 = { field: "hello" };
// const t2c: Test2 = {};  // Error: Property 'field' is missing

const t3a: Test3 = {};
const t3b: Test3 = { field: undefined };
const t3c: Test3 = { field: null };
const t3d: Test3 = { field: "hello" };

// Let's check if Test1 and Test2 are equivalent
const assignTest1to2: Test2 = t1a; // Should work with exactOptionalPropertyTypes: false
const assignTest2to1: Test1 = t2a; // Should work

console.log('TypeScript compiles successfully');
