import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div>
        <Topbar title={title} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
