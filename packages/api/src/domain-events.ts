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
