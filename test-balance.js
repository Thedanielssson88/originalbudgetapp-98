const fetch = require('node-fetch');

async function testBalance() {
  try {
    // Create a test balance post
    const response = await fetch('http://localhost:5000/api/budget-posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        monthKey: '2025-01',
        type: 'Balance',
        accountId: 'test-account-id',
        accountUserBalance: 12345,  // 123.45 kr in öre
        accountBalance: 67890,       // 678.90 kr in öre
        amount: 0,
        description: 'Test Balance',
        huvudkategoriId: null,
        underkategoriId: null
      })
    });

    const result = await response.json();
    console.log('Create result:', JSON.stringify(result, null, 2));

    // Check if the fields were saved
    if (result.accountUserBalance !== undefined) {
      console.log('✓ accountUserBalance field exists:', result.accountUserBalance);
    } else {
      console.log('✗ accountUserBalance field missing!');
    }

    if (result.accountBalance !== undefined) {
      console.log('✓ accountBalance field exists:', result.accountBalance);
    } else {
      console.log('✗ accountBalance field missing!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testBalance();