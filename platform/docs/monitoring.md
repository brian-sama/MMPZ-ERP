# Monitoring and Logging

## Tools

- Prometheus
- Grafana
- Netdata

Prometheus starter config:

- `platform/scripts/monitoring/prometheus.yml`

## Log Files

- `logs/app.log`
- `logs/error.log`
- `logs/audit.log`

## Alerting Targets

- API latency
- API error rate
- Queue depth and failed jobs
- WebSocket disconnect spikes
- PostgreSQL connection and query latency
- Redis availability
- Upload and log disk usage
