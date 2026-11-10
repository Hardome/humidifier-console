import { CapabilityStatus, DeviceProperty, labels, useCapabilities, useDevice } from '@entities/humidifier';
import { Badge } from '@shared/ui/badge';

export function CapabilitiesTable() {
  const device = useDevice();

  const capabilities = useCapabilities();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border-b border-border p-3 text-left font-medium text-table-heading">Функция</th>
            <th className="border-b border-border p-3 text-left font-medium text-table-heading">Состояние</th>
            <th className="border-b border-border p-3 text-left font-medium text-table-heading">Текущее значение</th>
          </tr>
        </thead>
        <tbody>
          {capabilities.data?.items.map((capability) => (
            <tr key={capability.name}>
              <td className="border-b border-table-border px-3 py-[13px] align-top">{labels[capability.name]}</td>
              <td className="border-b border-table-border px-3 py-[13px] align-top">
                <Badge variant={capability.status === CapabilityStatus.verified ? 'default' : 'outline'}>
                  {{ verified: 'Проверено', unsupported: 'Не поддерживается', declared: 'Заявлено' }[capability.status]}
                </Badge>
              </td>
              <td className="border-b border-table-border px-3 py-[13px] align-top">
                {capability.name === DeviceProperty.cycle_mode
                  ? '—'
                  : String(device.data?.values?.[capability.name] ?? '—')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
