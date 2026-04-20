import { useForm } from "@tanstack/react-form";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "heroui-native";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

const OTP_RESEND_COOLDOWN = 60;
const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";
const INPUT_BG = "#F5EFE8";

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

function isExpiredOtpError(message: string): boolean {
  return message.toLowerCase().includes("expir");
}

function GoldButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? "#D4C898" : pressed ? "#DFB83A" : GOLD,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: "center",
        opacity: disabled ? 0.7 : 1,
      })}
    >
      <Text
        className="font-manrope-bold text-[17px] tracking-[0.3px]"
        style={{ color: disabled ? "#8A7570" : "#2C1810" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GhostButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} className="items-center py-2.5">
      <Text
        className="font-manrope-md text-sm underline"
        style={{ color: disabled ? BORDER : "#8A7570" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="font-manrope-semi text-[11px] tracking-[1.8px] text-brand-muted-foreground mb-2 uppercase">
      {children}
    </Text>
  );
}

function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text className="font-manrope text-[13px] text-destructive mt-1.5">
      {message}
    </Text>
  );
}

export default function EnrolmentScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();

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
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: trimmedEmail,
        type: "sign-in",
      });
      if (result.error) {
        setEmailServerError(
          result.error.message ?? "Failed to send code. Please try again.",
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
      router.replace("/(tabs)/suggestions");
    },
  });

  async function handleResend() {
    if (resendCooldown > 0) return;
    setOtpServerError(null);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (result.error) {
      toast.show({
        variant: "danger",
        label: result.error.message ?? "Failed to resend code",
      });
      return;
    }
    otpForm.reset();
    startResendCooldown();
    toast.show({ variant: "success", label: "New code sent to your email" });
  }

  if (step === "otp") {
    return (
      <View className="flex-1 bg-background" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-8 pt-[72px] pb-10">
              <View className="mb-10">
                <Text className="font-caveat text-[42px] text-foreground leading-[46px]">
                  Check your{"\n"}inbox.
                </Text>
                <Text className="font-manrope text-[15px] text-brand-muted-foreground italic mt-3 leading-[22px]">
                  We sent a 6-digit code to{"\n"}
                  <Text className="text-foreground font-manrope-semi" style={{ fontStyle: "normal" }}>
                    {email}
                  </Text>
                </Text>
              </View>

              <View className="mb-4">
                <FieldLabel>Verification code</FieldLabel>
                <otpForm.Field name="otp">
                  {(field) => (
                    <View>
                      <TextInput
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChangeText={(text) =>
                          field.handleChange(text.replace(/\D/g, "").slice(0, 6))
                        }
                        placeholder="123456"
                        placeholderTextColor={BORDER}
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        returnKeyType="go"
                        onSubmitEditing={otpForm.handleSubmit}
                        maxLength={6}
                        className="font-manrope-md text-foreground bg-brand-input rounded-2xl px-5 py-4"
                        style={{
                          fontSize: 28,
                          letterSpacing: 8,
                          borderWidth: 2,
                          borderColor: field.state.meta.errors.length > 0 ? "#C0392B" : BORDER,
                        }}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <InlineError
                          message={
                            field.state.meta.errors[0]?.message ??
                            String(field.state.meta.errors[0])
                          }
                        />
                      )}
                    </View>
                  )}
                </otpForm.Field>
                <InlineError message={otpServerError} />
              </View>

              <View className="flex-1" />

              <View className="gap-3">
                <otpForm.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
                  {({ isSubmitting }) => (
                    <GoldButton
                      onPress={otpForm.handleSubmit}
                      disabled={isSubmitting}
                      label={isSubmitting ? "Verifying…" : "Verify →"}
                    />
                  )}
                </otpForm.Subscribe>

                <GhostButton
                  onPress={handleResend}
                  disabled={resendCooldown > 0}
                  label={
                    resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend code"
                  }
                />

                <GhostButton
                  onPress={() => {
                    otpForm.reset();
                    setOtpServerError(null);
                    setStep("email");
                  }}
                  label="Use a different email"
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-8 pt-[72px] pb-10">
            <View className="mb-12">
              <Text className="font-manrope-semi text-[11px] tracking-[2px] text-brand-muted-foreground uppercase mb-[14px]">
                Sip&Speak
              </Text>
              <Text className="font-manrope-bold text-[36px] text-foreground leading-[42px]">
                {"Find a partner\nover "}
                <Text className="font-caveat text-[44px] leading-[48px]" style={{ color: "#9B6B3A" }}>
                  koffie.
                </Text>
              </Text>
              <Text className="font-manrope text-[15px] text-brand-muted-foreground mt-[18px] leading-[23px]">
                Practise a language with someone who lives in Eindhoven. Meet in person. Message after.
              </Text>
            </View>

            <View className="mb-4">
              <FieldLabel>TU/e Email</FieldLabel>
              <emailForm.Field name="email">
                {(field) => (
                  <View>
                    <TextInput
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChangeText={(v) => {
                        setEmailServerError(null);
                        field.handleChange(v);
                      }}
                      placeholder="a.j.devries@student.tue.nl"
                      placeholderTextColor={BORDER}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="go"
                      onSubmitEditing={emailForm.handleSubmit}
                      className="font-manrope-md text-base text-foreground bg-brand-input rounded-2xl px-5 py-4"
                      style={{
                        borderWidth: 2,
                        borderColor: field.state.meta.errors.length > 0 ? "#C0392B" : BORDER,
                      }}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <InlineError
                        message={
                          field.state.meta.errors[0]?.message ??
                          String(field.state.meta.errors[0])
                        }
                      />
                    )}
                  </View>
                )}
              </emailForm.Field>
              <InlineError message={emailServerError} />
              <Text className="font-manrope text-[13px] text-brand-muted-foreground italic mt-2">
                We'll send a 6-digit code.
              </Text>
            </View>

            <View className="flex-1" />

            <View className="gap-4">
              <emailForm.Subscribe selector={(state) => ({ isSubmitting: state.isSubmitting })}>
                {({ isSubmitting }) => (
                  <GoldButton
                    onPress={emailForm.handleSubmit}
                    disabled={isSubmitting}
                    label={isSubmitting ? "Sending…" : "Continue"}
                  />
                )}
              </emailForm.Subscribe>

              <Text className="font-manrope text-[13px] text-brand-muted-foreground text-center leading-5">
                By joining you agree to the{" "}
                <Text className="underline">community code</Text>.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
