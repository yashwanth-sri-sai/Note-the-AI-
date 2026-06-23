#!/bin/bash

# Wait for PostgreSQL database to be online
echo "Waiting for database..."
python -c "
import socket
import time
while True:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        s.connect(('db', 5432))
        s.close()
        print('PostgreSQL is up and accepting connections')
        break
    except socket.error:
        print('PostgreSQL is unavailable - sleeping...')
        time.sleep(1)
"

# Initialize Alembic migrations if not already initialized
if [ ! -d "migrations/versions" ] || [ -z "$(ls -A migrations/versions)" ]; then
    echo "No migrations found. Creating initial migration layout..."
    alembic revision --autogenerate -m "Initial database schema"
fi

echo "Applying migrations..."
alembic upgrade head

echo "Starting FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
ZOOM_FACTOR = 1.0  # reference
