'use client';

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    primary: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
        variants[variant] || variants.default
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function StockBadge({ quantity, unit }) {
  const qty = Number(quantity || 0);

  if (qty <= 0) {
    return (
      <Badge variant="danger" className="gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Out of Stock (0 {unit})
      </Badge>
    );
  }

  if (qty <= 10) {
    return (
      <Badge variant="warning" className="gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Low Stock ({qty} {unit})
      </Badge>
    );
  }

  return (
    <Badge variant="success" className="gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      {qty} {unit}
    </Badge>
  );
}

