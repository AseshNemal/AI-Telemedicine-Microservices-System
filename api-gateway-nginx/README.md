# NGINX API Gateway

A production-ready reverse proxy and API Gateway built with NGINX that routes all microservices through a single entry point.

## Features

- **Single Entry Point**: Access all services via `http://localhost` (port 80)
- **Routing**: Intelligent routing to all microservices (Auth, Patient, Doctor, Appointment, Notification)
- **Rate Limiting**: Built-in rate limiting (10 req/s per IP, bursts up to 20)
- **Load Balancing**: Least connections algorithm with connection pooling
- **Compression**: Gzip compression for faster response times
- **Health Checks**: Self-healing with automatic upstream failover
- **Security**: Proper headers, HTTPS ready, DDoS mitigation
- **Logging**: Full request/response logging for debugging
- **Monitoring**: Liveness and readiness probes for Kubernetes

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway (NGINX)                   │
│                   port 80 / port 443                    │
├────────┬──────────┬──────────┬──────────┬───────────────┤
│        │          │          │          │               │
│   Auth │ Patient  │ Doctor   │Appointment│ Notification │
│   5001 │  5002    │  8082    │   8083   │    8084      │
└────────┴──────────┴──────────┴──────────┴───────────────┘
```

## Local Development (Docker Compose)

### Running the Full Stack

From the `deployments/` directory:

```bash
cd deployments
docker compose up --build
```

This starts:
- NGINX API Gateway on `http://localhost` (port 80)
- Auth Service on `http://localhost/api/auth` (via gateway)
- Patient Service on `http://localhost/api/patients` (via gateway)
- Doctor Service on `http://localhost/doctors` (via gateway)
- Appointment Service on `http://localhost/appointments` (via gateway)
- Notification Service on `http://localhost/send-email` & `/send-sms` (via gateway)
- Next.js Frontend on `http://localhost:3000`
- MongoDB instances for Auth and Patient services

### Health Checks

```bash
# Gateway health
curl http://localhost/health

# Auth service (via gateway)
curl http://localhost/api/auth/health

# Patient service (via gateway)
curl http://localhost/api/patients/health

# Direct service checks
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:8082/health
curl http://localhost:8083/health
curl http://localhost:8084/health
```

### API Documentation

Open `http://localhost/api-docs` to view Swagger documentation (proxied from Auth Service).

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.25+)
- kubectl configured

### Deploy

```bash
# Apply gateway manifests
kubectl apply -f deployments/kubernetes/api-gateway-deployment.yaml
kubectl apply -f deployments/kubernetes/api-gateway-service.yaml

# Verify pods are running
kubectl get pods -l app=api-gateway
kubectl get svc api-gateway-nginx
```

### Access

```bash
# Get external IP (may take a minute for LoadBalancer)
kubectl get svc api-gateway-nginx

# Once external IP is available:
curl http://<EXTERNAL-IP>/health
```

## Configuration

### Routing Rules (docker-compose)

The gateway routes incoming requests:

| **Path** | **Service** | **Port** |
|----------|-------------|---------|
| `/api/auth/...` | auth-service-node | 5001 |
| `/api/patients/...` | patient-service-node | 5002 |
| `/doctors/...` | doctor-service | 8082 |
| `/doctor/...` | doctor-service | 8082 |
| `/appointments/...` | appointment-service | 8083 |
| `/send-email/...` | notification-service | 8084 |
| `/send-sms/...` | notification-service | 8084 |
| `/health` | Gateway's own health | N/A |

### Modifying Routes

Edit `api-gateway-nginx/nginx.conf`:

```nginx
location ~ ^/your-path/?(.*)$ {
    limit_req zone=api_limit burst=20 nodelay;
    
    proxy_pass http://upstream_service/$1$is_args$args;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

Then rebuild with `docker compose up --build`.

## Rate Limiting

- **Default**: 10 requests/second per IP
- **Burst**: Up to 20 requests allowed
- **Status Code**: 429 (Too Many Requests) when exceeded

To adjust, edit `nginx.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
```

Change `rate=10r/s` to your desired value (e.g., `rate=50r/s`).

## Logging

### Docker Compose

```bash
# View gateway logs
docker compose logs -f api-gateway

