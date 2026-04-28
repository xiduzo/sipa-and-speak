import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { trpc } from "@/utils/trpc";
import { HeroNoMeetup } from "@/components/home/hero-nomeetup";
import { HeroMatchFound } from "@/components/home/hero-matchfound";
import { HeroWaiting } from "@/components/home/hero-waiting";
import { HeroConfirmed } from "@/components/home/hero-confirmed";
import { HeroPost } from "@/components/home/hero-post";
import { SecondaryCard } from "@/components/home/secondary-card";
import { resolveHomeState, type HomeState } from "@/components/home/home-state";
import { GOLD } from "@/components/home/tokens";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "GOEDEMORGEN";
  if (h < 18) return "GOEDEMIDDAG";
  return "GOEDENAVOND";
}

export default function HomeScreen() {
  const router = useRouter();
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());
  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));
  const matchesQuery = useQuery(trpc.matching.getMyMatches.queryOptions());
  const confirmedQuery = useQuery(trpc.meetup.getConfirmed.queryOptions());
  const pendingQuery = useQuery(trpc.meetup.list.queryOptions({ status: "pending" }));

  const name = profileQuery.data?.identity?.name ?? "";
  const initial = (name || "?").charAt(0).toUpperCase();

  const { hero, secondaries } = resolveHomeState({
    confirmed: confirmedQuery.data ?? [],
    pending: (pendingQuery.data ?? []).map((p) => ({
      id: p.id,
      isProposer: p.isProposer,
      partner: p.partner,
      venue: { id: p.venue.id, name: p.venue.name, photoUrl: p.venue.photoUrl },
      date: p.date,
      time: p.time,
      createdAt: p.createdAt,
    })),
    matches: matchesQuery.data ?? [],
    discover: discoverQuery.data?.partners ?? [],
  });

  function handleSecondaryPress(state: HomeState) {
    switch (state.kind) {
      case "post":
      case "confirmed":
        router.push("/(tabs)/confirmed-meetups");
        return;
      case "waiting":
        if (state.proposal.isProposer) {
          router.push("/(tabs)/confirmed-meetups");
        } else {
          router.push({
            pathname: "/respond-meetup",
            params: { meetupId: state.proposal.id },
          });
        }
        return;
      case "matchfound":
      case "nomeetup":
        router.push("/match");
        return;
    }
  }

  function renderHero() {
    switch (hero.kind) {
      case "post":
        return (
          <HeroPost
            meetup={hero.meetup}
            onOpenChat={(conversationId) =>
              router.push(`/chat/${conversationId}` as never)
            }
          />
        );
      case "confirmed":
        return (
          <HeroConfirmed
            meetup={hero.meetup}
            onReschedule={() => router.push("/(tabs)/confirmed-meetups")}
          />
        );
      case "waiting":
        return (
          <HeroWaiting
            proposal={hero.proposal}
            onRespond={() =>
              router.push({
                pathname: "/respond-meetup",
                params: { meetupId: hero.proposal.id },
              })
            }
          />
        );
      case "matchfound":
        return (
          <HeroMatchFound
            match={hero.match}
            onPropose={() =>
              router.push({
                pathname: "/propose-meetup",
                params: {
                  partnerId: hero.match.partnerId,
                  partnerName: hero.match.partnerName,
                },
              })
            }
            onViewProfile={() =>
              router.push({
                pathname: "/partner/[id]",
                params: { id: hero.match.partnerId },
              })
            }
          />
        );
      case "nomeetup":
        return (
          <HeroNoMeetup
            matchCount={hero.matchCount}
            partners={hero.partners}
            onFindPartner={() => router.push("/match")}
          />
        );
    }
  }

  return (
    <Container>
      <View className="flex-1 px-6 pt-4">
        <View className="flex-row items-start justify-between mb-10">
          <View>
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground"
              style={{ fontSize: 12 }}
            >
              {greeting()}
            </Text>
            <Text
              className="text-brand-foreground font-jakarta"
              style={{ fontSize: 24, marginTop: 2 }}
            >
              {name || "Welcome"}
            </Text>
          </View>
          <Pressable
            testID="profile-avatar"
            onPress={() => router.push("/(tabs)/profile")}
            className="items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: GOLD }}
          >
            {profileQuery.data?.identity?.image ? (
              <Image
                source={{ uri: profileQuery.data.identity.image }}
                style={{ width: 44, height: 44, borderRadius: 22 }}
              />
            ) : (
              <Text className="font-manrope-bold" style={{ fontSize: 16 }}>
                {initial}
              </Text>
            )}
          </Pressable>
        </View>

        {renderHero()}

        {secondaries.length > 0 && (
          <View className="mt-8">
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground"
              style={{ fontSize: 12 }}
            >
              ALSO FOR YOU
            </Text>
            <View className="flex-row gap-3 mt-3">
              {secondaries.map((s) => (
                <SecondaryCard
                  key={s.kind}
                  state={s}
                  onPress={() => handleSecondaryPress(s)}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Container>
  );
}
