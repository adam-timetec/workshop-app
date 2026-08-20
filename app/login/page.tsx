import BrandHeader from "@/components/BrandHeader";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="public-shell">
      <BrandHeader />
      <main className="auth-shell"><LoginForm confirmError={error === "confirm"} /></main>
    </div>
  );
}
