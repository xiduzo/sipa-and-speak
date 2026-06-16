import { z } from "zod";
import { protectedProcedure, router } from "../../index";
import { getStartersForLanguage, type StarterCard } from "./starter-content";

/**
 * Read-only serving layer for curated conversation-starter content
 * (Task #404, Feature #378).
 *
 * `listByLanguage` returns the ordered cards for the requested language, or an
 * empty list for an unknown / uncurated language so the deck can render a
 * "no cards yet" state instead of a blank screen.
 */
export const startersRouter = router({
  listByLanguage: protectedProcedure
    .input(z.object({ language: z.string() }))
    .query(({ input }): { language: string; cards: StarterCard[] } => {
      return {
        language: input.language,
        cards: [...getStartersForLanguage(input.language)],
      };
    }),
});
