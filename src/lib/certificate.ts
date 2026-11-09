import "server-only";
import type { Admin } from "@prisma/client";
import { db } from "./db";
import { quizScope, userScope } from "./auth";
import { formatLongDate } from "./constants";
export { formatLongDate };

// Wording and signatories printed on every Certificate of Completion.
// These are sample values: change the names here, and replace the two files in
// public/signatures/ with scans of the real signatures (PNG with a transparent background works best).
// Organization and place can also be set per customer with CERTIFICATE_ORGANIZATION and CERTIFICATE_PLACE.
export const CERTIFICATE = {
  organization: process.env.CERTIFICATE_ORGANIZATION || "Sample Training Institute",
  place: process.env.CERTIFICATE_PLACE || "Toronto, Canada",
  title: "Certificate of Completion",
  showScore: true,
  signatories: [
    { name: "Dr. Anita Kumari", title: "Director, Training Programs", signature: "/signatures/signature-1.svg" },
    { name: "Rajesh Kumar", title: "Program Coordinator", signature: "/signatures/signature-2.svg" },
  ],
};

export type Certificate = {
  id: string;
  number: string;
  name: string;
  detail: string;
  training: string;
  score: number;
  completedOn: string;
};


/**
 * Certificates for the given passed attempts, limited to users and quizzes the admin may see.
 * Attempts that did not pass, or that belong to someone else, are silently left out.
 */
export async function getCertificates(admin: Pick<Admin, "id" | "role">, attemptIds: string[]): Promise<Certificate[]> {
  if (!attemptIds.length) return [];
  const attempts = await db.attempt.findMany({
    where: { id: { in: attemptIds }, passed: true, submittedAt: { not: null }, user: userScope(admin), quiz: quizScope(admin) },
    select: {
      id: true, score: true, submittedAt: true,
      quiz: { select: { title: true } },
      user: { select: { name: true, role: true, group: true } },
    },
  });
  return attempts
    .map((a) => ({
      id: a.id,
      number: `QP-${a.submittedAt!.getFullYear()}-${a.id.slice(-8).toUpperCase()}`,
      name: a.user.name,
      detail: [a.user.role, a.user.group].filter(Boolean).join(", "),
      training: a.quiz.title,
      score: a.score ?? 0,
      completedOn: formatLongDate(a.submittedAt!),
    }))
    .sort((x, y) => x.detail.localeCompare(y.detail, "en", { numeric: true }) || x.name.localeCompare(y.name));
}
