import { ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ className = "", children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = "", ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`border-b border-border bg-surface ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "", ...props }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-border ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = "", ...props }: TableHTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`transition-colors hover:bg-hover ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHeader({
  children,
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return (
    <th
      className={`px-3 py-2.5 text-xs font-semibold tracking-wide text-text-secondary uppercase ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = "", ...props }: TdHTMLAttributes<HTMLTableDataCellElement>) {
  return (
    <td className={`px-3 py-2.5 ${className}`} {...props}>
      {children}
    </td>
  );
}

export function TableEmpty({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-text-secondary">
        {children}
      </TableCell>
    </TableRow>
  );
}
