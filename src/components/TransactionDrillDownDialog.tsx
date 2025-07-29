import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/types/budget';

interface TransactionDrillDownDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  categoryName: string;
  budgetAmount: number;
  actualAmount: number;
}

export const TransactionDrillDownDialog: React.FC<TransactionDrillDownDialogProps> = ({
  isOpen,
  onClose,
  transactions,
  categoryName,
  budgetAmount,
  actualAmount
}) => {
  const difference = budgetAmount - actualAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Transaktioner för {categoryName}</span>
            <div className="flex items-center space-x-4 text-sm">
              <span>Budgeterat: {budgetAmount.toLocaleString('sv-SE')} kr</span>
              <span className="font-bold">Faktiskt: {actualAmount.toLocaleString('sv-SE')} kr</span>
              <span className={`font-bold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Differens: {difference.toLocaleString('sv-SE')} kr
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Inga transaktioner hittades för denna kategori
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Konto</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Belopp</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.date}</TableCell>
                    <TableCell>{transaction.accountId}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.userDescription || transaction.description}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {transaction.bankCategory && (
                          <div className="text-xs text-muted-foreground">
                            {transaction.bankCategory}
                            {transaction.bankSubCategory && ` > ${transaction.bankSubCategory}`}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount >= 0 ? '+' : ''}{Math.abs(transaction.amount).toLocaleString('sv-SE')} kr
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          transaction.status === 'green' ? 'default' : 
                          transaction.status === 'yellow' ? 'secondary' : 
                          'destructive'
                        }
                        className="text-xs"
                      >
                        {transaction.status === 'green' && 'Godkänd'}
                        {transaction.status === 'yellow' && 'Automatisk'}
                        {transaction.status === 'red' && 'Behöver granskning'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};