import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AccountDataRow {
  year: number;
  month: string;
  monthKey: string;
  account: string;
  calcKontosaldo: number;
  calcDescr: string;
}

interface AccountDataTableProps {
  data: AccountDataRow[];
  className?: string;
}

export const AccountDataTable: React.FC<AccountDataTableProps> = ({ data, className }) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Kontodata - År, Månad, Calc.Kontosaldo, Calc.Descr</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>År</TableHead>
                <TableHead>Månad</TableHead>
                <TableHead>Konto</TableHead>
                <TableHead className="text-right">Calc.Kontosaldo</TableHead>
                <TableHead>Calc.Descr</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={`${row.monthKey}-${row.account}-${index}`}>
                  <TableCell>{row.year}</TableCell>
                  <TableCell>{row.month}</TableCell>
                  <TableCell>{row.account}</TableCell>
                  <TableCell className="text-right">
                    {row.calcKontosaldo.toLocaleString()} kr
                  </TableCell>
                  <TableCell>
                    <span className={row.calcDescr === "(Est)" ? "text-orange-600 font-medium" : ""}>
                      {row.calcDescr || "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export type { AccountDataRow };