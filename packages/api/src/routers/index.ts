import { protectedProcedure, publicProcedure, router } from "../index";
import { profileRouter } from "../contexts/identity/profile";
import { matchingRouter } from "../contexts/matching/matching";
import { venueRouter } from "../contexts/scheduling/venue";
import { adminVenueRouter } from "../contexts/scheduling/venue-admin";
import { alumniAdminRouter } from "../contexts/identity/alumni-admin";
import { meetupRouter } from "../contexts/scheduling/meetup";
import { chatRouter, messagingRouter } from "../contexts/conversation";
import { moderationRouter } from "../contexts/moderation";
import { contentRouter } from "../contexts/conversation-practice";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  profile: profileRouter,
  matching: matchingRouter,
  venue: venueRouter,
  adminVenue: adminVenueRouter,
  adminAlumni: alumniAdminRouter,
  meetup: meetupRouter,
  chat: chatRouter,
  messaging: messagingRouter,
  moderation: moderationRouter,
  content: contentRouter,
});
export type AppRouter = typeof appRouter;
