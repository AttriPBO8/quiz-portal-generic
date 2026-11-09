import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MEDIA_LIMITS } from "@/lib/media-storage";
import { formatDate } from "@/lib/constants";
import { QuestionMedia } from "@/components/QuestionMedia";
import { MediaActions, UploadMedia } from "./MediaForms";

const KIND_LABEL = { IMAGE: "Picture", AUDIO: "Sound", VIDEO: "Video" } as const;

export default async function MediaLibrary() {
  await requireSuperAdmin();
  const files = await db.mediaFile.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { questions: true } } } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Media library</h1>
        <p className="text-muted">
          Pictures (up to {MEDIA_LIMITS.IMAGE.label}), sound clips (up to {MEDIA_LIMITS.AUDIO.label}) and short videos (up to {MEDIA_LIMITS.VIDEO.label}) that questions can show.
          Files are private: only signed-in admins, and quiz-takers given a question that uses them, can open them.
        </p>
      </div>
      <UploadMedia />
      {!files.length && <p className="card px-4 py-8 text-center text-muted">No media yet.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((f) => (
          <article key={f.id} className="card flex flex-col gap-3 p-4">
            <div className="grid min-h-28 place-items-center rounded-lg bg-surface-2 p-2">
              <QuestionMedia media={f} compact />
            </div>
            <div>
              <h2 className="break-all font-semibold">{f.name}</h2>
              <p className="text-sm text-muted">{KIND_LABEL[f.kind]} · {Math.ceil(f.size / 1024)} KB · added {formatDate(f.createdAt)} · used by {f._count.questions} question{f._count.questions === 1 ? "" : "s"}</p>
            </div>
            <MediaActions id={f.id} altText={f.altText} />
          </article>
        ))}
      </div>
    </div>
  );
}
