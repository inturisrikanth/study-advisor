// Server component: redirect this route to the dashboard panel
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/app#visaPanel");
}