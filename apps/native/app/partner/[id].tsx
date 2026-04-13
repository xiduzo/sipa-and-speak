import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { Spinner } from "heroui-native";
import { Image, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

export default function PartnerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const profileQuery = useQuery(
    trpc.matching.getPartnerProfile.queryOptions({ userId: id }),
  );

  if (profileQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-foreground text-lg font-semibold text-center">
            This profile is no longer available
          </Text>
          <Text className="text-muted-foreground text-center mt-2">
            The candidate may have left the platform.
          </Text>
        </View>
      </Container>
    );
  }

  return (
    <Container isScrollable={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header: photo + name */}
        <View className="items-center mb-6">
          {profile.image ? (
            <Image
              testID="profile-photo"
              source={{ uri: profile.image }}
              className="w-24 h-24 rounded-full mb-3"
            />
          ) : (
            <View
              testID="profile-photo-placeholder"
              className="w-24 h-24 rounded-full bg-muted items-center justify-center mb-3"
            >
              <Text className="text-muted-foreground text-3xl font-semibold">
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text testID="profile-name" className="text-foreground text-2xl font-bold">
            {profile.name}
          </Text>
          {(profile.age != null || profile.university) && (
            <Text className="text-muted-foreground mt-1">
              {[profile.age != null ? `${profile.age} years` : null, profile.university]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </View>

        {/* Bio / Introduction */}
        {profile.bio && (
          <View className="mb-4">
            <Text className="text-foreground font-semibold mb-1">Introduction</Text>
            <Text className="text-muted-foreground">{profile.bio}</Text>
          </View>
        )}

        {/* Spoken languages */}
        {profile.spokenLanguages.length > 0 && (
          <View className="mb-4">
            <Text className="text-foreground font-semibold mb-2">Speaks</Text>
            <View className="flex-row flex-wrap gap-2" testID="profile-offered-languages">
              {profile.spokenLanguages.map((l) => (
                <View key={l.language} className="bg-primary/10 px-3 py-1 rounded-full">
                  <Text className="text-primary text-sm">
                    {l.language}{l.proficiency ? ` · ${l.proficiency}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Learning languages */}
        {profile.learningLanguages.length > 0 && (
          <View className="mb-4">
            <Text className="text-foreground font-semibold mb-2">Learning</Text>
            <View className="flex-row flex-wrap gap-2" testID="profile-targeted-languages">
              {profile.learningLanguages.map((lang) => (
                <View key={lang} className="bg-secondary/10 px-3 py-1 rounded-full">
                  <Text className="text-secondary-foreground text-sm">{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests / Topics */}
        {profile.interests.length > 0 && (
          <View className="mb-4">
            <Text className="text-foreground font-semibold mb-2">Topics</Text>
            <View className="flex-row flex-wrap gap-2" testID="profile-topics">
              {profile.interests.map((topic) => (
                <View key={topic} className="bg-muted px-3 py-1 rounded-full">
                  <Text className="text-muted-foreground text-sm">{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </Container>
  );
}
