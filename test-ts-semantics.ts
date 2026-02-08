// Test TypeScript's handling of optional vs nullable

type OnlyOptional = {
  field?: string;
};

type NullableAndOptional = {
  field?: string | null;
};

// Test OnlyOptional
const valid1: OnlyOptional = {};
const valid2: OnlyOptional = { field: undefined };
const valid3: OnlyOptional = { field: "hello" };
// This should ERROR:
const invalid1: OnlyOptional = { field: null };  // Error expected

// Test NullableAndOptional  
const valid4: NullableAndOptional = {};
const valid5: NullableAndOptional = { field: undefined };
const valid6: NullableAndOptional = { field: "hello" };
const valid7: NullableAndOptional = { field: null };  // Should be valid
