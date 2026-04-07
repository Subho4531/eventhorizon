import { redirect } from "next/navigation";

// /dashboard → /markets (Dashboard concept absorbed into Markets sidebar)
export default function DashboardRedirect() {
  redirect("/markets");
}
