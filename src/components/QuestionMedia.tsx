// The picture, sound clip or video shown with a question. Files come from /media/<id>,
// which only signed-in people can open. Downloading is discouraged but cannot be fully stopped.

export type MediaInfo = { id: string; kind: "IMAGE" | "AUDIO" | "VIDEO"; altText: string; mimeType: string };

export function QuestionMedia({ media, compact = false }: { media: MediaInfo; compact?: boolean }) {
  const src = `/media/${media.id}`;
  const box = compact ? "max-h-24" : "max-h-72 sm:max-h-80";
  if (media.kind === "IMAGE") {
    // eslint-disable-next-line @next/next/no-img-element -- private files, not suited to next/image
    return <img src={src} alt={media.altText || "Picture for this question"} className={`${box} w-auto max-w-full rounded-lg border border-border bg-white object-contain`} draggable={false} />;
  }
  if (media.kind === "AUDIO") {
    return (
      <figure className="w-full max-w-md">
        <audio controls preload="metadata" controlsList="nodownload noplaybackrate" className="w-full">
          <source src={src} type={media.mimeType} />
          Your browser cannot play this sound clip.
        </audio>
        {media.altText && !compact && <figcaption className="mt-1 text-sm text-muted">{media.altText}</figcaption>}
      </figure>
    );
  }
  return (
    <video controls playsInline preload="metadata" controlsList="nodownload noplaybackrate" disablePictureInPicture
      className={`${box} w-full max-w-xl rounded-lg border border-border bg-black`} aria-label={media.altText || "Video for this question"}>
      <source src={src} type={media.mimeType} />
      Your browser cannot play this video.
    </video>
  );
}
