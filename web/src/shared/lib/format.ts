export const dateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('ru-RU') : 'Нет данных');

export const errors: Record<string, string> = {
  stale_state: 'Показания устарели. Дождитесь восстановления связи.',
  capability_unverified: 'Сначала проверьте эту функцию в настройках.',
  database_unavailable: 'База данных недоступна. Изменения не сохранены.',
  command_rejected: 'Прибор отклонил команду.',
  result_unknown: 'Ответ потерян. Результат неизвестен; команда не повторяется.',
  readback_mismatch: 'Прибор не подтвердил новое значение.',
  lan_or_token: 'Нет ответа по локальной сети. Проверьте соединение и токен.',
  configuration: 'Не настроено подключение устройства.',
  owner_observation_required: 'Для проверки требуется наблюдение владельца.',
  choose_different_value: 'Выберите значение, отличающееся от текущего.',
  restoration_pending: 'Исходное значение пока не восстановлено. Требуется проверка владельца.',
  telegram_delivery: 'Не удалось отправить сообщение. Проверьте настройки Telegram.',
  validation_error: 'Проверьте заполнение формы.',
  cross_origin_request: 'Откройте панель по её собственному адресу и повторите действие.',
  specification: 'Ответ устройства не соответствует поддерживаемой модели. Проверьте модель и прошивку.',
};

export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const errorDetails = error as {
      code?: string;
      data?: { code?: string };
      error?: { code?: string };
    };
    const code = errorDetails.code ?? errorDetails.data?.code ?? errorDetails.error?.code;

    if (code && Object.hasOwn(errors, code)) {
      return errors[code];
    }
  }

  return 'Не удалось выполнить запрос. Проверьте соединение и повторите позже.';
}
