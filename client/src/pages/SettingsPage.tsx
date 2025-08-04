import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MainCategoriesSettings } from "@/components/MainCategoriesSettings";
import { PaydaySettings } from "@/components/PaydaySettings";
import { useBudget } from "@/hooks/useBudget";

const SettingsPage = () => {
  const { budgetState } = useBudget();
  const [currentPayday, setCurrentPayday] = useState(25); // Default payday

  const handlePaydayChange = (newPayday: number) => {
    setCurrentPayday(newPayday);
    // Here you would typically save to the backend or state management
    console.log('Payday changed to:', newPayday);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Inställningar
          </h1>
          <p className="text-muted-foreground text-lg">
            Konfigurera kategorier och löndagar för budgetkalkylatorn
          </p>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lönedag och Period</CardTitle>
            </CardHeader>
            <CardContent>
              <PaydaySettings 
                currentPayday={currentPayday}
                onPaydayChange={handlePaydayChange}
              />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Huvudkategorier</CardTitle>
            </CardHeader>
            <CardContent>
              <MainCategoriesSettings 
                mainCategories={budgetState.categories?.map(cat => cat.name) || []}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;