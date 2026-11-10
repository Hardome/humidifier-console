import { AlertCircle, Inbox } from 'lucide-react';

import { errorMessage } from '../lib/format';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty';

interface FailureProperties {
  readonly error: unknown;
  readonly retry?: () => void;
}

export function Failure({ error, retry }: Readonly<FailureProperties>) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Не удалось загрузить данные</AlertTitle>
      <AlertDescription>
        {errorMessage(error)}
        {retry && (
          <Button variant="outline" onClick={retry}>
            Повторить
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface NoDataProperties {
  readonly title?: string;
  readonly children?: React.ReactNode;
}

export function NoData({
  title = 'Пока нет данных',
  children = 'Данные появятся после начала наблюдений.',
}: Readonly<NoDataProperties>) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
