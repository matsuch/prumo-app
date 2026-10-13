import { createClient } from "@/lib/supabase/server";
import Workspace from "@/components/Workspace";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user && !user.is_anonymous ? (user.email ?? null) : null;

  return <Workspace email={email} />;
}
