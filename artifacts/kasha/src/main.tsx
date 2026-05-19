import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getApiUrl } from "@/lib/api";

const apiUrl = getApiUrl();
if (apiUrl) {
  setBaseUrl(apiUrl);
  // On cross-origin deployments (Vercel frontend + Render backend) Clerk
  // session cookies are not sent automatically.  Register a getter so every
  // generated API hook attaches "Authorization: Bearer <token>" instead.
  setAuthTokenGetter(async () => {
    try {
      return (await (window as any).Clerk?.session?.getToken?.()) ?? null;
    } catch {
      return null;
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
