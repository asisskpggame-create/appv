import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/700.css';
import './apiBase.ts';
import { installNativeBridge } from './engine/nativeBridge.ts';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Must run before the app renders: the engine adapter checks for the bridge when it is created.
installNativeBridge();

createRoot(document.getElementById('root')!).render(<App />);

// Fade out the static boot splash (see index.html) once React has painted.
const bootSplash = document.getElementById('boot-splash');
if (bootSplash) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      bootSplash.classList.add('hide');
      window.setTimeout(() => bootSplash.remove(), 450);
    }),
  );
}
