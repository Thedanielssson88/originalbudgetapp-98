import React, { useState } from 'react';
import { useBudget } from '../hooks/useBudget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BudgetCalculator = () => {
  console.log('🔥 [COMPONENT] BudgetCalculator component is starting!');
  
  const { isLoading, budgetState, calculated } = useBudget();
  
  // Basic state management - start simple
  const [activeTab, setActiveTab] = useState<string>("inkomster");
  
  console.log('🔥 [COMPONENT] BudgetCalculator render - isLoading:', isLoading);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading budget calculator...</div>
      </div>
    );
  }
  
  const currentMonthData = budgetState.historicalData[budgetState.selectedMonthKey] || {};
  
  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Budget Calculator</CardTitle>
          <div className="text-sm text-gray-600">
            Selected Month: {budgetState.selectedMonthKey}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="inkomster">Income</TabsTrigger>
              <TabsTrigger value="kostnader">Costs</TabsTrigger>
              <TabsTrigger value="sparande">Savings</TabsTrigger>
              <TabsTrigger value="resultat">Results</TabsTrigger>
            </TabsList>
            
            <TabsContent value="inkomster" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Income</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Andreas Salary</label>
                      <Input 
                        type="number" 
                        value={currentMonthData.andreasSalary || 45000}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Susanna Salary</label>
                      <Input 
                        type="number" 
                        value={currentMonthData.susannaSalary || 40000}
                        readOnly
                      />
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium">Total Monthly Income</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {calculated.results.totalSalary.toLocaleString()} kr
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="kostnader" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentMonthData.costGroups?.map((group: any, index: number) => (
                      <div key={group.id || index} className="flex justify-between items-center p-3 border rounded">
                        <span>{group.name}</span>
                        <span className="font-medium">{group.amount?.toLocaleString()} kr</span>
                      </div>
                    )) || <div className="text-gray-500">No cost categories defined</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="sparande" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Savings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentMonthData.savingsGroups?.map((group: any, index: number) => (
                      <div key={group.id || index} className="flex justify-between items-center p-3 border rounded">
                        <span>{group.name}</span>
                        <span className="font-medium">{group.amount?.toLocaleString()} kr</span>
                      </div>
                    )) || <div className="text-gray-500">No savings categories defined</div>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="resultat" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Budget Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-sm font-medium">Balance Left</div>
                      <div className="text-2xl font-bold text-green-600">
                        {calculated.results.balanceLeft.toLocaleString()} kr
                      </div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-sm font-medium">Daily Budget</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {calculated.results.totalDailyBudget.toLocaleString()} kr
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm font-medium">Andreas Share</div>
                      <div className="text-xl font-bold">
                        {calculated.results.andreasShare.toLocaleString()} kr
                      </div>
                      <div className="text-sm text-gray-600">
                        ({calculated.results.andreasPercentage.toFixed(1)}%)
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-sm font-medium">Susanna Share</div>
                      <div className="text-xl font-bold">
                        {calculated.results.susannaShare.toLocaleString()} kr
                      </div>
                      <div className="text-sm text-gray-600">
                        ({calculated.results.susannaPercentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetCalculator;