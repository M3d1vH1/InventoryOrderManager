import { createContext, useContext, useState } from "react";

interface SidebarContextType {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isSidebarOpen: true,
  toggleSidebar: () => {},
  currentPage: "Dashboard",
  setCurrentPage: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState("Dashboard");

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <SidebarContext.Provider value={{ 
      isSidebarOpen, 
      toggleSidebar,
      currentPage,
      setCurrentPage,
    }}>
      {children}
    </SidebarContext.Provider>
  );
};
