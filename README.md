# Shorty's Inventory

Inventory pilot application for Shorty's Pizza Shack.

This implementation starts the MVP with:
- Mobile-first inventory count workflow.
- Multi-location session support.
- Toast OAuth test endpoint and integration scaffold.
- XtraCHEF health endpoint scaffold.
- Prisma schema for future persistent storage.

## Security First

The Toast credentials currently shared in chat should be treated as exposed. Rotate the client secret in Toast before moving to staging or production.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Prisma ORM
- Zod validation

## Setup

1. Copy .env.example to .env and fill in actual secrets.
2. Install dependencies: npm install
3. Generate Prisma client: npm run prisma:generate
4. Start development server: npm run dev

Open http://localhost:3000

## AWS Free-Tier Deployment

You can deploy this app on a single EC2 free-tier instance using Docker.

Deployment assets included:
- Dockerfile
- docker-compose.ec2.yml
- .env.aws.example
- scripts/aws/bootstrap-ec2.sh
- scripts/aws/deploy-ec2.sh
- deploy/aws-free-tier.md

Start with the full guide in deploy/aws-free-tier.md.

## Git Repository Setup

This project already has a local git history. To connect it to GitHub:

1. Create an empty GitHub repository.
2. Add remote:
	git remote add origin https://github.com/<your-org>/<your-repo>.git
3. Push current branch:
	git push -u origin master

If you prefer main as default branch:

1. git branch -M main
2. git push -u origin main

## Useful Scripts

- npm run dev
- npm run build
- npm run lint
- npm run typecheck
- npm run prisma:generate
- npm run prisma:migrate

## Implemented API Endpoints

- GET /api/health
- GET /api/integrations/toast/token
- GET /api/integrations/xtrachef/health
- GET /api/count/locations
- POST /api/count/sessions
- GET /api/count/sessions/:sessionId
- PATCH /api/count/sessions/:sessionId
- GET /api/count/sessions/:sessionId/export
- GET /api/integrations/toast/sync
- POST /api/integrations/toast/sync
- GET /api/integrations/toast/schedule
- POST /api/integrations/toast/schedule
- GET /api/mappings
- POST /api/mappings

## Notes

- Count sessions and integration catalog now use Prisma-backed pilot models when DATABASE_URL is reachable.
- If the database is unavailable, the app gracefully falls back to in-memory storage to avoid blocking field testing.
- The Prisma schema is ready for migration when you connect a Postgres database.
- Write routes enforce role gates using the x-user-role header during bootstrap (STAFF, MANAGER, OWNER).
