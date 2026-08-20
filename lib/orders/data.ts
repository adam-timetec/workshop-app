import "server-only";

import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DashboardData,
  MenuCategory,
  MenuItem,
  OrderLine,
  OrderingRound,
  StaffOrder,
  StaffProfile,
} from "./types";

type ProfileRow = {
  id: string;
  display_name: string;
  department: string | null;
  role: "staff" | "admin";
};

type CategoryRow = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type MenuItemRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  is_available: boolean;
  sort_order: number;
};

type RoundRow = {
  id: string;
  title: string;
  vendor_name: string;
  order_date: string;
  cutoff_at: string;
  status: "planned" | "open" | "closed" | "cancelled";
};

type OrderRow = {
  id: string;
  user_id: string;
  status: "submitted" | "cancelled";
  note: string | null;
  total_cents: number;
  updated_at: string;
};

type OrderLineRow = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  unit_price_cents: number;
  quantity: number;
  note: string | null;
};

function mapProfile(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    department: row.department,
    role: row.role,
  };
}

function mapRound(row: RoundRow): OrderingRound {
  return {
    id: row.id,
    title: row.title,
    vendorName: row.vendor_name,
    orderDate: row.order_date,
    cutoffAt: row.cutoff_at,
    status: row.status,
    acceptingOrders: row.status === "open" && new Date(row.cutoff_at).getTime() > Date.now(),
  };
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getOrderDashboard(user: User): Promise<DashboardData> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new Error("Backend not connected.");

  const [profileResult, categoryResult, itemResult, roundResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, department, role")
      .eq("id", user.id)
      .single(),
    supabase
      .from("menu_categories")
      .select("id, name, sort_order, is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("menu_items")
      .select("id, category_id, name, description, price_cents, is_available, sort_order")
      .order("sort_order")
      .order("name"),
    supabase
      .from("ordering_rounds")
      .select("id, title, vendor_name, order_date, cutoff_at, status")
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const firstError =
    profileResult.error ?? categoryResult.error ?? itemResult.error ?? roundResult.error;
  if (firstError) throw new Error(firstError.message);

  const profile = mapProfile(profileResult.data as ProfileRow);
  const categories = ((categoryResult.data ?? []) as CategoryRow[]).map<MenuCategory>((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
  const menuItems = ((itemResult.data ?? []) as MenuItemRow[]).map<MenuItem>((row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    isAvailable: row.is_available,
    sortOrder: row.sort_order,
  }));
  const recentRounds = ((roundResult.data ?? []) as RoundRow[]).map(mapRound);
  const activeRound =
    recentRounds.find((round) => round.acceptingOrders) ?? recentRounds[0] ?? null;

  if (!activeRound) {
    return { profile, categories, menuItems, activeRound: null, recentRounds, orders: [] };
  }

  const [ordersResult, profilesResult] = await Promise.all([
    supabase
      .from("orders")
      .select("id, user_id, status, note, total_cents, updated_at")
      .eq("round_id", activeRound.id)
      .order("updated_at"),
    supabase.from("profiles").select("id, display_name, department"),
  ]);
  if (ordersResult.error) throw new Error(ordersResult.error.message);
  if (profilesResult.error) throw new Error(profilesResult.error.message);

  const orderRows = (ordersResult.data ?? []) as OrderRow[];
  const orderIds = orderRows.map((order) => order.id);
  const linesResult = orderIds.length
    ? await supabase
        .from("order_items")
        .select("id, order_id, menu_item_id, item_name, unit_price_cents, quantity, note")
        .in("order_id", orderIds)
        .order("created_at")
    : { data: [], error: null };
  if (linesResult.error) throw new Error(linesResult.error.message);

  const profileById = new Map(
    ((profilesResult.data ?? []) as Array<Pick<ProfileRow, "id" | "display_name" | "department">>).map(
      (row) => [row.id, row]
    )
  );
  const linesByOrder = new Map<string, OrderLine[]>();
  for (const row of (linesResult.data ?? []) as OrderLineRow[]) {
    const lines = linesByOrder.get(row.order_id) ?? [];
    lines.push({
      id: row.id,
      menuItemId: row.menu_item_id,
      itemName: row.item_name,
      unitPriceCents: row.unit_price_cents,
      quantity: row.quantity,
      note: row.note,
    });
    linesByOrder.set(row.order_id, lines);
  }

  const orders = orderRows.map<StaffOrder>((row) => {
    const staff = profileById.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      staffName: staff?.display_name ?? "TimeTec staff",
      department: staff?.department ?? null,
      status: row.status,
      note: row.note,
      totalCents: row.total_cents,
      updatedAt: row.updated_at,
      lines: linesByOrder.get(row.id) ?? [],
    };
  });

  return { profile, categories, menuItems, activeRound, recentRounds, orders };
}
