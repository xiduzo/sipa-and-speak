import { createFileRoute } from "@tanstack/react-router";

import { PublicShell } from "@/components/site-shell";

export const Route = createFileRoute("/child-safety")({
  component: ChildSafetyPage,
});

const SUPPORT_EMAIL = "hello@sipandspeak.nl";
const CHILD_SAFETY_EMAIL = "child-safety@sipandspeak.nl";

// TODO: keep this in sync whenever the standards change.
const LAST_UPDATED = "19 July 2026";

export function ChildSafetyPage() {
  return (
    <PublicShell>
      <main className="container mx-auto max-w-2xl break-words px-4 py-12 leading-relaxed">
        <h1 className="mb-4 text-2xl font-bold sm:text-3xl">
          Child Safety Standards
        </h1>

        <p className="mb-6 text-muted-foreground">
          Sip &amp; Speak (published on Google Play by xiduzo) is an
          adults-only, in-person language-exchange platform. This page sets out
          the standards we follow to keep children safe and to prohibit child
          sexual abuse and exploitation (CSAE) on our service. Last updated{" "}
          {LAST_UPDATED}.
        </p>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            Zero tolerance for CSAE
          </h2>
          <p>
            Sip &amp; Speak strictly prohibits child sexual abuse and
            exploitation (CSAE) in every form. This includes, without
            limitation, child sexual abuse material (CSAM), grooming,
            sextortion, trafficking, sexualised commentary about minors, and
            any content or behaviour that sexualises a person under 18. Anyone
            who engages in such conduct — or attempts to — will be permanently
            removed from Sip &amp; Speak and reported to the appropriate
            authorities.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">Adults-only service</h2>
          <p>
            Sip &amp; Speak is intended for users aged 18 and over. Accounts
            found to belong to a person under 18 are removed. We do not
            knowingly collect personal data from children. If you believe a
            child is using the service, contact us at{" "}
            <a
              className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={`mailto:${CHILD_SAFETY_EMAIL}`}
            >
              {CHILD_SAFETY_EMAIL}
            </a>{" "}
            and we will take action.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            How we prevent, detect, and respond
          </h2>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              <strong>Prevent.</strong> Our Community Code and Terms of Use
              forbid any sexual content involving minors and any contact of a
              sexual nature with a minor. Users must agree to these terms
              before using Sip &amp; Speak.
            </li>
            <li>
              <strong>Detect.</strong> We provide in-app reporting on every
              profile, chat, and meet-up. Reports flagged as CSAE-related are
              routed to a human reviewer as the highest priority and are never
              closed automatically.
            </li>
            <li>
              <strong>Respond.</strong> Confirmed CSAE results in immediate,
              permanent removal of the account, preservation of evidence, and
              a report to the National Center for Missing &amp; Exploited
              Children (NCMEC) where required, and to Dutch law enforcement or
              the relevant local authorities. We also cooperate with lawful
              requests from law enforcement.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            How to report CSAE or a child-safety concern
          </h2>
          <p className="mb-2">
            If you see or experience anything on Sip &amp; Speak that
            sexualises or endangers a minor, please report it right away:
          </p>
          <ul className="ml-5 list-disc space-y-2">
            <li>
              Use the in-app <em>Report</em> action on the profile, chat, or
              meet-up.
            </li>
            <li>
              Email our Child Safety point of contact at{" "}
              <a
                className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href={`mailto:${CHILD_SAFETY_EMAIL}`}
              >
                {CHILD_SAFETY_EMAIL}
              </a>
              . We aim to respond within one business day.
            </li>
            <li>
              If a child is in immediate danger, contact your local emergency
              number first (in the Netherlands: <strong>112</strong>). You can
              also report CSAM directly to{" "}
              <a
                className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href="https://www.offlimits.nl/"
                target="_blank"
                rel="noreferrer"
              >
                Offlimits (formerly Meldpunt Kinderporno)
              </a>{" "}
              in the Netherlands or{" "}
              <a
                className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href="https://report.cybertip.org/"
                target="_blank"
                rel="noreferrer"
              >
                NCMEC CyberTipline
              </a>{" "}
              internationally.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            Compliance with law and platform policies
          </h2>
          <p>
            Sip &amp; Speak complies with applicable child-safety laws,
            including the Dutch Wetboek van Strafrecht, EU Regulation
            2021/1232 and the EU Digital Services Act, and the U.S. federal
            reporting requirement under 18 U.S.C. § 2258A. We follow the
            Google Play Families and Child Safety Standards policies, and
            reserve the right to update these standards to remain aligned
            with them.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-xl font-semibold">
            Child Safety point of contact
          </h2>
          <p>
            For CSAE reports, child-safety questions, or requests from
            regulators and law enforcement, contact:{" "}
            <a
              className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={`mailto:${CHILD_SAFETY_EMAIL}`}
            >
              {CHILD_SAFETY_EMAIL}
            </a>
            . For general questions, email{" "}
            <a
              className="rounded-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
