import React from 'react';
import { useBudget } from '../hooks/useBudget';
import { getInternalTransferSummary } from '../services/calculationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const InternalTransfersSummary: React.FC = () => {
  const { budgetState } = useBudget();
  const { selectedMonthKey } = budgetState;

  // Format currency using the same pattern as in other components
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Anropa den centrala funktionen för att få all färdigbearbetad data
  const transferSummaries = getInternalTransferSummary(budgetState, selectedMonthKey);

  if (transferSummaries.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Inga interna överföringar hittades för denna period.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {transferSummaries.map(summary => (
        <Card key={summary.accountId}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{summary.accountName}</span>
              <div className="space-x-2">
                {summary.totalIn > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    In: {formatCurrency(summary.totalIn)}
                  </Badge>
                )}
                {summary.totalOut > 0 && (
                  <Badge variant="destructive">
                    Ut: {formatCurrency(summary.totalOut)}
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary.incomingTransfers.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 text-sm">Inkommande</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {summary.incomingTransfers.map((t, index) => (
                    <li key={index} className="text-sm">
                      <span className="font-medium">{formatCurrency(t.amount)}</span> från{' '}
                      <span className="text-muted-foreground">{t.fromAccountName}</span>
                      {!t.linked && (
                        <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-200">
                          Ej matchad
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.outgoingTransfers.length > 0 && (
              <div className={summary.incomingTransfers.length > 0 ? 'mt-4' : ''}>
                <h4 className="font-semibold mb-2 text-sm">Utgående</h4>
                <ul className="list-disc pl-5 space-y-1">
                  {summary.outgoingTransfers.map((t, index) => (
                    <li key={index} className="text-sm">
                      <span className="font-medium">{formatCurrency(t.amount)}</span> till{' '}
                      <span className="text-muted-foreground">{t.toAccountName}</span>
                      {!t.linked && (
                        <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-200">
                          Ej matchad
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};