# Browserless Kubernetes Deployment

Deploys a [Browserless](https://www.browserless.io/) Chromium cluster for use as a remote PDF renderer by user-office-factory.

## Resources

| File                 | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `deployment.yaml`    | Browserless Deployment (image, env, probes, resources) |
| `service.yaml`       | LoadBalancer Service exposing port `3000`              |
| `kustomization.yaml` | Kustomize entrypoint                                   |

## Deploy

```bash
kubectl apply -k k8s/browserless/ -n <namespace>
```

## Verify

```bash
kubectl get pods -l app.kubernetes.io/name=browserless
kubectl get svc browserless
```

## Configuration

Key environment variables in `deployment.yaml`:

| Variable     | Default  | Description                             |
| ------------ | -------- | --------------------------------------- |
| `CONCURRENT` | `5`      | Max concurrent browser sessions per pod |
| `QUEUED`     | `10`     | Max queued requests per pod             |
| `TIMEOUT`    | `120000` | Session timeout in ms                   |
| `HEALTH`     | `true`   | Enable health endpoint for probes       |

## Scaling

Increase replicas to handle more concurrent PDF generations:

```bash
kubectl scale deployment browserless --replicas=3
```

The LoadBalancer service distributes WebSocket connections across pods.

## Factory configuration

Point the factory service to this cluster:

```dotenv
BROWSER_WS_ENDPOINT=ws://browserless.<namespace>.svc.cluster.local:3000
FACTORY_BASE_URL=http://<factory-service>.<namespace>.svc.cluster.local:4500
MAX_CONCURRENT_PDF_GENERATIONS=15
```

Adjust `MAX_CONCURRENT_PDF_GENERATIONS` based on total cluster capacity (`replicas × (CONCURRENT + QUEUED)`).
