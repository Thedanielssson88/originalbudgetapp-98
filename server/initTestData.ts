import { db } from './db';
import { accounts, huvudkategorier, underkategorier } from '../shared/schema';

async function initTestData() {
  try {
    console.log('Initializing test data...');
    
    // Add test account
    const [testAccount] = await db.insert(accounts).values({
      userId: 'dev-user-123',
      name: 'Överföring',
      balance: 0
    }).returning();
    
    console.log('Created account:', testAccount);
    
    // Add huvudkategorier
    const kategorier = await db.insert(huvudkategorier).values([
      { userId: 'dev-user-123', name: 'Hyra' },
      { userId: 'dev-user-123', name: 'Mat & Kläder' },
      { userId: 'dev-user-123', name: 'Transport' }
    ]).returning();
    
    console.log('Created huvudkategorier:', kategorier);
    
    // Add underkategorier for Transport
    const transportKategori = kategorier.find(k => k.name === 'Transport');
    if (transportKategori) {
      const underkat = await db.insert(underkategorier).values([
        { userId: 'dev-user-123', huvudkategoriId: transportKategori.id, name: 'Bränsle' },
        { userId: 'dev-user-123', huvudkategoriId: transportKategori.id, name: 'Underhåll fordon' },
        { userId: 'dev-user-123', huvudkategoriId: transportKategori.id, name: 'Parkering' },
        { userId: 'dev-user-123', huvudkategoriId: transportKategori.id, name: 'Kollektivtrafik' }
      ]).returning();
      
      console.log('Created underkategorier:', underkat);
    }
    
    console.log('Test data initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing test data:', error);
    process.exit(1);
  }
}

initTestData();