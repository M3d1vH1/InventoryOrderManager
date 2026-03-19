# Milestone 09 — CI/CD Pipeline (GitHub Actions)

**Priority:** P2
**Depends on:** Milestone 01 (Docker), Mac Mini SSH key setup
**Blocks:** Nothing

---

## Objective

On every push to `main`, GitHub Actions SSH into the Mac Mini, pulls the latest code, rebuilds the Docker image, and restarts the services with zero downtime (rolling restart).

---

## Prerequisites (Manual Steps)

1. **Generate SSH key on Mac Mini:**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   # Copy the private key for GitHub:
   cat ~/.ssh/github_deploy
   ```

2. **Add secrets to GitHub repo** (`Settings → Secrets and variables → Actions`):
   - `DEPLOY_HOST` — Mac Mini local IP or Tailscale IP (e.g., `192.168.1.100`)
   - `DEPLOY_USER` — Mac Mini username (e.g., `yourname`)
   - `DEPLOY_KEY` — Contents of `~/.ssh/github_deploy` (private key)
   - `DEPLOY_PATH` — Absolute path to repo on Mac Mini (e.g., `/Users/yourname/amphoreus-v2`)

---

## Create `.github/workflows/deploy.yml`

```yaml
# .github/workflows/deploy.yml
name: Deploy to Mac Mini

on:
  push:
    branches:
      - main
  # Allow manual trigger
  workflow_dispatch:

jobs:
  test:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type check
        run: npm run typecheck

  deploy:
    name: Deploy to Mac Mini
    needs: test
    runs-on: ubuntu-latest
    # Only deploy on push to main (not PRs)
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            set -e  # Exit on any error

            echo "🚀 Starting deployment at $(date)"

            # Navigate to project
            cd ${{ secrets.DEPLOY_PATH }}

            # Pull latest code
            echo "📦 Pulling latest code..."
            git pull origin main

            # Build new Docker image
            echo "🔨 Building Docker image..."
            docker compose build app

            # Restart with zero downtime:
            # Start new container, wait for health, stop old container
            echo "🔄 Restarting app container..."
            docker compose up -d --no-deps --build app

            # Wait for health check to pass (max 60 seconds)
            echo "⏳ Waiting for health check..."
            for i in {1..12}; do
              if docker compose exec -T app wget -qO- http://localhost:5000/api/health > /dev/null 2>&1; then
                echo "✅ Health check passed"
                break
              fi
              if [ $i -eq 12 ]; then
                echo "❌ Health check failed after 60s — rolling back"
                docker compose restart app
                exit 1
              fi
              echo "  Waiting... ($((i*5))s)"
              sleep 5
            done

            # Clean up old Docker images (keep last 3)
            echo "🧹 Cleaning up old images..."
            docker image prune -f

            echo "✅ Deployment complete at $(date)"

  notify:
    name: Notify Slack
    needs: deploy
    runs-on: ubuntu-latest
    if: always()

    steps:
      - name: Notify Slack
        if: env.SLACK_WEBHOOK_URL != ''
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          STATUS="${{ needs.deploy.result }}"
          if [ "$STATUS" == "success" ]; then
            COLOR="good"
            EMOJI="✅"
            TEXT="Deployment succeeded"
          else
            COLOR="danger"
            EMOJI="❌"
            TEXT="Deployment FAILED"
          fi

          curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{
              \"attachments\": [{
                \"color\": \"$COLOR\",
                \"text\": \"$EMOJI *Amphoreus V2* $TEXT\",
                \"fields\": [
                  {\"title\": \"Branch\", \"value\": \"${{ github.ref_name }}\", \"short\": true},
                  {\"title\": \"Commit\", \"value\": \"${{ github.sha }}\", \"short\": true},
                  {\"title\": \"Author\", \"value\": \"${{ github.actor }}\", \"short\": true}
                ]
              }]
            }"
```

---

## Mac Mini Setup (One-Time)

```bash
# 1. Install Docker Desktop for Mac (Apple Silicon)
# Download from: https://www.docker.com/products/docker-desktop/

# 2. Enable SSH on Mac Mini
# System Preferences → Sharing → Remote Login → Enable

# 3. Clone the repo
git clone git@github.com:[your-org]/amphoreus-v2.git ~/amphoreus-v2
cd ~/amphoreus-v2

# 4. Create .env.production
cp .env.example .env.production
# Edit with real values

# 5. Create data directories
bash scripts/init-data-dirs.sh

# 6. Initial startup
docker compose --env-file .env.production up -d

# 7. Verify everything is healthy
docker compose ps
```

---

## Verification

```bash
# 1. Push a test commit to main
git commit --allow-empty -m "test: trigger deployment"
git push origin main

# 2. Watch GitHub Actions (Actions tab in GitHub)
# Expected: test job passes, deploy job SSHs in and runs successfully

# 3. Check Mac Mini logs
docker compose logs app --tail=20

# 4. Verify health
curl https://[YOUR_DOMAIN]/api/health
# Expected: {"status":"ok"}
```

---

## Files Created in This Milestone

```
amphoreus-v2/
└── .github/
    └── workflows/
        └── deploy.yml    ← NEW: Push-to-deploy workflow
```
