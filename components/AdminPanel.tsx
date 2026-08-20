"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createCategoryAction,
  createMenuItemAction,
  createRoundAction,
  setRoundStatusAction,
  toggleMenuItemAction,
} from "@/app/app/actions";
import type { ActionResult, DashboardData, RoundStatus } from "@/lib/orders/types";

const initialState: ActionResult = { ok: false, message: "" };

function FormStatus({ state, pending }: { state: ActionResult; pending: boolean }) {
  if (pending) return <p className="form-message" role="status">Saving…</p>;
  if (!state.message) return <span className="form-message-placeholder" aria-hidden="true" />;
  return (
    <p className={`form-message ${state.ok ? "form-message--success" : "form-message--error"}`} role="status">
      {state.message}
    </p>
  );
}

export default function AdminPanel({ data }: { data: DashboardData }) {
  const [roundState, roundAction, roundPending] = useActionState(createRoundAction, initialState);
  const [categoryState, categoryAction, categoryPending] = useActionState(createCategoryAction, initialState);
  const [itemState, itemAction, itemPending] = useActionState(createMenuItemAction, initialState);
  const [controlPending, startControlTransition] = useTransition();
  const [controlMessage, setControlMessage] = useState<ActionResult>(initialState);
  const activeCategories = data.categories.filter((category) => category.isActive);

  function setRoundStatus(roundId: string, status: RoundStatus) {
    startControlTransition(async () => {
      setControlMessage(await setRoundStatusAction(roundId, status));
    });
  }

  function toggleItem(itemId: string, available: boolean) {
    startControlTransition(async () => {
      setControlMessage(await toggleMenuItemAction(itemId, available));
    });
  }

  return (
    <section className="admin-panel" aria-labelledby="admin-title">
      <div className="section-heading section-heading--admin">
        <div>
          <h2 id="admin-title">Admin controls</h2>
          <p>Create ordering rounds and maintain the staff menu.</p>
        </div>
        <span className="status status--admin">Administrator</span>
      </div>

      <div className="admin-grid">
        <div className="admin-section">
          <h3>Ordering rounds</h3>
          <form action={roundAction} className="admin-form">
            <label className="field">
              <span>Round title</span>
              <input name="title" required maxLength={100} placeholder="Friday lunch" />
            </label>
            <label className="field">
              <span>Vendor</span>
              <input name="vendorName" required maxLength={100} placeholder="Restaurant name" />
            </label>
            <div className="form-pair">
              <label className="field">
                <span>Order date</span>
                <input name="orderDate" type="date" required />
              </label>
              <label className="field">
                <span>Cutoff time</span>
                <input name="cutoffAt" type="datetime-local" required />
              </label>
            </div>
            <label className="field">
              <span>Starting status</span>
              <select name="status" defaultValue="open">
                <option value="open">Open for orders</option>
                <option value="planned">Planned</option>
              </select>
            </label>
            <button className="button button--primary" type="submit" disabled={roundPending}>Create round</button>
            <FormStatus state={roundState} pending={roundPending} />
          </form>

          <div className="admin-list">
            {data.recentRounds.map((round) => (
              <div className="admin-list-row" key={round.id}>
                <div><strong>{round.title}</strong><span>{round.vendorName} · {round.orderDate}</span></div>
                <div className="admin-row-actions">
                  <span className={`status status--${round.status}`}>{round.status}</span>
                  {round.status === "planned" && (
                    <button className="button button--small" type="button" disabled={controlPending} onClick={() => setRoundStatus(round.id, "open")}>Open</button>
                  )}
                  {round.status === "open" && (
                    <button className="button button--small" type="button" disabled={controlPending} onClick={() => setRoundStatus(round.id, "closed")}>Close</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <h3>Menu</h3>
          <form action={categoryAction} className="inline-form">
            <label className="field">
              <span>New category</span>
              <input name="name" required maxLength={60} placeholder="Desserts" />
            </label>
            <button className="button" type="submit" disabled={categoryPending}>Add category</button>
          </form>
          <FormStatus state={categoryState} pending={categoryPending} />

          <form action={itemAction} className="admin-form admin-form--item">
            <div className="form-pair">
              <label className="field">
                <span>Category</span>
                <select name="categoryId" required defaultValue="">
                  <option value="" disabled>Choose category</option>
                  {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Price (MYR)</span>
                <input name="price" required type="number" min="0" step="0.01" placeholder="12.00" />
              </label>
            </div>
            <label className="field">
              <span>Item name</span>
              <input name="name" required maxLength={100} placeholder="Nasi lemak" />
            </label>
            <label className="field">
              <span>Description <small>optional</small></span>
              <input name="description" maxLength={240} placeholder="Short menu description" />
            </label>
            <button className="button button--primary" type="submit" disabled={itemPending}>Add menu item</button>
            <FormStatus state={itemState} pending={itemPending} />
          </form>

          <div className="admin-list">
            {data.menuItems.map((item) => (
              <div className="admin-list-row" key={item.id}>
                <div><strong>{item.name}</strong><span>{item.isAvailable ? "Available" : "Paused"}</span></div>
                <button
                  className="button button--small"
                  type="button"
                  disabled={controlPending}
                  onClick={() => toggleItem(item.id, !item.isAvailable)}
                >
                  {item.isAvailable ? "Pause" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <FormStatus state={controlMessage} pending={controlPending} />
    </section>
  );
}
