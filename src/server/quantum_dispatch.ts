/**
 * FairFix Quantum-Inspired Batch Dispatch Engine
 * 
 * Classical Simulated Annealing on a Quadratic Unconstrained Binary Optimization (QUBO)
 * formulation of the hyper-local multi-worker multi-request matching problem.
 * 
 * MANDATORY TRUTH SPECIFICATION:
 * "Quantum-inspired: classical simulated annealing on a QUBO. Not run on quantum hardware."
 * No speedup claims. No quantum hardware used.
 */

export interface DispatchRequest {
  id: string;
  category: string;
  lat: number;
  lng: number;
  offered_price: number;
  description: string;
  customer_name?: string;
}

export interface DispatchWorker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  categories: string[];
  base_rate: number;
  radius_km: number;
  verification_status: 'verified' | 'pending' | 'unverified' | 'rejected';
  rating_avg: number;
  available: boolean;
  is_flagged?: boolean;
}

export interface CostBreakdown {
  reqId: string;
  workerId: string;
  distanceKm: number;
  etaMinutes: number;
  priceDiffPercent: number;
  ratingTerm: number;
  unverifiedTerm: number;
  totalCost: number;
  isFeasible: boolean;
}

export interface QUBOTracePoint {
  sweep: number;
  temperature: number;
  energy: number;
  violations: number;
}

export interface DispatchResult {
  assignments: { reqId: string; workerId: string; cost: number; eta: number }[];
  totalAnnealingCost: number;
  exactCost: number | null;
  optimalityGapPercent: number | null;
  exactSolverUsed: boolean;
  energyTrace: QUBOTracePoint[];
  computationTimeMs: number;
  finalTemperature: number;
  matrixSize: { requests: number; workers: number };
  annealingSweeps: number;
}

export const INFEASIBLE_PENALTY_M = 10000;
export const QUBO_CONSTRAINT_A = 1000; // Larger than largest finite cost

/**
 * Calculates great-circle distance between two points in km.
 */
function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Builds the cost matrix c[i][j] based on the specification:
 * c[i][j] = 1.0 * ETA_minutes 
 *         + 0.5 * (abs(offer - worker_rate) / typical_price * 100) 
 *         + 8 * (1 - rating / 5) 
 *         + 6 if unverified (or pending/rejected)
 * If category mismatches or distance > radius, c[i][j] = M.
 */
export function computeCostMatrix(
  requests: DispatchRequest[],
  workers: DispatchWorker[],
  typicalPrice = 500
): { matrix: number[][]; breakdowns: CostBreakdown[][] } {
  const matrix: number[][] = [];
  const breakdowns: CostBreakdown[][] = [];

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const rowCosts: number[] = [];
    const rowBreakdowns: CostBreakdown[] = [];

    for (let j = 0; j < workers.length; j++) {
      const w = workers[j];
      const dist = haversineDist(req.lat, req.lng, w.lat, w.lng);
      const categoryMatch = w.categories.includes(req.category);
      const withinRadius = dist <= w.radius_km;

      if (!categoryMatch || !withinRadius || !w.available || w.is_flagged) {
        rowCosts.push(INFEASIBLE_PENALTY_M);
        rowBreakdowns.push({
          reqId: req.id,
          workerId: w.id,
          distanceKm: dist,
          etaMinutes: 999,
          priceDiffPercent: 999,
          ratingTerm: 999,
          unverifiedTerm: 999,
          totalCost: INFEASIBLE_PENALTY_M,
          isFeasible: false,
        });
        continue;
      }

      const eta = Math.max(5, Math.round((dist / 20) * 60)); // 20 km/h avg speed
      const priceDiffPercent = (Math.abs(req.offered_price - w.base_rate) / typicalPrice) * 100;
      const ratingTerm = 8 * (1 - (w.rating_avg || 4.0) / 5);
      const unverifiedTerm = w.verification_status === 'verified' ? 0 : 6;

      const totalCost = Number((1.0 * eta + 0.5 * priceDiffPercent + ratingTerm + unverifiedTerm).toFixed(2));

      rowCosts.push(totalCost);
      rowBreakdowns.push({
        reqId: req.id,
        workerId: w.id,
        distanceKm: dist,
        etaMinutes: eta,
        priceDiffPercent,
        ratingTerm,
        unverifiedTerm,
        totalCost,
        isFeasible: true,
      });
    }
    matrix.push(rowCosts);
    breakdowns.push(rowBreakdowns);
  }

  return { matrix, breakdowns };
}

