# Browserless Kubernetes Deployment

Deploys a [Browserless](https://www.browserless.io/) Chromium cluster with NGINX `least_conn` load balancing for use as a remote PDF renderer by user-office-factory.

## Architecture

```
Factory ─- ws ──> browserless (ClusterIP, NGINX) ── ws ──> Browserless Pod 1
                                                 ── ws ──> Browserless Pod 2
                                                 ── ws ──> Browserless Pod N
```

NGINX uses `least_conn` to route each new WebSocket connection to the Browserless pod with the fewest active connections, ensuring even distribution when PDF generation times vary.

## Resources

| File                    | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `deployment.yaml`       | Browserless Deployment (image, env, probes, resources)    |
| `service.yaml`          | Headless Service for pod discovery by NGINX               |
| `nginx-configmap.yaml`  | NGINX config (`least_conn`, WebSocket support, timeouts)  |
| `nginx-deployment.yaml` | NGINX reverse-proxy Deployment                            |
| `nginx-service.yaml`    | ClusterIP Service `browserless` — the factory entry point |
| `kustomization.yaml`    | Kustomize entrypoint                                      |

## Deploy

```bash
kubectl apply -k k8s/browserless/ -n <namespace>
```

## Configuration

### Browserless pods (`deployment.yaml`)

| Variable     | Default  | Description                             |
| ------------ | -------- | --------------------------------------- |
| `CONCURRENT` | `5`      | Max concurrent browser sessions per pod |
| `QUEUED`     | `10`     | Max queued requests per pod             |
| `TIMEOUT`    | `120000` | Session timeout in ms                   |
| `HEALTH`     | `true`   | Enable health endpoint for probes       |

### NGINX (`nginx-configmap.yaml`)

| Setting               | Value   | Description                                           |
| --------------------- | ------- | ----------------------------------------------------- |
| `least_conn`          | —       | Route to pod with fewest active connections           |
| `proxy_next_upstream` | `error` | Only retry on connection errors (prevents duplicates) |
| Timeouts              | 900 s   | Accommodate long-running PDF generation               |

## Scaling

### Scale Browserless pods

```bash
kubectl scale deployment browserless --replicas=3
kubectl rollout restart deployment browserless-nginx
```

> **Important:** After scaling Browserless pods, restart NGINX so it re-resolves the headless DNS and picks up the new pod IPs. Open-source NGINX resolves upstream DNS once at startup.

## Factory configuration

Point the factory service to the NGINX entry-point service:

```dotenv
BROWSER_WS_ENDPOINT=ws://browserless.<namespace>.svc.cluster.local:3000
FACTORY_BASE_URL=http://<factory-service>.<namespace>.svc.cluster.local:4500
MAX_CONCURRENT_PDF_GENERATIONS=15
```

`BROWSER_WS_ENDPOINT` targets the `browserless` ClusterIP service (NGINX). NGINX handles distribution to the Browserless pods.

### Calculating MAX_CONCURRENT_PDF_GENERATIONS (semaphore)

```
MAX_CONCURRENT_PDF_GENERATIONS = replicas × CONCURRENT
```

| Replicas | CONCURRENT | Semaphore |
| -------- | ---------- | --------- |
| 2        | 5          | 10        |
| 3        | 5          | 15        |
| 4        | 5          | 20        |

**Do not include QUEUED** in the calculation. The queue is a burst buffer that adds latency — targeting it will not improve throughput.

## Performance Tuning

### Why CONCURRENT=5 is optimal

Each Chromium browser instance is CPU and memory intensive. When running multiple concurrent browsers on the same pod, they compete for:

- **CPU cycles** — Chrome rendering and PDF generation are CPU-bound
- **Memory bandwidth** — each browser context consumes ~100-200MB
- **I/O** — temporary file writes during PDF generation

**Observed behaviour with 2 CPU / 2Gi memory per pod:**

| CONCURRENT | Mean Time/Job | Total Time (31 proposals) | Notes                  |
| ---------- | ------------- | ------------------------- | ---------------------- |
| 5          | ~3.4s         | ~32.4s                    | Optimal                |
| 7          | ~4.6s         | ~32.7s                    | 35% slower per job     |
| 10         | ~5.5s         | ~37s                      | Significant contention |

**Why higher concurrency doesn't help:**

The parallelism gain is cancelled out by resource contention. With CONCURRENT=7, you process more jobs simultaneously, but each job takes 35% longer:

- **CONCURRENT=5:** 15 parallel slots × 3.4s/job = efficient throughput
- **CONCURRENT=7:** 21 parallel slots × 4.6s/job = same throughput, more resource usage

**Recommendation:** Scale horizontally (more pods) rather than vertically (more concurrent per pod). Adding a 4th pod with CONCURRENT=5 is more effective than increasing to CONCURRENT=7 on 3 pods.

### Horizontal scaling results

| Pods | Capacity | Semaphore | Time (31 proposals) | Improvement |
| ---- | -------- | --------- | ------------------- | ----------- |
| 2    | 10       | 10        | ~47s                | baseline    |
| 3    | 15       | 15        | ~32.4s              | 31% faster  |
| 4    | 20       | 20        | ~27.5s              | 42% faster  |

Each additional pod provides meaningful throughput gains without the diminishing returns of increasing per-pod concurrency.

### Load balancing comparison

| Setup                       | Time (31 proposals) | Distribution        |
| --------------------------- | ------------------- | ------------------- |
| Direct ClusterIP (no NGINX) | ~43.7s              | Random              |
| NGINX with dynamic DNS      | ~37s                | Uneven (41/32/51)   |
| **NGINX with `least_conn`** | **~32.4s**          | **Even (42/43/39)** |

`least_conn` provides ~26% faster throughput than direct ClusterIP by ensuring even distribution across pods.

## Example Performance Stats (DEV cluster)

**Recommended configuration:** 3-4 pods, CONCURRENT=5, QUEUED=10, Factory semaphore=15-20, NGINX `least_conn`

**Workload:** 31 proposals / ~200 pages / ~124 browserless jobs (each proposal generates ~4 jobs: proposal + questionnaire + technical review + samples)

### 3 pods (semaphore=15)

| Pod | Jobs | Mean Time | Max Concurrent |
| --- | ---- | --------- | -------------- |
| 1   | 42   | 3.7s      | 5              |
| 2   | 43   | 3.1s      | 5              |
| 3   | 39   | 3.4s      | 5              |

**Total time: ~32.4 seconds**

### 4 pods (semaphore=20)

**Total time: ~27.5 seconds** (~18% faster than 3 pods)

**Key observations:**
- Even job distribution thanks to `least_conn`
- Consistent mean times (3.1-3.7s) — no resource contention
- All pods utilising full concurrent capacity
- No rejected requests, no timeouts
- Horizontal scaling provides linear throughput improvement
