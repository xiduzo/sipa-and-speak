import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/partner/$id")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }
    return { session };
  },
});

function RouteComponent() {
  const { id } = Route.useParams();
  const profileQuery = useQuery(trpc.matching.getPartnerProfile.queryOptions({ userId: id }));

  if (profileQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const profile = profileQuery.data;

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <p className="text-foreground text-lg font-semibold">Profile no longer available</p>
        <p className="text-muted-foreground">This candidate may have left the platform.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex flex-col items-center mb-6">
        {profile.image ? (
          <img
            data-testid="profile-photo"
            src={profile.image}
            alt={profile.name}
            className="w-24 h-24 rounded-full object-cover mb-3"
          />
        ) : (
          <div
            data-testid="profile-photo-placeholder"
            className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-3"
          >
            <span className="text-muted-foreground text-3xl font-semibold">
              {profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <h1 data-testid="profile-name" className="text-foreground text-2xl font-bold">
          {profile.name}
        </h1>
        {(profile.age != null || profile.university) && (
          <p className="text-muted-foreground mt-1">
            {[profile.age != null ? `${profile.age} years` : null, profile.university]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>

      {profile.bio && (
        <div className="mb-4">
          <h2 className="text-foreground font-semibold mb-1">Introduction</h2>
          <p className="text-muted-foreground">{profile.bio}</p>
        </div>
      )}

      {profile.spokenLanguages.length > 0 && (
        <div className="mb-4">
          <h2 className="text-foreground font-semibold mb-2">Speaks</h2>
          <div className="flex flex-wrap gap-2" data-testid="profile-offered-languages">
            {profile.spokenLanguages.map((l) => (
              <span key={l.language} className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full">
                {l.language}{l.proficiency ? ` · ${l.proficiency}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.learningLanguages.length > 0 && (
        <div className="mb-4">
          <h2 className="text-foreground font-semibold mb-2">Learning</h2>
          <div className="flex flex-wrap gap-2" data-testid="profile-targeted-languages">
            {profile.learningLanguages.map((lang) => (
              <span key={lang} className="bg-secondary/10 text-secondary-foreground text-sm px-3 py-1 rounded-full">
                {lang}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.interests.length > 0 && (
        <div className="mb-4">
          <h2 className="text-foreground font-semibold mb-2">Topics</h2>
          <div className="flex flex-wrap gap-2" data-testid="profile-topics">
            {profile.interests.map((topic) => (
              <span key={topic} className="bg-muted text-muted-foreground text-sm px-3 py-1 rounded-full">
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
