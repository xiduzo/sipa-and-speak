export interface DeliveryMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  categoryIdentifier?: string;
}

export interface DeliveryTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface NotificationDelivery {
  send(messages: DeliveryMessage[]): Promise<DeliveryTicket[]>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export class ExpoPushDelivery implements NotificationDelivery {
  async send(messages: DeliveryMessage[]): Promise<DeliveryTicket[]> {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    const json = (await response.json()) as { data: DeliveryTicket[] };
    return json.data ?? [];
  }
}

export class InMemoryDelivery implements NotificationDelivery {
  readonly sent: DeliveryMessage[][] = [];
  private nextTickets: DeliveryTicket[] | null = null;

  async send(messages: DeliveryMessage[]): Promise<DeliveryTicket[]> {
    this.sent.push(messages);
    if (this.nextTickets) {
      const tickets = this.nextTickets;
      this.nextTickets = null;
      return tickets;
    }
    return messages.map((_, i) => ({ status: "ok" as const, id: `inmem-${i}` }));
  }

  setNextTickets(tickets: DeliveryTicket[]): void {
    this.nextTickets = tickets;
  }

  reset(): void {
    this.sent.length = 0;
    this.nextTickets = null;
  }
}

let currentDelivery: NotificationDelivery = new ExpoPushDelivery();

export function getDelivery(): NotificationDelivery {
  return currentDelivery;
}

export function setDelivery(delivery: NotificationDelivery): void {
  currentDelivery = delivery;
}
