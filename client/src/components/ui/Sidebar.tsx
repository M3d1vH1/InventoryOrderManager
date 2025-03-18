import React from "react";

interface SidebarProps {
  children?: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <div className="flex flex-col h-full w-72 md:w-64 bg-sidebar border-r border-sidebar-border">
      {children}
    </div>
  );
}