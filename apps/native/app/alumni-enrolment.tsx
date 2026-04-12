import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  Surface,
  TextField,
  useToast,
} from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

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

export default function AlumniEnrolmentScreen() {
  const router = useRouter();
  const { toast } = useToast();

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
          "This looks like an active TU/e institutional email. Please use the student enrolment path instead.",
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
            ? "This code has expired. Tap 'Resend code' to get a new one."
            : "Invalid code. Please check and try again.",
        );
        return;
      }

      await queryClient.refetchQueries();
      router.replace("/");
    },
  });

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtpServerError(null);

    const result = await sendOtpWithRetry(email);

    if (result.error) {
      toast.show({
        variant: "danger",
        label: isRegistryUnavailableError(result.error)
          ? "The alumni registry is temporarily unavailable. Please try again shortly."
          : (result.error.message ?? "Failed to resend code"),
      });
      return;
    }

    otpForm.reset();
    startResendCooldown();
    toast.show({ variant: "success", label: "New code sent to your email" });
  }

  if (step === "otp") {
    return (
      <Surface variant="secondary" className="p-4 rounded-lg">
        <Text className="text-foreground font-medium mb-1">
          Enter your code
        </Text>
        <Text className="text-muted-foreground text-sm mb-4">
          A 6-digit code was sent to {email}
        </Text>

        <otpForm.Subscribe
          selector={(state) => ({ isSubmitting: state.isSubmitting })}
        >
          {({ isSubmitting }) => (
            <>
              {otpServerError && (
                <FieldError isInvalid className="mb-3">
                  {otpServerError}
                </FieldError>
              )}

              <View className="gap-3">
                <otpForm.Field name="otp">
                  {(field) => (
                    <TextField>
                      <Label>Verification code</Label>
                      <Input
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChangeText={(text) =>
                          field.handleChange(
                            text.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        placeholder="123456"
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        returnKeyType="go"
                        onSubmitEditing={otpForm.handleSubmit}
                        maxLength={6}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError isInvalid>
                          {field.state.meta.errors[0]?.message ??
                            String(field.state.meta.errors[0])}
                        </FieldError>
                      )}
                    </TextField>
                  )}
                </otpForm.Field>

                <Button
                  onPress={otpForm.handleSubmit}
                  isDisabled={isSubmitting}
                  className="mt-1"
                >
                  {isSubmitting ? (
                    <Spinner size="sm" color="default" />
                  ) : (
                    <Button.Label>Verify code</Button.Label>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onPress={handleResend}
                  isDisabled={resendCooldown > 0}
                >
                  <Button.Label>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"}
                  </Button.Label>
                </Button>

                <Button
                  variant="ghost"
                  onPress={() => {
                    otpForm.reset();
                    setOtpServerError(null);
                    setStep("email");
                  }}
                >
                  <Button.Label>Use a different email</Button.Label>
                </Button>
              </View>
            </>
          )}
        </otpForm.Subscribe>
      </Surface>
    );
  }

  return (
    <Surface variant="secondary" className="p-4 rounded-lg">
      <Text className="text-foreground font-medium mb-1">
        Enrol as TU/e Alumni
      </Text>
      <Text className="text-muted-foreground text-sm mb-4">
        Enter your alumni email address to get started
      </Text>

      <emailForm.Subscribe
        selector={(state) => ({ isSubmitting: state.isSubmitting })}
      >
        {({ isSubmitting }) => (
          <>
            {emailServerError && (
              <FieldError isInvalid className="mb-3">
                {emailServerError}
              </FieldError>
            )}

            <View className="gap-3">
              <emailForm.Field name="email">
                {(field) => (
                  <TextField>
                    <Label>Alumni email address</Label>
                    <Input
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChangeText={(v) => {
                        setEmailServerError(null);
                        field.handleChange(v);
                      }}
                      placeholder="j.doe@alumni.tue.nl"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="go"
                      onSubmitEditing={emailForm.handleSubmit}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <FieldError isInvalid>
                        {field.state.meta.errors[0]?.message ??
                          String(field.state.meta.errors[0])}
                      </FieldError>
                    )}
                  </TextField>
                )}
              </emailForm.Field>

              <Button
                onPress={emailForm.handleSubmit}
                isDisabled={isSubmitting}
                className="mt-1"
              >
                {isSubmitting ? (
                  <Spinner size="sm" color="default" />
                ) : (
                  <Button.Label>Continue</Button.Label>
                )}
              </Button>

              <Button
                variant="ghost"
                onPress={() => router.replace("/enrolment")}
              >
                <Button.Label>
                  Active TU/e student? Enrol here instead
                </Button.Label>
              </Button>
            </View>
          </>
        )}
      </emailForm.Subscribe>
    </Surface>
  );
}
