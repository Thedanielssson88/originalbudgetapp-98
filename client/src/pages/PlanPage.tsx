import { useEffect } from "react";
import { useLocation } from "wouter";
import PlanCalculator from "@/components/PlanCalculator";

const PlanPage = () => {
  const [location] = useLocation();

  useEffect(() => {
    // Map routes to tab names that the PlanCalculator expects
    const routeToTabMap: { [key: string]: string } = {
      '/plan': 'inkomster',
      '/plan/inkomster': 'inkomster',
      '/plan/sammanstallning': 'sammanstallning', 
      '/plan/overforing': 'overforing',
      '/plan/egen-budget': 'egen-budget',
      '/plan/historia': 'historia'
    };

    const targetTab = routeToTabMap[location] || 'inkomster';
    
    // Find the PlanCalculator component and set its active tab
    // This is a bit of a hack, but since PlanCalculator uses internal state for tabs,
    // we need to trigger a custom event or find another way to sync
    const event = new CustomEvent('setActiveTab', { detail: targetTab });
    window.dispatchEvent(event);
  }, [location]);

  return <PlanCalculator />;
};

export default PlanPage;