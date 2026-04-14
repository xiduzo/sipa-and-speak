/**
 * Minimal heroui-native mock for Jest tests.
 * Renders accessible primitives so testID, onPress, and children work correctly.
 */
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

function Button({ children, onPress, isDisabled, testID, ...rest }: {
  children?: React.ReactNode;
  onPress?: () => void;
  isDisabled?: boolean;
  testID?: string;
  [key: string]: unknown;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={!isDisabled ? onPress : undefined}
      accessibilityState={{ disabled: isDisabled ?? false }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

function ButtonLabel({ children }: { children?: React.ReactNode }) {
  return <Text>{children}</Text>;
}

Button.Label = ButtonLabel;

function Spinner({ testID }: { testID?: string; size?: string }) {
  return <ActivityIndicator testID={testID ?? "spinner"} />;
}

function Card({ children, testID }: { children?: React.ReactNode; testID?: string }) {
  return <View testID={testID}>{children}</View>;
}

function useToast() {
  return { toast: jest.fn() };
}

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

export { Button, Card, Spinner, useToast, cn };
export default { Button, Card, Spinner, useToast, cn };
