"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult, RoundStatus, SaveOrderInput } from "@/lib/orders/types";

const failed = (message: string): ActionResult => ({ ok: false, message });
const succeeded = (message: string): ActionResult => ({ ok: true, message });

async function getAuthenticatedClient() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { authenticated: false, error: "Backend not connected." } as const;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { authenticated: false, error: "Your session expired. Sign in again." } as const;
  return { authenticated: true, supabase, user } as const;
}

async function getAdminClient() {
  const authenticated = await getAuthenticatedClient();
  if (!authenticated.authenticated) return authenticated;
  const { data, error } = await authenticated.supabase
    .from("profiles")
    .select("role")
    .eq("id", authenticated.user.id)
    .single();
  if (error || data?.role !== "admin") {
    return { authenticated: false, error: "Administrator access is required for that change." } as const;
  }
  return authenticated;
}

export async function saveOrderAction(input: SaveOrderInput): Promise<ActionResult> {
  const authenticated = await getAuthenticatedClient();
  if (!authenticated.authenticated) return failed(authenticated.error);
  if (!input.roundId || input.items.length === 0) return failed("Choose at least one item.");
  if (input.note.length > 300) return failed("Keep the order note under 300 characters.");

  const items = input.items.map((item) => ({
    item_id: item.itemId,
    quantity: Math.trunc(item.quantity),
    note: item.note.trim() || null,
  }));
  const { error } = await authenticated.supabase.rpc("save_my_order", {
    p_round_id: input.roundId,
    p_note: input.note.trim() || null,
    p_items: items,
  });
  if (error) return failed(error.message || "The order could not be saved. Try again.");

  revalidatePath("/app");
  return succeeded("Order saved");
}

export async function cancelOrderAction(roundId: string): Promise<ActionResult> {
  const authenticated = await getAuthenticatedClient();
  if (!authenticated.authenticated) return failed(authenticated.error);
  const { error } = await authenticated.supabase.rpc("cancel_my_order", {
    p_round_id: roundId,
  });
  if (error) return failed(error.message || "The order could not be cancelled. Try again.");
  revalidatePath("/app");
  return succeeded("Order cancelled");
}

export async function createCategoryAction(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await getAdminClient();
  if (!admin.authenticated) return failed(admin.error);
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return failed("Enter a category name under 60 characters.");
  const { error } = await admin.supabase.from("menu_categories").insert({ name });
  if (error) return failed(error.message.includes("duplicate") ? "That category already exists." : error.message);
  revalidatePath("/app");
  return succeeded("Category added");
}

export async function createMenuItemAction(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await getAdminClient();
  if (!admin.authenticated) return failed(admin.error);
  const categoryId = String(formData.get("categoryId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  if (!categoryId || !name || name.length > 100) return failed("Choose a category and enter an item name.");
  if (!Number.isFinite(price) || price < 0) return failed("Enter a valid price.");
  const { error } = await admin.supabase.from("menu_items").insert({
    category_id: categoryId,
    name,
    description: description || null,
    price_cents: Math.round(price * 100),
  });
  if (error) return failed(error.message);
  revalidatePath("/app");
  return succeeded("Menu item added");
}

export async function toggleMenuItemAction(itemId: string, isAvailable: boolean): Promise<ActionResult> {
  const admin = await getAdminClient();
  if (!admin.authenticated) return failed(admin.error);
  const { error } = await admin.supabase
    .from("menu_items")
    .update({ is_available: isAvailable })
    .eq("id", itemId);
  if (error) return failed(error.message);
  revalidatePath("/app");
  return succeeded(isAvailable ? "Item available" : "Item paused");
}

export async function createRoundAction(
  _previous: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const admin = await getAdminClient();
  if (!admin.authenticated) return failed(admin.error);
  const title = String(formData.get("title") ?? "").trim();
  const vendorName = String(formData.get("vendorName") ?? "").trim();
  const orderDate = String(formData.get("orderDate") ?? "");
  const cutoffLocal = String(formData.get("cutoffAt") ?? "");
  const status = String(formData.get("status") ?? "planned") as RoundStatus;
  const cutoffAt = new Date(`${cutoffLocal}:00+08:00`);
  if (!title || !vendorName || !orderDate || Number.isNaN(cutoffAt.getTime())) {
    return failed("Complete the title, vendor, order date, and cutoff time.");
  }
  if (!(["planned", "open"] as RoundStatus[]).includes(status)) return failed("Choose a valid round status.");

  const { error } = await admin.supabase.from("ordering_rounds").insert({
    title,
    vendor_name: vendorName,
    order_date: orderDate,
    cutoff_at: cutoffAt.toISOString(),
    status,
    created_by: admin.user.id,
  });
  if (error) {
    return failed(error.code === "23505" ? "Close the current open round before opening another." : error.message);
  }
  revalidatePath("/app");
  return succeeded("Ordering round created");
}

export async function setRoundStatusAction(roundId: string, status: RoundStatus): Promise<ActionResult> {
  const admin = await getAdminClient();
  if (!admin.authenticated) return failed(admin.error);
  if (!(["planned", "open", "closed", "cancelled"] as RoundStatus[]).includes(status)) {
    return failed("Choose a valid round status.");
  }
  const { error } = await admin.supabase
    .from("ordering_rounds")
    .update({ status })
    .eq("id", roundId);
  if (error) {
    return failed(error.code === "23505" ? "Another ordering round is already open." : error.message);
  }
  revalidatePath("/app");
  return succeeded(`Round ${status}`);
}
