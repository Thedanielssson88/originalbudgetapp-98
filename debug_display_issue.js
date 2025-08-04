
// Debug kategori-display problem
console.clear();
console.log('🔍 CATEGORY DEBUG: Looking at current month transactions...');

// Get all transactions from storage
const budgetState = JSON.parse(localStorage.getItem('budgetState') || '{}');
const allTransactions = budgetState.allTransactions || [];

console.log('Total transactions in storage:', allTransactions.length);

// Filter for August 2025 transactions
const augustTransactions = allTransactions.filter(tx => 
  tx.date >= '2025-08-01' && tx.date <= '2025-08-31'
);

console.log('August 2025 transactions:', augustTransactions.length);

// Show transactions with categories
const txsWithCategories = augustTransactions.filter(tx => 
  tx.bankCategory && tx.bankCategory !== '-' && tx.bankCategory.trim() !== ''
);

console.log('August transactions WITH categories:', txsWithCategories.length);

if (txsWithCategories.length > 0) {
  console.log('Sample transactions with categories:');
  txsWithCategories.slice(0, 5).forEach((tx, i) => {
    console.log(i+1 + '.', {
      id: tx.id.slice(0,8) + '...',
      description: tx.description,
      bankCategory: tx.bankCategory,
      bankSubCategory: tx.bankSubCategory,
      date: tx.date
    });
  });
} else {
  console.log('❌ NO AUGUST TRANSACTIONS HAVE CATEGORIES!');
  
  // Check a few recent transactions to see what they look like
  console.log('Sample recent August transactions:');
  augustTransactions.slice(0, 3).forEach((tx, i) => {
    console.log(i+1 + '.', {
      id: tx.id.slice(0,8) + '...',
      description: tx.description,
      bankCategory: tx.bankCategory || 'MISSING',
      bankSubCategory: tx.bankSubCategory || 'MISSING',
      date: tx.date
    });
  });
}

