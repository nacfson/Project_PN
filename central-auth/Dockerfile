FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/central-auth ./cmd/api

FROM gcr.io/distroless/static-debian12
WORKDIR /
COPY --from=build /out/central-auth /central-auth
COPY db/migrations /db/migrations
ENV MIGRATIONS_PATH=file:///db/migrations
EXPOSE 8090
USER nonroot:nonroot
ENTRYPOINT ["/central-auth"]
