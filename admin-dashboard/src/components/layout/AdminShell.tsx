import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ToastHost from '@/components/ui/Toast';

export default function AdminShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="shell-main">
        <Topbar title={title} />
        <main className="content">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
