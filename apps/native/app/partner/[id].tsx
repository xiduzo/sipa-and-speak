import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { MatchCelebrationModal } from "@/components/match-celebration-modal";
import { queryClient, trpc } from "@/utils/trpc";
import { interestLabel } from "@/utils/interest-labels";

const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";

const LANGUAGE_FLAGS: Record<string, string> = {
  Afrikaans: "🇿🇦", Arabic: "🇸🇦", Bengali: "🇧🇩", Bulgarian: "🇧🇬",
  Catalan: "🏳️", Chinese: "🇨🇳", Croatian: "🇭🇷", Czech: "🇨🇿",
  Danish: "🇩🇰", Dutch: "🇳🇱", English: "🇬🇧", Estonian: "🇪🇪",
  Finnish: "🇫🇮", French: "🇫🇷", German: "🇩🇪", Greek: "🇬🇷",
  Hebrew: "🇮🇱", Hindi: "🇮🇳", Hungarian: "🇭🇺", Indonesian: "🇮🇩",
  Italian: "🇮🇹", Japanese: "🇯🇵", Korean: "🇰🇷", Latvian: "🇱🇻",
  Lithuanian: "🇱🇹", Malay: "🇲🇾", Norwegian: "🇳🇴", Persian: "🇮🇷",
  Polish: "🇵🇱", Portuguese: "🇵🇹", Romanian: "🇷🇴", Russian: "🇷🇺",
  Serbian: "🇷🇸", Slovak: "🇸🇰", Slovenian: "🇸🇮", Spanish: "🇪🇸",
  Swedish: "🇸🇪", Thai: "🇹🇭", Turkish: "🇹🇷", Ukrainian: "🇺🇦",
  Vietnamese: "🇻🇳",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2"
      style={{ color: "#8A7570" }}
    >
      {children}
    </Text>
  );
}

