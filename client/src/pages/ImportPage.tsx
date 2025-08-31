import { TransactionImportEnhanced } from "../components/TransactionImportEnhanced";

const ImportPage = () => {
  return (
    <div className="mx-4 py-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Importera Transaktioner
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Importera CSV/XLSX-filer från din bank och mappa kolumner automatiskt
        </p>
      </div>
      
      <TransactionImportEnhanced />
    </div>
  );
};

export default ImportPage;