import { redirect } from "next/navigation";

import { CoinClient } from "@/components/CoinClient";
import { createClient } from "@/lib/supabase/server";

export default async function CoinPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return <CoinClient />;
}
