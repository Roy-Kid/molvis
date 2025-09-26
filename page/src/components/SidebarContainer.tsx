import React, { useState } from 'react';
import Sidebar from './Sidebar';

const SidebarContainer: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />;
};

export default SidebarContainer;