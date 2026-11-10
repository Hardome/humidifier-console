import { LoaderCircle } from 'lucide-react';

import { CommandStatus } from '@entities/humidifier';
import { errorMessage, errors } from '@shared/lib/format';

import type { useCommand } from '../lib/use-command';

interface CommandFeedbackProperties {
  readonly command: ReturnType<typeof useCommand>;
}

export function CommandFeedback({ command }: Readonly<CommandFeedbackProperties>) {
  return (
    <div aria-live="polite" className="pt-2 text-xs">
      {command.busy && (
        <span className="flex items-center gap-2">
          <LoaderCircle className="size-4 animate-spin" />
          Ожидаем подтверждения…
        </span>
      )}
      {command.status === CommandStatus.confirmed && <span className="text-primary">Прибор подтвердил изменение</span>}
      {(command.status === CommandStatus.failed || command.status === CommandStatus.unknown) && (
        <span className="text-error">
          {errors[command.result?.error ?? ''] ?? 'Команда не подтверждена. Проверьте состояние прибора.'}
        </span>
      )}
      {command.error && <span className="text-error">{errorMessage(command.error)}</span>}
    </div>
  );
}
