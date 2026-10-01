import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { TabmeApp } from "@/components/tabme/TabmeApp";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <TabmeApp userId={user.id} />;
}
