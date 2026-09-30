import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AdminShell({
  title,
  email,
  children,
}: {
  title: string;
  email: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="shell-main">
        <Topbar title={title} email={email} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
