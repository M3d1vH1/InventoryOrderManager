import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Header = () => {
  const { toggleSidebar, currentPage } = useSidebar();
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
      logout();
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Could not log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center">
        <Button 
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="md:hidden text-slate-800 rounded-md hover:bg-slate-100"
        >
          <Menu />
        </Button>
        <h2 className="text-xl font-semibold ml-2">{currentPage}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full relative">
            <i className="fas fa-bell"></i>
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-slate-100">
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center text-slate-600">
                <i className="fas fa-user"></i>
              </div>
              <span className="hidden md:inline">{user?.fullName || "User"}</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {user?.fullName}
              <div className="text-xs text-muted-foreground">
                {user?.role === 'admin' && 'Administrator'}
                {user?.role === 'front_office' && 'Front Office'}
                {user?.role === 'warehouse' && 'Warehouse Staff'}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = "/settings"}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-red-500" onClick={handleLogout}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
