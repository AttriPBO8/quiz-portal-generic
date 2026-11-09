import type { Prisma } from "@prisma/client";
import { requireAdmin, userScope } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_TYPES, roleLabel } from "@/lib/constants";
import { filterOptions } from "@/lib/reports";
import { FilterBar } from "@/components/FilterBar";
import { UsersTable } from "./UsersTable";
import { UploadUsers } from "./UploadUsers";

const LIMIT = 1000;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdmin();
  const f = await searchParams;
  const isSuper = admin.role === "SUPER_ADMIN";
  const roleType = ROLE_TYPES.find((r) => r.value === f.roleType)?.value;
  const where: Prisma.UserWhereInput = {
    ...userScope(admin),
    ...(f.districtId ? { districtId: f.districtId } : {}),
    ...(f.blockId ? { blockId: f.blockId } : {}),
    ...(roleType ? { roleType } : {}),
    ...(f.localAdminId && isSuper ? { localAdminId: f.localAdminId === "none" ? null : f.localAdminId } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { phone: { contains: f.q } }] } : {}),
  };
  const [users, total, opts, localAdmins] = await Promise.all([
    db.user.findMany({
      where,
      include: { district: true, block: true, localAdmin: true },
      orderBy: [{ district: { name: "asc" } }, { block: { name: "asc" } }, { roleType: "asc" }, { name: "asc" }],
      take: LIMIT,
    }),
    db.user.count({ where }),
    filterOptions(admin),
    isSuper ? db.admin.findMany({ where: { role: "LOCAL_ADMIN" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted">{total} quiz-taker{total === 1 ? "" : "s"}{total > LIMIT ? `, showing the first ${LIMIT}. Use the filters to narrow down.` : "."}</p>
        </div>
      </div>
      {isSuper && <UploadUsers />}
      <FilterBar
        search="Name or phone"
        filters={[
          { name: "districtId", label: "District", options: opts.districts.map((d) => ({ value: d.id, label: d.name })) },
          { name: "blockId", label: "Block", options: opts.blocks.filter((b) => !f.districtId || b.districtId === f.districtId).map((b) => ({ value: b.id, label: b.name })) },
          { name: "roleType", label: "Role", options: ROLE_TYPES.map((r) => ({ value: r.value, label: r.label })) },
          ...(isSuper ? [{ name: "localAdminId", label: "Local Admin", options: [{ value: "none", label: "(none)" }, ...localAdmins.map((a) => ({ value: a.id, label: a.name }))] }] : []),
        ]}
      />
      <UsersTable
        showLocalAdmin={isSuper}
        users={users.map((u) => ({
          id: u.id, name: u.name, phone: u.phone, role: roleLabel(u.roleType), district: u.district.name, block: u.block.name,
          localAdmin: u.localAdmin?.name ?? "", active: u.active, ownPassword: !!u.passwordChangedAt,
          locked: !!u.lockedUntil && u.lockedUntil > new Date(),
        }))}
      />
    </div>
  );
}
