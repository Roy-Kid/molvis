import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import Core from './core';
import UIContainer from './ui/ui';

const App = () => {
  return (
    <div id="app">
        <Core />
        <UIContainer />
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <FluentProvider theme={webLightTheme}>
      <App />
    </FluentProvider>
  );
} else {
  console.error('Root element not found');
}
