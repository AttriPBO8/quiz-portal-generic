"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth";
import { cleanMediaName, deleteMedia, detectMedia, MEDIA_LIMITS, saveMedia } from "@/lib/media-storage";
import { securityEvent } from "@/lib/security";

// Super Admin actions on the Media library: the pictures, sounds and videos questions can show.

export type MediaFormState = { error?: string; ok?: string } | undefined;

export async function uploadMedia(_: MediaFormState, form: FormData): Promise<MediaFormState> {
  const me = await requireSuperAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  const altText = String(form.get("altText") ?? "").trim().slice(0, 300);
  if (file.size > MEDIA_LIMITS.VIDEO.maxBytes) return { error: `The file is too large. Videos can be up to ${MEDIA_LIMITS.VIDEO.label}.` };
  const body = new Uint8Array(await file.arrayBuffer());
  const type = detectMedia(body);
  if (!type) return { error: "This file type is not supported. Use PNG, JPG, WebP or GIF pictures; MP3, M4A, OGG or WAV sound; or MP4 or WebM video." };
  const limit = MEDIA_LIMITS[type.kind];
  if (body.length > limit.maxBytes) return { error: `${type.kind === "IMAGE" ? "Pictures" : type.kind === "AUDIO" ? "Sound clips" : "Videos"} can be up to ${limit.label}. Make it smaller and try again.` };
  if (type.kind === "IMAGE" && !altText) return { error: "Describe the picture in a few words, for people who use screen readers." };

  const name = cleanMediaName(String(form.get("name") || file.name), type.ext);
  if (await db.mediaFile.findUnique({ where: { name } })) return { error: `A file named ${name} is already in the library. Rename the file, or delete the old one first.` };
  const storageKey = `media/${randomUUID()}.${type.ext}`;
  await saveMedia(storageKey, body, type.mimeType);
  const created = await db.mediaFile.create({ data: { name, kind: type.kind, mimeType: type.mimeType, size: body.length, altText, storageKey, uploadedBy: me.username } });
  await securityEvent({ type: "MEDIA_UPLOADED", success: true, portal: "admin", account: `admin:${me.id}`, label: me.username, detail: `${created.name} (${type.mimeType}, ${Math.ceil(body.length / 1024)} KB)` });
  revalidatePath("/admin/media");
  return { ok: `Added ${name}. Use this name in a question file's "media" field, or pick it on a question bank page.` };
}

export async function updateMediaAlt(mediaId: string, altText: string) {
  await requireSuperAdmin();
  await db.mediaFile.update({ where: { id: mediaId }, data: { altText: altText.trim().slice(0, 300) } });
  revalidatePath("/admin/media");
}

export async function removeMedia(mediaId: string): Promise<string | null> {
  const me = await requireSuperAdmin();
  const media = await db.mediaFile.findUnique({ where: { id: mediaId }, include: { _count: { select: { questions: true } } } });
  if (!media) return null;
  if (media._count.questions) return `${media.name} is used by ${media._count.questions} question(s). Remove it from them first.`;
  await db.mediaFile.delete({ where: { id: media.id } });
  await deleteMedia(media.storageKey);
  await securityEvent({ type: "MEDIA_DELETED", success: true, portal: "admin", account: `admin:${me.id}`, label: me.username, detail: media.name });
  revalidatePath("/admin/media");
  return null;
}

/** Shows a library file with a question, or removes it (mediaId empty). */
export async function setQuestionMedia(bankId: string, externalId: string, mediaId: string) {
  await requireSuperAdmin();
  const media = mediaId ? await db.mediaFile.findUnique({ where: { id: mediaId }, select: { id: true } }) : null;
  await db.question.update({ where: { bankId_externalId: { bankId, externalId } }, data: { mediaId: media?.id ?? null } });
  revalidatePath(`/admin/questions/${bankId}`);
}
