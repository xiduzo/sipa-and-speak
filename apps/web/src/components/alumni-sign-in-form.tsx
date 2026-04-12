import { Button } from "@sip-and-speak/ui/components/button";
import { Input } from "@sip-and-speak/ui/components/input";
import { Label } from "@sip-and-speak/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

const OTP_RESEND_COOLDOWN = 60;

const TUE_STUDENT_DOMAINS = ["@student.tue.nl", "@tue.nl"] as const;

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
});

const otpSchema = z.object({
  otp: z
    .string()
    .trim()
    .min(1, "Code is required")
    .length(6, "Code must be 6 digits")
    .regex(/^\d+$/, "Code must contain only digits"),
});

function isTueStudentEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  return TUE_STUDENT_DOMAINS.some((domain) => lower.endsWith(domain));
}

function isExpiredOtpError(message: string): boolean {
  return message.toLowerCase().includes("expir");
}

function isRegistryUnavailableError(error: {
  message?: string;
  status?: number;
}): boolean {
  if (error.status === 503) return true;
  return (error.message ?? "").toLowerCase().includes("temporarily unavailable");
}

async function sendOtpWithRetry(email: string) {
  const firstAttempt = await authClient.emailOtp.sendVerificationOtp({
    email,
    type: "sign-in",
  });

  if (!firstAttempt.error) return firstAttempt;

  // Retry once on transient service-unavailable errors (task #45)
  if (isRegistryUnavailableError(firstAttempt.error)) {
    return authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
  }

  return firstAttempt;
}

export default function AlumniSignInForm() {
  const navigate = useNavigate({ from: "/alumni-login" });
  const { isPending } = authClient.useSession();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [emailServerError, setEmailServerError] = useState<string | null>(null);
  const [otpServerError, setOtpServerError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startResendCooldown() {
    setResendCooldown(OTP_RESEND_COOLDOWN);
  }

  useEffect(() => {
    if (resendCooldown <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }

    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [resendCooldown]);

  const emailForm = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: emailSchema },
    onSubmit: async ({ value }) => {
      setEmailServerError(null);
      const trimmedEmail = value.email.trim();

      // Client-side guard: TU/e student/staff emails should use the student path (task #42)
      if (isTueStudentEmail(trimmedEmail)) {
        setEmailServerError(
          "This looks like an active TU/e institutional email. Please use the student sign-in path instead.",
        );
        return;
      }

      const result = await sendOtpWithRetry(trimmedEmail);

      if (result.error) {
        if (isRegistryUnavailableError(result.error)) {
          setEmailServerError(
            "The alumni registry is temporarily unavailable. Please try again in a moment.",
          );
          return;
        }
        setEmailServerError(
          result.error.message ??
            "Your email address was not found in the TU/e alumni registry. Please check your address or contact alumni@tue.nl for help.",
        );
        return;
      }

      setEmail(trimmedEmail);
      startResendCooldown();
      setStep("otp");
    },
  });

  const otpForm = useForm({
    defaultValues: { otp: "" },
    validators: { onSubmit: otpSchema },
    onSubmit: async ({ value }) => {
      setOtpServerError(null);

      const result = await authClient.signIn.emailOtp({
        email,
        otp: value.otp.trim(),
      });

      if (result.error) {
        const message = result.error.message ?? "Invalid code";
        setOtpServerError(
          isExpiredOtpError(message)
            ? "This code has expired. Click 'Resend code' to get a new one."
            : "Invalid code. Please check and try again.",
        );
        return;
      }

      navigate({ to: "/dashboard" });
      toast.success("Signed in successfully");
    },
  });

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtpServerError(null);

    const result = await sendOtpWithRetry(email);

    if (result.error) {
      toast.error(
        isRegistryUnavailableError(result.error)
          ? "The alumni registry is temporarily unavailable. Please try again shortly."
          : (result.error.message ?? "Failed to resend code"),
      );
      return;
    }

    otpForm.reset();
    startResendCooldown();
    toast.success("New code sent to your email");
  }

  if (isPending) {
    return <Loader />;
  }

  if (step === "otp") {
    return (
      <div className="mx-auto w-full mt-10 max-w-md p-6">
        <h1 className="mb-2 text-center text-3xl font-bold">Check your email</h1>
        <p className="mb-6 text-center text-muted-foreground text-sm">
          A 6-digit code was sent to {email}
        </p>

        {otpServerError && (
          <p className="mb-4 text-sm text-red-500 text-center">{otpServerError}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            otpForm.handleSubmit();
          }}
          className="space-y-4"
        >
          <otpForm.Field name="otp">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>Verification code</Label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={field.state.value}
                  maxLength={6}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  placeholder="123456"
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-sm text-red-500">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </otpForm.Field>

          <otpForm.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Verifying..." : "Verify code"}
              </Button>
            )}
          </otpForm.Subscribe>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="w-full"
          >
            {resendCooldown > 0
              ? `Resend code in ${resendCooldown}s`
              : "Resend code"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              otpForm.reset();
              setOtpServerError(null);
              setStep("email");
            }}
            className="w-full"
          >
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-2 text-center text-3xl font-bold">TU/e Alumni</h1>
      <p className="mb-6 text-center text-muted-foreground text-sm">
        Enter your alumni email address to enrol or sign in
      </p>

      {emailServerError && (
        <p className="mb-4 text-sm text-red-500 text-center">{emailServerError}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          emailForm.handleSubmit();
        }}
        className="space-y-4"
      >
        <emailForm.Field name="email">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Alumni email address</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  setEmailServerError(null);
                  field.handleChange(e.target.value);
                }}
                placeholder="j.doe@alumni.tue.nl"
              />
              {field.state.meta.errors.map((error) => (
                <p key={error?.message} className="text-sm text-red-500">
                  {error?.message}
                </p>
              ))}
            </div>
          )}
        </emailForm.Field>

        <emailForm.Subscribe
          selector={(state) => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Sending code..." : "Continue"}
            </Button>
          )}
        </emailForm.Subscribe>
      </form>

      <div className="mt-4">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/login" })}
          className="w-full"
        >
          Active TU/e student? Sign in here instead
        </Button>
      </div>
    </div>
  );
}
