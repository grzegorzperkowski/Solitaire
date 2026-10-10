import './styles.css';
import { createApp } from './app.js';

const app = createApp();
if (typeof window !== 'undefined') {
  window.__SOLITAIRE_APP__ = app;
}
app.init();
