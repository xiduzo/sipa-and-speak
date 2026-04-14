import { protectedProcedure, publicProcedure, router } from "../index";
import { profileRouter } from "./profile";
import { matchingRouter } from "./matching";
import { venueRouter } from "./venue";
import { adminVenueRouter } from "./venue-admin";
import { meetupRouter } from "./meetup";
import { chatRouter } from "./chat";
import { messagingRouter } from "./messaging";
import { moderationRouter } from "./moderation";

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
  meetup: meetupRouter,
  chat: chatRouter,
  messaging: messagingRouter,
  moderation: moderationRouter,
});
export type AppRouter = typeof appRouter;
