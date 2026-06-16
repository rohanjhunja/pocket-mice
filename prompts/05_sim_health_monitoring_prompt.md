# Prompt: Create Simulation Health and Baseline Profiling System

Build a simulation baseline performance profiler, student-reported performance telemetry API, and admin-only health monitoring dashboards.

---

## 🏗️ Baseline Profiler Engine

Create a server utility function and CLI script (`backfill_sim_health.js`) to establish ideal loading baselines for embedded simulations:
1.  **HEAD Probe**: Send a `HEAD` request to a simulation URL with an abort timer (e.g. 8s). Measure elapsed time as the Time to First Byte (**TTFB**).
2.  **Size Capture**: Read the `Content-Length` header.
3.  **Source Classification**: Inspect the domain of the URL to classify its source type (e.g., Concord Consortium CODAP, AWS S3 bucket, local app file, Supabase storage).
4.  **Ideal Duration Formula**: Calculate expected load time:
    $$\text{Ideal Load Time} = \text{TTFB} + \left( \frac{\text{Content-Length}}{\text{Reference Bandwidth (6 MB/s)}} \times 1000 \right) + \text{Parsing Overhead}$$
    *Parsing Overhead values*: 800ms for Concord CODAP, 500ms for S3 buckets, 100ms standard.
5.  **Upsert**: Store variables in `sim_baselines` table (on conflict, update).

---

## 📡 Student Telemetry Collector API

Create a Next.js POST API route `/api/sim-health`:
1.  **Payload Parameters**:
    *   `url`: The simulation embed URL.
    *   `load_time_ms`: Total loading duration measured on the client browser.
    *   `dynamic_expected_ms`: Expected ideal duration from the baseline.
    *   `status`: `'success'`, `'timeout'`, or `'error'`.
    *   `failure_reason`: Optional details if loaded status failed.
    *   `diagnostics`: Object containing client specs (device type, network speed).
2.  **Logging**: Write the payload to `sim_health_checks` table. Infer the client's approximate region from headers (e.g. Vercel IP location header `x-vercel-ip-city`).

*Client Implementation*: In the lesson player iframe component, monitor iframe loading:
*   Listen to iframe `'load'` event. If triggered before 5s timeout, calculate load time via `performance.now()` and post status `'success'`.
*   If timeout triggers first, post status `'timeout'` and load time `5000ms`.

---

## 📊 Admin Health Monitoring Dashboard

Create an admin-only performance dashboard `/dashboard/sim-health` that aggregates telemetry checks:

### 1. KPI Cards
*   Total tracked simulations.
*   Count of Healthy, Degraded, and Unhealthy simulations.

### 2. Aggregation Algorithm (Last 10 Checks per Simulation)
*   For each simulation URL, fetch the last 10 health checks from the database.
*   Calculate **Actual vs. Expected Ratio**: Sum actual load times and divide by expected ideal loads. (Penalize timeouts and error states by counting them as `3 * expected_load_time`).
*   Determine **Health Status**:
    *   `Healthy`: Ratio $\le 1.25$ AND failures $< 3$.
    *   `Degraded`: Ratio $> 1.25$ OR failures $\ge 3$.
    *   `Unhealthy`: Ratio $> 2.0$ OR failures $\ge 5$.

### 3. Analytics Grid Columns
Render a table displaying:
*   **Health Badge**: Color-coded (Emerald for Healthy, Amber for Degraded, Red for Unhealthy).
*   **Responsibility Breakdown**: Count of issues categorized by diagnostic markers:
    *   `Student Network` (e.g., slow connections).
    *   `Student Device` (e.g., outdated browsers).
    *   `Platform Origin` (e.g., source server down).
    *   `Simulation Code` (e.g., JS runtime errors).
*   **Simulation URL & Parent Lessons**: Clickable links mapping which active lessons embed the simulation.
*   **Baseline Stats**: Ideal load time and TTFB.
*   **Performance Ratio**: Displaying actual ratio multiplier (e.g., `1.15x`).

---

## 📈 Simulation Detail Analytics Page

Create an detail page (`/dashboard/simulation/[id]`):
*   Provide a timeline history chart of loading latency over time.
*   Provide a diagnostic checklist of client device and network statistics.
*   Provide a list of all lessons embedding this simulation.
*   Provide buttons to launch a session wrapper for this simulation directly (auto-generating a 1-step lesson player).

---

## ⚠️ Potential Failure Points & Mitigation

*   **Telemetry Flooding**: High student traffic creates database write locks on the telemetry tables.
    *   *Mitigation*: Implement client-side throttling or use a queuing service. Alternatively, only post health checks on failed loads or sample a percentage of successful loads.
*   **Missing Baselines**: If a simulation was not profiled, calculations will result in division-by-zero or return nulls.
    *   *Mitigation*: If no baseline exists, upsert a baseline stub dynamically with standard default properties when the first check arrives.

---

## 🏁 Zero-Error Checklist

- [ ] Admin authorization checks role on dashboard page load and redirects non-admins.
- [ ] Average ratio calculation guards against zero expected times and does not return `NaN`.
- [ ] Timeline graphs handle missing dates or sparse time gaps gracefully.
- [ ] Profiler handles relative URLs (local hosting files) correctly.
- [ ] Telemetry post is non-blocking to the student's lesson player execution.
