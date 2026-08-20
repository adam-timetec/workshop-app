import Link from "next/link";

/** Top navigation shown on the public pages (/, /login, /signup). */
export default function BrandHeader() {
  return (
    <header className="public-nav">
      <div className="public-nav__inner">
        <Link href="/" className="public-wordmark">
          <span aria-hidden="true" className="workspace-mark">TT</span>
          <span>Lunch Orders</span>
        </Link>
        <nav className="public-nav__actions" aria-label="Account">
          <Link href="/login" className="button button--quiet">
            Sign in
          </Link>
          <Link href="/signup" className="button button--primary">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}
