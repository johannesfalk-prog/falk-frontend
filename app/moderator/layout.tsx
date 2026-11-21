import ModeratorGuard from './ModeratorGuard';

export default function ModeratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="moderator-layout min-h-screen bg-[#E8DCC4]">
      <ModeratorGuard>{children}</ModeratorGuard>
    </div>
  );
}
