import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { withUniwind } from "uniwind";

const StyledIonicons = withUniwind(Ionicons);

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: undefined,
        tabBarInactiveTintColor: undefined,
      }}
    >
      <Tabs.Screen
        name="suggestions"
        options={{
          title: "Match",
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="confirmed-meetups"
        options={{
          title: "Meet-Ups",
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <StyledIonicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
