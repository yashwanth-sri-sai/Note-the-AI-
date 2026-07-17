import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BrainCircuit, Mail, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Loader } from "../../components/ui/Loader";
import { apiClient } from "@/lib/api-client";
import { Logo } from "@/components/common/Logo";

const forgotSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

type ForgotSchemaType = z.infer<typeof forgotSchema>;

export const ForgotPassword: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotSchemaType>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotSchemaType) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await apiClient.post("/auth/forgot-password", { email: data.email });
      setIsSent(true);
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || "An error occurred. Please try again."
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
          <Link
            to="/login"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 self-start transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Login
          </Link>
          <Logo size={88} className="mb-3 animate-fadeIn" />
          <h2 className="text-2xl font-bold tracking-tight">Forgot Password</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email and we'll send you a password reset link
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-red-500 animate-fadeIn">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSent ? (
          <div className="space-y-4 text-center py-4 animate-fadeIn">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Reset Link Sent</h3>
              <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                If the email is associated with a NoteAI account, we've sent instructions to reset your password.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block rounded-xl bg-primary px-6 py-2 text-xs font-semibold text-white shadow hover:bg-primary/95 transition-all mt-2"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground px-0.5">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  {...register("email")}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors"
                />
              </div>
              {errors.email && (
                <span className="text-[10px] text-red-500 font-medium px-1">
                  {errors.email.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all disabled:opacity-50 mt-2"
            >
              {isSubmitting ? (
                <Loader size="sm" className="mr-2" />
              ) : null}
              Send Reset Link
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
