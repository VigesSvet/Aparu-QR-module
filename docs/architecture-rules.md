# Architecture Rules

## Goals
- Build a scalable QR taxi-ordering web client with a clean migration path from demo mocks to production React + FastAPI + PostgreSQL.
- Keep the first version thin, explicit, and easy to replace piece by piece.
- Isolate external integrations so APARU Maps API stays mandatory but swappable behind stable interfaces if backend orchestration expands.

## Constraints
- Frontend stack: React + TypeScript.
- Use APARU Maps API artifacts from provided documentation and collection.
- Preserve mobile-first UX and keep the booking flow linear.
- Prefer explicit modules and service boundaries over framework magic.

## Preferred patterns
- Feature-oriented frontend structure layered over shared UI and infrastructure modules.
- Separate `entities`, `features`, `shared`, and `pages/app routes` concerns where useful, without over-splitting tiny code.
- Keep all network access in `lib/services` and typed adapters.
- Put validation close to the form flow, but keep reusable parsing/formatting in shared utilities.
- Prepare backend-oriented contracts/types in a way that can later map to FastAPI DTOs and PostgreSQL-backed domain models.

## Avoid
- hidden magic
- overengineering without need
- tight coupling without reason
- scattering API calls directly inside view components
- locking business flow into mock implementations without adapter seams

## Directory / module boundaries
- `app/`: route entrypoints and screen composition.
- `components/`: shared presentational building blocks.
- `hooks/`: reusable React hooks only when they remove real duplication.
- `lib/`: services, API clients, validation helpers, route parsing, domain mappers, mocks.
- `public/`: static assets including APARU logo.
- `docs/`: project rules and architecture notes.
- `integrations/aparu-maps/`: copied source artifacts from desktop for traceability.

## State management rules
- Start with local component state and small custom hooks.
- Introduce global state only for cross-flow data that actually spans screens (ride draft, verification state, ride status).
- Keep server/integration state behind service functions; do not fuse transport details with components.

## API rules
- APARU Maps API is mandatory for map/geocode/route-related flows.
- Frontend must talk through small typed client functions.
- Keep `baseUrl` and `apiKey` configurable through environment variables.
- Mock SMS and order services behind interfaces that can later be replaced by FastAPI endpoints.

## Testing rules
- Minimum: typecheck + build must pass.
- Add focused tests for parsing/validation helpers if they become non-trivial.
- Do not block progress on broad test infra before the first working flow exists.
