import { useMutation, useQuery } from "@tanstack/react-query";
import { Spinner } from "heroui-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { MeetupFlowModal, type MeetupFlowMode } from "@/components/meetup-flow-modal";
import { CARD, CARD_BLUE, GOLD } from "@/components/home/tokens";
import { formatDayTime, toDate } from "@/lib/dates";
import { trpc, queryClient } from "@/utils/trpc";
import { meetupCardStatus, type PillTone } from "@/utils/meetup-card-status";

const DARK = "#1A1A1A";
const MUTED = "#8A7570";
const OUTLINE = "#1A1A1A";

const TONE_BG: Record<PillTone, string> = {
  gold: GOLD,
  mint: CARD_BLUE,
  muted: CARD,
  rose: "#F1D9D2",
};

function StatusPill({ label, tone, testID }: { label: string; tone: PillTone; testID?: string }) {
  return (
    <View
      testID={testID}
      className="rounded-full"
      style={{
        backgroundColor: TONE_BG[tone],
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <Text
        className="font-manrope-semi"
        style={{
          fontSize: 10,
          letterSpacing: 1.6,
          color: DARK,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function PrimaryPill({
  label,
  onPress,
  disabled,
  testID,
  flex,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  flex?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-full ${flex ? "flex-1" : ""}`}
      style={{
        height: 46,
        paddingHorizontal: 22,
        backgroundColor: GOLD,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Text className="font-manrope-bold" style={{ fontSize: 14, color: DARK }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryPill({
  label,
  onPress,
  disabled,
  testID,
  flex,
  destructive,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  flex?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      className={`items-center justify-center rounded-full ${flex ? "flex-1" : ""}`}
      style={{
        height: 46,
        paddingHorizontal: 22,
        borderWidth: 1.5,
        borderColor: destructive ? "#B36B5E" : OUTLINE,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Text
        className="font-manrope-bold"
        style={{ fontSize: 14, color: destructive ? "#7A3B30" : DARK }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CardShell({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className="rounded-3xl mb-3"
      style={{
        backgroundColor: "#FFFFFF",
        padding: 18,
      }}
    >
      {children}
    </View>
  );
}

function CardHeader({
  partnerName,
  dateTimeLabel,
  venueName,
  rawDateTime,
  pill,
}: {
  partnerName: string;
  dateTimeLabel: string;
  venueName: string;
  rawDateTime: string;
  pill: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <View className="flex-row items-start justify-between mb-1.5" style={{ gap: 12 }}>
        <Text
          testID="meetup-partner"
          className="font-jakarta flex-1"
          style={{ fontSize: 20, color: DARK }}
        >
          With {partnerName}
        </Text>
        {pill}
      </View>
      <View className="flex-row items-center" style={{ gap: 6 }}>
        <Text
          testID="meetup-datetime"
          className="font-manrope-semi"
          style={{ fontSize: 13, color: DARK }}
          accessibilityLabel={rawDateTime}
        >
          {dateTimeLabel}
        </Text>
        <Text className="font-manrope" style={{ fontSize: 13, color: MUTED }}>
          ·
        </Text>
        <Text
          testID="meetup-venue"
          className="font-manrope flex-1"
          style={{ fontSize: 13, color: MUTED }}
          numberOfLines={1}
        >
          {venueName}
        </Text>
      </View>
    </View>
  );
}

export default function ConfirmedMeetupsScreen() {
  const meetupsQuery = useQuery(trpc.meetup.getConfirmed.queryOptions());
  const pendingQuery = useQuery(trpc.meetup.list.queryOptions({ status: "pending" }));
  const [meetupModal, setMeetupModal] = useState<MeetupFlowMode | null>(null);

  const reportAttendanceMutation = useMutation(
    trpc.meetup.reportAttendance.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
      },
      onError: (err) => Alert.alert("Error", err.message),
    }),
  );

  const cancelMutation = useMutation(
    trpc.meetup.cancelMeetup.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
        void queryClient.invalidateQueries(trpc.meetup.list.queryOptions({ status: "pending" }));
        Alert.alert("Meetup cancelled", "The meetup has been cancelled.");
      },
      onError: (err) => Alert.alert("Error", err.message),
    }),
  );

  const withdrawMutation = useMutation(
    trpc.meetup.withdrawMeetup.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.list.queryOptions({ status: "pending" }));
        Alert.alert("Proposal withdrawn", "Your proposal has been withdrawn.");
      },
      onError: (err) => Alert.alert("Error", err.message),
    }),
  );

  if (meetupsQuery.isPending || pendingQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  const meetups = meetupsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];

  if (
    meetups.length === 0 &&
    pending.length === 0 &&
    !meetupsQuery.isFetching &&
    !pendingQuery.isFetching
  ) {
    return (
      <Container isScrollable={false}>
        <View testID="no-meetups-state" className="flex-1 items-center justify-center px-8">
          <View
            className="items-center justify-center rounded-full mb-6"
            style={{ width: 72, height: 72, backgroundColor: CARD }}
          >
            <Text style={{ fontSize: 32 }}>☕</Text>
          </View>
          <Text
            className="font-jakarta text-center mb-2"
            style={{ fontSize: 24, color: DARK }}
          >
            No meetups yet
          </Text>
          <Text
            className="font-manrope text-center"
            style={{ fontSize: 14, color: MUTED, lineHeight: 20 }}
          >
            Propose a meetup to a match to get your coffee book started.
          </Text>
        </View>
      </Container>
    );
  }

  function handleCancel(meetupId: string) {
    Alert.alert("Cancel meetup", "Are you sure you want to cancel this meetup?", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel meetup",
        style: "destructive",
        onPress: () => cancelMutation.mutate({ meetupId }),
      },
    ]);
  }

  function handleWithdraw(meetupId: string) {
    Alert.alert("Withdraw proposal", "Are you sure you want to withdraw this proposal?", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: () => withdrawMutation.mutate({ meetupId }),
      },
    ]);
  }

  const scheduledCount = meetups.length;
  const pendingCount = pending.length;

  return (
    <Container isScrollable={false}>
      <MeetupFlowModal mode={meetupModal} onDismiss={() => setMeetupModal(null)} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 }}>
          <Text
            className="font-jakarta"
            style={{ fontSize: 42, lineHeight: 46, color: DARK, letterSpacing: -0.5 }}
          >
            Meetups
          </Text>
          <View className="flex-row items-center" style={{ gap: 8, marginTop: 4 }}>
            <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
              {scheduledCount} scheduled
            </Text>
            {pendingCount > 0 && (
              <>
                <Text className="font-manrope" style={{ fontSize: 14, color: MUTED }}>
                  ·
                </Text>
                <Text
                  className="font-manrope-semi"
                  style={{ fontSize: 14, color: GOLD }}
                >
                  {pendingCount} pending
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Pending proposals */}
        {pending.length > 0 && (
          <View testID="pending-proposals-section" style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground mb-3"
              style={{ fontSize: 11, letterSpacing: 2, color: MUTED, paddingHorizontal: 4 }}
            >
              PENDING
            </Text>

            {pending.map((p) => {
              const isOutgoing = p.isProposer;

              return (
                <CardShell key={p.id} testID="pending-proposal-card">
                  <CardHeader
                    partnerName={p.partner.name}
                    dateTimeLabel={formatDayTime(p.scheduledAt)}
                    venueName={p.venue.name}
                    rawDateTime={toDate(p.scheduledAt)?.toISOString() ?? ""}
                    pill={
                      <StatusPill
                        label={isOutgoing ? "Waiting" : "Their turn"}
                        tone={isOutgoing ? "muted" : "mint"}
                      />
                    }
                  />

                  {isOutgoing ? (
                    <>
                      <Text
                        testID="awaiting-response-label"
                        className="font-manrope text-center"
                        style={{
                          fontSize: 12,
                          color: MUTED,
                          fontStyle: "italic",
                          marginBottom: 12,
                        }}
                      >
                        Awaiting response from {p.partner.name}
                      </Text>
                      <SecondaryPill
                        testID="withdraw-proposal-btn"
                        label="Withdraw"
                        onPress={() => handleWithdraw(p.id)}
                        disabled={withdrawMutation.isPending}
                        destructive
                      />
                    </>
                  ) : (
                    <PrimaryPill
                      testID="respond-to-proposal-btn"
                      label="Respond  →"
                      onPress={() => setMeetupModal({ type: "respond", meetupId: p.id })}
                    />
                  )}
                </CardShell>
              );
            })}
          </View>
        )}

        {/* Confirmed meetups */}
        {meetups.length > 0 && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text
              className="font-manrope-semi tracking-widest text-brand-muted-foreground mb-3"
              style={{ fontSize: 11, letterSpacing: 2, color: MUTED, paddingHorizontal: 4 }}
            >
              SCHEDULED
            </Text>

            {meetups.map((m) => {
              const status = meetupCardStatus(m);

              return (
                <CardShell key={m.meetupId} testID="meetup-card">
                  <CardHeader
                    partnerName={m.partner.name}
                    dateTimeLabel={formatDayTime(m.scheduledAt)}
                    venueName={m.venue.name}
                    rawDateTime={toDate(m.scheduledAt)?.toISOString() ?? ""}
                    pill={<StatusPill label={status.pillLabel} tone={status.pillTone} />}
                  />

                  {/* Future meetup actions */}
                  {!m.isPast && (
                    <View className="flex-row" style={{ gap: 10 }}>
                      <PrimaryPill
                        testID="reschedule-meetup-btn"
                        label={status.rescheduleLabel}
                        disabled={status.rescheduleDisabled}
                        onPress={() =>
                          setMeetupModal({
                            type: "reschedule",
                            meetupId: m.meetupId,
                            currentVenueId: m.venue.id,
                            currentScheduledAt: m.scheduledAt,
                          })
                        }
                        flex
                      />
                      <SecondaryPill
                        testID="cancel-meetup-btn"
                        label="Cancel"
                        onPress={() => handleCancel(m.meetupId)}
                        disabled={cancelMutation.isPending}
                        destructive
                        flex
                      />
                    </View>
                  )}

                  {/* Past — attendance prompt */}
                  {m.isPast && !m.hasReported && (
                    <View testID="attendance-prompt">
                      <Text
                        testID="meetup-past-label"
                        className="font-manrope-semi mb-3"
                        style={{ fontSize: 13, color: DARK }}
                      >
                        Did your meetup take place?
                      </Text>
                      <View className="flex-row" style={{ gap: 10 }}>
                        <PrimaryPill
                          testID="attendance-yes-btn"
                          label="We met up"
                          disabled={reportAttendanceMutation.isPending}
                          onPress={() =>
                            reportAttendanceMutation.mutate(
                              { meetupId: m.meetupId, attended: true },
                              {
                                onSuccess: () =>
                                  Alert.alert(
                                    "Thanks!",
                                    `You reported attending this meetup — wait for ${m.partner.name} to respond.`,
                                  ),
                              },
                            )
                          }
                          flex
                        />
                        <SecondaryPill
                          testID="attendance-no-btn"
                          label="We didn't"
                          disabled={reportAttendanceMutation.isPending}
                          onPress={() =>
                            reportAttendanceMutation.mutate(
                              { meetupId: m.meetupId, attended: false },
                              {
                                onSuccess: () =>
                                  Alert.alert(
                                    "No worries",
                                    `Want to set up another moment with ${m.partner.name}?`,
                                    [
                                      { text: "Not now", style: "cancel" },
                                      {
                                        text: "Propose again",
                                        onPress: () =>
                                          setMeetupModal({
                                            type: "propose",
                                            partnerId: m.partner.id,
                                            partnerName: m.partner.name,
                                          }),
                                      },
                                    ],
                                  ),
                              },
                            )
                          }
                          flex
                        />
                      </View>
                    </View>
                  )}

                  {/* Past — already reported */}
                  {m.isPast && m.hasReported && (
                    <Text
                      testID="attendance-reported-label"
                      className="font-manrope"
                      style={{ fontSize: 12, color: MUTED }}
                    >
                      {m.myAttendance
                        ? `You reported attending this meetup`
                        : `You reported not attending this meetup`}
                    </Text>
                  )}
                </CardShell>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Container>
  );
}
