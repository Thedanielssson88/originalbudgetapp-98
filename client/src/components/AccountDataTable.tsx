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
          {/* Mobile view */}
          <div className="block md:hidden space-y-2">
            {data.map((row, index) => (
              <div key={`${row.monthKey}-${row.account}-${index}`} className="border rounded-lg p-3 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{row.year} - {row.month}</span>
                  <span className={`text-xs ${row.calcDescr === "(Est)" ? "text-orange-600 font-medium" : "text-muted-foreground"}`}>
                    {row.calcDescr || "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{row.account}</span>
                  <span className="font-medium text-sm">{row.calcKontosaldo.toLocaleString()} kr</span>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop view */}
          <div className="hidden md:block table-responsive">
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
        </div>
      </CardContent>
    </Card>
  );
};

export type { AccountDataRow };