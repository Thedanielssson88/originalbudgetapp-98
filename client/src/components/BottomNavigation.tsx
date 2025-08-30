import { Calculator, BarChart3, ArrowRightLeft, PieChart, History, Target, Upload, Settings, LogOut, CreditCard, Bug, MoreHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const items = [
  { title: "Budget", url: "/inkomster", icon: Calculator },
  { title: "Översikt", url: "/sammanstallning", icon: BarChart3 },
  { title: "Överföring", url: "/overforing", icon: ArrowRightLeft },
  { title: "Min Budget", url: "/egen-budget", icon: PieChart },
  { title: "Historia", url: "/historia", icon: History },
  { title: "Sparmål", url: "/sparmal", icon: Target },
  { title: "Transaktioner", url: "/granska", icon: CreditCard },
  { title: "Import", url: "/transaktioner", icon: Upload },
  { title: "Inställningar", url: "/installningar", icon: Settings },
  { title: "Debug", url: "/debug", icon: Bug },
];

export function BottomNavigation() {
  const [location] = useLocation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);

  const isActive = (path: string) => location === path;

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  // Check scroll position for gradient indicators
  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setShowLeftGradient(scrollLeft > 0);
        setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 1);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll);
      }
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  // Auto-scroll to active item on mount
  useEffect(() => {
    const activeIndex = items.findIndex(item => isActive(item.url));
    if (activeIndex !== -1 && scrollContainerRef.current) {
      const itemWidth = 80; // Approximate width of each item
      const containerWidth = scrollContainerRef.current.clientWidth;
      const scrollPosition = (activeIndex * itemWidth) - (containerWidth / 2) + (itemWidth / 2);
      scrollContainerRef.current.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [location]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t shadow-lg">
      <div className="relative h-16">
        {/* Left gradient indicator */}
        {showLeftGradient && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        )}
        
        {/* Right gradient indicator */}
        {showRightGradient && (
          <div className="absolute right-12 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        )}

        <div className="flex h-full">
          {/* Scrollable navigation items */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-x-auto scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex items-center h-full px-2 gap-1" style={{ width: 'max-content' }}>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);
                
                return (
                  <Link key={item.url} href={item.url}>
                    <button
                      className={cn(
                        "flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[76px] h-14",
                        active 
                          ? "bg-primary text-primary-foreground shadow-md scale-105" 
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:scale-95"
                      )}
                    >
                      <Icon className={cn("mb-0.5 transition-all", active ? "h-5 w-5" : "h-4 w-4")} />
                      <span className={cn("font-medium whitespace-nowrap transition-all", active ? "text-[11px]" : "text-[10px]")}>
                        {item.title}
                      </span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* More menu */}
          <div className="flex items-center px-2 border-l">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all duration-200 min-w-[60px] h-14",
                    "text-muted-foreground hover:bg-accent hover:text-accent-foreground active:scale-95"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4 mb-0.5" />
                  <span className="text-[10px] font-medium">Mer</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 mb-2">
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logga ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}