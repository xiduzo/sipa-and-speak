import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/suggestions")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function CandidateCard({
  userId,
  name,
  image,
  spokenLanguages,
  learningLanguages,
  interests,
}: {
  userId: string;
  name: string;
  image: string | null;
  spokenLanguages: { language: string; proficiency: string | null }[];
  learningLanguages: string[];
  interests: string[];
}) {
  return (
    <a
      href={`/partner/${userId}`}
      data-testid="candidate-card"
      className="block bg-card border border-border rounded-2xl p-4 cursor-pointer hover:opacity-80 transition-opacity no-underline"
    >
      <div className="flex items-center gap-3 mb-3">
        {image ? (
          <img
            data-testid="candidate-photo"
            src={image}
            alt={name}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <div
            data-testid="candidate-photo-placeholder"
            className="w-14 h-14 rounded-full bg-muted flex items-center justify-center"
          >
            <span className="text-muted-foreground text-xl font-semibold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span data-testid="candidate-name" className="text-foreground text-lg font-semibold flex-1">
          {name}
        </span>
      </div>

      {spokenLanguages.length > 0 && (
        <div className="mb-2">
          <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Speaks</p>
          <div className="flex flex-wrap gap-1" data-testid="candidate-offered-languages">
            {spokenLanguages.map((l) => (
              <span key={l.language} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                {l.language}
              </span>
            ))}
          </div>
        </div>
      )}

      {learningLanguages.length > 0 && (
        <div className="mb-2">
          <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Learning</p>
          <div className="flex flex-wrap gap-1" data-testid="candidate-targeted-languages">
            {learningLanguages.map((lang) => (
              <span key={lang} className="bg-secondary/10 text-secondary-foreground text-xs px-2 py-0.5 rounded-full">
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {interests.length > 0 && (
        <div>
          <p className="text-muted-foreground text-xs uppercase font-medium mb-1">Topics</p>
          <div className="flex flex-wrap gap-1" data-testid="candidate-conversation-topics">
            {interests.map((topic) => (
              <span key={topic} className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </a>
  );
}

const APP_SHARE_URL = "https://sip-and-speak.app";
const APP_SHARE_MESSAGE =
  "I'm using Sip&Speak to find a language exchange partner at TU/e — you should join too! " +
  APP_SHARE_URL;

async function handleWebShare() {
  if (navigator.share) {
    await navigator.share({ title: "Sip&Speak", text: APP_SHARE_MESSAGE, url: APP_SHARE_URL });
  } else {
    await navigator.clipboard.writeText(APP_SHARE_URL);
    // Toast not available here without additional setup — inline alert as fallback
    alert("App link copied to clipboard!");
  }
}

function EmptySuggestionState() {
  return (
    <div data-testid="empty-suggestion-state" className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <p className="text-foreground text-xl font-semibold">No matches yet</p>
      <p className="text-muted-foreground max-w-sm">
        We couldn't find a match for your language yet — would you like to share this app with a friend?
      </p>
      <button
        data-testid="share-action"
        onClick={handleWebShare}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Share the app
      </button>
    </div>
  );
}

function RouteComponent() {
  const discoverQuery = useQuery(trpc.matching.discover.queryOptions({}));

  const partners = discoverQuery.data?.partners ?? [];

  if (discoverQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!discoverQuery.isPending && partners.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-foreground text-2xl font-bold mb-6">Suggestions</h1>
        <EmptySuggestionState />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-foreground text-2xl font-bold mb-6">Suggestions</h1>
      <div className="flex flex-col gap-3">
        {partners.map((partner) => (
          <CandidateCard
            key={partner.userId}
            userId={partner.userId}
            name={partner.name}
            image={partner.image}
            spokenLanguages={partner.spokenLanguages}
            learningLanguages={partner.learningLanguages}
            interests={partner.interests}
          />
        ))}
      </div>
    </div>
  );
}
