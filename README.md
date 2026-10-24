# FairFix: Hyperlocal Blue-Collar Services with Live Fair-Price Band

FairFix is a full-stack, hyper-local on-demand home services platform engineered for urban Indian micro-markets (seeded with Bengaluru neighborhoods: Koramangala, HSR Layout, Indiranagar, Jayanagar, and Whitefield).

It eliminates arbitrary price-gouging and exploitative aggregator commissions (25–30%) through a transparent, algorithmic **fair-price band engine**, a **server-enforced 3-round negotiation protocol**, a **7-state job lifecycle with privacy-first contact masking**, and a **quantum-inspired QUBO batch dispatch engine**.

---

## 1. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                        REACT 19 + VITE FRONTEND (PORT 3000)                       |
|                                                                                   |
|  +--------------------+  +--------------------+  +--------------------+           |
|  |   Customer View    |  |    Worker View     |  | Fair-Price Monitor |           |
|  | 4-Step Stepper &   |  | Job Dispatch Radar |  | Live Band Gauge &  |           |
|  | Negotiation Thread |  | Rate Setup & Doc   |  | IQR Outlier Pruner |           |
|  +--------------------+  +--------------------+  +--------------------+           |
|            |                        |                       |                     |
|  +--------------------+  +--------------------+  +--------------------+           |
|  |  Admin Ops Console |  |   Batch Dispatch   |  |    Concept Lab     |           |
|  | Verif, Incidents,  |  | Simulated Anneal   |  | Non-interactive    |           |
|  | & Auto-Flag Queue  |  | vs Exact Hungarian |  | Roadmap Blueprints |           |
|  +--------------------+  +--------------------+  +--------------------+           |
+-----------------------------------------------------------------------------------+
                                         |
                                         | REST APIs (/api/*)
                                         v
+-----------------------------------------------------------------------------------+
|                           EXPRESS API SERVER (server.ts)                          |
|                                                                                   |
|  * /api/price-band          IQR 1.5x filter, 25/50/75 percentiles, 10km radius    |
|  * /api/jobs                7-state FSM (requested->negotiating->accepted...)     |
|  * /api/jobs/:id/offer      3-round alternating negotiation protocol              |
|  * /api/tracking/:id        Coarse 500m grid, 20-pt FIFO cache, 100m geofence     |
|  * /api/safety/incident     High-priority safety queue + 112 emergency notice     |
|  * /api/dispatch/batch      QUBO Ising formulation + Simulated Annealing          |
|  * /api/admin/*             Worker verification, 3-customer auto-flagging         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                     DATA LAYER & CANONICAL DEMO SEED                              |
|                                                                                   |
|  * SQLite Engine: Node.js node:sqlite (zero external C++ binary dependency)       |
|  * Canonical Dataset: 8 customers, 12 workers, 1 admin, 66 historical jobs        |
|  * Document Storage: /uploads (JPG/PNG/PDF <= 5MB with randomized filenames)      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Engineering Truth: Real vs. Simulated vs. Concept

FairFix adheres strictly to the **Honesty Rule**: capabilities are accurately labelled without exaggerated speedup claims, fake hardware claims, or simulated metrics presented as production telemetry.

| Feature | Category | Implementation Reality |
| :--- | :--- | :--- |
| **Fair-Price Band Engine** | **REAL** | Computes 25th ($Q_1$), 50th (Median), and 75th ($Q_3$) percentiles from completed local jobs within 10 km. Filters outliers exceeding $1.5 \times \text{IQR}$. Clamps weekly band velocity to $\pm 10\%$. Enforces 2-job/week pair limit to prevent collusive rate rigging. |
| **3-Round Negotiation Protocol** | **REAL** | Server validates alternating counter-offers, round numbering (1 to 3), and mutual acceptance. Reaching max rounds without agreement auto-cancels the job. |
| **7-State Job Lifecycle** | **REAL** | Transitions guard `requested` &rarr; `negotiating` &rarr; `accepted` &rarr; `in_progress` &rarr; `completed` &rarr; `rated`. Out-of-order transitions are rejected with HTTP 400. |
| **Phone Number Masking** | **REAL** | Numbers remain masked (`+91 ••••• •••••`) during request and negotiation, are unmasked only during active service (`accepted`, `in_progress`), and are **strictly re-masked** once the job is rated. |
| **Worker Verification & Rejection** | **REAL** | Multer upload validation (JPG, PNG, PDF <= 5MB). Admin review with mandatory rejection reason logging and status reset on re-upload. |
| **3-Distinct-Customer Auto-Flag** | **REAL** | Evaluates reports across distinct `reporter_id` customers. 3 distinct customer reports trigger `is_flagged = 1`. Flagged workers rank strictly last in customer discovery. |
| **Safety / Incident Button** | **REAL** | Logs high-priority incident records with GPS coordinates to the Admin Operations Queue with explicit disclaimer: *"This does not contact emergency services. In an emergency dial 112."* |
| **Live Location Tracking** | **REAL** | Browser HTML5 Geolocation ingestion, 500m coarse grid prior to acceptance, accuracy filter ($>100\text{m}$ discarded), 20-point FIFO cache, 100m geofence arrival prompt, and complete cache deletion upon job completion. |
| **GPS Simulator Feeder** | **SIMULATED** | Interpolates 20 waypoints along route at 20 km/h. Carries a prominent, visible `SIMULATED GPS` chip across the map UI. |
| **Quantum-Inspired Batch Dispatch** | **REAL (CLASSICAL)** | Solves a Quadratic Unconstrained Binary Optimization (QUBO) formulation using classical Metropolis-Hastings Simulated Annealing. Benchmarked against exact Hungarian algorithm ($N \le 6$). **Not run on quantum hardware; no quantum speedup claimed.** |
| **Concept Lab (D-Wave, WhatsApp, BLE)** | **CONCEPT** | Strictly non-interactive conceptual blueprint cards with hatched borders, `CONCEPT, NOT IMPLEMENTED` chips, and disabled buttons. |

---

## 3. Mathematical Mechanics of the Fair-Price Band

The algorithm (`src/server/band.ts`) runs on completed jobs filtered by:
1. **Category**: exact match (e.g. `plumbing`, `electrician`).
2. **Geographic Proximity**: Haversine distance $\le 10\text{ km}$ from customer coordinates.
3. **Time Window**: last 90 calendar days.
4. **Anti-Gaming Pair Cap**: at most 2 completed jobs per customer-worker pair per 7-day rolling window to prevent artificial collusion.

### Percentile & IQR Calculation
Sorted prices: $P = [p_1, p_2, \dots, p_n]$:
$$\text{Typical} = \text{Median}(P) = P_{50}$$
$$Q_1 = P_{25}, \quad Q_3 = P_{75}$$
$$\text{IQR} = Q_3 - Q_1$$

### Tukey Fence Outlier Elimination
Jobs with price $p < Q_1 - 1.5 \times \text{IQR}$ or $p > Q_3 + 1.5 \times \text{IQR}$ are pruned.
The remaining valid transactions define the baseline band:
$$\text{Low} = Q_{1,\text{valid}}, \quad \text{High} = Q_{3,\text{valid}}$$

### Velocity Dampening
To prevent flash crashes or speculative surges, if at least 5 completed jobs exist, the band's typical value is clamped against the prior historical snapshot:
$$\text{Typical}_{\text{clamped}} = \max\left(0.9 \times \text{Typical}_{\text{old}}, \min\left(1.1 \times \text{Typical}_{\text{old}}, \text{Typical}\right)\right)$$

### Confidence Tiers
- **High**: $\ge 10$ valid transactions.
- **Medium**: $5 - 9$ valid transactions.
- **Low (few jobs)**: $1 - 4$ valid transactions.
- **Estimate**: $0$ jobs (uses default baseline).

---

## 4. Local Setup & Execution Guide

### Prerequisites
- Node.js 22.x LTS (recommended for built-in `node:sqlite` support)
- npm 10.x or higher

### Step-by-Step Commands
```bash
# 1. Clone repository
git clone https://github.com/dishatp18-web/RESONA_Sarthak-Yadav.git
cd RESONA_Sarthak-Yadav

# 2. Install dependencies (clean install with zero flags)
npm install

# 3. Seed canonical demo database (8 customers, 12 workers, 66 completed jobs)
npm run seed

# 4. Run the comprehensive test suite (all 6 test suites)
npm test

# 5. Typecheck & build production bundle
npm run lint
npm run build

# 6. Start the development server
npm run dev
```

Server binds to `http://localhost:3000`.

---

## 5. Automated Test Coverage Summary

Running `npm test` executes `test/run_all.ts`, running all 6 test suites:

| Suite | File | Assertions / Cases Covered | Status |
| :--- | :--- | :--- | :--- |
| **Band Algorithm** | `test/band.test.ts` | IQR outlier pruning, cook/maid low confidence tier, appliance zero-job baseline, comparison chips, Job ID title formatting (`Job 102`), below-typical gold caution chip, 60s recompute timestamp boundary. | **PASSED** |
| **State Machine** | `test/state_machine.test.ts` | Full lifecycle (`requested` &rarr; `accepted` &rarr; `in_progress` &rarr; `completed` &rarr; `rated`), worker job count increment, rating recompute trigger, ₹4,500 outlier rejection, phone masking lifecycle across all states. | **PASSED** |
| **Negotiation Protocol** | `test/negotiation.test.ts` | Alternating turns, customer & worker counter-offers, round 1 & 2 transitions, mutual acceptance price settlement, max round (3) auto-cancellation. | **PASSED** |
| **Verification & Safety** | `test/step_b.test.ts` | Document rejection reason logging & clearance on approval, 3-distinct-customer auto-flagging threshold, flagged worker rank demotion, safety incident creation, trip share token expiration. | **PASSED** |
| **Live Location Tracking** | `test/step_c.test.ts` | Accuracy filter ($>100\text{m}$ dropped), 20-point FIFO cache eviction, pre-acceptance 500m coarse grid, auto-deletion on completion, 100m geofence detection, speed clamping ($10 - 40\text{ km/h}$). | **PASSED** |
| **Quantum-Inspired Dispatch** | `test/quantum_dispatch.test.ts` | Cost matrix construction, category gating, QUBO energy Hamiltonian, exact Hungarian solver comparison, 20-instance benchmark confirming $\ge 80\%$ optimality vs exact solver. | **PASSED** |

**Total Result**: 6 / 6 Suites Passed 100% in ~8.8 seconds.
