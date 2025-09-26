import React from 'react';
import MolvisWrapper from './MolvisWrapper.tsx';
import SidebarContainer from './components/SidebarContainer.tsx';

const App: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#000',
      }}
    >
      <MolvisWrapper />
      <SidebarContainer />
    </div>
  );
};

export default App;