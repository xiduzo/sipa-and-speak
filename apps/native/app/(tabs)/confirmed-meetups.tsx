import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";

export default function ConfirmedMeetupsScreen() {
  const router = useRouter();
  const meetupsQuery = useQuery(trpc.meetup.getConfirmed.queryOptions());
  const pendingQuery = useQuery(trpc.meetup.list.queryOptions({ status: "pending" }));

  // Track which meetup has the reschedule form open
  const [reschedulingMeetupId, setReschedulingMeetupId] = useState<string | null>(null);
  const [rescheduleVenueId, setRescheduleVenueId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const venuesQuery = useQuery(trpc.venue.listForPicker.queryOptions());

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

  const rescheduleMutation = useMutation(
    trpc.meetup.proposeReschedule.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetup.getConfirmed.queryOptions());
        closeRescheduleForm();
        Alert.alert("Reschedule proposed", "Your reschedule request has been sent to your partner.");
      },
      onError: (err) => setRescheduleError(err.message),
    }),
  );

  function openRescheduleForm(meetupId: string, currentVenueId: string, currentDate: string, currentTime: string) {
    setReschedulingMeetupId(meetupId);
    setRescheduleVenueId(currentVenueId);
    setRescheduleDate(currentDate);
    setRescheduleTime(currentTime);
    setRescheduleError(null);
  }

  function closeRescheduleForm() {
    setReschedulingMeetupId(null);
    setRescheduleVenueId(null);
    setRescheduleDate("");
    setRescheduleTime("");
    setRescheduleError(null);
  }

  function handleRescheduleSubmit(meetupId: string) {
    setRescheduleError(null);
    if (!rescheduleVenueId) { setRescheduleError("Please select a location"); return; }
    if (!rescheduleDate.match(/^\d{4}-\d{2}-\d{2}$/)) { setRescheduleError("Enter a date in YYYY-MM-DD format"); return; }
    if (!rescheduleTime.match(/^\d{2}:\d{2}$/)) { setRescheduleError("Enter a time in HH:MM format"); return; }
    const proposed = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
    if (proposed <= new Date()) { setRescheduleError("Date and time must be in the future"); return; }
    rescheduleMutation.mutate({ meetupId, venueId: rescheduleVenueId, date: rescheduleDate, time: rescheduleTime });
  }

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
          <Text className="text-foreground text-lg font-semibold text-center mb-2">
            No meetups yet
          </Text>
          <Text className="text-muted-foreground text-center">
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
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text className="text-foreground text-2xl font-bold mb-6">Meetups</Text>

        {pending.length > 0 && (
          <View testID="pending-proposals-section" className="mb-6">
            <Text className="text-foreground text-base font-semibold mb-3">Pending proposals</Text>
            {pending.map((p) => (
              <View
                key={p.id}
                testID="pending-proposal-card"
                className="bg-card border border-border rounded-2xl p-4 mb-3"
              >
                <Text className="text-foreground font-semibold text-base mb-1">
                  With {p.partner.name}
                </Text>
                <Text className="text-muted-foreground text-sm mb-0.5">{p.venue.name}</Text>
                <Text className="text-muted-foreground text-sm mb-3">{p.date} at {p.time}</Text>
                {p.isProposer ? (
                  <Text testID="awaiting-response-label" className="text-muted-foreground text-xs text-center">
                    Awaiting response from {p.partner.name}
                  </Text>
                ) : (
                  <Button
                    testID="respond-to-proposal-btn"
                    variant="primary"
                    onPress={() => router.push({ pathname: "/respond-meetup", params: { meetupId: p.id } })}
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
            <Text testID="meetup-partner" className="text-foreground font-semibold text-base mb-1">
              With {m.partner.name}
            </Text>
            <Text testID="meetup-venue" className="text-muted-foreground text-sm mb-0.5">
              {m.venue.name}
            </Text>
            <Text testID="meetup-datetime" className="text-muted-foreground text-sm mb-4">
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
                {reschedulingMeetupId !== m.meetupId ? (
                  <Button
                    testID="reschedule-meetup-btn"
                    variant="outline"
                    onPress={() => openRescheduleForm(m.meetupId, m.venue.id, m.date, m.time)}
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
                ) : (
                  <View testID="reschedule-form" className="mt-2">
                    <Text className="text-foreground font-semibold mb-2">Location</Text>
                    {venuesQuery.isPending ? (
                      <Spinner />
                    ) : (
                      <View className="flex flex-col gap-2 mb-4">
                        {(venuesQuery.data ?? []).map((v) => (
                          <TouchableOpacity
                            key={v.id}
                            testID="reschedule-venue-option"
                            onPress={() => setRescheduleVenueId(v.id)}
                            className={`border rounded-xl p-3 ${rescheduleVenueId === v.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                          >
                            <Text className={`font-medium ${rescheduleVenueId === v.id ? "text-primary" : "text-foreground"}`}>{v.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <Text className="text-foreground font-semibold mb-2">Date (YYYY-MM-DD)</Text>
                    <View className="border border-border rounded-xl px-3 py-2 bg-card mb-4">
                      <Text
                        testID="reschedule-date-input"
                        className="text-foreground"
                        onPress={() => {/* date picker placeholder */}}
                      >
                        {rescheduleDate || "YYYY-MM-DD"}
                      </Text>
                    </View>

                    <Text className="text-foreground font-semibold mb-2">Time (HH:MM)</Text>
                    <View className="border border-border rounded-xl px-3 py-2 bg-card mb-4">
                      <Text
                        testID="reschedule-time-input"
                        className="text-foreground"
                      >
                        {rescheduleTime || "HH:MM"}
                      </Text>
                    </View>

                    {rescheduleError && (
                      <Text testID="reschedule-error" className="text-destructive text-sm mb-4">
                        {rescheduleError}
                      </Text>
                    )}

                    <View className="flex flex-row gap-2">
                      <Button
                        testID="reschedule-submit-btn"
                        onPress={() => handleRescheduleSubmit(m.meetupId)}
                        isDisabled={rescheduleMutation.isPending}
                        className="flex-1"
                      >
                        <Button.Label>
                          {rescheduleMutation.isPending ? "Sending…" : "Propose reschedule"}
                        </Button.Label>
                      </Button>
                      <Button
                        testID="reschedule-cancel-btn"
                        variant="ghost"
                        onPress={closeRescheduleForm}
                        className="flex-1"
                      >
                        <Button.Label>Cancel</Button.Label>
                      </Button>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* #95 — Attendance prompt shown after meetup time passes */}
            {m.isPast && !m.hasReported && (
              <View testID="attendance-prompt" className="mt-2">
                <Text className="text-foreground font-semibold text-sm text-center mb-3">
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
              <Text testID="attendance-reported-label" className="text-muted-foreground text-xs text-center mt-2">
                {m.myAttendance ? "You reported attending this meetup" : "You reported not attending this meetup"}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </Container>
  );
}
