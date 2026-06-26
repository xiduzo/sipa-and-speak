import { and, eq, ne, inArray, notInArray, or, sql, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "@sip-and-speak/db";
import { languageProfile, userLanguage, userInterest } from "@sip-and-speak/db/schema/identity";
import { matchRequest, studentMatch } from "@sip-and-speak/db/schema/matching";
import { meetup, attendanceReport } from "@sip-and-speak/db/schema/scheduling";
import { user } from "@sip-and-speak/db/schema/auth";
import { protectedProcedure, router } from "../../index";
import { buildExcludedUserIds, scoreCandidates } from "./matching-utils";
import {
  MatchRequest,
  MatchRuleError,
  type MatchRequestSnapshot,
} from "./match-request-aggregate";
import { commitAndEmit } from "../../unit-of-work";

/** Convert aggregate rule violations into the right tRPC error code. */
function toTrpcError(err: unknown): never {
  if (err instanceof MatchRuleError) {
    throw new TRPCError({ code: err.code, message: err.message });
  }
  throw err;
}

/** Load the MatchRequest snapshot the aggregate needs for status transitions. */
async function loadMatchRequestSnapshot(
  id: string,
): Promise<MatchRequestSnapshot | null> {
  const row = await db.query.matchRequest.findFirst({
    where: eq(matchRequest.id, id),
  });
  if (!row) return null;
  return {
    id: row.id,
    requesterId: row.requesterId,
    receiverId: row.receiverId,
    status: row.status,
  };
}

// --- Router ---

export const matchingRouter = router({
  discover: protectedProcedure
    .input(
      z.object({
        filterLanguage: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const myLanguages = await db
        .select()
        .from(userLanguage)
        .where(eq(userLanguage.userId, userId));

      const mySpoken = myLanguages
        .filter((l) => l.type === "spoken")
        .map((l) => l.language);
      const myLearning = myLanguages
        .filter((l) => l.type === "learning")
        .map((l) => l.language);

      // #125 — Build exclusion list: candidates with an active request in either direction
      const activeRequests = await db
        .select({
          requesterId: matchRequest.requesterId,
          receiverId: matchRequest.receiverId,
        })
        .from(matchRequest)
        .where(
          and(
            or(
              eq(matchRequest.requesterId, userId),
              eq(matchRequest.receiverId, userId),
            ),
            // "voided" = an unmatch (#7) — keep that pair out of discover for good.
            inArray(matchRequest.status, ["pending", "accepted", "voided"]),
          ),
        );

      const excludedUserIds = buildExcludedUserIds(userId, activeRequests);

      // Fetch all other users who have completed onboarding
      const otherProfiles = await db
        .select()
        .from(languageProfile)
        .where(
          and(
            ne(languageProfile.userId, userId),
            eq(languageProfile.onboardingComplete, true),
            excludedUserIds.length > 0
              ? notInArray(languageProfile.userId, excludedUserIds)
              : undefined,
          ),
        );

      if (otherProfiles.length === 0) {
        return { partners: [], nextCursor: undefined };
      }

      const otherUserIds = otherProfiles.map((p) => p.userId);

      // Batch-fetch languages and interests for all candidates
      const allLanguages = await db
        .select()
        .from(userLanguage)
        .where(inArray(userLanguage.userId, otherUserIds));

      const allInterests = await db
        .select()
        .from(userInterest)
        .where(inArray(userInterest.userId, otherUserIds));

      // Fetch user info (name, image) for candidates — exclude suspended AND
      // permanently removed Students (#100/#108) and soft-deleted accounts (#447)
      const allUsers = await db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(
          and(
            inArray(user.id, otherUserIds),
            notInArray(user.studentStatus, ["suspended", "removed"]),
            isNull(user.deletedAt),
          ),
        );

      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      // Group languages and interests by userId
      const langByUser = new Map<string, typeof allLanguages>();
      for (const l of allLanguages) {
        const arr = langByUser.get(l.userId) ?? [];
        arr.push(l);
        langByUser.set(l.userId, arr);
      }

      const interestByUser = new Map<string, typeof allInterests>();
      for (const i of allInterests) {
        const arr = interestByUser.get(i.userId) ?? [];
        arr.push(i);
        interestByUser.set(i.userId, arr);
      }

      // Build candidate list (suspended users absent from userMap are excluded)
      const candidates = otherProfiles
        .filter((profile) => userMap.has(profile.userId))
        .map((profile) => {
          const langs = langByUser.get(profile.userId) ?? [];
          const interests = interestByUser.get(profile.userId) ?? [];
          const userInfo = userMap.get(profile.userId)!;
          return {
            userId: profile.userId,
            name: userInfo.name ?? "Unknown",
            image: userInfo.image ?? null,
            bio: profile.bio,
            university: profile.university,
            age: profile.age,
            spokenLanguages: langs
              .filter((l) => l.type === "spoken")
              .map((l) => ({ language: l.language, proficiency: l.proficiency })),
            learningLanguages: langs
              .filter((l) => l.type === "learning")
              .map((l) => l.language),
            interests: interests.map((i) => i.interest),
          };
        });

      const scored = scoreCandidates(
        { spoken: mySpoken, learning: myLearning },
        candidates,
        input.filterLanguage ? { language: input.filterLanguage } : undefined,
      );

      // Cursor-based pagination (cursor = index offset as string)
      const startIndex = input.cursor ? parseInt(input.cursor, 10) : 0;
      const page = scored.slice(startIndex, startIndex + input.limit).map((candidate) => {
        const partnerSpoken = candidate.spokenLanguages.map((l) => l.language);
        const compatibleLanguages = Array.from(new Set([
          ...myLearning.filter((lang) => partnerSpoken.includes(lang)),
          ...mySpoken.filter((lang) => candidate.learningLanguages.includes(lang)),
          ...myLearning.filter((lang) => candidate.learningLanguages.includes(lang)),
        ]));
        return { ...candidate, compatibleLanguages };
      });
      const nextCursor =
        startIndex + input.limit < scored.length
          ? String(startIndex + input.limit)
          : undefined;

      return { partners: page, nextCursor };
    }),

  getIncomingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const receiverId = ctx.session.user.id;

      const pendingRequests = await db
        .select({
          matchRequestId: matchRequest.id,
          requesterId: matchRequest.requesterId,
          createdAt: matchRequest.createdAt,
        })
        .from(matchRequest)
        .where(
          and(
            eq(matchRequest.receiverId, receiverId),
            eq(matchRequest.status, "pending"),
          ),
        );

      if (pendingRequests.length === 0) return [];

      const requesterIds = pendingRequests.map((r) => r.requesterId);

      const [requesterUsers, requesterLanguages] = await Promise.all([
        db
          .select({ id: user.id, name: user.name, image: user.image })
          .from(user)
          .where(inArray(user.id, requesterIds)),
        db
          .select()
          .from(userLanguage)
          .where(inArray(userLanguage.userId, requesterIds)),
      ]);

      return pendingRequests.map((req) => {
        const userInfo = requesterUsers.find((u) => u.id === req.requesterId);
        const langs = requesterLanguages.filter((l) => l.userId === req.requesterId);

        return {
          matchRequestId: req.matchRequestId,
          requesterId: req.requesterId,
          requesterName: userInfo?.name ?? "Unknown",
          requesterPhotoUrl: userInfo?.image ?? null,
          requesterOfferedLanguages: langs
            .filter((l) => l.type === "spoken")
            .map((l) => l.language),
          requesterTargetedLanguages: langs
            .filter((l) => l.type === "learning")
            .map((l) => l.language),
          createdAt: req.createdAt.toISOString(),
        };
      });
    }),

  // #8/#9 — the caller's own outstanding sent invitations (mirror of incoming).
  getOutgoingRequests: protectedProcedure
    .query(async ({ ctx }) => {
      const requesterId = ctx.session.user.id;

      const pendingRequests = await db
        .select({
          matchRequestId: matchRequest.id,
          receiverId: matchRequest.receiverId,
          createdAt: matchRequest.createdAt,
        })
        .from(matchRequest)
        .where(
          and(
            eq(matchRequest.requesterId, requesterId),
            eq(matchRequest.status, "pending"),
          ),
        );

      if (pendingRequests.length === 0) return [];

      const receiverIds = pendingRequests.map((r) => r.receiverId);

      const [receiverUsers, receiverLanguages] = await Promise.all([
        db
          .select({ id: user.id, name: user.name, image: user.image })
          .from(user)
          .where(inArray(user.id, receiverIds)),
        db
          .select()
          .from(userLanguage)
          .where(inArray(userLanguage.userId, receiverIds)),
      ]);

      return pendingRequests.map((req) => {
        const userInfo = receiverUsers.find((u) => u.id === req.receiverId);
        const langs = receiverLanguages.filter((l) => l.userId === req.receiverId);

        return {
          matchRequestId: req.matchRequestId,
          receiverId: req.receiverId,
          receiverName: userInfo?.name ?? "Unknown",
          receiverPhotoUrl: userInfo?.image ?? null,
          receiverOfferedLanguages: langs
            .filter((l) => l.type === "spoken")
            .map((l) => l.language),
          receiverTargetedLanguages: langs
            .filter((l) => l.type === "learning")
            .map((l) => l.language),
          createdAt: req.createdAt.toISOString(),
        };
      });
    }),

  getPartnerProfile: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const profile = await db.query.languageProfile.findFirst({
        where: eq(languageProfile.userId, input.userId),
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This profile is no longer available.",
        });
      }

      const languages = await db
        .select()
        .from(userLanguage)
        .where(eq(userLanguage.userId, input.userId));

      const interests = await db
        .select()
        .from(userInterest)
        .where(eq(userInterest.userId, input.userId));

      const [userInfo, completedMeetups, sipCount] = await Promise.all([
        db
          .select({ id: user.id, name: user.name, image: user.image, email: user.email })
          .from(user)
          .where(eq(user.id, input.userId))
          .then((rows) => rows[0] ?? null),
        db
          .select({ id: meetup.id })
          .from(meetup)
          .where(and(
            or(eq(meetup.proposerId, input.userId), eq(meetup.receiverId, input.userId)),
            eq(meetup.status, "completed"),
          )),
        db
          .select({ count: sql<number>`cast(count(*) as int)` })
          .from(attendanceReport)
          .where(and(eq(attendanceReport.studentId, input.userId), eq(attendanceReport.attended, true)))
          .then((rows) => rows[0]?.count ?? 0),
      ]);

      const meetupIds = completedMeetups.map((m) => m.id);
      const averageRating = meetupIds.length > 0
        ? await db
            .select({ avg: sql<string>`avg(${attendanceReport.rating})` })
            .from(attendanceReport)
            .where(and(
              inArray(attendanceReport.meetupId, meetupIds),
              ne(attendanceReport.studentId, input.userId),
            ))
            .then((rows) => {
              const val = rows[0]?.avg ? parseFloat(rows[0].avg) : null;
              return val !== null ? Math.round(val * 10) / 10 : null;
            })
        : null;

      return {
        userId: profile.userId,
        name: userInfo?.name ?? "Unknown",
        image: userInfo?.image ?? null,
        bio: profile.bio,
        university: profile.university,
        age: profile.age,
        latitude: profile.latitude,
        longitude: profile.longitude,
        spokenLanguages: languages
          .filter((l) => l.type === "spoken")
          .map((l) => ({ language: l.language, proficiency: l.proficiency })),
        learningLanguages: languages
          .filter((l) => l.type === "learning")
          .map((l) => l.language),
        interests: interests.map((i) => i.interest),
        onboardingComplete: profile.onboardingComplete,
        sipCount,
        averageRating,
      };
    }),

  getMatchRequestStatus: protectedProcedure
    .input(z.object({ candidateUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      const requesterId = ctx.session.user.id;
      const existing = await db.query.matchRequest.findFirst({
        where: and(
          eq(matchRequest.requesterId, requesterId),
          eq(matchRequest.receiverId, input.candidateUserId),
        ),
      });
      const status = existing?.status;
      const matchRequestStatus =
        status === "pending" || status === "accepted" || status === "declined"
          ? status
          : ("none" as const);

      // A live match is bidirectional and lives in studentMatch, independent of
      // who originally sent the request. Derive matched-state from there so the
      // matched-only actions (propose / unmatch) show for BOTH sides of the
      // pair — not just the side that happened to send the first "say hoi".
      const match = await db.query.studentMatch.findFirst({
        where: and(
          or(
            and(
              eq(studentMatch.studentAId, requesterId),
              eq(studentMatch.studentBId, input.candidateUserId),
            ),
            and(
              eq(studentMatch.studentAId, input.candidateUserId),
              eq(studentMatch.studentBId, requesterId),
            ),
          ),
          inArray(studentMatch.status, ["matched", "connected"]),
        ),
      });

      return { matchRequestStatus, isMatched: match != null };
    }),

  sendMatchRequest: protectedProcedure
    .input(z.object({ receiverId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requesterId = ctx.session.user.id;

      // Load the preconditions the aggregate needs: receiver existence, a
      // conflicting active request, and the requester's display name + offered/
      // targeted languages for the MatchRequestSent payload.
      const [receiverProfile, existing, requesterRow, requesterLanguages] =
        await Promise.all([
          db.query.languageProfile.findFirst({
            where: eq(languageProfile.userId, input.receiverId),
          }),
          db.query.matchRequest.findFirst({
            where: and(
              eq(matchRequest.requesterId, requesterId),
              eq(matchRequest.receiverId, input.receiverId),
              // pending or accepted only — declined allows re-request
              inArray(matchRequest.status, ["pending", "accepted"]),
            ),
          }),
          db.select({ name: user.name }).from(user).where(eq(user.id, requesterId)).limit(1),
          db
            .select({ language: userLanguage.language, type: userLanguage.type })
            .from(userLanguage)
            .where(eq(userLanguage.userId, requesterId)),
        ]);

      let decision;
      try {
        decision = MatchRequest.send({
          requesterId,
          requesterName: requesterRow[0]?.name ?? "Someone",
          receiverId: input.receiverId,
          receiverExists: receiverProfile != null,
          offeredLanguage:
            requesterLanguages.find((l) => l.type === "spoken")?.language ?? null,
          targetedLanguage:
            requesterLanguages.find((l) => l.type === "learning")?.language ?? null,
          hasActiveRequest: existing != null,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      const matchRequestId = await commitAndEmit(async (tx) => {
        const [created] = await tx
          .insert(matchRequest)
          .values(decision.row)
          .returning({ id: matchRequest.id });
        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create match request.",
          });
        }
        return {
          result: created.id,
          // The aggregate cannot know the id until the row exists — graft it on.
          events: decision.events.map((e) => ({
            name: e.name,
            payload: { ...e.payload, matchRequestId: created.id },
          })),
        };
      });

      console.info("[MatchRequestSent]", {
        matchRequestId,
        requesterId,
        receiverId: input.receiverId,
      });

      return { matchRequestId, status: "pending" as const };
    }),

  acceptMatchRequest: protectedProcedure
    .input(z.object({ matchRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const receiverId = ctx.session.user.id;

      const existing = await loadMatchRequestSnapshot(input.matchRequestId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match request not found." });
      }

      const [receiverRow] = await db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, receiverId))
        .limit(1);

      let decision;
      try {
        decision = MatchRequest.accept(existing, {
          actorId: receiverId,
          receiverName: receiverRow?.name ?? "Someone",
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      // Marking the request accepted and creating the match commit together —
      // the aggregate hands both writes to one unit of work, so we can never get
      // an accepted request with no match (or an orphan match).
      await commitAndEmit(async (tx) => {
        await tx
          .update(matchRequest)
          .set({ status: decision.state.status })
          .where(eq(matchRequest.id, existing.id));
        await tx.insert(studentMatch).values({
          studentAId: decision.createMatch.studentAId,
          studentBId: decision.createMatch.studentBId,
          matchRequestId: existing.id,
        });
        return { result: undefined, events: decision.events };
      });

      console.info("[MatchRequestAccepted]", {
        matchRequestId: existing.id,
        requesterId: existing.requesterId,
        receiverId,
      });

      return { status: "accepted" as const, matchedWithUserId: existing.requesterId };
    }),

  declineMatchRequest: protectedProcedure
    .input(z.object({ matchRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const receiverId = ctx.session.user.id;

      const existing = await loadMatchRequestSnapshot(input.matchRequestId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match request not found." });
      }

      let decision;
      try {
        decision = MatchRequest.decline(existing, {
          actorId: receiverId,
          now: new Date(),
        });
      } catch (err) {
        toTrpcError(err);
      }

      await commitAndEmit(async (tx) => {
        await tx
          .update(matchRequest)
          .set({ status: decision.state.status })
          .where(eq(matchRequest.id, existing.id));
        return { result: undefined, events: decision.events };
      });

      console.info("[MatchRequestDeclined]", {
        matchRequestId: existing.id,
        requesterId: existing.requesterId,
        receiverId,
      });

      return { status: "declined" as const };
    }),

  // #8 — sender cancels an invitation they sent before it's answered.
  // Hard-delete so the invite fully reverses: both users become discoverable to
  // each other again and the sender may invite again later.
  withdrawMatchRequest: protectedProcedure
    .input(z.object({ matchRequestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const requesterId = ctx.session.user.id;

      const existing = await loadMatchRequestSnapshot(input.matchRequestId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
      }

      try {
        MatchRequest.withdraw(existing, { actorId: requesterId });
      } catch (err) {
        toTrpcError(err);
      }

      await commitAndEmit(async (tx) => {
        await tx.delete(matchRequest).where(eq(matchRequest.id, existing.id));
        return { result: undefined, events: [] };
      });

      console.info("[MatchRequestWithdrawn]", {
        matchRequestId: existing.id,
        requesterId,
        receiverId: existing.receiverId,
      });

      return { success: true as const };
    }),

  // #7 — unmatch an existing buddy. Voids the underlying request (keeps the pair
  // out of discover) and drops the match row from both users' match lists.
  unmatch: protectedProcedure
    .input(z.object({ partnerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const match = await db.query.studentMatch.findFirst({
        where: or(
          and(
            eq(studentMatch.studentAId, userId),
            eq(studentMatch.studentBId, input.partnerId),
          ),
          and(
            eq(studentMatch.studentAId, input.partnerId),
            eq(studentMatch.studentBId, userId),
          ),
        ),
      });

      try {
        MatchRequest.unmatch({
          actorId: userId,
          partnerId: input.partnerId,
          matchExists: match != null,
        });
      } catch (err) {
        toTrpcError(err);
      }

      // Voiding the request and dropping the match commit together.
      await commitAndEmit(async (tx) => {
        await tx
          .update(matchRequest)
          .set({ status: "voided" })
          .where(eq(matchRequest.id, match!.matchRequestId));
        await tx.delete(studentMatch).where(eq(studentMatch.id, match!.id));
        return { result: undefined, events: [] };
      });

      console.info("[Unmatched]", {
        userId,
        partnerId: input.partnerId,
        matchId: match!.id,
      });

      return { success: true as const };
    }),

  getMyMatches: protectedProcedure
    .input(
      z
        .object({
          includeWithActiveMeetup: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const includeWithActiveMeetup = input?.includeWithActiveMeetup ?? false;

      const matches = await db
        .select()
        .from(studentMatch)
        .where(
          and(
            or(
              eq(studentMatch.studentAId, userId),
              eq(studentMatch.studentBId, userId),
            ),
            // Both "matched" and "connected" are live matches — a "connected"
            // pair has met and confirmed attendance (#138), so they must keep
            // showing in the Matches tab, not vanish once you actually meet.
            inArray(studentMatch.status, ["matched", "connected"]),
          ),
        );

      if (matches.length === 0) return [];

      let proposableMatches = matches;

      if (!includeWithActiveMeetup) {
        const activeProposals = await db
          .select({ proposerId: meetup.proposerId, receiverId: meetup.receiverId })
          .from(meetup)
          .where(
            and(
              inArray(meetup.status, ["pending", "confirmed"]),
              or(eq(meetup.proposerId, userId), eq(meetup.receiverId, userId)),
            ),
          );

        const activePartnerIds = new Set(
          activeProposals.map((p) =>
            p.proposerId === userId ? p.receiverId : p.proposerId,
          ),
        );

        proposableMatches = matches.filter((m) => {
          const partnerId = m.studentAId === userId ? m.studentBId : m.studentAId;
          return !activePartnerIds.has(partnerId);
        });
      }

      if (proposableMatches.length === 0) return [];

      const partnerIds = proposableMatches.map((m) =>
        m.studentAId === userId ? m.studentBId : m.studentAId,
      );

      const partnerUsers = await db
        .select({ id: user.id, name: user.name, image: user.image })
        .from(user)
        .where(inArray(user.id, partnerIds));

      return proposableMatches.map((m) => {
        const partnerId = m.studentAId === userId ? m.studentBId : m.studentAId;
        const partnerInfo = partnerUsers.find((u) => u.id === partnerId);
        return {
          matchId: m.id,
          partnerId,
          partnerName: partnerInfo?.name ?? "Unknown",
          partnerPhotoUrl: partnerInfo?.image ?? null,
          matchedAt: m.createdAt.toISOString(),
        };
      });
    }),
});
