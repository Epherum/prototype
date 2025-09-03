# Modal System Migration Guide

## Why Replace React Portals?

### Current Problems:
1. **Visual Flicker**: Modals appear in wrong location for ~1s before portal moves them
2. **Complex State Management**: Each modal needs its own `isOpen` state
3. **Portal Overhead**: `createPortal` and `typeof window` checks add complexity
4. **Hydration Issues**: Client-side portal creation can cause hydration mismatches
5. **Z-index Management**: Manual z-index coordination between modals
6. **Scattered Modal Logic**: Each component manages its own modal rendering

### New Solution Benefits:
1. **Zero Flicker**: Modals render directly at app level, no movement needed
2. **Centralized Management**: One provider handles all modals
3. **No Portals**: Clean React tree, no DOM manipulation
4. **Better DX**: Simplified API with hooks
5. **Auto Z-index**: Automatic stacking for multiple modals
6. **SSR Safe**: No client-side DOM dependencies

## Migration Examples

### Before (Current Portal System):

```tsx
// Component managing modal state + portal
const MyComponent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const openModal = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <>
      <button onClick={() => openModal(item)}>Open Modal</button>
      
      {/* Separate modal component with portal */}
      <MyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={selectedItem}
      />
    </>
  );
};

// Modal component with portal flicker
const MyModal = ({ isOpen, onClose, item }) => {
  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-overlay" onClick={onClose}>
          {/* Modal content */}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // FLICKER HAPPENS HERE ⚡️
  if (typeof window === "object") {
    return createPortal(modalContent, document.body);
  }
  return null;
};
```

### After (New Modal System):

```tsx
// Component using clean modal hook
const MyComponent = () => {
  const { showModal } = useModalHelpers();

  const openModal = (item) => {
    showModal({
      title: "My Modal",
      children: <MyModalContent item={item} />,
      width: 'md'
    });
  };

  return (
    <button onClick={() => openModal(item)}>Open Modal</button>
  );
};

// Just the content, no portal logic!
const MyModalContent = ({ item }) => {
  return (
    <div>
      {/* Modal content */}
    </div>
  );
};
```

## API Comparison

### Current Document Creation Modal Usage:
```tsx
// Multiple state variables needed
const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
const [selectedGood, setSelectedGood] = useState(null);

// Complex modal management
const handleSelectGood = (good) => {
  setSelectedGood(good);
  setIsQuantityModalOpen(true);
};

// JSX with modal component
<SingleItemQuantityModal
  isOpen={isQuantityModalOpen}
  onClose={() => setIsQuantityModalOpen(false)}
  onSubmit={handleSubmit}
  good={selectedGood}
/>
```

### New System Usage:
```tsx
// Single hook, no state management
const { openQuantityModal } = useSingleItemQuantityModal();

// One-line modal opening
const handleSelectGood = (good) => {
  openQuantityModal(good, handleSubmit);
};

// No JSX needed - modal is managed centrally
```

## Implementation Steps

### 1. Add Provider to App Root

```tsx
// app/layout.tsx or _app.tsx
import { ModalProvider } from '@/features/shared/modal';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ModalProvider>
          {children}
        </ModalProvider>
      </body>
    </html>
  );
}
```

### 2. Migrate Existing Modals

For each existing modal:

1. **Extract Content**: Move modal content to separate component
2. **Create Hook**: Create custom hook using `useModalHelpers`
3. **Update Consumers**: Replace state management with hook calls
4. **Remove Portal Code**: Delete old modal component with portals

### 3. Common Modal Patterns

```tsx
// Confirmation dialogs
const { showConfirmation } = useModalHelpers();

showConfirmation({
  title: "Delete Item",
  message: "Are you sure you want to delete this item?",
  onConfirm: () => handleDelete(),
  onCancel: () => console.log('Cancelled')
});

// Alert messages  
const { showAlert } = useModalHelpers();

showAlert({
  title: "Success",
  message: "Item has been saved successfully!",
  onClose: () => redirect('/items')
});

// Custom modals
const { showModal } = useModalHelpers();

showModal({
  title: "Custom Form",
  width: 'lg',
  children: <MyCustomForm onSubmit={handleSubmit} />
});
```

## Migration Priority

### High Priority (Immediate):
1. ✅ SingleItemQuantityModal (document creation)
2. ⚠️ JournalModal (complex hierarchical selection)
3. ⚠️ Any other modals causing flicker

### Medium Priority:
1. Confirmation dialogs throughout app
2. Alert/notification modals
3. Form submission modals

### Benefits Timeline:
- **Immediate**: No more modal flicker
- **Week 1**: Cleaner codebase, easier modal creation
- **Month 1**: Better performance, improved UX consistency

## Performance Impact

### Before:
- Portal creation/destruction overhead
- Multiple DOM queries (`document.body`)  
- Potential memory leaks from portal cleanup
- Hydration coordination complexity

### After:
- Single modal layer rendered once
- No DOM manipulation
- Automatic cleanup via React tree
- Zero hydration issues

The new system eliminates the portal flicker completely while making modal management much more elegant and maintainable.