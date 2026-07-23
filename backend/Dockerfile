FROM golang:1.26 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api
RUN go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate
RUN go build -trimpath -ldflags="-s -w" -o /out/retranslate-senses ./cmd/retranslate-senses

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /out/api /out/migrate /out/retranslate-senses ./
COPY db/migrations ./db/migrations
ENV APP_ADDR=:8080
EXPOSE 8080
CMD ["./api"]
