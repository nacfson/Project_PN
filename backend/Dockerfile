FROM --platform=$BUILDPLATFORM golang:1.26 AS builder
ARG TARGETOS=linux
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
    && GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
    && GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o /out/retranslate-senses ./cmd/retranslate-senses

FROM debian:bookworm-slim AS runtime
# Link this image to the GitHub repo so Actions GITHUB_TOKEN can publish to GHCR.
LABEL org.opencontainers.image.source="https://github.com/nacfson/Project_PN"
LABEL org.opencontainers.image.description="Project PN backend API"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --home-dir /app --shell /usr/sbin/nologin app
WORKDIR /app
COPY --from=builder --chown=10001:10001 /out/api /out/migrate /out/retranslate-senses ./
COPY --chown=10001:10001 db/migrations ./db/migrations
ENV APP_ADDR=:8080
EXPOSE 8080
USER 10001:10001
CMD ["./api"]
