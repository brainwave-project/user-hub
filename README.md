# user-hub

User identity lifecycle, account state machine, and role management for the Brainwave platform.

## Responsibilities

- CRUD operations on user profiles
- Account state transitions (active, suspended, deleted)
- Role assignment and management
- Internal gRPC consumer (auth-hub for identity verification)

## Tech Stack

- Node.js 20 + TypeScript + Express
- PostgreSQL + Prisma ORM (schema: `user_management`)
- `@brainwave-project/core` (shared domain types)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List all users (paginated) |
| GET | `/api/users/:id` | Get user by ID or Keycloak UUID |
| PATCH | `/api/users/:id` | Update user profile |
| PATCH | `/api/users/:id/status` | Change account status |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI |

## Development

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Database

```bash
npm run db:migrate   # Run migrations
npm run db:seed      # Seed users from Keycloak
npm run db:studio    # Open Prisma Studio
```

## Docker

```bash
docker build -t user-hub .
docker run -p 3001:3001 --env-file .env user-hub
```

## CI/CD

On push to `main`, GitHub Actions builds and pushes the image to:
```
ghcr.io/brainwave-project/brainwave-user-hub:latest
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default: 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_HUB_GRPC_HOST` | auth-hub gRPC host |
| `AUTH_HUB_GRPC_PORT` | auth-hub gRPC port (default: 50051) |
| `KEYCLOAK_BASE_URL` | Keycloak server URL |
| `KEYCLOAK_ADMIN_USER` | Keycloak admin username |
| `KEYCLOAK_ADMIN_PASSWORD` | Keycloak admin password |