# View all logs
docker compose logs -f
```

### Kubernetes

```bash
# View gateway logs
kubectl logs -l app=api-gateway -f

# View specific pod logs
kubectl logs pod/api-gateway-nginx-<pod-id> -f
```

## Load Balancing

The gateway uses **least connections** algorithm:

```nginx
upstream service_name {
    least_conn;
    server service1:port max_fails=3 fail_timeout=30s;
    server service2:port max_fails=3 fail_timeout=30s;
}
```

- Services are marked down after 3 consecutive failures
- Down services are retried every 30s
- Connections are routed to service with fewest active connections

## Performance Tuning

### For High Traffic

1. **Increase worker processes** (api-gateway-nginx/nginx.conf):
   ```nginx
   worker_processes auto;  # Uses all available CPUs
   ```

2. **Increase worker connections**:
   ```nginx
   events {
       worker_connections 4096;  # Default is 1024
   }
   ```

3. **Enable caching** (for static/cacheable responses):
   ```nginx
   proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
   location ~ ^/api/patients/?(.*)$ {
       proxy_cache api_cache;
       proxy_cache_valid 200 1m;
       add_header X-Cache-Status $upstream_cache_status;
       ...
   }
   ```

## Security Considerations

1. **HTTPS/TLS**: Deploy with TLS termination (use Let's Encrypt for production)
2. **CORS**: Configure CORS headers as needed
3. **WAF**: Consider adding ModSecurity for advanced protection
4. **DDoS**: Rate limiting and connection limits are configured
5. **Access Control**: Add IP whitelisting if needed

Example HTTPS redirect:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    # ... rest of config
}
```

## Troubleshooting

### 502 Bad Gateway

- Check upstream service is running
- Verify service port is correct in upstream definition
- Check service logs: `docker compose logs auth-service-node`

### Connection Timeout

- Increase `proxy_connect_timeout`, `proxy_send_timeout`, `proxy_read_timeout`
- Check network connectivity between gateway and upstream
- Verify firewall rules allow traffic on service ports

### High Latency

- Check API Gateway logs for slow requests
- Increase worker processes if CPU is bottlenecked
- Consider adding caching for frequently accessed endpoints
- Profile upstream services

### Rate Limiting Issues

- Check if legitimate traffic is being rate-limited
- Adjust burst or rate in `limit_req_zone`
- Use different zones for different endpoints if needed

## Monitoring

### Metrics to Watch

- **Request Rate**: Requests per second served
- **Response Time**: p50, p95, p99 latencies
- **Error Rate**: 4xx, 5xx responses
- **Upstream Health**: Number of healthy vs down services
- **Connection Pool**: Active/idle connections to upstreams

### Tools

- **Prometheus**: Scrape NGINX metrics via `vts` module
- **Grafana**: Visualize metrics
- **ELK Stack**: Centralize logs from NGINX
- **Jaeger**: Distributed tracing (add via headers)

## Development

### Testing Locally

```bash
# Test a specific endpoint
curl -v http://localhost/api/auth/health

# Test with custom header
curl -H "Authorization: Bearer token" http://localhost/api/patients/me

# Test with rate limiting
for i in {1..30}; do curl http://localhost/health; done

# Monitor gateway in real-time
docker compose logs -f api-gateway | grep "POST\|GET\|PUT\|DELETE"
```

### Rebuilding Configuration

After editing `nginx.conf`:

```bash
docker compose up --build api-gateway
```

Or reload without rebuild:

```bash
docker compose exec api-gateway nginx -s reload
```

## Production Deployment

### Key Steps

1. Use a managed load balancer (ALB, NLB, etc.) in front of gateway
2. Enable TLS/SSL with valid certificates
3. Set up monitoring and alerting
4. Configure log aggregation (CloudWatch, Splunk, etc.)
5. Use autoscaling for gateway replicas
6. Set resource limits and requests appropriately
7. Implement circuit breakers for downstream services
8. Enable WAF rules on load balancer
9. Regular security scanning and updates

### Example Kubernetes Production Config

```yaml
# Replace LoadBalancer with ClusterIP for internal gateway
# Use Ingress with TLS termination instead
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: tls-cert
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway-nginx
            port:
              number: 80
```

---

**Need Help?** Check logs, verify service connectivity, and ensure `.env` configurations are correct.
