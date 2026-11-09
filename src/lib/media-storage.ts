import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MediaKind } from "@prisma/client";

// Pictures, sound clips and short videos used in questions.
//
// Where the files are kept:
//   - On AWS: a private S3 bucket (MEDIA_BUCKET, in MEDIA_BUCKET_REGION). The browser gets a
//     link that works for a few minutes, and only after the app has checked who is asking.
//   - On a laptop: the MEDIA_DIR folder (default "media-files"), which git ignores.
// Files are never public. Each one is checked by its content, not just its name.

export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; label: string }> = {
  IMAGE: { maxBytes: 1 * 1024 * 1024, label: "1 MB" },
  AUDIO: { maxBytes: 3 * 1024 * 1024, label: "3 MB" },
  VIDEO: { maxBytes: 5 * 1024 * 1024, label: "5 MB" },
};

export const ACCEPTED_TYPES = ".png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.ogg,.wav,.mp4,.webm";

type Detected = { kind: MediaKind; mimeType: string; ext: string };

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/**
 * Works out what a file really is from its first bytes. Anything not on the list is refused,
 * including SVG and HTML, which could carry scripts.
 */
export function detectMedia(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return { kind: "IMAGE", mimeType: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "IMAGE", mimeType: "image/jpeg", ext: "jpg" };
  if (ascii(b, 0, 4) === "GIF8") return { kind: "IMAGE", mimeType: "image/gif", ext: "gif" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { kind: "IMAGE", mimeType: "image/webp", ext: "webp" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return { kind: "AUDIO", mimeType: "audio/wav", ext: "wav" };
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: "AUDIO", mimeType: "audio/mpeg", ext: "mp3" };
  if (ascii(b, 0, 4) === "OggS") return { kind: "AUDIO", mimeType: "audio/ogg", ext: "ogg" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "VIDEO", mimeType: "video/webm", ext: "webm" };
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    if (brand.startsWith("M4A") || brand.startsWith("M4B")) return { kind: "AUDIO", mimeType: "audio/mp4", ext: "m4a" };
    return { kind: "VIDEO", mimeType: "video/mp4", ext: "mp4" };
  }
  return null;
}

/** A safe file name: letters, numbers, dots, dashes and underscores, ending in the real extension. */
export function cleanMediaName(original: string, ext: string) {
  const base = path.basename(original).replace(/\.[^.]*$/, "").toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "media";
  return `${base}.${ext}`;
}

const bucket = () => process.env.MEDIA_BUCKET ?? "";
const region = () => process.env.MEDIA_BUCKET_REGION || "ap-south-1";
const localDir = () => path.resolve(process.env.MEDIA_DIR || "media-files");
export const usesS3 = () => !!bucket();

let s3: S3Client | null = null;
// On Amplify the app's compute role gives access to the bucket, so no keys are stored anywhere.
const client = () => (s3 ??= new S3Client({ region: region() }));

/** Where a stored file lives, inside the bucket or the local folder. Never built from user input. */
const localPath = (key: string) => {
  const p = path.join(localDir(), key);
  if (!p.startsWith(localDir() + path.sep)) throw new Error("Bad media key");
  return p;
};

export async function saveMedia(key: string, body: Uint8Array, mimeType: string) {
  if (usesS3()) {
    await client().send(new PutObjectCommand({
      Bucket: bucket(), Key: key, Body: body, ContentType: mimeType,
      ServerSideEncryption: "AES256", CacheControl: "private, max-age=600",
    }));
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function deleteMedia(key: string) {
  if (usesS3()) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return;
  }
  await rm(localPath(key), { force: true });
}

/** S3 only: a link to the file that stops working after 10 minutes. */
export async function signedMediaUrl(key: string, mimeType: string) {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentType: mimeType }), { expiresIn: 600 });
}

/** Local folder only: the file's size and a reader for all or part of it (videos ask for parts). */
export async function openLocalMedia(key: string) {
  const file = localPath(key);
  const { size } = await stat(file);
  return { size, stream: (start?: number, end?: number) => createReadStream(file, { start, end }) };
}

export const readLocalMedia = (key: string) => readFile(localPath(key));
