import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { withUniwind } from "uniwind";

import { trpc } from "@/utils/trpc";

const StyledIonicons = withUniwind(Ionicons);

function toBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? "99+" : String(count);
}

export default function TabsLayout() {
  const incomingRequestsQuery = useQuery(trpc.matching.getIncomingRequests.queryOptions());
  const pendingMeetupsQuery = useQuery(trpc.meetup.list.queryOptions({ status: "pending" }));
  const confirmedMeetupsQuery = useQuery(trpc.meetup.getConfirmed.queryOptions());
  const chatEntriesQuery = useQuery(trpc.chat.listEntries.queryOptions());

  const matchesCount = incomingRequestsQuery.data?.length ?? 0;

  const pendingProposalsNeedingResponse = (pendingMeetupsQuery.data ?? []).filter(
    (p) => !p.isProposer,
  ).length;
  const confirmed = confirmedMeetupsQuery.data ?? [];
  const attendanceNeeded = confirmed.filter((m) => m.isPast && !m.hasReported).length;
  const rescheduleNeeded = confirmed.filter(
    (m) => m.reschedulePending && !m.rescheduleIsFromMe,
  ).length;
  const meetupsCount = pendingProposalsNeedingResponse + attendanceNeeded + rescheduleNeeded;

  const chatsCount = (chatEntriesQuery.data ?? []).filter(
    (e) =>
      (e.kind === "open" && e.hasUnread) ||
      (e.kind === "locked" && e.phase === "awaiting_my_optin"),
  ).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: undefined,
        tabBarInactiveTintColor: undefined,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarBadge: toBadge(matchesCount),
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="confirmed-meetups"
        options={{
          title: "Meet-Ups",
          tabBarBadge: toBadge(meetupsCount),
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarBadge: toBadge(chatsCount),
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="conversation-starters"
        options={{
          title: "Conversation Starters",
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="chatbox-ellipses-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="suggestions"
        options={{ href: null }}
      />
    </Tabs>
  );
}
