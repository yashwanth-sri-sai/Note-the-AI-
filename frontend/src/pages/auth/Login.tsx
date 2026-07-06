import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { BrainCircuit, Mail, Lock, AlertCircle, ArrowLeft } from "lucide-react";
import { Loader } from "../../components/ui/Loader";
import { useAuthStore } from "@/store/auth-store";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long." }),
});

type LoginSchemaType = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login, googleLogin } = useAuthStore();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchemaType>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchemaType) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMsg(
        err.response?.data?.detail || "Invalid email or password. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock Google OAuth trigger for demonstration/Phase 1 validation
  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Typically, here we prompt Google One-Tap or Google Login PopUp,
      // which returns a credential token, then we send it to our API.
      // We pass a dummy credential token for local demonstration testing.
      const dummyIdToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ1c2VyQG5vdGVhaS5hcHAiLCJuYW1lIjoiRGVtbyBVc2VyIiwicGljdHVyZSI6IiIsImF1ZCI6IjEyMzQ1Njc4OTktZHVtbXljbGllbnRpZC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.sig";
      await googleLogin(dummyIdToken);
      navigate("/dashboard");
    } catch (err: any) {
      setErrorMsg("Failed to authenticate with Google.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 transition-colors duration-300 relative">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] rounded-full bg-primary/5 blur-[90px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-indigo-500/5 blur-[90px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-2xl shadow-xl border border-border/80">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4 self-start transition-colors"
          >
            <ArrowLeft className="h-3 w-3" /> Back
          </Link>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/20 mb-3">
            <BrainCircuit className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sign in to access your NoteAI dashboard
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 text-xs text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

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

          <div className="space-y-1">
            <div className="flex justify-between items-center px-0.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Password
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert("Password reset is not configured for mock environment.");
                }}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                Forgot?
              </a>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors"
              />
            </div>
            {errors.password && (
              <span className="text-[10px] text-red-500 font-medium px-1">
                {errors.password.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader size="sm" className="mr-2" />
            ) : null}
            Sign In
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-border/80"></div>
          <span className="flex-shrink mx-4 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
            or continue with
          </span>
          <div className="flex-grow border-t border-border/80"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 py-2.5 text-sm font-medium transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.47 14.99 1 12 1 7.35 1 3.37 3.65 1.4 7.54l3.88 3c.92-2.76 3.51-4.5 6.72-4.5z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.97 3.7-8.62z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.54c-.24-.72-.37-1.5-.37-2.3s.13-1.58.37-2.3l-3.88-3C.54 8.78 0 10.33 0 12s.54 3.22 1.4 5.06l3.88-3z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.5 1.18-4.23 1.18-3.21 0-5.8-2.14-6.72-5.04l-3.88 3C3.37 20.35 7.35 23 12 23z"
            />
          </svg>
          Google
        </button>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
};
