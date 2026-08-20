/** Friendly placeholder shown wherever Supabase isn't connected yet (Modules 1–4). */
export default function BackendNotConnected({ schemaRequired = false }: { schemaRequired?: boolean }) {
  return (
    <div className="setup-notice">
      <p><strong>{schemaRequired ? "Food ordering schema not found" : "Backend not connected"}</strong></p>
      <p>
        {schemaRequired ? (
          <>Run <code>supabase/workshop-schema.sql</code> in the Supabase SQL editor, then refresh this page.</>
        ) : (
          <>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then restart the development server.</>
        )}
      </p>
    </div>
  );
}
