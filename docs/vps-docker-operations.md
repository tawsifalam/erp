# VPS Docker operations

Day-to-day commands for the production server at `/opt/erp`: inspect the stack, stop it completely, and fix common Compose mistakes.

**Deploy from scratch:** `./scripts/deploy-prod.sh initial` · **Update:** `./scripts/deploy-prod.sh update` · [cloud-deployment.md](./cloud-deployment.md)

---

## Compose project and config files

Production uses **host nginx** on 80/443 and **five** Docker services: `postgres`, `redis`, `minio`, `api`, `web`.

| What you see | Meaning |
|--------------|---------|
| `docker compose ls` → `erp` · `running(5)` · `/opt/erp/docker-compose.yml` | Five app/data containers (no compose `nginx`) |
| Root [docker-compose.yml](../docker-compose.yml) | Includes [infra/docker/docker-compose.yml](../infra/docker/docker-compose.yml) |

**Standard `COMPOSE` array** (use for `up`, `ps`, `logs`, `exec`, `down`, `build`):

```bash
cd /opt/erp
COMPOSE=(
  --env-file /opt/erp/.env
  -f /opt/erp/docker-compose.yml
  -f /opt/erp/infra/docker/docker-compose.prod.yml
  -f /opt/erp/infra/docker/docker-compose.prod-host-nginx.yml
)
```

[scripts/lib/compose-prod.sh](../scripts/lib/compose-prod.sh) defines the same files for all deploy scripts. Mixing different `-f` / `--env-file` lists can leave containers running while `down` appears to do nothing.

**Wrong project name:** `docker compose -f infra/docker/docker-compose.yml` alone (no root file, no `--env-file`) may register project `docker` instead of `erp`. Use the `COMPOSE` array above.

---

## Inspecting what is running

```bash
cd /opt/erp
```

| Command | Use when |
|---------|----------|
| `docker compose ls` | All Compose projects on the host |
| `docker compose "${COMPOSE[@]}" ps -a` | This stack’s services |
| `docker ps --filter "label=com.docker.compose.project=erp"` | Containers for project `erp` |
| `curl -s http://127.0.0.1:3001/api/health` | API reachable (host-nginx layout) |
| `sudo ss -tlnp \| grep -E ':80|:443|:3000|:3001'` | Host nginx + app bindings |

### `docker compose ps` is empty but `docker compose ls` shows `running(5)`

1. **Wrong directory** — `cd /opt/erp` and use `"${COMPOSE[@]}"`.
2. **Different project** — `ps` without `COMPOSE` may target another project.
3. **Different machine** — laptop vs VPS.

### Domain still works after `compose ps` looks empty

On the VPS, project `erp` may still be running. **Host nginx** (systemd) can still answer HTTPS even when api/web containers are stopped (502) or when you are checking the wrong machine.

---

## Stop the application completely (VPS)

“Stopped” = no `erp` containers **and** (if desired) host nginx not serving the app.

### 1. Stop Docker (project `erp`)

```bash
cd /opt/erp
docker compose "${COMPOSE[@]}" down --remove-orphans
```

Or explicitly:

```bash
docker compose -p erp "${COMPOSE[@]}" down --remove-orphans
```

Verify:

```bash
docker compose ls
docker ps --filter "label=com.docker.compose.project=erp"
```

### 2. If `down` does not remove containers

```bash
docker ps -q --filter "label=com.docker.compose.project=erp" | xargs -r docker stop
docker ps -aq --filter "label=com.docker.compose.project=erp" | xargs -r docker rm -f
docker compose "${COMPOSE[@]}" down --remove-orphans
```

Check for a second project (e.g. `docker`) in `docker compose ls`.

### 3. Stop host nginx

```bash
sudo systemctl stop nginx
# optional: sudo systemctl disable nginx
```

Compose `down` does **not** stop systemd nginx.

### 4. Confirm from outside

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.yourdomain.com/api/health
```

Expect failure, timeout, or 502/503 — not `200` with `{"status":"ok"}`.

### 5. Optional — delete data volumes

```bash
docker compose "${COMPOSE[@]}" down -v --remove-orphans
```

Wipes Postgres and MinIO data.

**Automated clean reset** (stops stack, wipes volumes, `migrate deploy`, health check):

```bash
cd /opt/erp
./scripts/deploy-prod.sh reset          # prompts: type RESET
./scripts/deploy-prod.sh reset --yes    # non-interactive
./scripts/deploy-prod.sh reset --db-only   # Postgres only, keep Redis/MinIO
./scripts/deploy-prod.sh reset --seed      # demo data (staging only)
```

---

## Start again after a full stop

```bash
cd /opt/erp
docker compose "${COMPOSE[@]}" up -d postgres redis minio
docker compose "${COMPOSE[@]}" up -d api web
sudo systemctl start nginx
```

After `git pull`:

```bash
./scripts/deploy-prod.sh update
```

---

## Command mistakes (Linux VPS)

| Mistake | Fix |
|---------|-----|
| `open /opt/erp/ ...` | macOS only; use `cd /opt/erp` |
| Space in path: `/opt/erp/ infra/...` | No space after `/opt/erp/` |
| `down` from `$HOME` | `cd /opt/erp` and use `"${COMPOSE[@]}"` |
| Missing `--env-file` | Add `--env-file /opt/erp/.env` |
| Starting compose `nginx` on VPS | Use host nginx; see [cloud-deployment.md § Step 9](./cloud-deployment.md#step-9--host-nginx-and-tls) |
| `sites-available/erp: No such file` | Run `sudo apt install -y nginx` first |
| Public site down after `reset` | `./scripts/deploy-prod.sh health`; `sudo systemctl start nginx` |

---

## Auto-restart after `down`

```bash
systemctl list-units --type=service | grep -iE 'erp|docker|compose'
crontab -l
sudo ls /etc/cron.d/
```

Disable cron/systemd that runs `docker compose up -d` until you want the app back.

---

## Related docs

- [cloud-deployment.md](./cloud-deployment.md)
- [production-smoke-runbook.md](./production-smoke-runbook.md)
- [smoke-local.md](./smoke-local.md)
