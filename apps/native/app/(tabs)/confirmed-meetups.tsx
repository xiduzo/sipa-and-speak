import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { MeetupFlowModal, type MeetupFlowMode } from "@/components/meetup-flow-modal";
import { trpc, queryClient } from "@/utils/trpc";

const DARK = "#2C1810";
const MUTED = "#8A7570";

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

  if (meetups.length === 0 && pending.length === 0 && !meetupsQuery.isFetching && !pendingQuery.isFetching) {
    return (
      <Container isScrollable={false}>
        <View testID="no-meetups-state" className="flex-1 items-center justify-center p-6">
          <Text className="text-foreground text-lg font-manrope-bold text-center mb-2">
            No meetups yet
          </Text>
          <Text className="font-manrope text-center" style={{ color: MUTED }}>
            Propose a meetup to a match to get started.
          </Text>
        </View>
      </Container>
    );
  }

  function handleCancel(meetupId: string) {
    Alert.alert(
      "Cancel meetup",
      "Are you sure you want to cancel this meetup?",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel meetup",
          style: "destructive",
          onPress: () => cancelMutation.mutate({ meetupId }),
        },
      ],
    );
  }

  return (
    <Container>
      <MeetupFlowModal mode={meetupModal} onDismiss={() => setMeetupModal(null)} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-foreground text-2xl font-manrope-bold mb-6">Meetups</Text>

        {pending.length > 0 && (
          <View testID="pending-proposals-section" className="mb-6">
            <Text className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-3" style={{ color: MUTED }}>Pending proposals</Text>
            {pending.map((p) => (
              <View
                key={p.id}
                testID="pending-proposal-card"
                className="bg-card border border-border rounded-2xl p-4 mb-3"
              >
                <Text className="font-manrope-semi text-base mb-1" style={{ color: DARK }}>
                  With {p.partner.name}
                </Text>
                <Text className="font-manrope text-sm mb-0.5" style={{ color: MUTED }}>{p.venue.name}</Text>
                <Text className="font-manrope text-sm mb-3" style={{ color: MUTED }}>{p.date} at {p.time}</Text>
                {p.isProposer ? (
                  <Text testID="awaiting-response-label" className="font-manrope text-xs text-center" style={{ color: MUTED }}>
                    Awaiting response from {p.partner.name}
                  </Text>
                ) : (
                  <Button
                    testID="respond-to-proposal-btn"
                    variant="primary"
                    onPress={() => setMeetupModal({ type: "respond", meetupId: p.id })}
                  >
                    <Button.Label>Respond to proposal</Button.Label>
                  </Button>
                )}
              </View>
            ))}
          </View>
        )}

        {meetups.map((m) => (
          <View
            key={m.meetupId}
            testID="meetup-card"
            className="bg-card border border-border rounded-2xl p-4 mb-4"
          >
            <Text testID="meetup-partner" className="font-manrope-semi text-base mb-1" style={{ color: DARK }}>
              With {m.partner.name}
            </Text>
            <Text testID="meetup-venue" className="font-manrope text-sm mb-0.5" style={{ color: MUTED }}>
              {m.venue.name}
            </Text>
            <Text testID="meetup-datetime" className="font-manrope text-sm mb-4" style={{ color: MUTED }}>
              {m.date} at {m.time}
            </Text>

            {!m.isPast && (
              <View className="flex flex-col gap-2">
                {/* #79 — Cancel action hidden when meetup is in the past */}
                <Button
                  testID="cancel-meetup-btn"
                  variant="ghost"
                  onPress={() => handleCancel(m.meetupId)}
                  isDisabled={cancelMutation.isPending}
                >
                  <Button.Label>Cancel meetup</Button.Label>
                </Button>

                {/* #86 — Reschedule action */}
                <Button
                  testID="reschedule-meetup-btn"
                  variant="outline"
                  onPress={() =>
                    setMeetupModal({
                      type: "reschedule",
                      meetupId: m.meetupId,
                      currentVenueId: m.venue.id,
                      currentDate: m.date,
                      currentTime: m.time,
                    })
                  }
                  isDisabled={m.reschedulePending}
                >
                  <Button.Label>
                    {m.reschedulePending && m.rescheduleIsFromMe
                      ? "Reschedule pending…"
                      : m.reschedulePending
                        ? "Partner proposed reschedule"
                        : "Reschedule"}
                  </Button.Label>
                </Button>
              </View>
            )}

            {/* #95 — Attendance prompt shown after meetup time passes */}
            {m.isPast && !m.hasReported && (
              <View testID="attendance-prompt" className="mt-2">
                <Text className="font-manrope-semi text-sm text-center mb-3" style={{ color: DARK }}>
                  Did your meetup take place?
                </Text>
                <View className="flex flex-row gap-2">
                  <Button
                    testID="attendance-yes-btn"
                    onPress={() =>
                      reportAttendanceMutation.mutate({ meetupId: m.meetupId, attended: true })
                    }
                    isDisabled={reportAttendanceMutation.isPending}
                    className="flex-1"
                  >
                    <Button.Label>We met up</Button.Label>
                  </Button>
                  <Button
                    testID="attendance-no-btn"
                    variant="outline"
                    onPress={() =>
                      reportAttendanceMutation.mutate({ meetupId: m.meetupId, attended: false })
                    }
                    isDisabled={reportAttendanceMutation.isPending}
                    className="flex-1"
                  >
                    <Button.Label>We didn't meet</Button.Label>
                  </Button>
                </View>
              </View>
            )}

            {m.isPast && m.hasReported && (
              <Text testID="attendance-reported-label" className="font-manrope text-xs text-center mt-2" style={{ color: MUTED }}>
                {m.myAttendance ? "You reported attending this meetup" : "You reported not attending this meetup"}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </Container>
  );
}
