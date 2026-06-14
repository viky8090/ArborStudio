# ArborStudio Container — Python runtime
# Phase 0: hello-world that connects to the Worker and reports status.
# Phase 1+: runs the real `arbor` CLI.

# ---------- Stage 1: builder ----------
FROM python:3.11-slim AS builder

# Build-time deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install Arbor and the runtime deps into a virtual env
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "arbor[all] @ git+https://github.com/RUC-NLPIR/Arbor.git@main" || \
    pip install --no-cache-dir arbor-cli

# ---------- Stage 2: runtime ----------
FROM python:3.11-slim

# Runtime deps: git (for worktree), curl (for healthchecks), tini (for signal handling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    tini \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash runner
WORKDIR /home/runner

# Copy Python deps from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy the runner code
COPY --chown=runner:runner . /home/runner/app/

# Switch to non-root
USER runner
ENV PATH="/home/runner/.local/bin:${PATH}"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /home/runner/app

# Healthcheck (the container exposes no HTTP, so this is a no-op; we use the
# Worker's heartbeat check instead)
HEALTHCHECK NONE

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash", "entrypoint.sh"]
