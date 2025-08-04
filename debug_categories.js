console.log('🔍 CATEGORY DEBUG: Transaction from storage with categories:'); 
const allTx = JSON.parse(localStorage.getItem('budgetState') || '{}').allTransactions || [];
const txWithCats = allTx.filter(tx => tx.bankCategory && tx.bankCategory !== '-').slice(0, 3);
console.log('Found transactions with categories:', txWithCats.map(tx => ({
  id: tx.id.slice(0,8),
  desc: tx.description,
  bankCat: tx.bankCategory,
  bankSubCat: tx.bankSubCategory,
  date: tx.date
})));
console.log('Total transactions:', allTx.length);
