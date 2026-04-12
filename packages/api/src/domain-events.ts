import { EventEmitter } from "events";

export interface LanguageProfileUpdatedEvent {
  userId: string;
  changedAt: Date;
}

type DomainEventMap = {
  LanguageProfileUpdated: [LanguageProfileUpdatedEvent];
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
