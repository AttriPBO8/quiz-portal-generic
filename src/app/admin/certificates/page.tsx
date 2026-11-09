import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CERTIFICATE, getCertificates, type Certificate } from "@/lib/certificate";
import { getResultRows, type ResultFilters } from "@/lib/reports";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Certificates of Completion" };

// Most certificates printed in one go, to keep the page quick to open.
const MAX = 500;

// Printable certificates. ?attempt=<id> shows one; otherwise the Results filters pick everyone who passed.
export default async function Certificates({ searchParams }: { searchParams: Promise<ResultFilters & { attempt?: string }> }) {
  const admin = await requireAdmin();
  const { attempt, ...filters } = await searchParams;
  const ids = attempt
    ? [attempt]
    : (await getResultRows(admin, { ...filters, status: "COMPLETED" })).map((r) => r.passedAttemptId).filter((id): id is string => !!id);
  const certs = await getCertificates(admin, ids.slice(0, MAX));
  const back = attempt ? `/admin/attempts/${attempt}` : `/admin?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])}`;

  return (
    <main className="cert-root mx-auto w-full max-w-6xl px-4 py-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <Link href={back} className="text-sm text-primary underline">← Back</Link>
          <h1 className="text-2xl font-bold">Certificates of Completion</h1>
          <p className="text-muted">
            {certs.length ? `${certs.length} certificate${certs.length === 1 ? "" : "s"}, one per page.` : "Nobody here has passed yet, so there are no certificates."}
            {ids.length > MAX && ` Showing the first ${MAX}; use the filters on Results to print the rest.`}
            {" "}In the print window choose <strong>Save as PDF</strong> to keep a file, and turn off headers and footers.
          </p>
        </div>
        {certs.length > 0 && <PrintButton label={certs.length === 1 ? "Print or save as PDF" : `Print all ${certs.length} or save as PDF`} />}
      </div>
      {certs.map((c) => <CertificateSheet key={c.id} cert={c} />)}
    </main>
  );
}

function CertificateSheet({ cert }: { cert: Certificate }) {
  return (
    <section className="cert-page" aria-label={`Certificate for ${cert.name}`}>
      <div className="cert">
        <div className="cert-frame">
          <div className="cert-org">{CERTIFICATE.organization}</div>
          <div className="cert-place">{CERTIFICATE.place}</div>
          <div className="cert-title">{CERTIFICATE.title}</div>
          <div className="cert-rule" />
          <div className="cert-text">This is to certify that</div>
          <div className="cert-name">{cert.name}</div>
          <div className="cert-detail">{cert.detail}</div>
          <div className="cert-text">has successfully completed the training</div>
          <div className="cert-training">{cert.training}</div>
          <div className="cert-text">
            {CERTIFICATE.showScore && <>with a score of <strong>{cert.score}%</strong> </>}on <strong>{cert.completedOn}</strong>.
          </div>
          <div className="cert-footer">
            <Signatory s={CERTIFICATE.signatories[0]} />
            <div className="cert-seal"><span>Training<br />Completed<br />{cert.completedOn.slice(-4)}</span></div>
            <Signatory s={CERTIFICATE.signatories[1]} />
          </div>
          <div className="cert-meta">Certificate no. {cert.number} · Date of completion: {cert.completedOn}</div>
        </div>
      </div>
    </section>
  );
}

function Signatory({ s }: { s: (typeof CERTIFICATE.signatories)[number] }) {
  return (
    <div className="cert-sign">
      {/* eslint-disable-next-line @next/next/no-img-element -- a plain image prints reliably */}
      <img src={s.signature} alt={`Signature of ${s.name}`} />
      <div className="line"><strong>{s.name}</strong>{s.title}<br />{CERTIFICATE.organization}</div>
    </div>
  );
}