/**
 * Evaluates the QUBO objective energy for a binary matrix x[i][j]:
 * E(x) = sum c[i][j]*x[i][j] + A * sum_i (sum_j x[i][j] - 1)^2 + A * sum_j sum_{i<k} x[i][j]*x[k][j]
 */
export function evaluateQUBOEnergy(
  x: number[][],
  costMatrix: number[][],
  penaltyA = QUBO_CONSTRAINT_A
): { totalEnergy: number; linearCost: number; requestViolations: number; workerViolations: number } {
  const N = x.length;
  const M = x[0]?.length || 0;

  let linearCost = 0;
  let requestViolations = 0;
  let workerViolations = 0;

  // 1. Linear objective term: sum c[i][j] * x[i][j]
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      if (x[i][j] === 1) {
        linearCost += costMatrix[i][j];
      }
    }
  }

  // 2. Request assignment constraint: exactly one worker per request sum_j x[i][j] == 1
  for (let i = 0; i < N; i++) {
    let assignedCount = 0;
    for (let j = 0; j < M; j++) {
      assignedCount += x[i][j];
    }
    const diff = assignedCount - 1;
    if (diff !== 0) {
      requestViolations += diff * diff;
    }
  }

  // 3. Worker capacity constraint: at most one request per worker (sum_{i<k} x[i][j]*x[k][j])
  for (let j = 0; j < M; j++) {
    let workerAssignedCount = 0;
    for (let i = 0; i < N; i++) {
      workerAssignedCount += x[i][j];
    }
    if (workerAssignedCount > 1) {
      // Pairwise count: n*(n-1)/2
      workerViolations += (workerAssignedCount * (workerAssignedCount - 1)) / 2;
    }
  }

  const totalEnergy = linearCost + penaltyA * requestViolations + penaltyA * workerViolations;

  return {
    totalEnergy,
    linearCost,
    requestViolations,
    workerViolations,
  };
}

/**
 * Solves the matching problem using Classical Simulated Annealing on the QUBO.
 * Runs random restarts and records energy trace.
 */
