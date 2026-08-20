"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelOrderAction, saveOrderAction } from "@/app/app/actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DashboardData, MenuItem } from "@/lib/orders/types";
import AdminPanel from "./AdminPanel";

const currency = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
});

const dateTime = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

function money(cents: number) {
  return currency.format(cents / 100);
}

export default function FoodOrderingWorkspace({
  data,
  userEmail,
}: {
  data: DashboardData;
  userEmail: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState("all");
  const [orderNote, setOrderNote] = useState(
    data.orders.find((order) => order.userId === data.profile.id)?.note ?? ""
  );
  const initialOrder = data.orders.find(
    (order) => order.userId === data.profile.id && order.status === "submitted"
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (initialOrder?.lines ?? [])
        .filter((line) => line.menuItemId)
        .map((line) => [line.menuItemId as string, line.quantity])
    )
  );
  const [error, setError] = useState<string | null>(null);

  const round = data.activeRound;
  const canOrder = Boolean(round?.acceptingOrders);
  const visibleCategories = data.categories.filter((category) => category.isActive);
  const visibleItems = data.menuItems.filter(
    (item) =>
      visibleCategories.some((category) => category.id === item.categoryId) &&
      (categoryId === "all" || item.categoryId === categoryId)
  );
  const selectedItems = useMemo(
    () =>
      data.menuItems
        .filter((item) => (quantities[item.id] ?? 0) > 0)
        .map((item) => ({ item, quantity: quantities[item.id] })),
    [data.menuItems, quantities]
  );
  const totalCents = selectedItems.reduce(
    (total, selection) => total + selection.item.priceCents * selection.quantity,
    0
  );
  const submittedOrders = data.orders.filter((order) => order.status === "submitted");
  const isAdmin = data.profile.role === "admin";

  function changeQuantity(item: MenuItem, delta: number) {
    if (!canOrder || !item.isAvailable) return;
    setQuantities((current) => {
      const next = Math.max(0, Math.min(20, (current[item.id] ?? 0) + delta));
      const updated = { ...current };
      if (next === 0) delete updated[item.id];
      else updated[item.id] = next;
      return updated;
    });
    setError(null);
  }

  function saveOrder() {
    if (!round || selectedItems.length === 0) {
      setError("Choose at least one menu item before saving your order.");
      return;
    }
    startTransition(async () => {
      const result = await saveOrderAction({
        roundId: round.id,
        note: orderNote,
        items: selectedItems.map(({ item, quantity }) => ({
          itemId: item.id,
          quantity,
          note: "",
        })),
      });
      if (!result.ok) setError(result.message);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  function cancelOrder() {
    if (!round) return;
    startTransition(async () => {
      const result = await cancelOrderAction(round.id);
      if (!result.ok) setError(result.message);
      else {
        setQuantities({});
        setOrderNote("");
        setError(null);
        router.refresh();
      }
    });
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="order-shell">
      <header className="workspace-nav">
        <Link className="workspace-wordmark" href="/">
          <span aria-hidden="true" className="workspace-mark">TT</span>
          <span>Lunch Orders</span>
        </Link>
        <div className="workspace-account">
          <span className="workspace-user">
            <strong>{data.profile.displayName}</strong>
            <span>{userEmail}</span>
          </span>
          <button className="button button--quiet" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="workspace-main">
        <section className="round-bar" aria-labelledby="round-title">
          <div>
            <p className="utility-label">Current order</p>
            <h1 id="round-title">{round?.title ?? "No ordering round"}</h1>
          </div>
          {round ? (
            <dl className="round-facts">
              <div><dt>Vendor</dt><dd>{round.vendorName}</dd></div>
              <div><dt>Cutoff</dt><dd>{dateTime.format(new Date(round.cutoffAt))}</dd></div>
              <div>
                <dt>Status</dt>
                <dd><span className={`status status--${canOrder ? "open" : "closed"}`}>{canOrder ? "Open" : "Closed"}</span></dd>
              </div>
            </dl>
          ) : (
            <p className="round-empty">
              {isAdmin
                ? "Your administrator access is active. Create the first ordering round below."
                : "No ordering round is open. Ask an administrator to create one."}
            </p>
          )}
        </section>

        {!round && isAdmin && <AdminPanel data={data} />}

        <div className="order-workbench">
          <section className="menu-panel" aria-labelledby="menu-title">
            <div className="section-heading">
              <div>
                <h2 id="menu-title">Menu</h2>
                <p>Set the quantity beside each item.</p>
              </div>
              <span className="item-count">{visibleItems.length} items</span>
            </div>

            <div className="category-tabs" role="group" aria-label="Filter menu categories">
              <button
                className={categoryId === "all" ? "category-tab is-active" : "category-tab"}
                type="button"
                aria-pressed={categoryId === "all"}
                onClick={() => setCategoryId("all")}
              >
                All
              </button>
              {visibleCategories.map((category) => (
                <button
                  key={category.id}
                  className={categoryId === category.id ? "category-tab is-active" : "category-tab"}
                  type="button"
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="menu-list">
              {visibleItems.length === 0 ? (
                <div className="empty-state">
                  <strong>No menu items in this category.</strong>
                  <span>Choose another category or ask an administrator to add an item.</span>
                </div>
              ) : (
                visibleItems.map((item) => {
                  const quantity = quantities[item.id] ?? 0;
                  return (
                    <article className={`menu-row${!item.isAvailable ? " is-unavailable" : ""}`} key={item.id}>
                      <div className="menu-copy">
                        <div className="menu-name-line">
                          <h3>{item.name}</h3>
                          {!item.isAvailable && <span className="status status--closed">Unavailable</span>}
                        </div>
                        {item.description && <p>{item.description}</p>}
                      </div>
                      <span className="menu-price">{money(item.priceCents)}</span>
                      <div className="quantity-control" aria-label={`${item.name} quantity`}>
                        <button
                          type="button"
                          aria-label={`Remove one ${item.name}`}
                          onClick={() => changeQuantity(item, -1)}
                          disabled={!canOrder || !item.isAvailable || quantity === 0 || isPending}
                        >
                          −
                        </button>
                        <output aria-live="polite">{quantity}</output>
                        <button
                          type="button"
                          aria-label={`Add one ${item.name}`}
                          onClick={() => changeQuantity(item, 1)}
                          disabled={!canOrder || !item.isAvailable || quantity === 20 || isPending}
                        >
                          +
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <aside className="basket-panel" aria-labelledby="basket-title">
            <div className="section-heading">
              <div>
                <h2 id="basket-title">Your order</h2>
                <p>{initialOrder ? "Saved order" : "Not saved yet"}</p>
              </div>
            </div>
            {selectedItems.length ? (
              <ul className="basket-lines">
                {selectedItems.map(({ item, quantity }) => (
                  <li key={item.id}>
                    <span><strong>{quantity} ×</strong> {item.name}</span>
                    <span>{money(item.priceCents * quantity)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="basket-empty">Your order is empty. Add an item from the menu.</p>
            )}
            <div className="basket-total"><span>Total</span><strong>{money(totalCents)}</strong></div>
            <label className="field">
              <span>Order note <small>optional</small></span>
              <textarea
                value={orderNote}
                maxLength={300}
                rows={3}
                onChange={(event) => setOrderNote(event.target.value)}
                placeholder="Example: no chilli"
                disabled={!canOrder || isPending}
              />
              <small className="field-help">{orderNote.length}/300 characters</small>
            </label>
            {error && <p className="form-message form-message--error" role="alert">{error}</p>}
            <button
              className="button button--primary button--wide"
              type="button"
              onClick={saveOrder}
              disabled={!canOrder || selectedItems.length === 0 || isPending}
            >
              {isPending ? "Saving…" : initialOrder ? "Update order" : "Save order"}
            </button>
            {initialOrder && canOrder && (
              <button className="button button--danger button--wide" type="button" onClick={cancelOrder} disabled={isPending}>
                Cancel order
              </button>
            )}
          </aside>
        </div>

        <section className="staff-orders" aria-labelledby="staff-orders-title">
          <div className="section-heading">
            <div>
              <h2 id="staff-orders-title">Staff orders</h2>
              <p>Everyone can see what has been submitted for this round.</p>
            </div>
            <span className="order-count">{submittedOrders.length} submitted</span>
          </div>
          {submittedOrders.length === 0 ? (
            <div className="empty-state">
              <strong>No staff orders yet.</strong>
              <span>The first saved order will appear here.</span>
            </div>
          ) : (
            <div className="staff-order-list">
              {submittedOrders.map((order) => (
                <article className="staff-order-row" key={order.id}>
                  <div className="staff-identity">
                    <strong>{order.staffName}</strong>
                    <span>{order.department ?? "Department not set"}</span>
                  </div>
                  <div className="staff-order-items">
                    {order.lines.map((line) => (
                      <span key={line.id}>{line.quantity} × {line.itemName}</span>
                    ))}
                    {order.note && <small>Note: {order.note}</small>}
                  </div>
                  <strong className="staff-order-total">{money(order.totalCents)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>

        {round && isAdmin && <AdminPanel data={data} />}
      </main>

      {canOrder && selectedItems.length > 0 && (
        <aside className="mobile-order-bar" aria-label="Current order summary">
          <span><strong>{selectedItems.length}</strong> selections · {money(totalCents)}</span>
          <button className="button button--primary" type="button" onClick={saveOrder} disabled={isPending}>
            {isPending ? "Saving…" : "Save order"}
          </button>
        </aside>
      )}
    </div>
  );
}
