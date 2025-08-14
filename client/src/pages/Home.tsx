import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { Link } from "wouter";
import { User } from "@shared/schema";

export default function Home() {
  const { user } = useAuth() as { user: User | undefined };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Välkommen till din Budget!
                </h1>
                {user && (
                  <p className="text-gray-600 dark:text-gray-300 mt-2">
                    Hej {user.firstName || user.email}! 👋
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {user?.profileImageUrl && (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profil" 
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/api/logout'}
                >
                  Logga ut
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/budget">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Budget & Månadskalkyl
                  </h3>
                  <p className="text-blue-700 dark:text-blue-200">
                    Skapa och hantera din månadsbudget
                  </p>
                </div>
              </Link>
              
              <Link href="/transactions">
                <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                  <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                    Transaktioner
                  </h3>
                  <p className="text-green-700 dark:text-green-200">
                    Se och hantera dina transaktioner
                  </p>
                </div>
              </Link>
              
              <Link href="/import">
                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
                    Importera Data
                  </h3>
                  <p className="text-purple-700 dark:text-purple-200">
                    Importera transaktioner från bank
                  </p>
                </div>
              </Link>
              
              <Link href="/savings">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
                  <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                    Sparmål
                  </h3>
                  <p className="text-yellow-700 dark:text-yellow-200">
                    Planera och spåra dina sparmål
                  </p>
                </div>
              </Link>
              
              <Link href="/categories">
                <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                    Kategorier
                  </h3>
                  <p className="text-red-700 dark:text-red-200">
                    Hantera kategorier och regler
                  </p>
                </div>
              </Link>
              
              <Link href="/settings">
                <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Inställningar
                  </h3>
                  <p className="text-gray-700 dark:text-gray-200">
                    Konfigurera din applikation
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}