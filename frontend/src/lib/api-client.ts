import axios from "axios";

const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || "";
const API_URL = RAW_API_URL.replace(/\/$/, ""); // Strip trailing slash if present

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // Send cookies (for refresh token HttpOnly cookies)
});

apiClient.interceptors.request.use(config => {

    if (config.data instanceof FormData) {
        for (const pair of (config.data as any).entries()) {
            console.log(pair[0], pair[1]);
        }
    }
    return config;
});

let accessToken: string | null = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

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

// Add access token and workspace ID to requests automatically
apiClient.interceptors.request.use(
  async (config) => {
    const url = config.url || "";
    const isAuthRoute =
      url.endsWith("/auth/refresh") ||
      url.endsWith("/auth/login") ||
      url.endsWith("/auth/register") ||
      url.endsWith("/users/me");

    // Request Gating: If auth is initializing, queue the request until complete
    if (!isAuthRoute) {
      try {
        const { useAuthStore } = await import("@/store/auth-store");
        const store = useAuthStore.getState();
        if (store.isLoading) {
          console.log("[api-client] Gating request during auth initialization:", url);
          await new Promise<void>((resolve) => {
            const unsubscribe = useAuthStore.subscribe((state) => {
              if (!state.isLoading) {
                unsubscribe();
                resolve();
              }
            });
          });
        }
      } catch (err) {
        console.error("Failed to check auth state during request gating:", err);
      }
    }

    if (accessToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    
    const activeWorkspaceId = localStorage.getItem("active_workspace_id");
    if (activeWorkspaceId) {
      config.headers["X-Workspace-ID"] = activeWorkspaceId;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let refreshPromise: Promise<string | null> | null = null;

// Auto-refresh access token on 401 Unauthorized responses
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    console.log("[api-client] Intercepted error response:", {
      url: originalRequest?.url,
      status: error.response?.status,
      _retry: originalRequest?._retry,
    });

    // Check if error is 401 and not already retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh" &&
      originalRequest.url !== "/auth/login" &&
      originalRequest.url !== "/auth/register"
    ) {
      originalRequest._retry = true;

      if (!refreshPromise) {
        console.log("[api-client] Token refresh initiated...");
        refreshPromise = apiClient
          .post("/auth/refresh")
          .then((response) => {
            const token = response.data.access_token;
            console.log("[api-client] Token refresh succeeded, new token:", token);
            setAccessToken(token);
            refreshPromise = null;
            return token;
          })
          .catch((refreshError) => {
            console.log("[api-client] Token refresh failed:", refreshError.response?.status || refreshError.message);
            setAccessToken(null);
            window.dispatchEvent(new Event("auth-logout"));
            refreshPromise = null;
            throw refreshError;
          });
      } else {
        console.log("[api-client] Token refresh already in progress, awaiting existing promise...");
      }

      return refreshPromise
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    }
    return Promise.reject(error);
  }
);
