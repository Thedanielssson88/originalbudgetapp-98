import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, Shield, Smartphone, BarChart3, PieChart, Target } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse"></div>
      </div>
      
      {/* Floating elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full opacity-20 animate-bounce delay-1000"></div>
      <div className="absolute top-40 right-16 w-16 h-16 bg-gradient-to-r from-pink-400 to-red-500 rounded-full opacity-20 animate-bounce delay-2000"></div>
      <div className="absolute bottom-20 left-20 w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full opacity-20 animate-bounce"></div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Hero Section */}
        <div className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm mb-8 border border-white/20">
              <Sparkles className="w-4 h-4" />
              Ny generation budgetapp
            </div>
            
            {/* Main heading */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Svensk Budget
              </span>
              <br />
              <span className="text-white">& Ekonomi</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl sm:text-2xl text-gray-200 mb-12 max-w-3xl mx-auto font-light leading-relaxed">
              Revolutionera din privatekonomi med AI-driven kategorisering, 
              <span className="text-blue-300 font-medium"> automatiska insikter</span> och 
              <span className="text-purple-300 font-medium"> smarta sparmål</span>
            </p>
            
            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-10 py-4 text-lg font-semibold rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 border-0 min-w-[280px] sm:min-w-auto"
                onClick={() => window.location.href = '/api/login'}
              >
                <span>Kom igång gratis</span>
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            
            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-6 text-gray-300 text-sm mb-12">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>Säker inloggning</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <span>Mobil-först</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <span>Realtidsdata</span>
              </div>
            </div>
            
            {/* Feature cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Smart Kategorisering
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  AI-driven automatisk kategorisering av alla dina transaktioner med anpassade regler och lärande algoritmer
                </p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all duration-300 group">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <PieChart className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Bankimport
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Importera transaktioner direkt från alla svenska banker via CSV/XLSX med intelligent mappning
                </p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all duration-300 group sm:col-span-2 lg:col-span-1">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Smarta Sparmål
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  Sätt upp och spåra dina sparmål med automatiska sparrekommendationer och framstegsspårning
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="text-center py-8 px-4">
          <p className="text-gray-400 text-sm">
            Säker inloggning via Replit • Dina data krypteras och skyddas • GDPR-kompatibel
          </p>
        </div>
      </div>
    </div>
  );
}