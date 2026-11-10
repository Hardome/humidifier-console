import { useSettings } from '@entities/humidifier';
import { Card, CardContent } from '@shared/ui/card';
import { DataRegion } from '@shared/ui/data-region';
import { Failure } from '@shared/ui/feedback';
import { Skeleton } from '@shared/ui/skeleton';

import { SettingsForm } from './settings-form';

export function AppSettings() {
  const settings = useSettings();

  return (
    <Card>
      <CardContent>
        {settings.error && (
          <Failure
            error={settings.error}
            retry={() => {
              void settings.refetch();
            }}
          />
        )}
        <DataRegion
          isLoading={settings.isPending}
          isFetching={settings.isFetching}
          skeleton={<Skeleton className="h-60 w-full" />}
        >
          {settings.data && <SettingsForm settings={settings.data} />}
        </DataRegion>
      </CardContent>
    </Card>
  );
}
