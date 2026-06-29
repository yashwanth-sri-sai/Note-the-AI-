#!/bin/bash

# Initialize Alembic migrations if not already initialized
if [ ! -d "migrations/versions" ] || [ -z "$(ls -A migrations/versions)" ]; then
    echo "No migrations found. Creating initial migration layout..."
    alembic revision --autogenerate -m "Initial database schema"
fi

echo "Running database migrations..."
alembic upgrade head

echo "Starting FastAPI..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port ${PORT:-8000}
