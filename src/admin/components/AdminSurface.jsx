export function AdminSurface({ as: Tag = 'div', className = '', children, padding = true, ...props }) {
  return (
    <Tag
      className={`admin-surface ${padding ? 'p-4 sm:p-5' : ''} ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
