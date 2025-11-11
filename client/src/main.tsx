import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

window.addEventListener('unhandledrejection', (event) => {
  if (
    event.reason?.message?.includes('MetaMask') ||
    event.reason?.stack?.includes('chrome-extension') ||
    event.reason?.stack?.includes('moz-extension')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
