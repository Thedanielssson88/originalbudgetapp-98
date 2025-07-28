import React from 'react';
import { useBudget } from '../hooks/useBudget';

const BudgetCalculatorMinimal = () => {
  console.log('🔥 [COMPONENT] BudgetCalculatorMinimal is starting!');
  
  const { isLoading, budgetState, calculated } = useBudget();
  
  console.log('🔥 [COMPONENT] BudgetCalculatorMinimal render - isLoading:', isLoading);
  
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Budget Calculator - Minimal Version</h1>
      <p>Selected Month: {budgetState.selectedMonthKey}</p>
      <p>Total Salary: {calculated.results.totalSalary}</p>
      <p>Balance Left: {calculated.results.balanceLeft}</p>
      <p>Andreas Share: {calculated.results.andreasShare}</p>
      <p>Susanna Share: {calculated.results.susannaShare}</p>
    </div>
  );
};

export default BudgetCalculatorMinimal;