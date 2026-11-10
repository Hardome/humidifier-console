import { useMutation } from '@tanstack/react-query';

import { useSettings } from '@entities/humidifier';
import { Button } from '@shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import { Failure } from '@shared/ui/feedback';

import { testTelegram } from '@api/clients';

export function TelegramSettings() {
  const settings = useSettings();

  const telegram = useMutation({ mutationFn: () => testTelegram().unwrap() });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram</CardTitle>
        <CardDescription>{settings.data?.telegram_configured ? 'Бот подключён' : 'Бот не настроен'}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-[11px] leading-[1.6] text-hint">
          Токен бота и chat_id задаются в локальном файле окружения сервера. Секреты не возвращаются в браузер.
        </p>
        <Button
          variant="outline"
          disabled={telegram.isPending || !settings.data?.telegram_configured}
          onClick={() => telegram.mutate()}
        >
          Отправить тестовое сообщение
        </Button>
        {telegram.error && <Failure error={telegram.error} />}
        <p className="text-[11px] leading-[1.6] text-hint" aria-live="polite">
          {telegram.isSuccess && 'Тестовое сообщение отправлено'}
        </p>
      </CardContent>
    </Card>
  );
}
