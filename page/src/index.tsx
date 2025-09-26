// React 18 entry
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import App from './App';
import './global.css';



// Get root element
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found');
}

const root = createRoot(container);

// Render app
root.render(
  <FluentProvider theme={webLightTheme}>
    <App />
  </FluentProvider>
);