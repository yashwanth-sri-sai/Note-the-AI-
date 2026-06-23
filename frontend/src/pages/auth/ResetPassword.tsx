import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BrainCircuit, Loader2, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long." }),
    confirmPassword: z.string().min(1, { message: "Confirm password is required." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetSchemaType = z.infer<typeof resetSchema>;

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetSchemaType>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetSchemaType) => {
    if (!token) {
      setErrorMsg("Invalid or missing reset token. Try requesting a new link.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await apiClient.post("/auth/reset-password", {
        token,
        new_password: data.password,
      });
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || "Failed to reset password. The link may have expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 transition-colors duration-300 relative">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] rounded-full bg-primary/5 blur-[90px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-indigo-500/5 blur-[90px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-6 glass-panel p-8 rounded-2xl shadow-xl border border-border/80 bg-card">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/20 mb-3">
            <BrainCircuit className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Reset Password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a new, secure password for your account
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-red-500 animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {!token && !isSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-3.5 text-xs text-yellow-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Missing reset token in URL parameters. Please check your link.</span>
          </div>
        )}

        {isSuccess ? (
          <div className="space-y-4 text-center py-4 animate-fadeIn">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Password Reset Complete</h3>
              <p className="text-xs text-muted-foreground">
                Your password has been successfully reset. You can now log in.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white shadow hover:bg-primary/95 transition-all mt-2"
            >
              Log In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground px-0.5">
                New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  disabled={!token}
                  {...register("password")}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors disabled:opacity-50"
                />
              </div>
              {errors.password && (
                <span className="text-[10px] text-red-500 font-medium px-1">
                  {errors.password.message}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground px-0.5">
                Confirm New Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  disabled={!token}
                  {...register("confirmPassword")}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors disabled:opacity-50"
                />
              </div>
              {errors.confirmPassword && (
                <span className="text-[10px] text-red-500 font-medium px-1">
                  {errors.confirmPassword.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reset Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
