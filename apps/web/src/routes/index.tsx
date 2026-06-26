import { Button } from "@sip-and-speak/ui/components/button";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  Coffee,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const SUPPORT_EMAIL = "hello@sipandspeak.nl";

// No public App Store / Play listing yet, so the primary action is an invite
// request by email. When store listings exist, point this at them instead —
// every CTA on the page reads from this one constant.
const INVITE_HREF = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
  "Sip & Speak — request an invite",
)}`;

// Footer / inline link styling, matched to the legal pages (privacy, terms…).
const LINK =
  "rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// The signature: example buddies the hero pairing card cycles through. "You"
// always speak EN and learn what the buddy speaks; the buddy mirrors it — so
// the reciprocity (you learn theirs, they learn yours) is exact for every pair.
const BUDDIES = [
  { name: "Lotte", code: "NL", interest: "cinema" },
  { name: "Mateo", code: "ES", interest: "football" },
  { name: "Yuki", code: "JA", interest: "design" },
  { name: "Amir", code: "AR", interest: "cooking" },
] as const;

const STEPS = [
  {
    n: "01",
    tint: "text-primary/30",
    title: "Tell us your languages",
    body: "Pick what you speak and what you want to practise — anywhere from A1 to C2.",
  },
  {
    n: "02",
    tint: "text-secondary/40",
    title: "Get matched with a local",
    body: "We pair you with someone whose languages mirror yours and who shares an interest.",
  },
  {
    n: "03",
    tint: "text-tertiary/50",
    title: "Meet & sip",
    body: "Meet at a café in Eindhoven, talk half in each language, then keep chatting in the app.",
  },
] as const;

// The real interest taxonomy from the app's enrolment screen.
const INTERESTS = [
  "Art",
  "Tech",
  "Music",
  "Cooking",
  "Sustainability",
  "Film",
  "Cosmology",
  "Photography",
  "Board games",
  "Hiking",
  "Yoga",
  "Literature",
  "Startups",
  "Design",
  "Travel",
  "Gaming",
  "Football",
  "Philosophy",
  "Theatre",
] as const;

function HomePage() {
  return (
    <div className="min-h-svh scroll-smooth bg-background font-sans text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Interests />
        <Trust />
        <CtaBand />
      </main>
      <SiteFooter />
    </div>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      className={`flex items-center gap-2 font-heading text-lg font-extrabold tracking-tight ${className}`}
    >
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Coffee className="size-4" />
      </span>
      <span>
        Sip <span className="text-primary">&amp;</span> Speak
      </span>
    </a>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground sm:flex">
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#community" className="transition-colors hover:text-foreground">
            Community
          </a>
        </nav>
        <Button render={<a href={INVITE_HREF} />}>Request an invite</Button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Warmth — a low, static glow in each brand accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-28 size-72 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 top-40 size-80 rounded-full bg-secondary/15 blur-3xl"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <MapPin className="size-3.5 text-primary" />
            Practise a language in Eindhoven
          </p>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Find a language buddy
            <br />
            over{" "}
            <span className="font-caveat text-[1.15em] font-bold leading-none text-primary">
              coffee
            </span>
            .
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Sip &amp; Speak pairs you with a local who speaks the language you’re
            learning — and is learning yours. Meet in person. Message after.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" render={<a href={INVITE_HREF} />}>
              Request an invite
              <ArrowRight />
            </Button>
            <Button size="lg" variant="ghost" render={<a href="#how" />}>
              See how it works
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Free to join · Meet over a drink, not a screen.
          </p>
        </div>
        <PairingCard />
      </div>
    </section>
  );
}

function PairingCard() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const interval = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % BUDDIES.length);
        setVisible(true);
      }, 280);
    }, 3600);
    return () => window.clearInterval(interval);
  }, []);

  const buddy = BUDDIES[index];

  return (
    <div className="relative lg:justify-self-end">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-xl shadow-foreground/5 sm:p-6">
        <div className="mb-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Coffee className="size-3.5 text-primary" />
          Saturday · 15:00 · a café in Eindhoven
        </div>

        <div
          className="space-y-2 transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <PersonRow
            tone="primary"
            initial="Y"
            name="You"
            tag="you"
            speaks="EN"
            learning={buddy.code}
          />

          <div className="flex justify-center" aria-hidden>
            <span className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm">
              <ArrowLeftRight className="size-4" />
            </span>
          </div>

          <PersonRow
            tone="secondary"
            initial={buddy.name[0]}
            name={buddy.name}
            tag="local"
            speaks={buddy.code}
            learning="EN"
          />

          <div className="!mt-4 flex items-center justify-center gap-2 rounded-2xl border border-gold/30 bg-gold/15 px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-gold" />
            Both into{" "}
            <span className="font-semibold text-foreground">{buddy.interest}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  tone,
  initial,
  name,
  tag,
  speaks,
  learning,
}: {
  tone: "primary" | "secondary";
  initial: string;
  name: string;
  tag: string;
  speaks: string;
  learning: string;
}) {
  const avatar =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-secondary/10 text-secondary";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-full font-heading text-sm font-bold ${avatar}`}
      >
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{name}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <LangPill label="speaks" code={speaks} />
          <LangPill label="learning" code={learning} tone={tone} />
        </div>
      </div>
    </div>
  );
}

