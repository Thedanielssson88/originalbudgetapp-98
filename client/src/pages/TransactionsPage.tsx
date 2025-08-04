import { TransactionImportEnhanced } from "@/components/TransactionImportEnhanced";

const TransactionsPage = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Läs in transaktioner
          </h1>
          <p className="text-muted-foreground text-lg">
            Importera banktransaktioner för att kategorisera och analysera utgifter
          </p>
        </div>
        <TransactionImportEnhanced />
      </div>
    </div>
  );
};

export default TransactionsPage;