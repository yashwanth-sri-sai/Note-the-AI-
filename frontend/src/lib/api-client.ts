import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  withCredentials: true, // Send cookies (for refresh token HttpOnly cookies)
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
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

    // Check if error is 401 and not already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/refresh" &&
      originalRequest.url !== "/auth/login" &&
      originalRequest.url !== "/auth/register"
    ) {
      originalRequest._retry = true;
      try {
        const response = await apiClient.post("/auth/refresh");
        const token = response.data.access_token;

        setAccessToken(token);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        // Trigger a custom event to notify listeners (like AuthContext) that user is logged out
        window.dispatchEvent(new Event("auth-logout"));
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
