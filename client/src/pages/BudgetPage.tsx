import { useEffect } from "react";
import { useLocation } from "wouter";
import BudgetCalculator from "@/components/BudgetCalculator";

const BudgetPage = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Map routes to tab names that the BudgetCalculator expects
    const routeToTabMap: { [key: string]: string } = {
      '/': 'inkomster',
      '/inkomster': 'inkomster',
      '/sammanstallning': 'sammanstallning', 
      '/overforing': 'overforing',
      '/egen-budget': 'egen-budget',
      '/historia': 'historia'
    };

    const targetTab = routeToTabMap[location] || 'inkomster';
    
    // Find the BudgetCalculator component and set its active tab
    // This is a bit of a hack, but since BudgetCalculator uses internal state for tabs,
    // we need to trigger a custom event or find another way to sync
    const event = new CustomEvent('setActiveTab', { detail: targetTab });
    window.dispatchEvent(event);
  }, [location]);

  return <BudgetCalculator />;
};

export default BudgetPage;