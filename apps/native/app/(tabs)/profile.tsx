import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";

export default function ProfileScreen() {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  return (
    <Container isScrollable={false}>
      <View className="flex-1 p-6">
        <Text className="text-foreground text-2xl font-bold mb-2">Profile</Text>
        {session?.user?.name && (
          <Text className="text-muted-foreground mb-6">{session.user.name}</Text>
        )}
        <Button onPress={() => router.push("/edit-profile")}>
          <Button.Label>Edit Profile</Button.Label>
        </Button>
      </View>
    </Container>
  );
}
