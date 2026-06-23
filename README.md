# NoteAI - AI-Powered Knowledge Management SaaS (Phase 1)

Welcome to Phase 1 of **NoteAI**, an AI-powered knowledge management system. This phase delivers the complete foundation layer of the SaaS platform.

## Features Built
1. **Security & Authentication**:
   - JWT Access Token (short-lived, JSON response) & Refresh Token (long-lived, secure HttpOnly cookie).
   - Local User Registration & Login (passwords hashed using direct cryptographically-secure `bcrypt`).
   - Google OAuth ID Token validation endpoint.
   - Private endpoints protected using auth middleware.
   - Automatic token-refresh interceptor built into the frontend Axios client.
2. **User Profile Management**:
   - View/update profile (name, local password changes).
   - Avatar image upload (saved locally inside docker container, serving static URL).
   - Account deletion cascade (deletes user, active refresh tokens, and cascading notes/tags).
3. **Folders Module**:
   - Create, list, and delete folders.
   - Deleting a folder sets associated notes' `folder_id` to `NULL` (SET NULL cascade behavior), keeping your notes safe.
4. **Notes Module**:
   - CRUD notes.
   - Debounced autosave (1-second debounce) syncing changes to the backend database with cloud status indicators.
   - Star/Favorite notes toggle.
   - Duplicate note with attached tags.
5. **Tags Module**:
   - Create and delete custom tags with color presets.
   - Attach tags to notes.
6. **Workspace Dashboard & Editor**:
   - Premium responsive layouts (collapsible sidebar, notification menu, profile actions).
   - Split-screen workspace (search notes on the left, editor on the right).
   - Markdown Formatting toolbar (Bold, Italic, Headings, Lists, Code blocks, Tables, Links, Images).
   - Live Markdown HTML Preview toggle.
   - Spotlight Quick Search dialog (`Ctrl+K` or `Cmd+K` global keyboard listener).

---

## Technical Stack
- **Frontend**: Vite, React 18, TypeScript, TailwindCSS, Zustand (UI/Theme state), TanStack Query v5 (Server state), Axios.
- **Backend**: FastAPI, SQLAlchemy 2.0 (Async), Alembic, Uvicorn, Jose JWT, direct bcrypt.
- **Database**: PostgreSQL (ankane/pgvector image ready for future embedding integrations).

---

## Running the Application

### Option A: Using Docker (Recommended)
Make sure Docker Desktop is running on your machine, then run:

```bash
# Build and spin up database & backend services
docker compose up --build
```
- **Backend API**: `http://localhost:8000/api/v1`
- **Interactive Swagger Docs**: `http://localhost:8000/api/v1/docs`
- **PostgreSQL Database**: Port `5432` on host (user `postgres`, password `securepassword`).

Once the backend is running, navigate to the `frontend` folder, install packages, and start the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
- **Frontend SPA Client**: `http://localhost:5173`

---

### Option B: Running Locally (Manual setup without Docker)

#### 1. Backend Setup
1. **Prerequisites**: Python 3.10+ and a local PostgreSQL instance running.
2. Create a virtual environment and install packages:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   ```
3. Create a local `.env` configuration. Copy `.env.example` to `.env` and fill in your local Postgres connection credentials (e.g. `POSTGRES_SERVER="localhost"`).
4. Run Alembic migrations to construct the database schema:
   ```bash
   alembic revision --autogenerate -m "Initial schema layout"
   alembic upgrade head
   ```
5. Launch the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

#### 2. Frontend Setup
1. **Prerequisites**: Node.js v18+ installed.
2. Install packages and start Vite:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

---

## Directory Architecture
```
AI Notes & Knowledge Management SaaS/
├── backend/
│   ├── app/
│   │   ├── api/v1/              # Routing and endpoints (Auth, Users, Folders, Notes, Tags)
│   │   ├── core/                # Configuration, exceptions, direct bcrypt security
│   │   ├── db/                  # Session makers, async engines, SQLAlchemy models
│   │   ├── repositories/        # Async CRUD repository layer
│   │   ├── schemas/             # Pydantic models for validation and responses
│   │   ├── services/            # Main business logic layer
│   │   └── main.py              # FastAPI app bootstrap
│   ├── migrations/              # Alembic database versioning migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI layouts and editor elements
│   │   ├── context/             # AuthContext supplying user state
│   │   ├── hooks/               # Custom React Query server-state hooks
│   │   ├── lib/                 # Axios client, auth-interceptor, utility functions
│   │   ├── pages/               # Page panels (Landing, Login, Register, Dashboard)
│   │   ├── store/               # Zustand UI stores (Theme, active note filters)
│   │   ├── types/               # TypeScript data model interface types
│   │   ├── App.tsx              # Bootstrapper wrapping providers
│   │   └── main.tsx             # Entry script
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
└── docker-compose.yml
```
ZOOM_FACTOR = 1.0  # reference
