import { cn } from 'cn';

interface DeviceIllustrationProperties {
  readonly humidity?: number | null;
}

export function DeviceIllustration({ humidity }: DeviceIllustrationProperties) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative mt-5 mr-3 ml-6 h-[158px] shrink-0 grow-0 basis-[130px] -rotate-5 rounded-t-2xl rounded-b-[29px]',
        'bg-appliance shadow-appliance',
        'max-[700px]:mt-3.5 max-[700px]:mr-0 max-[700px]:ml-2.5 max-[700px]:h-[135px] max-[700px]:basis-[95px]',
      )}
    >
      <div className="absolute -top-2.5 right-1 left-1 h-[27px] rounded-[50%] bg-appliance-grille shadow-appliance-grille" />
      <div
        className={cn(
          'absolute top-[50px] left-9 grid size-[54px] place-items-center rounded-full bg-appliance-14',
          'text-[22px] font-light text-appliance-9 max-[700px]:top-11 max-[700px]:left-[25px]',
          'max-[700px]:size-[45px]',
        )}
      >
        {humidity ?? '—'}
      </div>
      <span className="absolute bottom-6 w-full text-center text-[10px] text-appliance-brand">smartmi</span>
    </div>
  );
}
