# Backend Deployment (Legacy Modal Setup)

> **Note:** The backend deployment has been migrated from Modal to an **Azure VM** containerized with **Docker**.
>
> All production backend deployment files, Dockerfile, docker-compose.yml, and FastAPI server implementation are now located in [`/demo`](../demo).

### Quick Azure VM Deployment Reference:
```bash
cd demo
docker compose up -d --build
```
