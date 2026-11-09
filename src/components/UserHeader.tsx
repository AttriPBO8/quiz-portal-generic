import { logoutUser } from "@/app/actions/user-auth";
import { roleLabel } from "@/lib/constants";
import type { getCurrentUser } from "@/lib/auth";
import { AppHeader, initials } from "./AppHeader";
import { UserMenu } from "./UserMenu";

type U = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function UserHeader({ user, title }: { user: U; title?: string }) {
  return (
    <AppHeader
      home="/quizzes"
      title={title}
      right={
        <UserMenu
          name={user.name}
          initials={initials(user.name)}
          detail={`${roleLabel(user.roleType)} · ${user.block.name}, ${user.district.name}`}
          links={[{ href: "/quizzes", label: "My quizzes" }, { href: "/account/password", label: "Change password" }]}
          onSignOut={logoutUser}
        />
      }
    />
  );
}
