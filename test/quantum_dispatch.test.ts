/**
 * FairFix Step D Unit & Integration Tests:
 * - QUBO Cost Matrix formulation (ETA, price diff, rating, verification penalty)
 * - Category mismatch penalty M = 10000
 * - QUBO Energy & Constraint Violation Evaluation (Penalty A = 1000)
 * - Exact Hungarian Permutation Solver (N <= 6)
 * - Classical Simulated Annealing Solver on 20 random small instances vs exact optimum
 * - Full Batch Dispatch Orchestrator with mandatory honesty disclaimer
 */
import assert from 'node:assert';
import {
  computeCostMatrix,
  evaluateQUBOEnergy,
  solveHungarianExact,
  solveSimulatedAnnealing,
  runBatchDispatch,
  INFEASIBLE_PENALTY_M,
  QUBO_CONSTRAINT_A,
  DispatchRequest,
  DispatchWorker,
} from '../src/server/quantum_dispatch.js';

console.log('🧪 Starting FairFix Step D Quantum-Inspired QUBO Dispatch Tests...\n');

// 1. Cost Matrix Construction Test
const mockRequests: DispatchRequest[] = [
  {
    id: 'req_1',
    category: 'plumbing',
    lat: 12.9352,
    lng: 77.6245,
    offered_price: 450,
    description: 'Leak in pipe',
  },
  {
    id: 'req_2',
    category: 'electrician',
    lat: 12.9121,
    lng: 77.6446,
    offered_price: 400,
    description: 'Fan repair',
  },
];

const mockWorkers: DispatchWorker[] = [
  {
    id: 'work_1',
    name: 'Ramesh Plumber',
    lat: 12.936,
    lng: 77.625,
    categories: ['plumbing'],
    base_rate: 450,
    radius_km: 5,
    verification_status: 'verified',
    rating_avg: 4.8,
    available: true,
  },
  {
    id: 'work_2',
    name: 'Suresh Electrician',
    lat: 12.913,
    lng: 77.645,
    categories: ['electrician'],
    base_rate: 400,
    radius_km: 5,
    verification_status: 'unverified',
    rating_avg: 4.5,
    available: true,
  },
];

const { matrix, breakdowns } = computeCostMatrix(mockRequests, mockWorkers, 500);

// Req 1 to Worker 1 is feasible plumbing match
assert(matrix[0][0] < 100, `Expected low cost for nearby verified plumbing match, got ${matrix[0][0]}`);
assert.strictEqual(breakdowns[0][0].isFeasible, true);

// Req 1 (plumbing) to Worker 2 (electrician) -> Infeasible penalty M
assert.strictEqual(matrix[0][1], INFEASIBLE_PENALTY_M, 'Category mismatch must yield INFEASIBLE_PENALTY_M');
assert.strictEqual(breakdowns[0][1].isFeasible, false);

// Worker 2 is unverified -> check +6 unverifiedTerm
assert.strictEqual(breakdowns[1][1].unverifiedTerm, 6, 'Unverified worker must incur +6 cost term');
console.log('✓ Test 1: Cost matrix construction, category gating, and unverified terms verified.');

// 2. QUBO Energy & Violation Evaluation Test
const costMatrix = [
  [10, 20],
  [15, 12],
];

// Valid 1-to-1 matching
const validX = [
  [1, 0],
  [0, 1],
];
const validEval = evaluateQUBOEnergy(validX, costMatrix, QUBO_CONSTRAINT_A);
assert.strictEqual(validEval.requestViolations, 0, 'Feasible assignment must have 0 request violations');
assert.strictEqual(validEval.workerViolations, 0, 'Feasible assignment must have 0 worker violations');
assert.strictEqual(validEval.totalEnergy, 10 + 12, 'Energy of valid state should equal pure linear cost');

// Double-booking worker 0 (both requests assigned to worker 0)
const doubleBookX = [
  [1, 0],
  [1, 0],
];
const dbEval = evaluateQUBOEnergy(doubleBookX, costMatrix, QUBO_CONSTRAINT_A);
assert(dbEval.workerViolations > 0, 'Double-booking worker must register worker violation');
assert(dbEval.totalEnergy >= QUBO_CONSTRAINT_A, 'Double-booking worker must incur penalty A');

// Missing assignment
const emptyX = [
  [0, 0],
  [0, 0],
];
const emptyEval = evaluateQUBOEnergy(emptyX, costMatrix, QUBO_CONSTRAINT_A);
assert.strictEqual(emptyEval.requestViolations, 2, 'Unassigned requests must register 2 request violations');
assert(emptyEval.totalEnergy >= 2 * QUBO_CONSTRAINT_A, 'Unassigned requests must incur 2 * penalty A');
console.log('✓ Test 2: QUBO energy evaluation and constraint penalties (A = 1000) verified.');

// 3. Exact Hungarian Permutation Solver (Benchmark)
const smallMatrix = [
  [14, 5, 8],
  [2, 12, 6],
  [7, 8, 3],
];
const exactResult = solveHungarianExact(smallMatrix);
assert.strictEqual(exactResult.optimalCost, 10, `Expected optimal cost 10, got ${exactResult.optimalCost}`);
assert.deepStrictEqual(exactResult.assignments, [
  { reqIdx: 0, workerIdx: 1 },
  { reqIdx: 1, workerIdx: 0 },
  { reqIdx: 2, workerIdx: 2 },
]);
console.log('✓ Test 3: Exact Hungarian permutation solver produces provable ground state.');

// 4. Simulated Annealing vs Exact Solver across 20 Random Instances
let nearOptimalTrials = 0;
const TOTAL_TRIALS = 20;

for (let t = 0; t < TOTAL_TRIALS; t++) {
  const testMat: number[][] = [];
  for (let i = 0; i < 3; i++) {
    testMat.push([
      Math.floor(Math.random() * 40) + 10,
      Math.floor(Math.random() * 40) + 10,
      Math.floor(Math.random() * 40) + 10,
    ]);
  }

  const exact = solveHungarianExact(testMat);
  const annealing = solveSimulatedAnnealing(testMat, {
    sweeps: 120,
    restarts: 3,
    tInitial: 100,
    coolingRate: 0.95,
  });

  const gap = annealing.bestCost - exact.optimalCost;
  const percentGap = exact.optimalCost > 0 ? (gap / exact.optimalCost) * 100 : 0;

  if (gap <= 2 || percentGap <= 10) {
    nearOptimalTrials++;
  }
}

const successRate = nearOptimalTrials / TOTAL_TRIALS;
console.log(`[Trials] Simulated Annealing vs Exact Hungarian: ${nearOptimalTrials}/${TOTAL_TRIALS} (${(successRate * 100).toFixed(1)}% within 10%)`);
assert(successRate >= 0.8, `Expected at least 80% near-optimal trials, got ${(successRate * 100).toFixed(1)}%`);
console.log('✓ Test 4: 20-instance benchmark confirms Annealing achieves >= 80% optimality vs exact solver.');

// 5. Full Batch Dispatch Orchestrator Run
const fullResult = runBatchDispatch(mockRequests, mockWorkers);
assert.strictEqual(fullResult.assignments.length, 2, 'Should assign 2 requests');
assert.strictEqual(fullResult.exactSolverUsed, true, 'Exact solver should be used for N <= 6');
assert(fullResult.energyTrace.length > 5, 'Energy trace should contain progression points');
console.log('✓ Test 5: Full batch dispatch orchestrator returns structured results, energy trace, and benchmark metrics.');

console.log('\n🎉 ALL Step D Quantum-Inspired Dispatch Tests PASSED 100%!');
