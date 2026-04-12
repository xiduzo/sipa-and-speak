import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Spinner, useToast } from "heroui-native";
import { ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

const INTERESTS_LABEL: Record<string, string> = {
  modern_art: "Modern Art",
  tech_coding: "Tech & Coding",
  jazz_music: "Jazz Music",
  culinary_arts: "Culinary Arts",
  sustainability: "Sustainability",
  cinephile: "Cinephile",
  cosmology: "Cosmology",
};

export default function ReviewProfileScreen() {
  const router = useRouter();
  const { toast } = useToast();

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  const submitMutation = useMutation({
    ...trpc.profile.submitProfile.mutationOptions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.show({ variant: "success", label: "You're in the matching pool!" });
      router.replace("/edit-profile");
    },
    onError: (e) => {
      toast.show({
        variant: "danger",
        label: (e as { message?: string }).message ?? "Submission failed. Please try again.",
      });
    },
  });

  const languages = profileQuery.data?.languages ?? [];
  const spokenLanguages = languages.filter((l) => l.type === "spoken");
  const learningLanguages = languages.filter((l) => l.type === "learning");
  const interests = profileQuery.data?.interests ?? [];

  const hasSpoken = spokenLanguages.length > 0;
  const hasLearning = learningLanguages.length > 0;
  const hasInterests = interests.length > 0;
  const isComplete = hasSpoken && hasLearning && hasInterests;

  if (profileQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  return (
    <Container isScrollable={false}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 p-6 gap-6">

          <View>
            <Text className="text-foreground text-2xl font-bold mb-1">Review your profile</Text>
            <Text className="text-muted-foreground text-sm">
              {isComplete
                ? "Everything looks great — submit to enter the matching pool."
                : "Complete all sections below before you can submit."}
            </Text>
          </View>

          {/* Spoken Languages */}
          <View className={`rounded-xl border p-4 ${!hasSpoken ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground font-semibold text-base">Spoken Languages</Text>
              {!hasSpoken && (
                <View className="bg-destructive/15 rounded-full px-2 py-0.5">
                  <Text className="text-destructive text-xs font-medium">Required</Text>
                </View>
              )}
            </View>

            {hasSpoken ? (
              <View className="flex-row flex-wrap gap-2">
                {spokenLanguages.map((l) => (
                  <View key={l.language} className="bg-muted rounded-full px-3 py-1">
                    <Text className="text-foreground text-sm">{l.language} · {l.proficiency}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <Text className="text-muted-foreground text-sm mb-3">
                  Add at least one language you speak.
                </Text>
                <Button variant="outline" onPress={() => router.push("/edit-profile")}>
                  <Button.Label>Add spoken language</Button.Label>
                </Button>
              </>
            )}

            {hasSpoken && (
              <Button variant="ghost" onPress={() => router.push("/edit-profile")} className="mt-2 self-start -ml-2">
                <Button.Label>Edit</Button.Label>
              </Button>
            )}
          </View>

          {/* Learning Languages */}
          <View className={`rounded-xl border p-4 ${!hasLearning ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground font-semibold text-base">Learning Languages</Text>
              {!hasLearning && (
                <View className="bg-destructive/15 rounded-full px-2 py-0.5">
                  <Text className="text-destructive text-xs font-medium">Required</Text>
                </View>
              )}
            </View>

            {hasLearning ? (
              <View className="flex-row flex-wrap gap-2">
                {learningLanguages.map((l) => (
                  <View key={l.language} className="bg-muted rounded-full px-3 py-1">
                    <Text className="text-foreground text-sm">{l.language} · {l.proficiency ?? "—"}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <Text className="text-muted-foreground text-sm mb-3">
                  Add at least one language you want to learn.
                </Text>
                <Button variant="outline" onPress={() => router.push("/edit-profile")}>
                  <Button.Label>Add learning language</Button.Label>
                </Button>
              </>
            )}

            {hasLearning && (
              <Button variant="ghost" onPress={() => router.push("/edit-profile")} className="mt-2 self-start -ml-2">
                <Button.Label>Edit</Button.Label>
              </Button>
            )}
          </View>

          {/* Interests */}
          <View className={`rounded-xl border p-4 ${!hasInterests ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-foreground font-semibold text-base">Interests</Text>
              {!hasInterests && (
                <View className="bg-destructive/15 rounded-full px-2 py-0.5">
                  <Text className="text-destructive text-xs font-medium">Required</Text>
                </View>
              )}
            </View>

            {hasInterests ? (
              <View className="flex-row flex-wrap gap-2">
                {interests.map((i) => (
                  <View key={i.interest} className="bg-muted rounded-full px-3 py-1">
                    <Text className="text-foreground text-sm">
                      {INTERESTS_LABEL[i.interest] ?? i.interest}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                <Text className="text-muted-foreground text-sm mb-3">
                  Select at least one interest to help us find your best match.
                </Text>
                <Button variant="outline" onPress={() => router.push("/edit-profile")}>
                  <Button.Label>Add interests</Button.Label>
                </Button>
              </>
            )}

            {hasInterests && (
              <Button variant="ghost" onPress={() => router.push("/edit-profile")} className="mt-2 self-start -ml-2">
                <Button.Label>Edit</Button.Label>
              </Button>
            )}
          </View>

          <View className="mt-2">
            <Button
              onPress={() => submitMutation.mutate()}
              isDisabled={!isComplete || submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Spinner size="sm" color="default" />
              ) : (
                <Button.Label>Submit — Enter Matching Pool</Button.Label>
              )}
            </Button>
          </View>

          <View>
            <Button
              variant="ghost"
              onPress={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.replace("/") } })}
            >
              <Button.Label>Sign out</Button.Label>
            </Button>
          </View>

        </View>
      </ScrollView>
    </Container>
  );
}
