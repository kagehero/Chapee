import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import RegisterForm from "@/components/RegisterForm";

/** すでにログイン済みならダッシュボードへ */
export default async function RegisterPage() {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore);
  if (session.valid) redirect("/dashboard");
  return <RegisterForm />;
}
