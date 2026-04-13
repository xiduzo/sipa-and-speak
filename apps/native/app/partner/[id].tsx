import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";

export default function PartnerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const profileQuery = useQuery(
    trpc.matching.getPartnerProfile.queryOptions({ userId: id }),
  );

  const commentsQuery = useQuery(
    trpc.profile.getCandidateComments.queryOptions({ candidateUserId: id }),
  );

  const statusQuery = useQuery(
    trpc.matching.getMatchRequestStatus.queryOptions({ candidateUserId: id }),
  );

  const [sendConflictError, setSendConflictError] = useState<string | null>(null);

  const sendRequestMutation = useMutation({
    ...trpc.matching.sendMatchRequest.mutationOptions(),
    onError: (error: { data?: { code?: string } }) => {
      if (error.data?.code === "CONFLICT") {
        setSendConflictError("A match request to this candidate already exists.");
      }
    },
  });

  // #121 — if profile is no longer available, navigate back
  useEffect(() => {
    if (profileQuery.error && (profileQuery.error as { data?: { code?: string } }).data?.code === "NOT_FOUND") {
      router.back();
    }
  }, [profileQuery.error, router]);

  if (profileQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  if (profileQuery.isError) {
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

  const profile = profileQuery.data;
  const comments = commentsQuery.data ?? [];
  const requestAlreadySent =
    (statusQuery.data?.matchRequestStatus === "pending" || statusQuery.data?.matchRequestStatus === "accepted") ||
    sendRequestMutation.isSuccess;

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

        {/* #119 — Comments section */}
        <View className="mb-6" testID="comments-section">
          <Text className="text-foreground font-semibold mb-3">What others say</Text>
          {comments.length === 0 ? (
            <Text testID="comments-empty" className="text-muted-foreground text-sm">
              No reviews yet.
            </Text>
          ) : (
            comments.map((comment, idx) => (
              <View
                key={idx}
                testID="comment-item"
                className="bg-muted/50 rounded-xl p-3 mb-2"
              >
                <Text className="text-foreground text-sm font-medium mb-1">
                  {comment.authorName}
                </Text>
                <Text className="text-muted-foreground text-sm">{comment.content}</Text>
              </View>
            ))
          )}
        </View>

        {/* #124 — Confirmation feedback */}
        {sendRequestMutation.isSuccess && (
          <View testID="confirmation-message" className="bg-primary/10 rounded-xl p-3 mb-3">
            <Text className="text-primary text-sm text-center">
              Request sent! We'll let you know when they respond.
            </Text>
          </View>
        )}

        {/* #123 — Conflict error */}
        {sendConflictError && (
          <View testID="conflict-error-message" className="bg-danger/10 rounded-xl p-3 mb-3">
            <Text className="text-danger text-sm text-center">{sendConflictError}</Text>
          </View>
        )}

        {/* #120/#122 — Contextual Send Request */}
        {requestAlreadySent ? (
          <View testID="request-sent-indicator" className="bg-muted rounded-xl p-4 mb-4 items-center">
            <Text className="text-muted-foreground font-medium">Request Sent</Text>
          </View>
        ) : (
          <Button
            testID="send-request-button"
            variant="primary"
            isDisabled={sendRequestMutation.isPending || statusQuery.isPending}
            onPress={() => sendRequestMutation.mutate({ receiverId: id })}
            className="mb-4"
          >
            {sendRequestMutation.isPending ? (
              <Spinner size="sm" />
            ) : (
              <Button.Label>Send Request</Button.Label>
            )}
          </Button>
        )}
      </ScrollView>
    </Container>
  );
}