export default function PartnerProfileScreen() {
  const { id, matchRequestId } = useLocalSearchParams<{ id: string; matchRequestId?: string }>();
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
  const [showCelebration, setShowCelebration] = useState(false);

  const sendRequestMutation = useMutation({
    ...trpc.matching.sendMatchRequest.mutationOptions(),
    onError: (error: { data?: { code?: string } }) => {
      if (error.data?.code === "CONFLICT") {
        setSendConflictError("A match request to this candidate already exists.");
      }
    },
  });

  const acceptMutation = useMutation({
    ...trpc.matching.acceptMatchRequest.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.matching.getIncomingRequests.queryOptions());
      queryClient.invalidateQueries(trpc.matching.getMyMatches.queryOptions());
      setShowCelebration(true);
    },
  });

  const declineMutation = useMutation({
    ...trpc.matching.declineMatchRequest.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries(trpc.matching.getIncomingRequests.queryOptions());
      router.back();
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
  const requestIsPending =
    statusQuery.data?.matchRequestStatus === "pending" ||
    (sendRequestMutation.isSuccess && statusQuery.data?.matchRequestStatus !== "accepted");
  const requestIsAccepted = statusQuery.data?.matchRequestStatus === "accepted";

  return (
    <>
      {profile && (
        <MatchCelebrationModal
          visible={showCelebration}
          partnerName={profile.name}
          partnerId={id}
          onDismiss={() => setShowCelebration(false)}
        />
      )}
    <Container isScrollable={false}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header: photo + name */}
        <View className="items-center mb-6">
          <View
            style={{ borderWidth: 2.5, borderColor: GOLD, borderRadius: 52, padding: 2, marginBottom: 12 }}
          >
            {profile.image ? (
              <Image
                testID="profile-photo"
                source={{ uri: profile.image }}
                style={{ width: 96, height: 96, borderRadius: 48 }}
              />
            ) : (
              <View
                testID="profile-photo-placeholder"
                style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: "#E2C5BD", alignItems: "center", justifyContent: "center" }}
              >
                <Text className="text-3xl font-jakarta" style={{ color: "#2C1810" }}>
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text testID="profile-name" className="text-foreground text-2xl font-manrope-bold mt-1">
            {profile.name}
          </Text>
          {(profile.age != null || profile.university) && (
            <Text className="text-muted-foreground font-manrope mt-1">
              {[profile.age != null ? `${profile.age} years` : null, profile.university]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          )}
        </View>

        {/* Bio / Introduction */}
        {profile.bio && (
          <View className="mb-4">
            <SectionLabel>Introduction</SectionLabel>
            <Text className="font-manrope" style={{ color: "#8A7570" }}>{profile.bio}</Text>
          </View>
        )}

        {/* Spoken languages */}
        {profile.spokenLanguages.length > 0 && (
          <View className="mb-4">
            <SectionLabel>Speaks</SectionLabel>
            <View className="flex-row flex-wrap gap-2" testID="profile-offered-languages">
              {profile.spokenLanguages.map((l) => (
                <View key={l.language} className="px-3 py-1 rounded-full" style={{ borderWidth: 1, borderColor: GOLD, backgroundColor: "#FFF9EC" }}>
                  <Text className="text-xs font-manrope-semi" style={{ color: "#2C1810" }}>
                    {LANGUAGE_FLAGS[l.language] ?? ""} {l.language}{l.proficiency ? ` · ${l.proficiency}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Learning languages */}
        {profile.learningLanguages.length > 0 && (
          <View className="mb-4">
            <SectionLabel>Learning</SectionLabel>
            <View className="flex-row flex-wrap gap-2" testID="profile-targeted-languages">
              {profile.learningLanguages.map((lang) => (
                <View key={lang} className="px-3 py-1 rounded-full" style={{ borderWidth: 1, borderColor: BORDER }}>
                  <Text className="text-xs font-manrope-semi" style={{ color: "#8A7570" }}>
                    {LANGUAGE_FLAGS[lang] ?? ""} {lang}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests / Topics */}
        {profile.interests.length > 0 && (
          <View className="mb-4">
            <SectionLabel>Topics</SectionLabel>
            <View className="flex-row flex-wrap gap-2" testID="profile-topics">
              {profile.interests.map((topic) => (
                <View key={topic} className="px-3 py-1 rounded-full" style={{ borderWidth: 1, borderColor: BORDER, backgroundColor: "#F5EFE8" }}>
                  <Text className="text-xs font-manrope" style={{ color: "#8A7570" }}>{interestLabel(topic)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* #119 — Comments section */}
        <View className="mb-6" testID="comments-section">
          <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-3" style={{ color: "#8A7570" }}>What others say</Text>
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
                <Text className="text-foreground text-sm font-manrope-semi mb-1">
                  {comment.authorName}
                </Text>
                <Text className="text-muted-foreground text-sm font-manrope">{comment.content}</Text>
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

        {/* #127 — Accept/Decline bar (when opened from incoming request context) */}
        {matchRequestId ? (
          acceptMutation.isSuccess ? (
            <View testID="accepted-propose-bar" className="mb-4">
              <View className="bg-primary/10 rounded-xl p-3 mb-3">
                <Text className="text-primary text-sm text-center font-medium">
                  Matched! Propose a meetup to get started.
                </Text>
              </View>
              <Button
                testID="propose-meetup-after-accept-btn"
                variant="primary"
                onPress={() =>
                  router.push({
                    pathname: "/propose-meetup",
                    params: { partnerId: id, partnerName: profile.name },
                  })
                }
              >
                <Button.Label>Propose a meetup</Button.Label>
              </Button>
            </View>
          ) : (
            <View testID="accept-decline-bar" className="flex-row gap-3 mb-4">
              <Button
                testID="decline-button"
                variant="ghost"
                className="flex-1"
                isDisabled={declineMutation.isPending}
                onPress={() => {
                  if (matchRequestId) {
                    declineMutation.mutate({ matchRequestId });
                  }
                }}
              >
                <Button.Label>Decline</Button.Label>
              </Button>
              <Button
                testID="accept-button"
                variant="primary"
                className="flex-1"
                isDisabled={acceptMutation.isPending}
                onPress={() => {
                  if (matchRequestId) {
                    acceptMutation.mutate({ matchRequestId });
                  }
                }}
              >
                {acceptMutation.isPending ? (
                  <Spinner size="sm" />
                ) : (
                  <Button.Label>Accept</Button.Label>
                )}
              </Button>
            </View>
          )
        ) : (
          /* #120/#122 — Contextual Send Request / Propose meetup */
          requestIsAccepted ? (
            <Button
              testID="propose-meetup-btn"
              variant="primary"
              className="mb-4"
              onPress={() =>
                router.push({
                  pathname: "/propose-meetup",
                  params: { partnerId: id, partnerName: profile.name },
                })
              }
            >
              <Button.Label>Propose a meetup</Button.Label>
            </Button>
          ) : requestIsPending ? (
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
          )
        )}
        {/* #65 — Report / flag this Student */}
        <Button
          testID="report-student-btn"
          variant="ghost"
          className="mb-2"
          onPress={() =>
            router.push({
              pathname: "/flag-user",
              params: { targetId: id, targetName: profile.name },
            })
          }
        >
          <Button.Label>Report Student</Button.Label>
        </Button>
      </ScrollView>
    </Container>
    </>
  );
}
