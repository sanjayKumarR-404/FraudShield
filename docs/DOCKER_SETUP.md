# Docker Setup Guide

## Prerequisites
- Docker Desktop installed

## How to Start the Stack
Start the entire sequence of Node, FastAPI, Redis, Postgres and React services using a single command:
```bash
docker compose up --build
```

## How to View Logs
To view logs for all services collaboratively, or for a specific service (like `server` or `ai-engine`):
```bash
docker compose logs -f [service]
```

## How to Stop
To shut down the containers cleanly safely closing background channels:
```bash
docker compose down
```

## How to Reset Database / Clear Data
If you need to tear down containers and wipe persistent data (PostgreSQL/Redis):
```bash
docker compose down -v
```

## How to Rebuild a Single Service
If you edit code in `ai-engine`, you can rebuild and start just that service rapidly without awaiting other rebuilds:
```bash
docker compose up --build [service]
```

## Common Troubleshooting
- **Database migrations failed:** Ensure the database container is fully healthy before the `server` attempts to migrate. This is mostly handled by `depends_on: postgres: service_healthy`.
- **Port conflicts:** If you run into `bind: address already in use`, make sure you don't have existing Postgres, Redis, Client or Node servers running locally on your machine mapped heavily over identical external ports (e.g 5432, 6379, 5000, 80).
