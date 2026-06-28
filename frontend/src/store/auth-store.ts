import { create } from "zustand";
import { apiClient, setAccessToken } from "@/lib/api-client";
import { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  updateUser: (data: { name?: string; password?: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start with loading active until verified

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const token = response.data.access_token;
      setAccessToken(token);

      const userResponse = await apiClient.get("/users/me");
      set({
        user: userResponse.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      await apiClient.post("/auth/register", { email, password, name });
      // Log in automatically after registration
      await get().login(email, password);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  googleLogin: async (token) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post("/auth/oauth/google", { token });
      const accessToken = response.data.access_token;
      setAccessToken(accessToken);

      const userResponse = await apiClient.get("/users/me");
      set({
        user: userResponse.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setAccessToken(null);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  updateUser: async (data) => {
    try {
      const response = await apiClient.put("/users/me", data);
      set({ user: response.data });
    } catch (error) {
      throw error;
    }
  },

  uploadAvatar: async (file) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post("/users/me/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      set({ user: response.data });
    } catch (error) {
      throw error;
    }
  },

  initAuth: async () => {
    console.log("[initAuth] started");
    try {
      const userResponse = await apiClient.get("/users/me");
      console.log("[initAuth] /users/me success:", userResponse.data);
      set({
        user: userResponse.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      console.log("[initAuth] /users/me failed:", err);
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

// Listen for token-refresh failure events to sign the user out automatically
if (typeof window !== "undefined") {
  window.addEventListener("auth-logout", () => {
    setAccessToken(null);
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
  });
}
