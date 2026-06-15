/**
 * Tests for task #380 — Add the Conversation Starters tab and screen to the
 * bottom navigation.
 *
 * Scenario 1: Tab is visible in the bottom navigation.
 *   The tabs layout registers a "Conversation Starters" <Tabs.Screen> with a
 *   label (title) and an Ionicons tabBarIcon, alongside the existing tabs.
 *
 * Scenario 2: Opening the tab.
 *   The Conversation Starters screen component renders its own content.
 *
 * `expo-router`'s <Tabs> is mocked to capture the registered screens (name +
 * options) so we can assert registration without a navigation container. The
 * tRPC badge queries used by the layout are mocked to return empty data.
 */
import { render, screen } from "@testing-library/react-native";
import React from "react";

type ScreenOptions = {
  title?: string;
  href?: string | null;
  tabBarIcon?: (p: { color: string; size: number }) => React.ReactNode;
};

const registeredScreens: { name: string; options?: ScreenOptions }[] = [];

jest.mock("expo-router", () => {
  const { View } = require("react-native");
  const Tabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Tabs.Screen = ({ name, options }: { name: string; options?: ScreenOptions }) => {
    registeredScreens.push({ name, options });
    return null;
  };
  return { Tabs, useRouter: () => ({ push: jest.fn() }) };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock("uniwind", () => ({
  withUniwind: (Component: unknown) => Component,
}));

jest.mock("@tanstack/react-query", () => {
  // The layout's badge queries read `.data.length` / `.data.filter(...)` (an
  // array), while the Conversation Starters screen reads `.data.languages`.
  // An array carrying a `languages` property satisfies both: the badges see an
  // empty array, and the screen sees one language → ready entry point.
  const data: unknown[] & { languages?: unknown } = [];
  data.languages = [{ language: "es", type: "spoken" }];
  return {
    useQuery: () => ({ data, isPending: false, isError: false }),
  };
});

const makeQueryable = () => ({ queryOptions: () => ({}) });
jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: { getIncomingRequests: makeQueryable() },
    meetup: { list: makeQueryable(), getConfirmed: makeQueryable() },
    chat: { listEntries: makeQueryable() },
    profile: { getMyProfile: makeQueryable() },
  },
}));

jest.mock("@/components/container", () => {
  const { View } = require("react-native");
  return {
    Container: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe("Conversation Starters tab registration", () => {
  beforeEach(() => {
    registeredScreens.length = 0;
  });

  it("registers a Conversation Starters tab with a label and icon", () => {
    const TabsLayout = require("@/app/(tabs)/_layout").default;
    render(<TabsLayout />);

    const tab = registeredScreens.find((s) => s.name === "conversation-starters");
    expect(tab).toBeDefined();
    expect(tab?.options?.title).toBe("Conversation Starters");
    // Icon renderer is provided and yields a node (Ionicons element).
    const iconNode = tab?.options?.tabBarIcon?.({ color: "#000", size: 24 });
    expect(iconNode).toBeTruthy();
  });

  it("registers it as a visible tab (not href: null) alongside existing tabs", () => {
    const TabsLayout = require("@/app/(tabs)/_layout").default;
    render(<TabsLayout />);

    const names = registeredScreens.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining(["home", "matches", "confirmed-meetups", "chats", "conversation-starters"]),
    );

    const tab = registeredScreens.find((s) => s.name === "conversation-starters");
    expect(tab?.options?.href).toBeUndefined();
  });
});

describe("Conversation Starters screen", () => {
  it("renders its own content when opened", () => {
    const ConversationStartersScreen = require("@/app/(tabs)/conversation-starters").default;
    render(<ConversationStartersScreen />);

    expect(screen.getByText("Conversation Starters")).toBeTruthy();
  });
});