function LangPill({
  label,
  code,
  tone,
}: {
  label: string;
  code: string;
  tone?: "primary" | "secondary";
}) {
  const codeTint =
    tone === "primary"
      ? "bg-primary/15 text-primary"
      : tone === "secondary"
        ? "bg-secondary/15 text-secondary"
        : "bg-muted text-foreground";
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-card py-0.5 pl-2 pr-1 text-xs text-muted-foreground">
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${codeTint}`}
      >
        {code}
      </span>
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {lead ? <p className="mt-4 text-lg text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

function HowItWorks() {
  return (
    <section
      id="how"
      className="scroll-mt-24 border-t border-border/60 bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="How it works"
          title="Three sips to your first conversation"
        />
        <ol className="mt-12 grid gap-10 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="relative">
              <span
                className={`font-heading text-5xl font-extrabold leading-none ${step.tint}`}
              >
                {step.n}
              </span>
              <h3 className="mt-4 font-heading text-xl font-bold">{step.title}</h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Interests() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Common ground"
          title="Talk about what you love"
          lead="We match on more than language — pick the topics you actually want to talk about, and we’ll find someone who’s into them too."
        />
        <ul className="mt-10 flex flex-wrap gap-2.5">
          {INTERESTS.map((interest, i) => {
            // A few chips carry a brand tint so the row has life without noise.
            const accent =
              i % 7 === 2
                ? "border-primary/30 bg-primary/10 text-primary"
                : i % 7 === 5
                  ? "border-secondary/30 bg-secondary/10 text-secondary"
                  : "border-border bg-card text-foreground";
            return (
              <li
                key={interest}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium ${accent}`}
              >
                {interest}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section
      id="community"
      className="scroll-mt-24 border-t border-border/60 bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          eyebrow="Community"
          title="Built on trust, not tracking"
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <article className="rounded-3xl border border-border bg-card p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-secondary/10 text-secondary">
              <ShieldCheck className="size-5" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-bold">
              Real people, real places
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Everyone uses a real name, meet-ups happen in public venues, and
              we look out for one another. It’s all in our{" "}
              <a className={LINK} href="/community-code">
                Community Code
              </a>
              .
            </p>
          </article>
          <article className="rounded-3xl border border-border bg-card p-6">
            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <h3 className="mt-4 font-heading text-xl font-bold">
              Your data, your call
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              We ask for the little we need to match you — no ads, no tracking.
              Read the{" "}
              <a className={LINK} href="/privacy">
                Privacy Statement
              </a>{" "}
              or{" "}
              <a className={LINK} href="/delete-account">
                delete your account
              </a>{" "}
              whenever you like.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="bg-tertiary text-tertiary-foreground">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20">
        <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
          Pull up a chair.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-tertiary-foreground/80">
          Your first conversation in a new language is one coffee away.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            className="bg-background text-foreground hover:bg-background/90"
            render={<a href={INVITE_HREF} />}
          >
            Request an invite
            <ArrowRight />
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Practise a language with a local, over coffee. Made in Eindhoven,
              the Netherlands.
            </p>
            <a className={`mt-3 inline-block text-sm ${LINK}`} href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </div>

          <nav aria-label="Legal" className="text-sm">
            <h3 className="font-heading font-bold">Legal</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a className={LINK} href="/privacy">
                  Privacy Statement
                </a>
              </li>
              <li>
                <a className={LINK} href="/terms">
                  Terms of Use
                </a>
              </li>
              <li>
                <a className={LINK} href="/community-code">
                  Community Code
                </a>
              </li>
              <li>
                <a className={LINK} href="/delete-account">
                  Delete your account
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Sip and Speak" className="text-sm">
            <h3 className="font-heading font-bold">Sip &amp; Speak</h3>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li>
                <a className={LINK} href="#how">
                  How it works
                </a>
              </li>
              <li>
                <a className={LINK} href="#community">
                  Community
                </a>
              </li>
              <li>
                <a className={LINK} href={INVITE_HREF}>
                  Request an invite
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-1 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Sip &amp; Speak</p>
          <p>Made in Eindhoven, the Netherlands.</p>
        </div>
      </div>
    </footer>
  );
}

export { HomePage };
