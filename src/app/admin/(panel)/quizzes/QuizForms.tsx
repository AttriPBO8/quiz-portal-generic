"use client";

import { useActionState, useState } from "react";
import { assignQuiz, createQuiz, updateQuiz, type QuizFormState } from "@/app/actions/admin-quizzes";

type Settings = { title: string; numEasy: number; numMedium: number; numHard: number; timeLimitMinutes: number; passingScore: number; opensAt: string; closesAt: string; active: boolean };
const DEFAULTS: Settings = { title: "", numEasy: 10, numMedium: 10, numHard: 10, timeLimitMinutes: 30, passingScore: 60, opensAt: "", closesAt: "", active: true };

function Message({ state }: { state: QuizFormState }) {
  if (state?.error) return <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{state.ok}</p>;
  return null;
}

function SettingsFields({ s, showActive }: { s: Settings; showActive?: boolean }) {
  const num = (name: keyof Settings, label: string, min = 0, max = 100) => (
    <label><span className="label">{label}</span><input className="input" type="number" name={name} min={min} max={max} defaultValue={s[name] as number} required /></label>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="sm:col-span-2 lg:col-span-3"><span className="label">Title</span><input className="input" name="title" defaultValue={s.title} maxLength={120} required /></label>
      {num("numEasy", "Easy questions")}
      {num("numMedium", "Medium questions")}
      {num("numHard", "Hard questions")}
      {num("timeLimitMinutes", "Time limit (minutes)", 1, 300)}
      {num("passingScore", "Pass mark (%)", 1, 100)}
      <div />
      <label><span className="label">Opens (India time, optional)</span><input className="input" type="datetime-local" name="opensAt" defaultValue={s.opensAt} /></label>
      <label><span className="label">Complete by (India time, optional)</span><input className="input" type="datetime-local" name="closesAt" defaultValue={s.closesAt} /></label>
      {showActive && (
        <label className="flex items-center gap-2 self-end pb-3"><input type="checkbox" name="active" defaultChecked={s.active} className="h-5 w-5" /> Visible to quiz-takers</label>
      )}
    </div>
  );
}

export function NewQuizForm({ banks }: { banks: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createQuiz, undefined);
  return (
    <details className="card p-4">
      <summary className="cursor-pointer font-semibold">Create a quiz</summary>
      {banks.length === 0 ? <p className="mt-3 text-muted">Upload a question bank first.</p> : (
        <form action={action} className="mt-4 space-y-4">
          <label className="block"><span className="label">Question bank</span>
            <select className="input" name="bankId" required>{banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </label>
          <SettingsFields s={DEFAULTS} />
          <Message state={state} />
          <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create quiz"}</button>
        </form>
      )}
    </details>
  );
}

export function EditQuizForm({ quizId, settings }: { quizId: string; settings: Settings }) {
  const [state, action, pending] = useActionState(updateQuiz.bind(null, quizId), undefined);
  return (
    <form action={action} className="space-y-4">
      <SettingsFields s={settings} showActive />
      <Message state={state} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}

type Opt = { id: string; name: string };
export function AssignForm({ quizId, districts, blocks }: { quizId: string; districts: Opt[]; blocks: (Opt & { districtId: string })[] }) {
  const [state, action, pending] = useActionState(assignQuiz.bind(null, quizId), undefined);
  const [districtId, setDistrictId] = useState("");
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">District</span>
          <select className="input" name="districtId" value={districtId} onChange={(e) => setDistrictId(e.target.value)}>
            <option value="">All districts</option>{districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label><span className="label">Block</span>
          <select className="input" name="blockId"><option value="">All blocks</option>{blocks.filter((b) => !districtId || b.districtId === districtId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        </label>
        <label><span className="label">Role</span>
          <select className="input" name="roleType"><option value="">All roles</option><option value="TEACHER">Teacher</option><option value="WORKER">Worker</option><option value="HELPER">Helper</option><option value="DUMMY">Dummy</option></select>
        </label>
      </div>
      <Message state={state} />
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" name="mode" value="add" disabled={pending}>Assign to matching users</button>
        <button className="btn btn-secondary" name="mode" value="remove" disabled={pending}>Remove from matching users</button>
      </div>
    </form>
  );
}
