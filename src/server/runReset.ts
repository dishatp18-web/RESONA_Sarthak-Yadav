import { resetDatabase } from './db.js';
import { seedData } from './seed.js';

console.log('--- Resetting FairFix Database ---');
resetDatabase();
seedData();
console.log('--- Database Reset & Re-seeded Successfully ---');
process.exit(0);
