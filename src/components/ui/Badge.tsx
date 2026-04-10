import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color = '#0096FA', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        className
      )}
      style={{
        backgroundColor: `${color}18`,
        color: color,
      }}
    >
      {children}
    </span>
  );
}
