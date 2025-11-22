import React, { useState } from 'react';
import {
  Button,
  Text,
  Checkbox,
  Slider,
  Divider,
} from '@fluentui/react-components';
import {
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Settings20Regular,
  DocumentText20Regular,
  Eye20Regular,
} from '@fluentui/react-icons';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const [activeTab, setActiveTab] = useState<'view' | 'data' | 'settings'>('view');

  return (
    <>
      <Button
        icon={isOpen ? <ChevronRight20Regular /> : <ChevronLeft20Regular />}
        onClick={onToggle}
        style={{
          position: 'fixed',
          top: 16,
          right: isOpen ? 320 : 0
        }}
      />
      
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 320,
          height: '100%',
          backgroundColor: 'white',
          borderLeft: '1px solid #333',
          padding: 16,
          overflowY: 'auto',
          boxShadow: '0 0 10px rgba(0,0,0,0.4)'
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Button
              icon={<Eye20Regular />}
              appearance={activeTab === 'view' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('view')}
            >
              View
            </Button>
            <Button
              icon={<DocumentText20Regular />}
              appearance={activeTab === 'data' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('data')}
            >
              Data
            </Button>
            <Button
              icon={<Settings20Regular />}
              appearance={activeTab === 'settings' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </Button>
          </div>
          
          <div>
            {activeTab === 'view' && (
              <div>
                <Text weight="semibold">Camera Controls</Text>
                <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
                  <Button size="small">Reset View</Button>
                  <Button size="small">Center</Button>
                </div>
                <Divider />
                <Text weight="semibold">Display</Text>
                <div style={{ margin: '8px 0' }}>
                  <Checkbox label="Show Grid" defaultChecked />
                  <Checkbox label="Show Axes" />
                </div>
              </div>
            )}
            
            {activeTab === 'data' && (
              <div>
                <Text weight="semibold">Load Molecule</Text>
                <input type="file" style={{ margin: '8px 0', width: '100%' }} />
                <Text weight="semibold">Molecule Info</Text>
                <div style={{ margin: '8px 0', padding: 8, border: '1px solid #ccc' }}>
                  <Text>No molecule loaded</Text>
                </div>
              </div>
            )}
            
            {activeTab === 'settings' && (
              <div>
                <Text weight="semibold">Rendering Quality</Text>
                <select style={{ margin: '8px 0', width: '100%' }}>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <Text weight="semibold">Grid Opacity</Text>
                <Slider min={0} max={1} step={0.1} defaultValue={0.25} style={{ margin: '8px 0' }} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;