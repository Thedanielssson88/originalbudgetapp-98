import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Link2, 
  Sparkles,
  Receipt,
  Shield,
  Banknote,
  Calendar,
  Building2,
  Edit3,
  Plus,
  ArrowUpDown,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useBudget } from '@/hooks/useBudget';
import { useTransactions, useUpdateTransaction } from '@/hooks/useTransactions';
import { useHuvudkategorier, useUnderkategorier } from '@/hooks/useCategories';
import { useCategoryRules, useCreateCategoryRule } from '@/hooks/useCategoryRules';
import { formatOrenAsCurrency } from '@/utils/currencyUtils';
import { TransactionTypeSelector } from '@/components/TransactionTypeSelector';
import { CreateRuleDialog } from '@/components/CreateRuleDialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function TransactionReviewPage() {
  const { toast } = useToast();
  const { orchestrator, budgetState } = useBudget();
  const { data: transactions = [] } = useTransactions();
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: underkategorier = [] } = useUnderkategorier();
  const createRuleMutation = useCreateCategoryRule();
  const updateTransactionMutation = useUpdateTransaction();

  // Filter uncategorized transactions (red/yellow) for current month
  const uncategorizedTransactions = useMemo(() => {
    const currentMonth = budgetState.selectedMonthKey;
    return transactions.filter(tx => {
      const txMonth = tx.date ? tx.date.substring(0, 7) : '';
      return txMonth === currentMonth && 
             (tx.status === 'red' || tx.status === 'yellow') &&
             tx.amount !== 0;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, budgetState.selectedMonthKey]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editMode, setEditMode] = useState<'note' | 'amount' | null>(null);
  const [tempNote, setTempNote] = useState('');
  const [tempAmount, setTempAmount] = useState('');

  const currentTransaction = uncategorizedTransactions[currentIndex];

  // Handle swipe/navigation
  const handleNext = useCallback(() => {
    if (currentIndex < uncategorizedTransactions.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
      setEditMode(null);
    }
  }, [currentIndex, uncategorizedTransactions.length]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
      setEditMode(null);
    }
  }, [currentIndex]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      handlePrevious();
    } else if (info.offset.x < -swipeThreshold) {
      handleNext();
    }
  };

  // Handle category updates
  const handleCategoryUpdate = async (huvudkategoriId: string, underkategoriId?: string) => {
    if (!currentTransaction) return;

    const huvudkat = huvudkategorier.find(h => h.id === huvudkategoriId);
    const underkat = underkategoriId ? underkategorier.find(u => u.id === underkategoriId) : null;

    await orchestrator.updateTransactionCategory(
      currentTransaction.id,
      huvudkat?.name || '',
      underkat?.id
    );

    toast({
      title: "Kategori uppdaterad",
      description: `${huvudkat?.name}${underkat ? ` - ${underkat.name}` : ''}`,
    });
  };

  // Handle transaction type update
  const handleTypeUpdate = async (type: string) => {
    if (!currentTransaction) return;
    
    await updateTransactionMutation.mutateAsync({
      id: currentTransaction.id,
      type: type
    });

    toast({
      title: "Transaktionstyp uppdaterad",
      description: `Ändrad till ${type}`,
    });
  };

  // Handle approve (make green)
  const handleApprove = async () => {
    if (!currentTransaction) return;

    await orchestrator.updateTransactionStatus(currentTransaction.id, 'green');
    
    toast({
      title: "Transaktion godkänd",
      className: "bg-green-50 border-green-200",
    });

    // Auto-advance to next transaction
    setTimeout(() => {
      if (currentIndex < uncategorizedTransactions.length - 1) {
        handleNext();
      }
    }, 300);
  };

  // Handle note update
  const handleNoteUpdate = async () => {
    if (!currentTransaction) return;
    
    await orchestrator.updateTransactionNote(currentTransaction.id, tempNote);
    setEditMode(null);
    
    toast({
      title: "Anteckning sparad",
    });
  };

  // Handle create rule
  const handleCreateRule = async (ruleData: any) => {
    await createRuleMutation.mutateAsync(ruleData);
    setShowRuleDialog(false);
    
    toast({
      title: "Regel skapad",
      description: "Transaktioner kommer automatiskt kategoriseras framöver",
    });
  };

  if (uncategorizedTransactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Allt är kategoriserat!</h2>
        <p className="text-muted-foreground">Du har inga transaktioner att granska just nu.</p>
      </div>
    );
  }

  if (!currentTransaction) return null;

  const progress = ((currentIndex + 1) / uncategorizedTransactions.length) * 100;
  const huvudkategoriForTransaction = huvudkategorier.find(h => h.name === currentTransaction.huvudkategori);
  const underkategorierForHuvud = huvudkategoriForTransaction 
    ? underkategorier.filter(u => u.huvudkategoriId === huvudkategoriForTransaction.id)
    : [];

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-20">
      {/* Header with progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Granska transaktioner</h1>
          <Badge variant="outline" className="text-lg px-3 py-1">
            {currentIndex + 1} / {uncategorizedTransactions.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          {uncategorizedTransactions.length - currentIndex - 1} transaktioner kvar att granska
        </p>
      </div>

      {/* Swipeable transaction card */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentTransaction.id}
          custom={direction}
          initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={handleDragEnd}
          className="touch-pan-y"
        >
          <Card className={cn(
            "border-2 shadow-lg",
            currentTransaction.status === 'red' ? "border-red-200 bg-red-50/50" : "border-yellow-200 bg-yellow-50/50"
          )}>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge 
                      variant={currentTransaction.status === 'red' ? "destructive" : "default"}
                      className="text-xs"
                    >
                      {currentTransaction.status === 'red' ? 'Ej kategoriserad' : 'Delvis kategoriserad'}
                    </Badge>
                    {currentTransaction.type && (
                      <Badge variant="outline" className="text-xs">
                        {currentTransaction.type}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(currentTransaction.date), 'PPP', { locale: sv })}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-2xl font-bold",
                    currentTransaction.amount < 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {formatOrenAsCurrency(currentTransaction.amount)}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Account info */}
              <div className="flex items-center gap-2 p-3 bg-background rounded-lg">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{currentTransaction.accountName || 'Okänt konto'}</span>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <div className="p-3 bg-background rounded-lg">
                  <p className="font-medium">{currentTransaction.description}</p>
                  {currentTransaction.bankKategori && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Bank: {currentTransaction.bankKategori}
                      {currentTransaction.bankUnderkategori && ` - ${currentTransaction.bankUnderkategori}`}
                    </p>
                  )}
                </div>
              </div>

              {/* Category selection */}
              <div className="space-y-3">
                <Label>Kategori</Label>
                <div className="grid gap-2">
                  <Select
                    value={huvudkategoriForTransaction?.id || ''}
                    onValueChange={(value) => handleCategoryUpdate(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj huvudkategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {huvudkategorier.map(kat => (
                        <SelectItem key={kat.id} value={kat.id}>
                          {kat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {huvudkategoriForTransaction && underkategorierForHuvud.length > 0 && (
                    <Select
                      value={currentTransaction.underkategoriId || ''}
                      onValueChange={(value) => handleCategoryUpdate(huvudkategoriForTransaction.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Välj underkategori" />
                      </SelectTrigger>
                      <SelectContent>
                        {underkategorierForHuvud.map(kat => (
                          <SelectItem key={kat.id} value={kat.id}>
                            {kat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Transaction type */}
              <div className="space-y-2">
                <Label>Transaktionstyp</Label>
                <TransactionTypeSelector
                  value={currentTransaction.type || 'Expense'}
                  onChange={handleTypeUpdate}
                  amount={currentTransaction.amount}
                />
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label>Egen anteckning</Label>
                {editMode === 'note' ? (
                  <div className="flex gap-2">
                    <Input
                      value={tempNote}
                      onChange={(e) => setTempNote(e.target.value)}
                      placeholder="Lägg till anteckning..."
                      onKeyDown={(e) => e.key === 'Enter' && handleNoteUpdate()}
                    />
                    <Button size="sm" onClick={handleNoteUpdate}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditMode(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="p-3 bg-background rounded-lg cursor-pointer hover:bg-accent"
                    onClick={() => {
                      setTempNote(currentTransaction.egenText || '');
                      setEditMode('note');
                    }}
                  >
                    <p className="text-sm">
                      {currentTransaction.egenText || <span className="text-muted-foreground">Klicka för att lägga till...</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => orchestrator.linkExpenseAndCoverage(currentTransaction.id, '')}
                  className="justify-start"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Utlägg
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => orchestrator.coverCost(currentTransaction.id, '')}
                  className="justify-start"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Täck kostnad
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRuleDialog(true)}
                  className="justify-start"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Skapa regel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Länka sparande
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      {/* Navigation controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            className="flex-1"
            size="lg"
            onClick={handleApprove}
            disabled={!currentTransaction.huvudkategori}
          >
            <Check className="h-5 w-5 mr-2" />
            Godkänn
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === uncategorizedTransactions.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Rule creation dialog */}
      {showRuleDialog && currentTransaction && (
        <CreateRuleDialog
          isOpen={showRuleDialog}
          onClose={() => setShowRuleDialog(false)}
          onSave={handleCreateRule}
          transaction={currentTransaction}
          accounts={budgetState.accounts}
        />
      )}
    </div>
  );
}