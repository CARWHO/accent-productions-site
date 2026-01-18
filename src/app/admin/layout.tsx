export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Hide global header and footer on admin pages */}
      <style>{`
        body > header, body > footer { display: none !important; }
      `}</style>
      <div className="min-h-screen bg-stone-50">
        {children}
      </div>
    </>
  );
}
