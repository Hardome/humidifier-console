import { AppSettings, CapabilityVerification, DeviceDiagnostics, TelegramSettings } from '@features/settings/edit';
import { ThemeSwitcher } from '@features/theme';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-[22px]">
      <Card className="min-[701px]:hidden">
        <CardHeader>
          <CardTitle>Тема оформления</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>
      <AppSettings />
      <CapabilityVerification />
      <TelegramSettings />
      <DeviceDiagnostics />
    </div>
  );
}
