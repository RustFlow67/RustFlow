"use client";

import { useEffect } from "react";

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext ||
        window.top !== window.self || !("serviceWorker" in navigator)) return;

    const register = () => {
      // Browsers or privacy settings may disable service workers. The site stays usable.
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
