import { defineOntology } from '../src/index.js';
import { z } from 'zod';
import { computeOntologyHash, writeLockfile } from '../src/lockfile/index.js';
import { readFile, unlink, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define a simple ontology for testing
const testOntology = defineOntology({
  name: 'test-ontology',
  
  environments: {
    dev: { debug: true },
  },
  
  auth: async () => ({ groups: ['public'] }),
  
  accessGroups: {
    admin: { description: 'Administrators' },
    user: { description: 'Regular users' },
  },
  
  entities: {
    User: { description: 'A user in the system' },
    Post: { description: 'A blog post' },
  },
  
  functions: {
    getUser: {
      description: 'Get a user by ID',
      access: ['admin', 'user'],
      entities: ['User'],
      isReadOnly: true,
      inputs: z.object({ id: z.string().uuid() }),
      outputs: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      resolver: async () => ({ name: 'Test', email: 'test@example.com' }),
    },
  },
});

async function test() {
  console.log('Testing TypeScript lock file generation...');
  
  // Compute hash and generate lock file
  const { ontology, hash } = computeOntologyHash(testOntology);
  console.log('✓ Hash computed:', hash);
  console.log('  Hash length:', hash.length);
  
  if (hash.length !== 16) {
    throw new Error(`Hash should be 16 characters, got ${hash.length}`);
  }
  
  // Ensure tmp directory exists
  const tmpDir = join(__dirname, '../tmp');
  if (!existsSync(tmpDir)) {
    await mkdir(tmpDir);
  }
  
  // Write lock file to tmp location
  await writeLockfile(tmpDir, ontology, hash);
  
  // Read and parse the lock file
  const lockContent = await readFile(join(tmpDir, 'ont.lock'), 'utf-8');
  const lockfile = JSON.parse(lockContent);
  
  console.log('✓ Lock file generated');
  console.log('  Version:', lockfile.version);
  console.log('  Hash:', lockfile.hash);
  console.log('  Ontology name:', lockfile.ontology.name);
  console.log('  Access groups:', lockfile.ontology.accessGroups);
  console.log('  Entities:', lockfile.ontology.entities);
  console.log('  Functions:', Object.keys(lockfile.ontology.functions));
  
  // Verify structure
  if (typeof lockfile.version !== 'number') {
    throw new Error('version should be a number');
  }
  if (lockfile.version !== 1) {
    throw new Error('version should be 1');
  }
  if (!lockfile.approvedAt) {
    throw new Error('approvedAt is required');
  }
  if (!lockfile.ontology) {
    throw new Error('ontology is required');
  }
  if (!Array.isArray(lockfile.ontology.accessGroups)) {
    throw new Error('accessGroups should be an array');
  }
  if (!Array.isArray(lockfile.ontology.entities)) {
    throw new Error('entities should be an array');
  }
  if (typeof lockfile.ontology.functions !== 'object') {
    throw new Error('functions should be an object');
  }
  
  // Check that access groups and entities are sorted
  const accessGroups = lockfile.ontology.accessGroups;
  const sortedAccessGroups = [...accessGroups].sort();
  if (JSON.stringify(accessGroups) !== JSON.stringify(sortedAccessGroups)) {
    throw new Error('accessGroups should be sorted');
  }
  
  const entities = lockfile.ontology.entities;
  const sortedEntities = [...entities].sort();
  if (JSON.stringify(entities) !== JSON.stringify(sortedEntities)) {
    throw new Error('entities should be sorted');
  }
  
  // Verify function shape
  const getUserFn = lockfile.ontology.functions.getUser;
  if (!getUserFn) {
    throw new Error('getUser function missing');
  }
  if (getUserFn.description !== 'Get a user by ID') {
    throw new Error('description mismatch');
  }
  if (!Array.isArray(getUserFn.access)) {
    throw new Error('access should be an array');
  }
  if (!Array.isArray(getUserFn.entities)) {
    throw new Error('entities should be an array');
  }
  if (!getUserFn.inputsSchema) {
    throw new Error('inputsSchema is required');
  }
  if (!getUserFn.outputsSchema) {
    throw new Error('outputsSchema is required');
  }
  
  // Clean up
  await unlink(join(tmpDir, 'ont.lock')).catch(() => {});
  
  console.log('✓ All checks passed!');
  console.log('\nLock file sample:');
  console.log(JSON.stringify(lockfile, null, 2));
}

test().catch(err => {
  console.error('✗ Test failed:', err);
  process.exit(1);
});
