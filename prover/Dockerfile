# Build Mysten's zkLogin prover from source in a reproducible way.
#
# Why source-build?
# - Hosted prover endpoints are unreachable in some regions/DNS setups.
# - Public prebuilt images aren’t always available/stable.
#
# This Dockerfile intentionally pins a repo + ref via build args.

FROM rust:1.78-bullseye AS builder

ARG ZKLOGIN_PROVER_REPO=https://github.com/MystenLabs/zklogin-prover.git
ARG ZKLOGIN_PROVER_REF=main

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates pkg-config libssl-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone and checkout the requested ref
RUN git clone --depth 1 ${ZKLOGIN_PROVER_REPO} zklogin-prover
WORKDIR /build/zklogin-prover
RUN git fetch --depth 1 origin ${ZKLOGIN_PROVER_REF} && git checkout ${ZKLOGIN_PROVER_REF}

# Build a release binary
RUN cargo build --release


FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The prover binary name can vary by repo; we copy the whole release dir and run via entrypoint script.
COPY --from=builder /build/zklogin-prover/target/release/ /app/bin/

# Simple entrypoint that finds an executable (preferring `zklogin-prover` if present)
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]
