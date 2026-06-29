# =========================================================================
# STAGE 1: BUILD STAGE
# =========================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    libmagic1 \
    file \
    && rm -rf /var/lib/apt/lists/*

# Setup virtualenv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt


# =========================================================================
# STAGE 2: RUNTIME STAGE
# =========================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime PostgreSQL client library
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    libmagic1 \
    file \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv dependencies from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application files
COPY . .

# Create a non-privileged system group and user
RUN groupadd -g 10001 appgroup \
    && useradd -u 10001 -g appgroup -m -s /bin/bash appuser

# Set correct folder permissions for runtime static storage and logs
RUN mkdir -p static/avatars \
    && chmod -R 775 static \
    && chown -R appuser:appgroup /app

# Ensure startup scripts are executable
RUN chmod +x start.sh

# Switch execution user to the non-root profile
USER appuser

EXPOSE 8000

# Start command
CMD ["./start.sh"]
