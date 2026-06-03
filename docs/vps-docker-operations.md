# VPS Docker operations

Day-to-day commands for the production server at `/opt/erp`: checking what is running, stopping the stack completely, and fixing common Compose mistakes.

**Deploy from scratch:** [cloud-deployment.md](./cloud-deployment.md) · **Rebuild after `git pull`:** [scripts/docker-rebuild-prod.sh](../scripts/docker-rebuild-prod.sh)

---

## Compose project and config files

On the VPS, the stack is usually project **`erp`**, started from the repo root:

| What you see | Meaning |
|--------------|---------|
| `docker compose ls` → `erp` · `running(6)` · `/opt/erp/docker-compose.yml` | Six containers are up for project `erp` |
| Root [docker-compose.yml](../docker-compose.yml) | Includes [infra/docker/docker-compose.yml](../infra/docker/docker-compose.yml) and loads `/opt/erp/.env` |

**Production overlays** (recommended on a VPS — no host ports on Postgres/Redis/MinIO; web/api on localhost for host nginx):

```bash
cd /opt/erp
COMPOSE="-f infra/docker/docker-compose.yml -f infra/docker/docker-compose.prod.yml -f infra/docker/docker-compose.prod-host-nginx.yml"
```

Use the **same** `$COMPOSE` (or the same root `docker-compose.yml`) for `up`, `ps`, `logs`, and `down`. Mixing commands started with different `-f` lists can leave containers running while `down` appears to do nothing.

**Wrong project name:** If you run compose with only `-f infra/docker/docker-compose.yml` from `/opt/erp`, Docker may register a second project (often named `docker`). Check with `docker compose ls` and stop both projects if needed.

---

## Inspecting what is running

Always work from the repo root on the server:

```bash
cd /opt/erp
```

| Command | Use when |
|---------|----------|
| `docker compose ls` | List all Compose projects on the host |
| `docker compose ps -a` | Services for **current** directory + default compose file |
| `docker compose $COMPOSE ps -a` | Services when using prod overlay files |
| `docker ps --filter "label=com.docker.compose.project=erp"` | Containers for project `erp` regardless of cwd |
| `curl -s http://127.0.0.1:3001/api/health` | API up (host-nginx layout) |
| `sudo ss -tlnp \| grep -E ':80|:443|:3000|:3001'` | What is listening on the host |

### `docker compose ps` is empty but `docker compose ls` shows `running(6)`

Common causes:

1. **Wrong directory** — run `cd /opt/erp` before `docker compose ps`.
2. **Different project** — `ps` only shows the project for the current compose invocation; `ls` shows all projects (e.g. `erp` vs `docker`).
3. **Different machine** — your laptop may have no `erp` project while the VPS still has `running(6)`.

### Domain still works after `docker compose ps` looks empty

On the **VPS**, containers for project `erp` may still be running (see `docker compose ls`).

Additionally:

- **Host nginx** (certbot) proxies to `127.0.0.1:3000` / `3001` — stopping only the `nginx` *container* does not stop public HTTPS if system nginx is active.
- **Another process** on a dev machine (local `node` / `next-server` on 3000/3001) is unrelated to production but can confuse local checks.

---

## Stop the application completely (VPS)

“Completely stopped” means: no `erp` containers running, and (if you use it) host nginx not serving the app.

### 1. Stop Docker (project `erp`)

**If you started from the root file** (matches `docker compose ls` showing `/opt/erp/docker-compose.yml`):

```bash
cd /opt/erp
docker compose -p erp -f /opt/erp/docker-compose.yml down --remove-orphans
```

**If you use prod + host-nginx overlays** (same as [docker-rebuild-prod.sh](../scripts/docker-rebuild-prod.sh)):

```bash
cd /opt/erp
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.prod.yml \
  -f infra/docker/docker-compose.prod-host-nginx.yml \
  down --remove-orphans
```

Verify:

```bash
docker compose ls
docker ps --filter "label=com.docker.compose.project=erp"
```

`erp` should show no running containers (or disappear from `ls`).

### 2. If `down` does not remove containers

Force-remove containers labeled with project `erp`:

```bash
docker ps -q --filter "label=com.docker.compose.project=erp" | xargs -r docker stop
docker ps -aq --filter "label=com.docker.compose.project=erp" | xargs -r docker rm -f
```

Then run `docker compose … down --remove-orphans` again from `/opt/erp`.

Check for a second project (e.g. `docker`):

```bash
docker compose ls
docker ps -a
```

Stop it with the same `-f` files you used when starting that stack.

### 3. Stop host nginx (certbot / system nginx)

Compose `down` does **not** stop system nginx:

```bash
sudo systemctl stop nginx
# optional — prevent start on reboot:
# sudo systemctl disable nginx
```

### 4. Confirm from outside

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.yourdomain.com/api/health
```

Expect connection failure, timeout, or 502/503 — not `200` with `{"status":"ok"}`.

### 5. Optional — delete data volumes

Only if you want to wipe Postgres and MinIO data (not required to take the site offline):

```bash
cd /opt/erp
docker compose -p erp -f /opt/erp/docker-compose.yml down -v --remove-orphans
```

---

## Start again after a full stop

**Host nginx** (prod overlay, no compose `nginx` service):

```bash
cd /opt/erp
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.prod.yml \
  -f infra/docker/docker-compose.prod-host-nginx.yml \
  up -d postgres redis minio

docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.prod.yml \
  -f infra/docker/docker-compose.prod-host-nginx.yml \
  up -d api web

sudo systemctl start nginx
```

**Or** rebuild and recreate after `git pull`:

```bash
cd /opt/erp
./scripts/docker-rebuild-prod.sh all
```

**Docker nginx** (compose service owns 80/443): omit `docker-compose.prod-host-nginx.yml`, stop host nginx first, and include `nginx` in `up` — see [cloud-deployment.md § Step 8](./cloud-deployment.md#step-8--start-application-services).

---

## Command mistakes (Linux VPS)

| Mistake | Fix |
|---------|-----|
| `open /opt/erp/ ...` | `open` is a macOS GUI command; on Linux use `cd /opt/erp` and `docker compose …` |
| Space in path: `/opt/erp/ infra/docker/...` | No space after `/opt/erp/`; use relative paths after `cd /opt/erp` |
| `-f` files without `cd /opt/erp` | Paths like `infra/docker/docker-compose.yml` are relative to the repo root |
| `no such file or directory` for compose files | Run `ls -la /opt/erp/infra/docker/`; if missing, `cd /opt/erp && git pull` or re-clone |
| `docker compose down` from `$HOME` | Always `cd /opt/erp` (or pass `-p erp -f /opt/erp/docker-compose.yml`) |

---

## Auto-restart after `down`

If containers return on their own, check:

```bash
systemctl list-units --type=service | grep -iE 'erp|docker|compose'
crontab -l
sudo ls /etc/cron.d/
```

Disable any cron or systemd unit that runs `docker compose up -d` until you intend to run the app again.

---

## Related docs

- [cloud-deployment.md](./cloud-deployment.md) — full deploy, TLS, troubleshooting table
- [production-smoke-runbook.md](./production-smoke-runbook.md) — post-deploy checks
- [smoke-local.md](./smoke-local.md) — local stack; `docker compose down -v` for dev data reset
