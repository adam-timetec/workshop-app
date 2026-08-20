import BrandHeader from "@/components/BrandHeader";
import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
  return (
    <div className="public-shell">
      <BrandHeader />
      <main className="auth-shell"><SignupForm /></main>
    </div>
  );
}
