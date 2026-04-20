import { EventEmitter } from "events";

export interface LanguageProfileUpdatedEvent {
  userId: string;
  changedAt: Date;
}

export interface InterestProfileUpdatedEvent {
  userId: string;
  changedAt: Date;
}

export interface ProfileCompletedEvent {
  userId: string;
  completedAt: Date;
}

export interface MatchRequestSentEvent {
  matchRequestId: string;
  requesterId: string;
  receiverId: string;
  sentAt: Date;
}

export interface MatchRequestAcceptedEvent {
  matchRequestId: string;
  requesterId: string;
  receiverId: string;
  acceptedAt: Date;
}

export interface MatchRequestDeclinedEvent {
  matchRequestId: string;
  requesterId: string;
  receiverId: string;
  declinedAt: Date;
}

export interface MeetupProposedEvent {
  meetupId: string;
  proposerId: string;
  receiverId: string;
  venueName: string;
  date: string;
  time: string;
  proposedAt: Date;
}

export interface MeetupConfirmedEvent {
  meetupId: string;
  proposerId: string;
  receiverId: string;
  venueName: string;
  date: string;
  time: string;
  confirmedAt: Date;
}

export interface MeetupCounterProposedEvent {
  meetupId: string;
  /** The student who just counter-proposed (new proposer after role swap) */
  newProposerId: string;
  /** The student who must now respond (new receiver after role swap) */
  newReceiverId: string;
  venueName: string;
  date: string;
  time: string;
  round: number;
  counterProposedAt: Date;
}

export interface MeetupDeclinedEvent {
  meetupId: string;
  proposerId: string;
  receiverId: string;
  declinedAt: Date;
}

export interface MeetupCancelledEvent {
  meetupId: string;
  cancelledById: string;
  otherStudentId: string;
  cancelledAt: Date;
}

export interface MeetupRescheduleProposedEvent {
  meetupId: string;
  proposerId: string;
  receiverId: string;
  venueId: string;
  venueName: string;
  date: string;
  time: string;
  proposedAt: Date;
}

export interface MeetupRescheduledEvent {
  meetupId: string;
  proposerId: string;
  receiverId: string;
  venueName: string;
  newDate: string;
  newTime: string;
  rescheduledAt: Date;
}

export interface MeetupRescheduleDeclinedEvent {
  meetupId: string;
  proposerId: string;
  receiverId: string;
  venueName: string;
  originalDate: string;
  originalTime: string;
  declinedAt: Date;
}

export interface AttendanceReportedEvent {
  reportId: string;
  meetupId: string;
  studentId: string;
  partnerId: string;
  attended: boolean;
  reportedAt: Date;
}

export interface SipAndSpeakMomentCompletedEvent {
  meetupId: string;
  studentAId: string;
  studentBId: string;
  completedAt: Date;
}

export interface MeetupNotAttendedEvent {
  meetupId: string;
  studentAId: string;
  studentBId: string;
  recordedAt: Date;
}

export interface MessagingOptInPromptedEvent {
  meetupId: string;
  studentAId: string;
  studentBId: string;
  promptedAt: Date;
}

export interface MessagingAcceptedEvent {
  meetupId: string;
  studentId: string;
  partnerId: string;
  respondedAt: Date;
}

export interface MessagingDeclinedEvent {
  meetupId: string;
  studentId: string;
  partnerId: string;
  respondedAt: Date;
}

export interface ConversationOpenedEvent {
  conversationId: string;
  meetupId: string;
  studentAId: string;
  studentBId: string;
  openedAt: Date;
}

export interface MessagingDeclineOutcomeEvent {
  meetupId: string;
  studentAId: string;
  studentBId: string;
}

export interface MessagingNudgeNeededEvent {
  meetupId: string;
  /** The student who accepted and triggered the nudge */
  acceptingStudentId: string;
  /** The student who has not yet responded and should receive the nudge */
  pendingStudentId: string;
}

export interface MessageSentEvent {
  conversationId: string;
  senderId: string;
  recipientId: string;
  senderName: string;
}

export interface StudentFlaggedEvent {
  flagId: string;
  reporterId: string;
  targetId: string;
  reason: string;
  flaggedAt: Date;
}

// #90
export interface StudentWarnedEvent {
  flagId: string;
  targetId: string;
  moderatorId: string;
  warnedAt: Date;
}

// #100
export interface StudentSuspendedEvent {
  flagId: string;
  targetId: string;
  moderatorId: string;
  suspendedAt: Date;
}

// #105
export interface SuspensionLiftedEvent {
  targetId: string;
  moderatorId: string;
  liftedAt: Date;
}

// #108
export interface StudentRemovedEvent {
  flagId: string;
  targetId: string;
  moderatorId: string;
  removedAt: Date;
}

// #276 — Feature #275
export interface StudentProfileCompletedEvent {
  userId: string;
  completedAt: Date;
}

// #276 — Feature #275
export interface StudentProfileUpdatedEvent {
  userId: string;
  updatedAt: Date;
}

type DomainEventMap = {
  LanguageProfileUpdated: [LanguageProfileUpdatedEvent];
  InterestProfileUpdated: [InterestProfileUpdatedEvent];
  ProfileCompleted: [ProfileCompletedEvent];
  MatchRequestSent: [MatchRequestSentEvent];
  MatchRequestAccepted: [MatchRequestAcceptedEvent];
  MatchRequestDeclined: [MatchRequestDeclinedEvent];
  MeetupProposed: [MeetupProposedEvent];
  MeetupConfirmed: [MeetupConfirmedEvent];
  MeetupCounterProposed: [MeetupCounterProposedEvent];
  MeetupDeclined: [MeetupDeclinedEvent];
  MeetupCancelled: [MeetupCancelledEvent];
  MeetupRescheduleProposed: [MeetupRescheduleProposedEvent];
  MeetupRescheduled: [MeetupRescheduledEvent];
  MeetupRescheduleDeclined: [MeetupRescheduleDeclinedEvent];
  AttendanceReported: [AttendanceReportedEvent];
  SipAndSpeakMomentCompleted: [SipAndSpeakMomentCompletedEvent];
  MeetupNotAttended: [MeetupNotAttendedEvent];
  MessagingOptInPrompted: [MessagingOptInPromptedEvent];
  MessagingAccepted: [MessagingAcceptedEvent];
  MessagingDeclined: [MessagingDeclinedEvent];
  MessagingNudgeNeeded: [MessagingNudgeNeededEvent];
  ConversationOpened: [ConversationOpenedEvent];
  MessagingDeclineOutcome: [MessagingDeclineOutcomeEvent];
  MessageSent: [MessageSentEvent];
  StudentFlagged: [StudentFlaggedEvent];
  StudentWarned: [StudentWarnedEvent];
  StudentSuspended: [StudentSuspendedEvent];
  SuspensionLifted: [SuspensionLiftedEvent];
  StudentRemoved: [StudentRemovedEvent];
  StudentProfileCompleted: [StudentProfileCompletedEvent];
  StudentProfileUpdated: [StudentProfileUpdatedEvent];
};

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof DomainEventMap>(event: K, ...args: DomainEventMap[K]): boolean {
    return super.emit(event as string, ...args);
  }
  on<K extends keyof DomainEventMap>(
    event: K,
    listener: (...args: DomainEventMap[K]) => void,
  ): this {
    return super.on(event as string, listener);
  }
  off<K extends keyof DomainEventMap>(
    event: K,
    listener: (...args: DomainEventMap[K]) => void,
  ): this {
    return super.off(event as string, listener);
  }
}

export const domainEvents = new TypedEventEmitter();
