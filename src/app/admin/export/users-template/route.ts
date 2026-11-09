import { getCurrentAdmin } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { USER_COLUMNS } from "@/lib/importers";

export async function GET() {
  if (!(await getCurrentAdmin())) return new Response("Not signed in", { status: 401 });
  return csvResponse("users-template.csv", toCsv(USER_COLUMNS, [
    ["Asha Kumari", "asha.kumari@example.com", "4165550101", "Employee", "Sales", "no", "localadmin1", ""],
    ["Ben Tremblay", "", "+1 647 555 0102", "Manager", "Sales", "no", "", ""],
    ["Test Person", "test1@example.com", "", "Employee", "", "yes", "", ""],
  ]));
}
