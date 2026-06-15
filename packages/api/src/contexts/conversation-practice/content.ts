import { router } from "../../index";
import { startersRouter } from "./starters";

/**
 * Conversation Practice content context. Nests the `starters` sub-router so the
 * client contract resolves to `content.starters.listByLanguage`.
 */
export const contentRouter = router({
  starters: startersRouter,
});
