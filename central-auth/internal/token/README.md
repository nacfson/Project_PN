# Central Auth Token Utilities

## Overview
Cryptographic opaque token generator and SHA-256 hashing utility used across `central-auth` for OAuth state tokens, bearer access/refresh tokens, and session cookies.

## Interface
- `[token.go:Generate]` — Generates 32 random bytes from `crypto/rand` and returns them encoded with `base64.RawURLEncoding`.
- `[token.go:Hash]` — Computes the SHA-256 digest of `value` and returns its lowercase hexadecimal string.

## Invariants
- `Generate` always reads 32 bytes (256 bits) of CSPRNG entropy and emits an unpadded URL-safe base64 string `[token.go:Generate]`.
- `Hash` is deterministic and returns a 64-character lowercase hex-encoded SHA-256 digest `[token.go:Hash]`.

## Side Effects
- Reads 32 bytes from the OS CSPRNG via `crypto/rand.Read` `[token.go:Generate]`.

## Verification
- Run: `cd central-auth && go test ./...`
