import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdmin, userScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { GROUP_LABEL } from "@/lib/constants";
import { filterOptions, peopleFilters, userFilter } from "@/lib/reports";
import { FilterBar } from "@/components/FilterBar";
import { UsersTable } from "./UsersTable";
import { UploadUsers } from "./UploadUsers";
import { UserForm } from "./UserForm";

const LIMIT = 1000;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const f = await searchParams;
  const isSuper = admin.role === "SUPER_ADMIN";
  const where: Prisma.UserWhereInput = {
    ...userScope(admin),
    ...userFilter({ ...f, test: f.test ?? "all" }),
    ...(f.localAdminId && isSuper ? { localAdminId: f.localAdminId === "none" ? null : f.localAdminId } : {}),
  };
  const [users, total, opts, localAdmins] = await Promise.all([
    db.user.findMany({
      where,
      include: { localAdmin: true },
      orderBy: [{ group: "asc" }, { role: "asc" }, { name: "asc" }],
      take: LIMIT,
    }),
    db.user.count({ where }),
    filterOptions(admin),
    isSuper ? db.admin.findMany({ where: { role: "LOCAL_ADMIN" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  const [groupFilter, roleFilter, testFilter] = peopleFilters(opts, GROUP_LABEL);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted">{total} quiz-taker{total === 1 ? "" : "s"}{total > LIMIT ? `, showing the first ${LIMIT}. Use the filters to narrow down.` : "."} They sign in with their email or phone number.</p>
        </div>
      </div>
      <details className="card p-4">
        <summary className="cursor-pointer font-semibold">Add a user</summary>
        <div className="mt-3">
          <UserForm
            roles={opts.roles} groups={opts.groups}
            localAdmins={isSuper ? localAdmins.map((a) => ({ id: a.id, name: a.name })) : undefined}
          />
        </div>
      </details>
      {isSuper && <UploadUsers />}
      <FilterBar
        search="Name, email or phone"
        filters={[
          groupFilter, roleFilter,
          { ...testFilter, allLabel: "All", options: [{ value: "only", label: "Only test accounts" }, { value: "hide", label: "Hide test accounts" }] },
          ...(isSuper ? [{ name: "localAdminId", label: "Local Admin", options: [{ value: "none", label: "(none)" }, ...localAdmins.map((a) => ({ value: a.id, label: a.name }))] }] : []),
        ]}
      />
      <UsersTable
        showLocalAdmin={isSuper}
        groupLabel={GROUP_LABEL}
        users={users.map((u) => ({
          id: u.id, name: u.name, email: u.email ?? "", phone: u.phone ?? "", role: u.role, group: u.group, test: u.testAccount,
          localAdmin: u.localAdmin?.name ?? "", active: u.active, ownPassword: !!u.passwordChangedAt,
          locked: !!u.lockedUntil && u.lockedUntil > new Date(),
        }))}
      />
      <p className="text-sm text-muted">Need to change someone&apos;s details? Use <strong>Edit details</strong> in the ⋯ menu on their row. <Link className="text-primary underline" href="/admin/export/users-template">CSV template</Link></p>
    </div>
  );
}
