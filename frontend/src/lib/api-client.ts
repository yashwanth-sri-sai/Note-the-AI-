import axios from "axios";

const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const API_URL = RAW_API_URL.replace(/\/$/, ""); // Strip trailing slash if present

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // Send cookies (for refresh token HttpOnly cookies)
});

// ─────────────────────────────────────────────────────────────────────────────
// Access token — module-level in-memory value (source of truth).
// localStorage is read once on load as a warm-start optimisation only.
// ─────────────────────────────────────────────────────────────────────────────

let accessToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem("access_token", token);
    } else {
      localStorage.removeItem("access_token");
    }
  }
};

export const getAccessToken = () => accessToken;

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor
// ─────────────────────────────────────────────────────────────────────────────

// Routes that bypass request gating (must be able to fire before authReady is settled).
const UNGATED_ROUTES = new Set([
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
  "/users/me",
]);

// Routes that are excluded from token refresh on 401.
const NON_REFRESHABLE_ROUTES = new Set([
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
]);

const isUngatedRoute = (url: string) =>
  [...UNGATED_ROUTES].some((route) => url.endsWith(route));

const isNonRefreshableRoute = (url: string) =>
  [...NON_REFRESHABLE_ROUTES].some((route) => url.endsWith(route));

apiClient.interceptors.request.use(
  async (config) => {
    const url = config.url || "";

    // ── Request Gating ───────────────────────────────────────────────────────
    // Hold non-auth requests until initAuth() has fully settled (authReady).
    // We gate on authReady (set-once, never reset) — NOT isLoading or
    // isAuthenticated, which toggle during login/logout/refresh cycles and
    // would block legitimate post-login calls or release the gate too early.
    if (!isUngatedRoute(url)) {
      try {
        const { useAuthStore } = await import("@/store/auth-store");
        const store = useAuthStore.getState();
        if (!store.authReady) {
          // Await the first authReady=true transition.
          await new Promise<void>((resolve) => {
            const unsubscribe = useAuthStore.subscribe((state) => {
              if (state.authReady) {
                unsubscribe();
                resolve();
              }
            });
          });
        }
      } catch (err) {
        console.error("[api-client] Failed to gate request on authReady:", err);
      }
    }

    // Attach Bearer token if available and not already set.
    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // Attach active workspace ID header.
    const activeWorkspaceId = localStorage.getItem("active_workspace_id");
    if (activeWorkspaceId) {
      config.headers["X-Workspace-ID"] = activeWorkspaceId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor — single-flight token refresh
//
// Design:
// - ONE refreshPromise at a time (module-level singleton).
// - ALL 401 responses share the same promise and wait for it to resolve.
// - On success: every waiting request is retried with the new token.
// - On failure: logout is dispatched ONCE; all waiting requests reject.
// - Auth routes are excluded from the retry loop to prevent infinite cycles.
// ─────────────────────────────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

// Guard: prevent dispatching auth-logout more than once per failed refresh.
let logoutDispatched = false;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const shouldAttemptRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isNonRefreshableRoute(originalRequest.url ?? "");

    if (!shouldAttemptRefresh) {
      return Promise.reject(error);
    }

    // Mark this request as already retried so we never enter this block again
    // for the same request object, preventing infinite retry loops.
    originalRequest._retry = true;

    // ── Single-flight guard ──────────────────────────────────────────────────
    // If a refresh is already in flight, all callers share that same promise
    // instead of firing duplicate POST /auth/refresh requests.
    if (!refreshPromise) {
      logoutDispatched = false; // Reset for this refresh cycle
      refreshPromise = apiClient
        .post("/auth/refresh")
        .then((response) => {
          const token = response.data.access_token;
          setAccessToken(token);
          refreshPromise = null;
          return token;
        })
        .catch((refreshError) => {
          setAccessToken(null);
          refreshPromise = null;
          // Dispatch logout exactly once, even if many requests fail.
          if (!logoutDispatched) {
            logoutDispatched = true;
            window.dispatchEvent(new Event("auth-logout"));
          }
          throw refreshError;
        });
    }

    // Wait for the single in-flight refresh (whether we started it or not).
    return refreshPromise
      .then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      })
      .catch((err) => Promise.reject(err));
  }
);
