import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export { Sidebar, Header };

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-4 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
} 