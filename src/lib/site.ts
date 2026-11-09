import "server-only";
import { cache } from "react";
import { db } from "./db";
import { formatDateTime } from "./constants";
import { quizWindow } from "./quiz-engine";

/**
 * The dates the quiz site is open, set by the Super Admin under Admin > Quiz site.
 * Outside them quiz-takers cannot sign in or start a quiz; a quiz already in progress can still
 * be finished. The admin site is always available.
 */
export const getQuizSite = cache(async () => {
  const s = await db.siteSettings.findUnique({ where: { id: 1 } });
  const opensAt = s?.quizSiteOpensAt ?? null;
  const closesAt = s?.quizSiteClosesAt ?? null;
  const state = quizWindow({ opensAt, closesAt });
  const message =
    state === "NOT_OPEN" ? `The quiz site opens on ${formatDateTime(opensAt!)}.`
    : state === "CLOSED" ? `The quiz site closed on ${formatDateTime(closesAt!)}. Thank you for taking part.`
    : null;
  return { opensAt, closesAt, open: state === "OPEN", message, updatedAt: s?.updatedAt ?? null, updatedBy: s?.updatedBy ?? null };
});