export function solveSimulatedAnnealing(
  costMatrix: number[][],
  optionsOrSweeps: number | {
    sweeps?: number;
    restarts?: number;
    tInitial?: number;
    coolingRate?: number;
  } = 100,
  restartsArg = 3,
  tInitialArg = 80,
  coolingRateArg = 0.95
): {
  bestX: number[][];
  bestEnergy: number;
  bestCost: number;
  energyTrace: QUBOTracePoint[];
  finalTemperature: number;
} {
  const N = costMatrix.length;
  const M = costMatrix[0]?.length || 0;

  let sweeps = 100;
  let restarts = restartsArg;
  let tInitial = tInitialArg;
  let coolingRate = coolingRateArg;

  if (typeof optionsOrSweeps === 'number') {
    sweeps = optionsOrSweeps;
  } else if (typeof optionsOrSweeps === 'object' && optionsOrSweeps !== null) {
    if (optionsOrSweeps.sweeps !== undefined) sweeps = optionsOrSweeps.sweeps;
    if (optionsOrSweeps.restarts !== undefined) restarts = optionsOrSweeps.restarts;
    if (optionsOrSweeps.tInitial !== undefined) tInitial = optionsOrSweeps.tInitial;
    if (optionsOrSweeps.coolingRate !== undefined) coolingRate = optionsOrSweeps.coolingRate;
  }

  let globalBestX: number[][] = [];
  let globalBestEnergy = Infinity;
  let globalBestCost = Infinity;
  let bestRunTrace: QUBOTracePoint[] = [];
  let lastTemp = 0.05;

  for (let r = 0; r < restarts; r++) {
    // Warm start: randomly assign each request to a distinct worker (if M >= N)
    const x: number[][] = Array.from({ length: N }, () => Array(M).fill(0));
    const availableWorkers = Array.from({ length: M }, (_, idx) => idx).sort(() => Math.random() - 0.5);

    for (let i = 0; i < N; i++) {
      if (i < availableWorkers.length) {
        x[i][availableWorkers[i]] = 1;
      }
    }

    let currentEval = evaluateQUBOEnergy(x, costMatrix);
    let currentEnergy = currentEval.totalEnergy;
    let temp = tInitial;

    let runBestX = x.map((row) => [...row]);
    let runBestEnergy = currentEnergy;
    let runBestCost = currentEval.linearCost;

    const runTrace: QUBOTracePoint[] = [];

    for (let s = 1; s <= sweeps; s++) {
      // Perform steps per sweep
      const stepsInSweep = Math.max(40, N * M * 3);
      for (let step = 0; step < stepsInSweep; step++) {
        const moveChoice = Math.random();

        if (moveChoice < 0.35) {
          // Move 1: Standard QUBO bit-flip
          const i = Math.floor(Math.random() * N);
          const j = Math.floor(Math.random() * M);
          x[i][j] = 1 - x[i][j];

          const cand = evaluateQUBOEnergy(x, costMatrix);
          const delta = cand.totalEnergy - currentEnergy;

          if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(0.1, temp))) {
            currentEnergy = cand.totalEnergy;
            currentEval = cand;
            if (cand.requestViolations === 0 && cand.workerViolations === 0 && cand.totalEnergy < runBestEnergy) {
              runBestEnergy = cand.totalEnergy;
              runBestCost = cand.linearCost;
              runBestX = x.map((row) => [...row]);
            }
          } else {
            x[i][j] = 1 - x[i][j]; // Revert
          }
        } else if (moveChoice < 0.7) {
          // Move 2: 2-opt Worker Swap between two distinct requests (preserves 1-to-1 constraint)
          const i1 = Math.floor(Math.random() * N);
          let i2 = Math.floor(Math.random() * N);
          if (N > 1) {
            while (i2 === i1) i2 = Math.floor(Math.random() * N);
            const w1 = x[i1].indexOf(1);
            const w2 = x[i2].indexOf(1);

            if (w1 !== -1 && w2 !== -1 && w1 !== w2) {
              x[i1][w1] = 0;
              x[i1][w2] = 1;
              x[i2][w2] = 0;
              x[i2][w1] = 1;

              const cand = evaluateQUBOEnergy(x, costMatrix);
              const delta = cand.totalEnergy - currentEnergy;

              if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(0.1, temp))) {
                currentEnergy = cand.totalEnergy;
                currentEval = cand;
                if (cand.requestViolations === 0 && cand.workerViolations === 0 && cand.totalEnergy < runBestEnergy) {
                  runBestEnergy = cand.totalEnergy;
                  runBestCost = cand.linearCost;
                  runBestX = x.map((row) => [...row]);
                }
              } else {
                x[i1][w1] = 1;
                x[i1][w2] = 0;
                x[i2][w2] = 1;
                x[i2][w1] = 0; // Revert
              }
            }
          }
        } else {
          // Move 3: Reassign a request to any worker (including unassigned)
          const i = Math.floor(Math.random() * N);
          const currentWorker = x[i].indexOf(1);
          const newWorker = Math.floor(Math.random() * M);

          if (currentWorker !== -1 && currentWorker !== newWorker) {
            x[i][currentWorker] = 0;
            x[i][newWorker] = 1;

            const cand = evaluateQUBOEnergy(x, costMatrix);
            const delta = cand.totalEnergy - currentEnergy;

            if (delta < 0 || Math.random() < Math.exp(-delta / Math.max(0.1, temp))) {
              currentEnergy = cand.totalEnergy;
              currentEval = cand;
              if (cand.requestViolations === 0 && cand.workerViolations === 0 && cand.totalEnergy < runBestEnergy) {
                runBestEnergy = cand.totalEnergy;
                runBestCost = cand.linearCost;
                runBestX = x.map((row) => [...row]);
              }
            } else {
              x[i][currentWorker] = 1;
              x[i][newWorker] = 0; // Revert
            }
          }
        }
      }

      temp *= coolingRate;
      lastTemp = temp;

      if (r === 0 || s % 2 === 0) {
        runTrace.push({
          sweep: s,
          temperature: Number(temp.toFixed(2)),
          energy: Number(currentEnergy.toFixed(1)),
          violations: currentEval.requestViolations + currentEval.workerViolations,
        });
      }
    }

    if (runBestEnergy < globalBestEnergy) {
      globalBestEnergy = runBestEnergy;
      globalBestCost = runBestCost;
      globalBestX = runBestX;
      bestRunTrace = runTrace;
    }
  }

  return {
    bestX: globalBestX,
    bestEnergy: globalBestEnergy,
    bestCost: globalBestCost,
    energyTrace: bestRunTrace.length > 0 ? bestRunTrace : [{ sweep: 1, temperature: tInitial, energy: globalBestEnergy, violations: 0 }],
    finalTemperature: Number(lastTemp.toFixed(3)),
  };
}

