import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Svensk Budget & Ekonomi
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Hantera din privatekonomi på svenska. Importera transaktioner, skapa budgetar och spåra dina sparkål.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Smart Kategorisering
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Automatisk kategorisering av transaktioner med anpassade regler
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                CSV/XLSX Import
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Importera transaktioner direkt från din bank
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
                Målsparande
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Sätt upp och spåra dina sparmål för framtida köp
              </p>
            </div>
          </div>
          
          <Button 
            size="lg" 
            className="px-8 py-4 text-lg"
            onClick={() => window.location.href = '/api/login'}
          >
            Logga in för att komma igång
          </Button>
          
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Säker inloggning via Replit
          </p>
        </div>
      </div>
    </div>
  );
}