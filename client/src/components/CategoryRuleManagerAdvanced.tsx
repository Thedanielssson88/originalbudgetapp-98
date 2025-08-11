import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Trash2, 
  Plus, 
  Edit, 
  ChevronDown, 
  ChevronUp,
  Filter,
  Settings,
  Target,
  Users,
  Tag,
  ToggleLeft,
  ToggleRight,
  Search,
  SortDesc,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { RuleCondition } from '@/types/budget';
import { v4 as uuidv4 } from 'uuid';
import { get, StorageKey } from '@/services/storageService';
import { useHuvudkategorier, useUnderkategorier, useCategoryNames } from '@/hooks/useCategories';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryRule } from '@shared/schema';
import { BankCategorySelector } from './BankCategorySelector';
import { CreateRuleDialog } from './CreateRuleDialog';
import { useBudget } from '@/hooks/useBudget';

interface CategoryRuleManagerAdvancedProps {
  rules: CategoryRule[];
  onRulesChange: (rules: CategoryRule[]) => void;
  mainCategories: string[]; // Legacy - still used for backwards compatibility during transition
  accounts: { id: string; name: string }[];
}

export const CategoryRuleManagerAdvanced: React.FC<CategoryRuleManagerAdvancedProps> = ({
  rules,
  onRulesChange,
  mainCategories,
  accounts
}) => {
  // Use UUID-based category hooks
  const { data: huvudkategorier = [] } = useHuvudkategorier();
  const { data: allUnderkategorier = [] } = useUnderkategorier();
  const { getHuvudkategoriName, getUnderkategoriName, getCategoryPath } = useCategoryNames();
  const { budgetState } = useBudget();
  
  // Extract available bank categories from transactions
  const availableBankCategories = React.useMemo(() => {
    const categories = new Set<string>();
    const allTransactions = budgetState?.allTransactions || [];
    allTransactions.forEach(tx => {
      if (tx.bankCategory && tx.bankCategory.trim() && tx.bankCategory !== '-') {
        categories.add(tx.bankCategory);
      }
    });
    return Array.from(categories).sort();
  }, [budgetState?.allTransactions]);
  
  const availableBankSubCategories = React.useMemo(() => {
    const subcategories = new Set<string>();
    const allTransactions = budgetState?.allTransactions || [];
    allTransactions.forEach(tx => {
      if (tx.bankSubCategory && tx.bankSubCategory.trim() && tx.bankSubCategory !== '-') {
        subcategories.add(tx.bankSubCategory);
      }
    });
    return Array.from(subcategories).sort();
  }, [budgetState?.allTransactions]);
  
  // Helper function to get account name by ID
  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : accountId;
  };
  
  const queryClient = useQueryClient();

  // State for filters and UI
  const [isCreateRuleDialogOpen, setIsCreateRuleDialogOpen] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);

  // Fetch PostgreSQL rules
  const { data: postgresqlRules = [], isLoading, error, refetch: refetchRules } = useQuery<CategoryRule[]>({
    queryKey: ['/api/category-rules'],
    queryFn: async () => {
      const response = await fetch('/api/category-rules');
      if (!response.ok) {
        throw new Error(`Failed to fetch rules: ${response.status}`);
      }
      return response.json();
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      console.log(`🗑️ [DELETE RULE] Attempting to delete rule: ${ruleId}`);
      const response = await fetch(`/api/category-rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [DELETE RULE] Failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to delete rule: ${response.status} - ${errorText}`);
      }
      console.log(`✅ [DELETE RULE] Successfully deleted rule: ${ruleId}`);
      // Handle 204 No Content response - don't try to parse JSON
      if (response.status === 204) {
        return { success: true };
      }
      return response.json();
    },
    onSuccess: () => {
      console.log(`🔄 [DELETE RULE] Refreshing rules list...`);
      // Force refetch immediately 
      queryClient.refetchQueries({ queryKey: ['/api/category-rules'] });
    }
  });

  // Toggle rule active status
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ ruleId, isActive }: { ruleId: string, isActive: boolean }) => {
      const response = await fetch(`/api/category-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: isActive ? 'true' : 'false' })
      });
      if (!response.ok) {
        throw new Error(`Failed to toggle rule: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/category-rules'] });
    }
  });

  // Toggle rule auto approval
  const toggleAutoApprovalMutation = useMutation({
    mutationFn: async ({ ruleId, autoApproval }: { ruleId: string, autoApproval: boolean }) => {
      const response = await fetch(`/api/category-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApproval })
      });
      if (!response.ok) {
        throw new Error(`Failed to toggle auto approval: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['/api/category-rules'] });
    }
  });

  const handleDeleteRule = async (ruleId: string) => {
    if (confirm('Är du säker på att du vill ta bort denna regel?')) {
      try {
        await deleteMutation.mutateAsync(ruleId);
      } catch (error) {
        console.error('❌ [RULE MANAGER] Failed to delete rule:', error);
      }
    }
  };

  const handleToggleRule = async (rule: CategoryRule) => {
    try {
      const newActiveStatus = !(rule.isActive === 'true' || rule.isActive === true);
      await toggleRuleMutation.mutateAsync({ 
        ruleId: rule.id, 
        isActive: newActiveStatus 
      });
    } catch (error) {
      console.error('❌ [RULE MANAGER] Failed to toggle rule:', error);
    }
  };

  const handleToggleAutoApproval = async (rule: CategoryRule) => {
    try {
      const newAutoApprovalStatus = !rule.autoApproval;
      await toggleAutoApprovalMutation.mutateAsync({ 
        ruleId: rule.id, 
        autoApproval: newAutoApprovalStatus 
      });
    } catch (error) {
      console.error('❌ [RULE MANAGER] Failed to toggle auto approval:', error);
    }
  };

  const toggleRuleExpansion = (ruleId: string) => {
    setExpandedRules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  // Filter and sort rules
  const filteredAndSortedRules = useMemo(() => {
    let filtered = postgresqlRules.filter(rule => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          rule.ruleName?.toLowerCase().includes(searchLower) ||
          rule.transactionName?.toLowerCase().includes(searchLower) ||
          getHuvudkategoriName(rule.huvudkategoriId)?.toLowerCase().includes(searchLower) ||
          getUnderkategoriName(rule.underkategoriId)?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Active filter
      if (filterActive !== 'all') {
        const isActive = rule.isActive === 'true' || rule.isActive === true;
        if (filterActive === 'active' && !isActive) return false;
        if (filterActive === 'inactive' && isActive) return false;
      }

      // Account filter
      if (filterAccount !== 'all') {
        try {
          const applicableAccounts = rule.applicableAccountIds ? JSON.parse(rule.applicableAccountIds) : [];
          if (applicableAccounts.length > 0 && !applicableAccounts.includes(filterAccount)) {
            return false;
          }
        } catch (e) {
          // If parsing fails, assume it applies to all accounts
        }
      }

      // Category filter
      if (filterCategory !== 'all') {
        if (rule.huvudkategoriId !== filterCategory) return false;
      }

      return true;
    });

    // Sort by priority (lower number = higher priority)
    filtered.sort((a, b) => {
      const priorityA = a.priority || 100;
      const priorityB = b.priority || 100;
      return priorityA - priorityB;
    });

    return filtered;
  }, [postgresqlRules, searchTerm, filterActive, filterAccount, filterCategory, getHuvudkategoriName, getUnderkategoriName]);

  // Helper function to format rule title
  const formatRuleTitle = (rule: CategoryRule) => {
    const huvudkategori = getHuvudkategoriName(rule.huvudkategoriId) || 'Okänd kategori';
    const underkategori = getUnderkategoriName(rule.underkategoriId) || 'Okänd underkategori';

    // Check if both text condition (villkor) and bank categories are present
    const hasTextCondition = rule.ruleType && rule.transactionName && rule.transactionName !== '*';
    const hasBankCategories = rule.bankhuvudkategori && rule.bankhuvudkategori !== 'Alla Bankkategorier';

    if (hasTextCondition && hasBankCategories) {
      // Both villkor and bank categories present
      const typeMap = {
        'textContains': 'Innehåller',
        'textStartsWith': 'Börjar med', 
        'exactText': 'Exakt text',
        'categoryMatch': 'Bankkategori'
      };
      const typeLabel = typeMap[rule.ruleType as keyof typeof typeMap] || rule.ruleType;
      const bankCategoryPart = rule.bankunderkategori && rule.bankunderkategori !== 'Alla Bankunderkategorier' 
        ? `${rule.bankhuvudkategori} / ${rule.bankunderkategori}`
        : rule.bankhuvudkategori;
      
      return `${typeLabel} • "${rule.transactionName}" ${bankCategoryPart} → ${huvudkategori} / ${underkategori}`;
    } else if (hasBankCategories) {
      // Only bank categories
      const bankCategoryPart = rule.bankunderkategori && rule.bankunderkategori !== 'Alla Bankunderkategorier'
        ? `${rule.bankhuvudkategori} / ${rule.bankunderkategori}`
        : rule.bankhuvudkategori;
      return `${bankCategoryPart} → ${huvudkategori} / ${underkategori}`;
    } else if (hasTextCondition) {
      // Only text condition
      const typeMap = {
        'textContains': 'Innehåller',
        'textStartsWith': 'Börjar med', 
        'exactText': 'Exakt text',
        'categoryMatch': 'Bankkategori'
      };
      const typeLabel = typeMap[rule.ruleType as keyof typeof typeMap] || rule.ruleType;
      return `${typeLabel} • "${rule.transactionName}" → ${huvudkategori} / ${underkategori}`;
    }
    
    return `${rule.ruleName || 'Namnlös regel'} → ${huvudkategori} / ${underkategori}`;
  };

  // Helper function to format rule subtitle
  const formatRuleSubtitle = (rule: CategoryRule) => {
    const parts = [];
    if (rule.positiveTransactionType && rule.positiveTransactionType !== 'Transaction') {
      // Display 'Inkomst' in UI when value is 'Income'
      const displayType = rule.positiveTransactionType === 'Income' ? 'Inkomst' : rule.positiveTransactionType;
      parts.push(`Pos: ${displayType}`);
    }
    if (rule.negativeTransactionType && rule.negativeTransactionType !== 'Transaction') {
      // Display 'Inkomst' in UI when value is 'Income'
      const displayType = rule.negativeTransactionType === 'Income' ? 'Inkomst' : rule.negativeTransactionType;
      parts.push(`Neg: ${displayType}`);
    }
    return parts.length > 0 ? parts.join(' • ') : 'Standard transaktionstyper';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regelmotor för Kategorisering</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Laddar regler...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Regelmotor för Kategorisering</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Kunde inte ladda regler. Försök igen senare.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">Regelmotor för Kategorisering</CardTitle>
            <CardDescription className="mt-1">
              Hantera automatiska kategoriseringsregler för transaktioner
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateRuleDialogOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Ny regel
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filters Section */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Filter & Sök</CardTitle>
              <Badge variant="secondary" className="ml-auto">
                {filteredAndSortedRules.length} av {postgresqlRules.length} regler
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök efter regelnamn, villkor, kategorier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filter Row */}
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={filterActive} onValueChange={setFilterActive}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla regler</SelectItem>
                    <SelectItem value="active">Endast aktiva</SelectItem>
                    <SelectItem value="inactive">Endast inaktiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Konto</Label>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla konton</SelectItem>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium">Huvudkategori</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla kategorier</SelectItem>
                    {huvudkategorier.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterAccount('all');
                    setFilterCategory('all');
                    setFilterActive('all');
                  }}
                  className="w-full"
                >
                  Rensa filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rules List */}
        <div className="space-y-3">
          {filteredAndSortedRules.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-muted-foreground mb-4">
                  {searchTerm || filterAccount !== 'all' || filterCategory !== 'all' || filterActive !== 'all' 
                    ? 'Inga regler matchar dina filter'
                    : 'Inga regler skapade än'
                  }
                </div>
                {(searchTerm || filterAccount !== 'all' || filterCategory !== 'all' || filterActive !== 'all') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterAccount('all');
                      setFilterCategory('all');
                      setFilterActive('all');
                    }}
                  >
                    Rensa alla filter
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredAndSortedRules.map((rule, index) => {
              const isExpanded = expandedRules.has(rule.id);
              const isActive = rule.isActive === 'true' || rule.isActive === true;
              const applicableAccounts = rule.applicableAccountIds ? 
                (JSON.parse(rule.applicableAccountIds || '[]').length === 0 ? 
                  ['Alla konton'] : 
                  JSON.parse(rule.applicableAccountIds).map((id: string) => getAccountName(id))
                ) : ['Alla konton'];

              return (
                <Card key={rule.id} className={`transition-all duration-200 ${
                  isActive ? 'border-green-200 bg-green-50/30' : 'border-gray-200 bg-gray-50/30'
                }`}>
                  <Collapsible open={isExpanded} onOpenChange={() => toggleRuleExpansion(rule.id)}>
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="pb-3 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start justify-between w-full">
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={isActive ? "default" : "secondary"} className="shrink-0">
                                #{rule.priority || 100}
                              </Badge>
                              {!isActive && (
                                <Badge variant="outline" className="shrink-0 text-orange-600 border-orange-200">
                                  Inaktiv
                                </Badge>
                              )}
                              <h3 className="font-medium text-sm leading-tight">
                                {formatRuleTitle(rule)}
                              </h3>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRuleSubtitle(rule)}
                            </p>
                            {applicableAccounts[0] !== 'Alla konton' && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {applicableAccounts.slice(0, 3).map((accountName, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {accountName}
                                  </Badge>
                                ))}
                                {applicableAccounts.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{applicableAccounts.length - 3} till
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleRule(rule);
                              }}
                              className="h-8 w-8 p-0"
                              disabled={toggleRuleMutation.isPending}
                              title={isActive ? "Inaktivera regel" : "Aktivera regel"}
                            >
                              {isActive ? (
                                <ToggleRight className="h-4 w-4 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleAutoApproval(rule);
                              }}
                              className="h-8 w-8 p-0"
                              disabled={toggleAutoApprovalMutation.isPending}
                              title={rule.autoApproval ? "Inaktivera automatiskt godkännande" : "Aktivera automatiskt godkännande"}
                            >
                              {rule.autoApproval ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRule(rule.id);
                              }}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              disabled={deleteMutation.isPending}
                              title="Ta bort regel"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        <Separator />
                        
                        {/* Section 1: Regeln gäller för */}
                        <Card className="border-blue-200 bg-blue-50/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <Filter className="h-4 w-4 text-blue-600" />
                              <CardTitle className="text-sm">Regeln gäller för</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Regeltyp</Label>
                                <p className="font-medium">
                                  {rule.ruleType === 'textContains' && 'Text innehåller'}
                                  {rule.ruleType === 'textStartsWith' && 'Text börjar med'}
                                  {rule.ruleType === 'exactText' && 'Exakt text'}
                                  {rule.ruleType === 'categoryMatch' && 'Bankens kategori'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Villkor</Label>
                                <p className="font-medium break-words">
                                  {rule.transactionName || 'Inget villkor'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Transaktionsriktning</Label>
                                <p className="font-medium">
                                  {rule.transactionDirection === 'all' && 'Alla transaktioner'}
                                  {rule.transactionDirection === 'positive' && 'Endast inkomster (+)'}
                                  {rule.transactionDirection === 'negative' && 'Endast utgifter (-)'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Bankkategorier</Label>
                                <p className="font-medium">
                                  {rule.bankhuvudkategori && rule.bankhuvudkategori !== 'Alla Bankkategorier'
                                    ? `${rule.bankhuvudkategori}${rule.bankunderkategori && rule.bankunderkategori !== 'Alla Bankunderkategorier' ? ` / ${rule.bankunderkategori}` : ''}`
                                    : 'Alla bankkategorier'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Section 2: Konton */}
                        <Card className="border-green-200 bg-green-50/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-green-600" />
                              <CardTitle className="text-sm">Konton som regeln gäller för</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-1">
                              {applicableAccounts.map((accountName, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {accountName}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Section 3: Kategorisering & Åtgärder */}
                        <Card className="border-purple-200 bg-purple-50/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-purple-600" />
                              <CardTitle className="text-sm">Kategorisering & Åtgärder</CardTitle>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Huvudkategori</Label>
                                <p className="font-medium">
                                  {getHuvudkategoriName(rule.huvudkategoriId) || 'Okänd kategori'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Underkategori</Label>
                                <p className="font-medium">
                                  {getUnderkategoriName(rule.underkategoriId) || 'Okänd underkategori'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Positiva belopp</Label>
                                <p className="font-medium">
                                  {rule.positiveTransactionType === 'Income' ? 'Inkomst' : (rule.positiveTransactionType || 'Transaction')}
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Negativa belopp</Label>
                                <p className="font-medium">
                                  {rule.negativeTransactionType === 'Income' ? 'Inkomst' : (rule.negativeTransactionType || 'Transaction')}
                                </p>
                              </div>
                            </div>
                            
                            <Separator />
                            
                            <div className="grid gap-3 md:grid-cols-2 text-sm">
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Prioritet</Label>
                                <p className="font-medium">
                                  {rule.priority || 100} <span className="text-xs text-muted-foreground">(lägre = högre prioritet)</span>
                                </p>
                              </div>
                              <div>
                                <Label className="text-xs font-medium text-muted-foreground">Automatiskt godkännande</Label>
                                <p className="font-medium">
                                  {rule.autoApproval ? 'Ja' : 'Nej'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}
        </div>

        {/* Statistics */}
        {postgresqlRules.length > 0 && (
          <Card className="bg-gray-50/30">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {postgresqlRules.filter(r => r.isActive === 'true' || r.isActive === true).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Aktiva regler</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">
                    {postgresqlRules.filter(r => r.isActive === 'false' || r.isActive === false).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Inaktiva regler</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredAndSortedRules.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Visas just nu</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
    
    {/* Create Rule Dialog */}
    <CreateRuleDialog
      open={isCreateRuleDialogOpen}
      onOpenChange={setIsCreateRuleDialogOpen}
      accounts={accounts}
      availableBankCategories={availableBankCategories}
      availableBankSubCategories={availableBankSubCategories}
    />
    </>
  );
};