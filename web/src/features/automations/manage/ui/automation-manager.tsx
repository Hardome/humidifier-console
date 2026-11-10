import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { CapabilityStatus, RuleKind, useCapabilities } from '@entities/humidifier';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card';
import { DataRegion } from '@shared/ui/data-region';
import { Failure, NoData } from '@shared/ui/feedback';
import { Skeleton } from '@shared/ui/skeleton';

import { runScene } from '@api/clients';
import { useListAutomations } from '@api/hooks/useListAutomations';
import { useListScenes } from '@api/hooks/useListScenes';
import { useListSchedules } from '@api/hooks/useListSchedules';
import type { RuleItem } from '@api/types';

import { endpoints, type Kind, titles } from '../model/rules';
import { BackgroundSettings } from './background-settings';
import { RuleEditor } from './rule-editor';

export function AutomationManager() {
  const [editor, setEditor] = useState<{ kind: Kind; rule?: RuleItem } | null>(null);

  const scenes = useListScenes(),
    schedules = useListSchedules(),
    automations = useListAutomations();

  const capabilities = useCapabilities();

  const isVerified = (name: string) =>
    !!capabilities.data?.items.some(
      (capability) => capability.name === name && capability.status === CapabilityStatus.verified,
    );

  const client = useQueryClient();

  const mutate = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => client.invalidateQueries(),
  });

  return (
    <div className="flex flex-col gap-[22px]">
      <BackgroundSettings />
      {mutate.error && <Failure error={mutate.error} />}
      {mutate.isSuccess && (
        <p className="text-[11px] leading-[1.6] text-hint" aria-live="polite">
          Изменения приняты. Результаты команд — в журнале событий.
        </p>
      )}
      {editor && <RuleEditor key={editor.rule?.id ?? editor.kind} {...editor} close={() => setEditor(null)} />}
      {(
        [
          [RuleKind.scene, scenes],
          [RuleKind.schedule, schedules],
          [RuleKind.automation, automations],
        ] as const
      ).map(([kind, query]) => (
        <Card key={kind}>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{titles[kind]}</CardTitle>
              <Button variant="outline" onClick={() => setEditor({ kind })}>
                Добавить
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {query.error && (
              <Failure
                error={query.error}
                retry={() => {
                  void query.refetch();
                }}
              />
            )}
            <DataRegion
              isLoading={query.isPending}
              isFetching={query.isFetching}
              skeleton={<Skeleton className="h-32 w-full" />}
            >
              {!query.error &&
                (query.data?.items.length ? (
                  <div className="flex flex-col gap-[21px]">
                    {query.data.items.map((rule) => (
                      <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <strong className="text-[13px] font-medium">{rule.name}</strong>
                          <p className="text-[11px] leading-[1.6] text-hint">
                            {kind !== RuleKind.scene && `${rule.enabled ? 'Включено' : 'Выключено'} · `}
                            Приоритет {rule.priority}
                            {rule.config.time && ` · ${rule.config.time}`}
                            {kind === RuleKind.automation && ` · ${rule.config.low}–${rule.config.high}%`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {kind === RuleKind.scene && (
                            <Button
                              disabled={
                                mutate.isPending ||
                                !rule.config.actions?.every((configuredAction) => isVerified(configuredAction.name))
                              }
                              onClick={() => mutate.mutate(() => runScene({ path: { id: rule.id } }).unwrap())}
                            >
                              Применить
                            </Button>
                          )}
                          <Button variant="outline" onClick={() => setEditor({ kind, rule })}>
                            Изменить
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={mutate.isPending}
                            onClick={() =>
                              mutate.mutate(() => endpoints[kind].remove({ path: { id: rule.id } }).unwrap())
                            }
                          >
                            Удалить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <NoData title="Правил пока нет">Добавьте правило из проверенных настроек.</NoData>
                ))}
            </DataRegion>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
