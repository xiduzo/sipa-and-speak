import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { MeetupFlowModal, type MeetupFlowMode } from "@/components/meetup-flow-modal";
import { ProfileModal } from "@/components/profile-modal";
import { trpc, queryClient } from "@/utils/trpc";
import { HeroNoMeetup } from "@/components/home/hero-nomeetup";
import { HeroMatchFound } from "@/components/home/hero-matchfound";
import { HeroWaiting } from "@/components/home/hero-waiting";
import { HeroConfirmed } from "@/components/home/hero-confirmed";
import { HeroPost } from "@/components/home/hero-post";
import { SecondaryCard } from "@/components/home/secondary-card";
import { HeroCarousel } from "@/components/home/hero-carousel";
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
  const [meetupModal, setMeetupModal] = useState<MeetupFlowMode | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());
  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));
  const matchesQuery = useQuery(trpc.matching.getMyMatches.queryOptions());
  const confirmedQuery = useQuery(trpc.meetup.getConfirmed.queryOptions());
  const pendingQuery = useQuery(trpc.meetup.list.queryOptions({ status: "pending" }));

  const name = profileQuery.data?.identity?.name ?? "";
  const initial = (name || "?").charAt(0).toUpperCase();

  const acceptRescheduleMutation = useMutation(trpc.meetup.acceptReschedule.mutationOptions({
    onSuccess: () => {
      void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
    },
  }));

  const { heros, secondaries } = resolveHomeState({
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
          setMeetupModal({ type: "respond", meetupId: state.proposal.id });
        }
        return;
      case "matchfound":
        setMeetupModal({
          type: "propose",
          partnerId: state.match.partnerId,
          partnerName: state.match.partnerName,
        });
        return;
      case "nomeetup":
        router.push("/match");
        return;
    }
  }

  function renderHero(hero: HomeState) {
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
            onReschedule={() =>
              setMeetupModal({
                type: "reschedule",
                meetupId: hero.meetup.meetupId,
                currentVenueId: hero.meetup.venue.id,
                currentDate: hero.meetup.date,
                currentTime: hero.meetup.time,
              })
            }
            onAcceptReschedule={() =>
              acceptRescheduleMutation.mutate({ meetupId: hero.meetup.meetupId })
            }
          />
        );
      case "waiting":
        return (
          <HeroWaiting
            proposal={hero.proposal}
            onRespond={() => setMeetupModal({ type: "respond", meetupId: hero.proposal.id })}
          />
        );
      case "matchfound":
        return (
          <HeroMatchFound
            match={hero.match}
            onPropose={() =>
              setMeetupModal({
                type: "propose",
                partnerId: hero.match.partnerId,
                partnerName: hero.match.partnerName,
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
      <MeetupFlowModal mode={meetupModal} onDismiss={() => setMeetupModal(null)} />
      <ProfileModal visible={profileOpen} onDismiss={() => setProfileOpen(false)} />
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
            onPress={() => setProfileOpen(true)}
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

        <HeroCarousel heros={heros} renderHero={renderHero} />

        {secondaries.length > 0 && (
          <View className="mt-8">
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground"
              style={{ fontSize: 12 }}
            >
              ALSO FOR YOU
            </Text>
            <View className="mt-3" style={{ gap: 12 }}>
              {Array.from({ length: Math.ceil(secondaries.length / 2) }).map(
                (_, rowIndex) => {
                  const rowCards = secondaries.slice(rowIndex * 2, rowIndex * 2 + 2);
                  return (
                    <View
                      key={`row-${rowIndex}`}
                      className="flex-row"
                      style={{ gap: 12 }}
                    >
                      {rowCards.map((s) => (
                        <SecondaryCard
                          key={s.kind}
                          state={s}
                          onPress={() => handleSecondaryPress(s)}
                        />
                      ))}
                      {rowCards.length === 1 && <View style={{ flex: 1 }} />}
                    </View>
                  );
                },
              )}
            </View>
          </View>
        )}

      </View>
    </Container>
  );
}
