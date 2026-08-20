import Link from "next/link";
import BrandHeader from "@/components/BrandHeader";

export default function HomePage() {
  return (
    <div className="public-shell">
      <BrandHeader />
      <main>
        <section className="public-hero">
          <div className="public-hero__copy">
            <h1>Lunch orders, in one place.</h1>
            <p>
              TimeTec staff choose from the shared menu, save their order, and see exactly what the team requested.
            </p>
            <div className="public-hero__actions">
              <Link className="button button--primary" href="/login">Open ordering</Link>
              <Link className="text-link" href="/signup">Create staff account</Link>
            </div>
          </div>
          <div className="order-preview" aria-label="Example staff order list">
            <div className="order-preview__head">
              <div><strong>Friday lunch</strong><span>Orders close at 11:30 AM</span></div>
              <span className="status status--open">Open</span>
            </div>
            <div className="order-preview__row"><strong>Amir</strong><span>Chicken rice · Lemon tea</span><b>RM15.50</b></div>
            <div className="order-preview__row"><strong>Mei Lin</strong><span>Curry noodles</span><b>RM11.50</b></div>
            <div className="order-preview__row order-preview__row--muted"><strong>Your order</strong><span>Choose from the menu</span><b>—</b></div>
          </div>
        </section>

        <section className="public-process" aria-labelledby="process-title">
          <div className="section-heading">
            <div><h2 id="process-title">A short path from menu to order.</h2><p>No chat thread to reconcile and no duplicated spreadsheet rows.</p></div>
          </div>
          <ol className="process-list">
            <li><span>1</span><div><strong>Admin opens a round</strong><p>Set the vendor, menu, date, and cutoff.</p></div></li>
            <li><span>2</span><div><strong>Staff save their choices</strong><p>Quantities and totals are checked by the server.</p></div></li>
            <li><span>3</span><div><strong>The team reads one list</strong><p>Every submitted order stays visible in one view.</p></div></li>
          </ol>
        </section>
      </main>
      <footer className="public-footer">
        <p>TimeTec Lunch Orders · Internal staff ordering</p>
      </footer>
    </div>
  );
}
