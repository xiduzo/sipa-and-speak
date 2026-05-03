import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import { useEffect, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { FlagUserModal } from "@/components/flag-user-modal";
import { trpc } from "@/utils/trpc";
import { interestLabel } from "@/utils/interest-labels";
import { getLanguageFlag } from "@/utils/language-flags";

const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";
const WARM_BROWN = "#2C1810";
const MUTED = "#8A7570";
const CARD_BG = "#EDE5DC";

export default function PartnerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [reportVisible, setReportVisible] = useState(false);

  const profileQuery = useQuery(
    trpc.matching.getPartnerProfile.queryOptions({ userId: id }),
  );

  const commentsQuery = useQuery(
    trpc.profile.getCandidateComments.queryOptions({ candidateUserId: id }),
  );

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

  return (
    <Container isScrollable={false}>
      {/* Custom header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text className="font-manrope" style={{ color: MUTED, fontSize: 14 }}>← back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setReportVisible(true)} hitSlop={12}>
          <Text className="font-manrope" style={{ color: MUTED, fontSize: 14 }}>⊏ safety</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 }}>

        {/* Avatar */}
        <View className="items-center mb-5">
          <View style={{ borderWidth: 2, borderColor: WARM_BROWN, borderRadius: 60, padding: 3, marginBottom: 16 }}>
            {profile.image ? (
              <Image
                testID="profile-photo"
                source={{ uri: profile.image }}
                style={{ width: 104, height: 104, borderRadius: 52 }}
              />
            ) : (
              <View
                testID="profile-photo-placeholder"
                style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: "#E2C5BD", alignItems: "center", justifyContent: "center" }}
              >
                <Text className="font-jakarta" style={{ fontSize: 40, color: WARM_BROWN }}>
                  {profile.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Name + age */}
          <Text testID="profile-name" className="font-jakarta" style={{ fontSize: 28, color: WARM_BROWN, fontStyle: "italic" }}>
            {profile.age != null ? `${profile.name}, ${profile.age}` : profile.name}
          </Text>

          {/* University */}
          {profile.university && (
            <Text className="font-manrope mt-1" style={{ color: MUTED, fontSize: 14 }}>
              {profile.university}
            </Text>
          )}

          {/* Sips + rating chip */}
          {(profile.sipCount > 0 || profile.averageRating !== null) && (
            <View className="mt-3 px-4 py-1.5 rounded-full" style={{ backgroundColor: GOLD }}>
              <Text className="font-manrope-semi text-sm" style={{ color: WARM_BROWN }}>
                {[
                  profile.sipCount > 0 ? `${profile.sipCount} ${profile.sipCount === 1 ? "sip" : "sips"}` : null,
                  profile.averageRating !== null ? `${profile.averageRating}★` : null,
                ].filter(Boolean).join(" · ")}
              </Text>
            </View>
          )}
        </View>

        {/* Bio card */}
        {profile.bio && (
          <View className="mb-5 rounded-2xl p-4" style={{ backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER }}>
            <Text className="font-manrope" style={{ color: WARM_BROWN, fontSize: 15, fontStyle: "italic", lineHeight: 22 }}>
              "{profile.bio}"
            </Text>
          </View>
        )}

        {/* Spoken languages */}
        {profile.spokenLanguages.length > 0 && (
          <View className="mb-4">
            <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: MUTED }}>
              Speaks
            </Text>
            <View className="flex-row flex-wrap gap-2" testID="profile-offered-languages">
              {profile.spokenLanguages.map((l) => (
                <View key={l.language} className="px-3 py-1 rounded-full" style={{ borderWidth: 1.5, borderColor: GOLD, backgroundColor: "#FFF9EC" }}>
                  <Text className="text-xs font-manrope-semi" style={{ color: WARM_BROWN }}>
                    {getLanguageFlag(l.language)} {l.language}{l.proficiency ? ` · ${l.proficiency}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Learning languages */}
        {profile.learningLanguages.length > 0 && (
          <View className="mb-4">
            <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: MUTED }}>
              Learning
            </Text>
            <View className="flex-row flex-wrap gap-2" testID="profile-targeted-languages">
              {profile.learningLanguages.map((lang) => (
                <View key={lang} className="px-3 py-1 rounded-full" style={{ borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F5EFE8" }}>
                  <Text className="text-xs font-manrope-semi" style={{ color: MUTED }}>
                    {getLanguageFlag(lang)} {lang}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interests */}
        {profile.interests.length > 0 && (
          <View className="mb-5">
            <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-2" style={{ color: MUTED }}>
              Topics
            </Text>
            <View className="flex-row flex-wrap gap-2" testID="profile-topics">
              {profile.interests.map((topic) => (
                <View key={topic} className="px-3 py-1.5 rounded-full" style={{ borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#F5EFE8" }}>
                  <Text className="text-sm font-manrope" style={{ color: WARM_BROWN }}>{interestLabel(topic)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Comments */}
        <View className="mb-6" testID="comments-section">
          <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-3" style={{ color: MUTED }}>
            What others say
          </Text>
          {comments.length === 0 ? (
            <Text testID="comments-empty" className="font-manrope text-sm" style={{ color: MUTED }}>
              No reviews yet.
            </Text>
          ) : (
            comments.map((comment, idx) => (
              <View
                key={idx}
                testID="comment-item"
                className="rounded-2xl p-3 mb-2"
                style={{ backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER }}
              >
                <Text className="font-manrope-semi text-sm mb-1" style={{ color: WARM_BROWN }}>
                  {comment.authorName}
                </Text>
                <Text className="font-manrope text-sm" style={{ color: MUTED }}>{comment.content}</Text>
              </View>
            ))
          )}
        </View>

      </ScrollView>

      <FlagUserModal
        visible={reportVisible}
        targetId={id}
        targetName={profile.name}
        onDismiss={() => setReportVisible(false)}
      />
    </Container>
  );
}
