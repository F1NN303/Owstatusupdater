import { AlertAccountProvider } from "@/lib/alertAccount";
import EmailAlerts from "@/pages/EmailAlerts";

export default function EmailAlertsRoute() {
  return (
    <AlertAccountProvider>
      <EmailAlerts />
    </AlertAccountProvider>
  );
}
