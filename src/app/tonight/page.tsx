import { redirect } from "next/navigation";

import { TonightClient } from "@/components/TonightClient";
import { createClient } from "@/lib/supabase/server";

export default async function TonightPage({
  searchParams,
}: {
  searchParams: { slug?: string; title?: string; year?: string; d?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <TonightClient
      slug={searchParams.slug ?? null}
      title={searchParams.title ?? null}
      year={searchParams.year ? Number(searchParams.year) || null : null}
      discovery={searchParams.d === "1"}
    />
  );
}
