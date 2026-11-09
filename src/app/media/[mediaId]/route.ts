import { Readable } from "node:stream";
import { currentUserId, getCurrentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { openLocalMedia, signedMediaUrl, usesS3 } from "@/lib/media-storage";

// Sends a question's picture, sound or video. Only signed-in people get it:
// admins, and quiz-takers who were given a question that uses this file.

export const dynamic = "force-dynamic";

async function mayView(mediaId: string) {
  if (await getCurrentAdmin()) return true;
  const userId = await currentUserId();
  if (!userId) return false;
  const attempts = await db.attempt.findMany({ where: { userId }, select: { questionIds: true } });
  const ids = attempts.flatMap((a) => a.questionIds);
  if (!ids.length) return false;
  return !!(await db.question.findFirst({ where: { mediaId, id: { in: ids } }, select: { id: true } }));
}

export async function GET(req: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  const media = await db.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media || !(await mayView(media.id))) return new Response("Not found", { status: 404 });

  if (usesS3()) {
    return new Response(null, { status: 302, headers: { Location: await signedMediaUrl(media.storageKey, media.mimeType), "Cache-Control": "private, no-store" } });
  }

  const file = await openLocalMedia(media.storageKey).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": media.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "Content-Disposition": "inline",
  };
  // Browsers (Safari especially) fetch audio and video in parts.
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : file.size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : file.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, file.size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${file.size}` } });
    return new Response(Readable.toWeb(file.stream(start, end)) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${file.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(file.stream()) as ReadableStream, { headers: { ...headers, "Content-Length": String(file.size) } });
}
