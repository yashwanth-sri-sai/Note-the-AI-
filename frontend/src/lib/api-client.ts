import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  withCredentials: true, // Send cookies (for refresh token HttpOnly cookies)
  headers: {
    "Content-Type": "application/json",
  },
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
  (config) => {
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
      console.log("[api-client] Attempting token refresh...");
      originalRequest._retry = true;
      try {
        const response = await apiClient.post("/auth/refresh");
        const token = response.data.access_token;
        console.log("[api-client] Token refresh succeeded, new token:", token);

        setAccessToken(token);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError: any) {
        console.log("[api-client] Token refresh failed:", refreshError.response?.status || refreshError.message);
        setAccessToken(null);
        // Trigger a custom event to notify listeners (like AuthContext) that user is logged out
        window.dispatchEvent(new Event("auth-logout"));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
