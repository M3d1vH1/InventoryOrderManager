import { useSidebar } from "@/context/SidebarContext";

const Header = () => {
  const { toggleSidebar, currentPage } = useSidebar();

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center">
        <button 
          onClick={toggleSidebar}
          className="md:hidden text-slate-800 p-2 rounded-md hover:bg-slate-100"
        >
          <i className="fas fa-bars"></i>
        </button>
        <h2 className="text-xl font-semibold ml-2">{currentPage}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full relative">
            <i className="fas fa-bell"></i>
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600">
            <i className="fas fa-user"></i>
          </div>
          <span className="hidden md:inline">Admin User</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
