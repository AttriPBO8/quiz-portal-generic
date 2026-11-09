import { getCurrentAdmin } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  if (!(await getCurrentAdmin())) return new Response("Not signed in", { status: 401 });
  return csvResponse("users-template.csv", toCsv(
    ["district", "block", "role_type", "phone", "name", "local_admin", "password"],
    [["District 1", "Block 1-1", "Teacher", "9876543210", "Asha Kumari", "localadmin1", ""]],
  ));
}
