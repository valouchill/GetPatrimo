export default function ConciergeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout minimal pour éviter tout conflit avec le layout racine
  return (
    <div className="min-h-screen w-full bg-slate-50">
      {children}
    </div>
  );
}
