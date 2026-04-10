interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      {icon && <div className="mb-3 text-gray-300">{icon}</div>}
      <p className="text-sm">{message}</p>
    </div>
  );
}
