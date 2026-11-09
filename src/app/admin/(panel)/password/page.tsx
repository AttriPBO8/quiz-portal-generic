import { PasswordForm } from "@/components/PasswordForm";
import { changeAdminPassword } from "@/app/actions/admin-auth";

export default function AdminPassword() {
  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">Change password</h1>
      <p className="mt-1 text-muted">At least 8 characters with letters and numbers.</p>
      <div className="card mt-6 p-5"><PasswordForm action={changeAdminPassword} backHref="/admin" /></div>
    </div>
  );
}
