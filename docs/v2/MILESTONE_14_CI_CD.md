# Milestone 14 — CI/CD Pipeline

| Field | Value |
|-------|-------|
| **Step** | 14 of 25 |
| **Priority** | P2 |
| **Depends on** | Step 1 |
| **Estimated effort** | 1 day |

---

## Goal

Set up GitHub Actions for continuous integration (lint, typecheck, test, build on every push) and continuous deployment (SSH into Mac Mini, pull latest image, restart containers on merge to `main`). The pipeline ensures nothing reaches production without passing all checks.

---

## Implementation

### 1. CI Workflow — `.github/workflows/ci.yml`

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-type:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint-and-type

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: amphoreus_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://test:test@localhost:5432/amphoreus_test
      REDIS_URL: redis://localhost:6379
      NODE_ENV: test

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run db:push  # Apply schema to test DB
      - run: npm test

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: lint-and-type
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
          retention-days: 7

  docker:
    name: Docker Build
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: docker build -t amphoreus-v2:${{ github.sha }} .

      - name: Tag as latest
        run: docker tag amphoreus-v2:${{ github.sha }} amphoreus-v2:latest
```

### 2. CD Workflow — `.github/workflows/deploy.yml`

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    name: Deploy to Mac Mini
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /opt/amphoreus-v2
            git pull origin main
            docker compose build --no-cache app
            docker compose up -d app
            docker compose exec app npm run db:migrate
            docker image prune -f
            echo "Deployed $(git rev-parse --short HEAD) at $(date)"

      - name: Health check
        run: |
          sleep 10
          curl -sf https://${{ secrets.APP_DOMAIN }}/api/health || exit 1

      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v2
        with:
          webhook: ${{ secrets.SLACK_WEBHOOK }}
          webhook-type: incoming-webhook
          payload: |
            {
              "text": "${{ job.status == 'success' && '✅' || '❌' }} Deploy ${{ job.status }}: amphoreus-v2 @ ${{ github.sha }}"
            }
```

### 3. Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "lint": "eslint src/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 4. Health Check Endpoint

```ts
// Already in src/server/index.ts from Milestone 03
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
    uptime: process.uptime(),
  });
});
```

---

## GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `DEPLOY_HOST` | Mac Mini IP or hostname (via Cloudflare Tunnel) |
| `DEPLOY_USER` | SSH user on Mac Mini |
| `DEPLOY_SSH_KEY` | Private key for SSH access |
| `APP_DOMAIN` | Production domain (e.g., `app.amphoreus.com`) |
| `SLACK_WEBHOOK` | Slack incoming webhook URL for deploy notifications |

---

## Files to Create

| Path | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | CI pipeline: lint, typecheck, test, build, Docker build |
| `.github/workflows/deploy.yml` | CD pipeline: SSH deploy to Mac Mini on main merge |
| `vitest.config.ts` | Vitest configuration (if not already from Step 1) |

---

## Verification

1. **CI on push** — push to a feature branch, confirm lint + typecheck + test + build all run.
2. **CI on PR** — open a PR to main, confirm status checks appear.
3. **Test with services** — confirm tests run against ephemeral PostgreSQL and Redis in CI.
4. **Build artifact** — confirm `dist/` is uploaded as an artifact.
5. **Docker build** — merge to main, confirm Docker image is built.
6. **Deploy trigger** — after CI succeeds on main, confirm deploy workflow triggers.
7. **SSH deploy** — confirm the deploy script pulls, builds, and restarts the container.
8. **Health check** — confirm the post-deploy health check hits `/api/health` successfully.
9. **Slack notification** — confirm deploy success/failure messages appear in Slack.
10. **Concurrency** — push twice quickly, confirm the first CI run is cancelled.

---

## Definition of Done

- [ ] CI runs lint, typecheck, test, and build on every push and PR
- [ ] Tests run against real PostgreSQL and Redis service containers
- [ ] Docker image is built on main branch merges
- [ ] CD deploys to Mac Mini via SSH after successful CI on main
- [ ] Post-deploy health check validates the application is running
- [ ] Deploy notifications sent to Slack
- [ ] CI concurrency cancels in-progress runs on new pushes
- [ ] Build artifacts are retained for 7 days
- [ ] All required GitHub secrets are documented
