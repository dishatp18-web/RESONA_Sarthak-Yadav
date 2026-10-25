/**
 * FairFix Comprehensive Automated Test Suite Runner
 * Runs all unit and integration test suites sequentially:
 * 1. Fair-Price Band Algorithm (IQR, confidence tiers, anti-gaming limits, formatting)
 * 2. State Machine & Ratings Recompute Lifecycle (transitions, ratings, phone masking)
 * 3. 3-Round Negotiation Protocol (server-enforced turns, counter-offers, round capping)
 * 4. Step B Safety & Verification (rejection reason, 3-distinct-customer auto-flag, priority)
 * 5. Step C Live Location Tracking (accuracy filter, 20-point FIFO, 500m coarse, geofence, speed clamp)
 * 6. Step D Quantum-Inspired Dispatch (QUBO formulation, simulated annealing vs exact Hungarian)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testFiles = [
  'test/band.test.ts',
  'test/state_machine.test.ts',
  'test/negotiation.test.ts',
  'test/step_b.test.ts',
  'test/step_c.test.ts',
  'test/quantum_dispatch.test.ts',
];

console.log('======================================================');
console.log('🚀 Running FairFix Comprehensive Test Suite (6 Suites)');
console.log('======================================================\n');

let failedSuites = 0;
const startTime = Date.now();

for (const testFile of testFiles) {
  console.log(`▶ Executing: ${testFile}`);
  const result = spawnSync('npx', ['tsx', testFile], {
    stdio: 'inherit',
    env: { ...process.env },
  });

  if (result.status !== 0) {
    console.error(`❌ Suite FAILED: ${testFile} (Exit code: ${result.status})`);
    failedSuites++;
  } else {
    console.log(`✔ Suite PASSED: ${testFile}\n`);
  }
}

const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
console.log('======================================================');
if (failedSuites > 0) {
  console.error(`💥 TEST SUITE FAILED: ${failedSuites} of ${testFiles.length} suites failed (${elapsedSec}s)`);
  process.exit(1);
} else {
  console.log(`🎉 ALL 6 TEST SUITES PASSED 100% (${testFiles.length}/${testFiles.length} passed in ${elapsedSec}s)`);
  console.log('======================================================\n');
}
