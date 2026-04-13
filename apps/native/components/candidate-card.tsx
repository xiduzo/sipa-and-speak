import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

interface CandidateCardProps {
  userId: string;
  name: string;
  image: string | null;
  spokenLanguages: { language: string; proficiency: string | null }[];
  learningLanguages: string[];
  interests: string[];
}

export function CandidateCard({
  userId,
  name,
  image,
  spokenLanguages,
  learningLanguages,
  interests,
}: CandidateCardProps) {
  const router = useRouter();

  function handlePress() {
    // Route created in Task #118 — cast until partner/[id].tsx exists
    router.push(`/partner/${userId}` as never);
  }

  return (
    <Pressable
      testID="candidate-card"
      onPress={handlePress}
      className="bg-card border border-border rounded-2xl p-4 mb-3 active:opacity-70"
    >
      <View className="flex-row items-center gap-3 mb-3">
        {image ? (
          <Image
            testID="candidate-photo"
            source={{ uri: image }}
            className="w-14 h-14 rounded-full"
          />
        ) : (
          <View
            testID="candidate-photo-placeholder"
            className="w-14 h-14 rounded-full bg-muted items-center justify-center"
          >
            <Text className="text-muted-foreground text-xl font-semibold">
              {name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <Text testID="candidate-name" className="text-foreground text-lg font-semibold flex-1">
          {name}
        </Text>
      </View>

      {spokenLanguages.length > 0 && (
        <View className="mb-2">
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            Speaks
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-offered-languages">
            {spokenLanguages.map((l) => (
              <View key={l.language} className="bg-primary/10 px-2 py-0.5 rounded-full">
                <Text className="text-primary text-xs">{l.language}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {learningLanguages.length > 0 && (
        <View className="mb-2">
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            Learning
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-targeted-languages">
            {learningLanguages.map((lang) => (
              <View key={lang} className="bg-secondary/10 px-2 py-0.5 rounded-full">
                <Text className="text-secondary-foreground text-xs">{lang}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {interests.length > 0 && (
        <View>
          <Text className="text-muted-foreground text-xs uppercase font-medium mb-1">
            Topics
          </Text>
          <View className="flex-row flex-wrap gap-1" testID="candidate-conversation-topics">
            {interests.map((topic) => (
              <View key={topic} className="bg-muted px-2 py-0.5 rounded-full">
                <Text className="text-muted-foreground text-xs">{topic}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Pressable>
  );
}
