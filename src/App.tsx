import { AdminSupportPage } from "./pages/AdminSupportPage";
import { AuthCallback } from "./pages/AuthCallback";
import { EducationPowerpoint } from "./pages/EducationPowerpoint";
import { PurcarApp } from "./pages/PurcarApp";
import { SupportPage } from "./pages/SupportPage";

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/education/powerpoint") {
    return <EducationPowerpoint />;
  }

  if (path === "/auth/callback") {
    return <AuthCallback />;
  }

  if (path === "/support") {
    return <SupportPage />;
  }

  if (path === "/admin/support") {
    return <AdminSupportPage />;
  }

  return <PurcarApp />;
}
