# Central Auth Commands

## Overview
Holds executable command entrypoints for the `central-auth` Go module.

## Subdirectories & Boundaries
- [api](./api/README.md) - Executable HTTP API server entrypoint (`main`) that runs migrations, opens PostgreSQL, wires internal services, and serves the authentication router.