/**
 * Exact Hungarian Algorithm / Kuhn-Munkres Solver for N x M instances (N <= M).
 * Computes the provable global optimum for benchmarks and unit tests.
 */
export function solveHungarianExact(costMatrix: number[][]): {
  optimalCost: number;
  assignments: { reqIdx: number; workerIdx: number }[];
} {
  const N = costMatrix.length;
  const M = costMatrix[0]?.length || 0;

  if (N === 0 || M === 0) {
    return { optimalCost: 0, assignments: [] };
  }

  // Permutation search for small benchmark instances (N <= 6)
  if (N <= 6) {
    let minCost = Infinity;
    let bestPerm: number[] = [];

    function permute(reqIdx: number, usedWorkers: Set<number>, currentCost: number, currentPerm: number[]) {
      if (currentCost >= minCost) return; // Prune branch

      if (reqIdx === N) {
        if (currentCost < minCost) {
          minCost = currentCost;
          bestPerm = [...currentPerm];
        }
        return;
      }

      for (let w = 0; w < M; w++) {
        if (!usedWorkers.has(w)) {
          const cost = costMatrix[reqIdx][w];
          usedWorkers.add(w);
          currentPerm.push(w);
          permute(reqIdx + 1, usedWorkers, currentCost + cost, currentPerm);
          currentPerm.pop();
          usedWorkers.delete(w);
        }
      }
    }

    permute(0, new Set(), 0, []);

    const assignments = bestPerm.map((w, i) => ({ reqIdx: i, workerIdx: w }));
    return { optimalCost: Number(minCost.toFixed(2)), assignments };
  }

  // Fallback for N > 6 (no exact check above 6x6)
  return { optimalCost: -1, assignments: [] };
}

/**
 * Full Dispatch Orchestrator
 */
export function runBatchDispatch(
  requests: DispatchRequest[],
  workers: DispatchWorker[],
  typicalPrice = 500
): DispatchResult {
  const startTime = Date.now();
  const { matrix } = computeCostMatrix(requests, workers, typicalPrice);
  const N = requests.length;
  const M = workers.length;

  const { bestX, bestCost, energyTrace, finalTemperature } = solveSimulatedAnnealing(matrix);

  // Extract assignments from bestX
  const assignments: { reqId: string; workerId: string; cost: number; eta: number }[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      if (bestX[i] && bestX[i][j] === 1) {
        const cost = matrix[i][j];
        const dist = haversineDist(requests[i].lat, requests[i].lng, workers[j].lat, workers[j].lng);
        const eta = Math.max(5, Math.round((dist / 20) * 60));
        assignments.push({
          reqId: requests[i].id,
          workerId: workers[j].id,
          cost,
          eta,
        });
      }
    }
  }

  // Exact benchmark computation (instances up to 6 requests)
  let exactCost: number | null = null;
  let optimalityGapPercent: number | null = null;
  let exactSolverUsed = false;

  if (N <= 6 && M <= 8) {
    const exact = solveHungarianExact(matrix);
    if (exact.optimalCost >= 0 && exact.optimalCost < INFEASIBLE_PENALTY_M) {
      exactCost = exact.optimalCost;
      exactSolverUsed = true;
      if (exactCost > 0) {
        optimalityGapPercent = Number((((bestCost - exactCost) / exactCost) * 100).toFixed(1));
      } else {
        optimalityGapPercent = 0.0;
      }
    }
  }

  const computationTimeMs = Date.now() - startTime;

  return {
    assignments,
    totalAnnealingCost: Number(bestCost.toFixed(2)),
    exactCost,
    optimalityGapPercent,
    exactSolverUsed,
    energyTrace,
    computationTimeMs,
    finalTemperature,
    matrixSize: { requests: N, workers: M },
    annealingSweeps: energyTrace.length,
  };
}
