import { AlertAccountProvider } from "@/lib/alertAccount";
import SettingsPage from "@/pages/SettingsPage";

export default function SettingsPageRoute() {
  return (
    <AlertAccountProvider>
      <SettingsPage />
    </AlertAccountProvider>
  );
}
