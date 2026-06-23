import React, { useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { User, Camera, Trash2, Key, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";

export const SettingsPage: React.FC = () => {
  const { user, updateUser, uploadAvatar, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [name, setName] = useState(user?.name || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg("Name cannot be empty.");
      return;
    }

    if (password) {
      if (password.length < 8) {
        setErrorMsg("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match.");
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateUser({
        name,
        ...(password ? { password } : {}),
      });
      setSuccessMsg("Profile updated successfully!");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      await uploadAvatar(file);
    } catch (err) {
      alert("Failed to upload avatar image.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const { apiClient } = await import("@/lib/api-client");
      await apiClient.delete("/users/me");
      await logout();
    } catch (err) {
      alert("Failed to delete account.");
      setIsDeleting(false);
    }
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10 text-left">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your account profile, avatar, security settings, and data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar Display card */}
        <div className="md:col-span-1 clay-panel p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            <div className="h-28 w-28 rounded-full overflow-hidden border-2 border-border/80 group-hover:border-primary/60 transition-colors flex items-center justify-center bg-muted">
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : user?.avatar_url ? (
                <img
                  src={
                    user.avatar_url.startsWith("http")
                      ? user.avatar_url
                      : `http://localhost:8000${user.avatar_url}`
                  }
                  alt={user.name || "User avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />

          <div>
            <h3 className="font-bold text-sm">{user?.name || "No Name"}</h3>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="w-full border-t border-border/20 pt-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-semibold">Provider:</span>
              <span className="font-bold capitalize text-primary">
                {user?.provider}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-semibold">Joined:</span>
              <span className="font-bold">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Update details form */}
        <div className="md:col-span-2 space-y-6">
          {/* Settings form */}
          <div className="clay-panel p-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Profile Settings
            </h2>

            {errorMsg && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-500 font-semibold">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 rounded-xl bg-green-500/10 border border-green-500/20 p-3 text-xs text-green-500 font-semibold">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full py-2.5 px-3.5 text-xs outline-none clay-input"
                />
              </div>

              {user?.provider === "local" ? (
                <>
                  <div className="border-t border-border/20 pt-4 mt-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5" /> Change Password
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full py-2.5 px-3.5 text-xs outline-none clay-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full py-2.5 px-3.5 text-xs outline-none clay-input"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground flex gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
                  <span>
                    Your account is authenticated via Google. Password updates are managed directly through Google Settings.
                  </span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 clay-btn-primary px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="clay-panel border-red-500/20 p-6 space-y-4 bg-red-500/[0.01]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Danger Zone
            </h2>
            <p className="text-xs text-muted-foreground">
              Permanently delete your account and remove all notes, folders, and settings from NoteAI. This action is irreversible.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-red-500/20 rounded-xl p-4 bg-red-500/[0.03]">
              <div className="flex gap-2.5 text-left">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <h4 className="font-bold text-xs text-red-500">Delete Account</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    All note contents and metadata will be permanently deleted.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-all shadow-md shadow-red-500/10 disabled:opacity-50"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 inline" />
                ) : null}
                {deleteConfirm ? "Confirm Delete Account" : "Delete Account"}
              </button>
            </div>
            {deleteConfirm && (
              <p className="text-[10px] text-red-400 font-semibold px-2 animate-pulse">
                ⚠️ Click "Confirm Delete Account" to permanently delete your data.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
