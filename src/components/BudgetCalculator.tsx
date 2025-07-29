import React, { useState, useEffect, useCallback, useReducer } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBudget } from '../hooks/useBudget';
import TransactionImport from '@/components/TransactionImport';
import { Transaction } from '@/types/budget';

const BudgetCalculator = () => {
  const { isLoading, budgetState, calculated } = useBudget();
  const [activeTab, setActiveTab] = useState('inkomster');

  const handleTransactionsImported = (transactions: Transaction[]) => {
    console.log('Importing transactions:', transactions);
    // TODO: Implement actual transaction storage/processing
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Laddar budgetdata...</p>
        </div>
      </div>
    );
  }

  const accounts = budgetState.accounts?.map(account => account.name) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="inkomster">Budget</TabsTrigger>
            <TabsTrigger value="sammanstallning">Översikt</TabsTrigger>
            <TabsTrigger value="historia">Historia</TabsTrigger>
            <TabsTrigger value="sparmal">Sparmål</TabsTrigger>
            <TabsTrigger value="transaktioner">Transaktioner</TabsTrigger>
            <TabsTrigger value="installningar">Inställningar</TabsTrigger>
          </TabsList>

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-center">
              {activeTab === 'inkomster' && 'Min Månadsbudget'}
              {activeTab === 'sammanstallning' && 'Budgetöversikt'}
              {activeTab === 'historia' && 'Historik'}
              {activeTab === 'sparmal' && 'Sparmål'}
              {activeTab === 'transaktioner' && 'Läs in transaktioner'}
              {activeTab === 'installningar' && 'Inställningar'}
            </h1>
          </div>

          <TabsContent value="inkomster" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Budgethantering</CardTitle>
                <CardDescription>Hantera din månadsbudget</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Budgetfunktioner kommer snart att återställas...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sammanstallning" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Budgetöversikt</CardTitle>
                <CardDescription>Se din budgetsammanfattning</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Översiktsfunktioner kommer snart att återställas...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historia" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Historisk data</CardTitle>
                <CardDescription>Se tidigare månaders budgetar</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Historikfunktioner kommer snart att återställas...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sparmal" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Sparmål</CardTitle>
                <CardDescription>Hantera dina sparmål</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sparmålsfunktioner kommer snart att återställas...
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transaktioner" className="mt-0">
            <div className="container mx-auto p-6">
              <TransactionImport
                accounts={accounts}
                onTransactionsImported={handleTransactionsImported}
              />
            </div>
          </TabsContent>

          <TabsContent value="installningar" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Inställningar</CardTitle>
                <CardDescription>Konfigurera din budget</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Inställningar kommer snart att återställas...
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BudgetCalculator;