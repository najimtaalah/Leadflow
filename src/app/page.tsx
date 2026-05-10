import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function Home() {
  const store = await cookies();
  const userId = store.get("user_id")?.value;
  if (userId) {
    redirect("/leads");
  } else {
    redirect("/login");
  }
}
