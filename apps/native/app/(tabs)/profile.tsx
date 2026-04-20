import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Image, Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

const AVATAR_SIZE = 80;

export default function ProfileScreen() {
  const router = useRouter();
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());
  const identity = profileQuery.data?.identity;

  const fullName = [identity?.name, identity?.surname].filter(Boolean).join(" ");

  return (
    <Container isScrollable={false}>
      <View className="flex-1 p-6">
        <Text className="text-foreground text-2xl font-bold mb-4">Profile</Text>

        <View className="flex-row items-center gap-4 mb-6">
          {identity?.image ? (
            <Image
              source={{ uri: identity.image }}
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
              accessibilityLabel="Profile picture"
            />
          ) : (
            <View
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
              className="bg-default-200 items-center justify-center"
              accessibilityLabel="Profile picture placeholder"
            >
              <Text className="text-default-500 text-2xl font-bold">
                {identity?.name?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          )}

          <View className="flex-1">
            {fullName ? (
              <Text className="text-foreground text-lg font-semibold">{fullName}</Text>
            ) : (
              <Text className="text-muted-foreground text-sm">No name set</Text>
            )}
          </View>
        </View>

        <Button onPress={() => router.push("/edit-profile")}>
          <Button.Label>Edit Profile</Button.Label>
        </Button>
        <Button
          variant="danger-soft"
          className="mt-4"
          onPress={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.replace("/");
                },
              },
            });
          }}
        >
          <Button.Label>Sign Out</Button.Label>
        </Button>
      </View>
    </Container>
  );
}
