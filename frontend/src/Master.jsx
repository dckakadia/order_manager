import { canViewPage } from './apiUtils';
import CustomerMaster from './CustomerMaster';
import ItemMaster from './ItemMaster';

// Merges the Customers and Items pages into one. Each section keeps its own
// independent page permission ('customers' / 'items') — a user might have
// view rights on one but not the other, so each renders on its own.
export default function Master() {
  const showCustomers = canViewPage('customers');
  const showItems = canViewPage('items');

  return (
    <div className="grid-1" style={{ gap: '2rem' }}>
      {showCustomers && (
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>Customers</h2>
          <CustomerMaster />
        </div>
      )}

      {showItems && (
        <div>
          <h2 style={{ marginBottom: '1.5rem' }}>Items</h2>
          <ItemMaster />
        </div>
      )}
    </div>
  );
}
