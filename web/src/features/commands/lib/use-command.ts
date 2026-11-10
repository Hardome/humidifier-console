import { useEffect } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CommandStatus, deviceQuerySettings } from '@entities/humidifier';

import { createCommand } from '@api/clients/createCommand';
import { getCommand } from '@api/clients/getCommand';
import type { CommandInput } from '@api/types/CommandInput';

const terminalStatuses: ReadonlySet<string> = new Set([
  CommandStatus.confirmed,
  CommandStatus.failed,
  CommandStatus.unknown,
]);

const activeStatuses: ReadonlySet<string> = new Set([CommandStatus.pending, CommandStatus.running]);

export function useCommand() {
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: CommandInput) => createCommand({ body }).unwrap(),
    retry: false,
  });

  const commandId = mutation.data?.id;

  const result = useQuery({
    queryKey: ['command', commandId],
    enabled: !!commandId,
    queryFn: () => getCommand({ path: { id: commandId as string } }).unwrap(),
    refetchInterval: (query) =>
      terminalStatuses.has(query.state.data?.status ?? '') ? false : deviceQuerySettings.commandRefreshMs,
  });

  const status = result.data?.status ?? (mutation.isPending ? CommandStatus.pending : undefined);

  useEffect(() => {
    if (terminalStatuses.has(status ?? '')) {
      void client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== 'command',
      });
    }
  }, [status, client]);

  return {
    send: mutation.mutate,
    status,
    busy: mutation.isPending || (!!commandId && (!status || activeStatuses.has(status))),
    error: mutation.error ?? result.error,
    result: result.data,
  };
}
