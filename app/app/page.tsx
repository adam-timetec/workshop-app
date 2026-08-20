import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import BrandHeader from "@/components/BrandHeader";
import BackendNotConnected from "@/components/BackendNotConnected";
import FoodOrderingWorkspace from "@/components/FoodOrderingWorkspace";
import { getOrderDashboard } from "@/lib/orders/data";

export default async function AppPage() {
  const supabase = await getSupabaseServerClient();

  // Modules 1–4: no backend yet — show the page shell, not a crash.
  if (!supabase) {
    return (
      <div className="min-h-screen bg-white">
        <BrandHeader />
        <main className="mx-auto max-w-2xl px-4 py-10">
          <h1 className="text-2xl font-bold">Lunch orders</h1>
          <div className="mt-4">
            <BackendNotConnected />
          </div>
        </main>
      </div>
    );
  }

  // Identity is verified ON THE SERVER — signed-out visitors never see this page.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let data = null;
  try {
    data = await getOrderDashboard(user);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="public-shell">
        <BrandHeader />
        <main className="setup-state">
          <h1>Finish the database setup</h1>
          <BackendNotConnected schemaRequired />
        </main>
      </div>
    );
  }

  return (
    <FoodOrderingWorkspace
      key={data.activeRound?.id ?? "no-round"}
      data={data}
      userEmail={user.email ?? ""}
    />
  );
}
