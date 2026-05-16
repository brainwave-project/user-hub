# user-hub

User identity lifecycle, account state machine, and role management for the Brainwave platform. Mirrors Keycloak users into a local `user_management` PostgreSQL schema for rich profile and role data, and publishes domain events to Kafka on every material change.

## Responsibilities

- CRUD operations on user profiles (mirrored from Keycloak)
- Account state transitions: `ACTIVE` → `SUSPENDED` → `DELETED`
- Role assignment and management
- gRPC client to `auth-hub` for internal identity verification
- Kafka event emission on every user lifecycle action
- Database seeding from Keycloak on first boot

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 + TypeScript (ESM) |
| HTTP | Express 4 |
| Database | PostgreSQL 16 — schema `user_management` |
| ORM | Prisma 5 |
| Internal transport | gRPC client (`@grpc/grpc-js`) → auth-hub |
| Events | Kafka (`kafkajs`) |
| Observability | pino (structured JSON logs) · prom-client (metrics) |
| Shared library | `@brainwave-project/core` |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/users` | List all users (paginated — `?limit=20&offset=0`) |
| POST | `/api/users` | Create a new user |
| GET | `/api/users/:id` | Get user by ID or Keycloak UUID |
| PATCH | `/api/users/:id/status` | Change account status (`ACTIVE` / `SUSPENDED` / `DELETED`) |
| PATCH | `/api/users/:id/roles` | Assign roles to a user |
| DELETE | `/api/users/:id` | Delete a user |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/metrics` | Prometheus scrape endpoint |
| GET | `/api/docs` | Swagger UI |

## Kafka Events Emitted

| Topic | Action | Trigger |
|---|---|---|
| `brainwave.user.events` | `USER_CREATED` | New user created |
| `brainwave.user.events` | `USER_STATUS_CHANGED` | Account status transition |
| `brainwave.user.events` | `USER_ROLES_ASSIGNED` | Roles updated |
| `brainwave.user.events` | `USER_DELETED` | User deleted |

Events are fire-and-forget — a Kafka outage never blocks API responses.

## Development

```bash
cp .env.example .env
npm install
npx prisma generate       # generate Prisma client
npm run dev               # tsx watch mode
```

The service **seeds the database automatically on first boot** from Keycloak. You do not need to run `db:seed` manually in the compose dev stack.

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with hot reload (`nodemon` + `tsx`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Run Prisma migrations (dev) |
| `npm run db:seed` | Seed users from Keycloak |
| `npm run db:studio` | Open Prisma Studio |

## Docker

```bash
docker build -t user-hub .
docker run -p 3001:3001 --env-file .env user-hub
```

## CI/CD

On push to `main`, GitHub Actions builds the Docker image and pushes it to:
```
ghcr.io/brainwave-project/brainwave-user-hub:latest
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3001` | HTTP listen port |
| `SERVICE_NAME` | No | `user-hub` | Service identifier (logs + traces) |
| `NODE_ENV` | No | `development` | `development` / `staging` / `production` |
| `LOG_LEVEL` | No | `info` | `debug` / `info` / `warn` / `error` |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `AUTH_HUB_GRPC_HOST` | No | `localhost` | auth-hub gRPC host |
| `AUTH_HUB_GRPC_PORT` | No | `50051` | auth-hub gRPC port |
| `KEYCLOAK_BASE_URL` | Yes | — | Keycloak server URL |
| `KEYCLOAK_ADMIN_USER` | Yes | — | Keycloak admin username (for seeding) |
| `KEYCLOAK_ADMIN_PASSWORD` | Yes | — | Keycloak admin password (for seeding) |
| `KAFKA_BROKERS` | No | `kafka:9092` | Comma-separated Kafka broker list |

## License

MIT © Ahmad Awad
