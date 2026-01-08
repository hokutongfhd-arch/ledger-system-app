# Phase 3: Advanced Component Standardization & Detail View Refactoring

## 1. Objective
Refactor complex UI components and Detail Views to ensure consistency with the standardized Form components established in Phase 2. Focus on eliminating duplicate components (like `SectionHeader`), standardizing "Detail Modals," and polishing complex inputs like `SearchableSelect`.

## 2. Key Tasks

### 2.1 Consolidate UI Components
- **Consolidate `SectionHeader`**:
  - `src/components/ui/DetailView.tsx` and `src/components/ui/Section.tsx` both export `SectionHeader`.
  - Goal: Merge into `src/components/ui/Section.tsx` or `src/components/ui/Typography.tsx` and use consistently across Forms and Detail Modals.
- **Standardize `DetailRow`**:
  - Move `DetailRow` from `src/components/ui/DetailView.tsx` to a more standard `src/components/ui/DescriptionList.tsx` or keep in `DetailView.tsx` but align styling with the new design system.
- **Refactor `SearchableSelect`**:
  - `src/components/ui/SearchableSelect.tsx` has hardcoded styles.
  - Goal: Update styling to match `Input.tsx` and `Select.tsx` (focus rings, border colors, error states).

### 2.2 Refactor Detail Modals
Apply the standardized components (`SectionHeader`, `DetailRow`/`DescriptionList`) to all Detail Modals:
- `src/features/employees/components/EmployeeDetailModal.tsx`
- `src/features/addresses/components/AddressDetailModal.tsx`
- `src/features/devices/components/IPhoneDetailModal.tsx`
- `src/features/devices/components/FeaturePhoneDetailModal.tsx`
- `src/features/devices/components/TabletDetailModal.tsx`
- `src/features/devices/components/RouterDetailModal.tsx`
- `src/features/logs/components/LogDetailModal.tsx`

### 2.3 List View Standardization (Optional/Time Permitting)
- Check feature list pages (e.g., `EmployeeList.tsx`, `DeviceList.tsx`) and ensure they use `src/components/ui/Table.tsx` consistently.

## 3. Implementation Steps

1.  **Analyze & Merge `SectionHeader`**: Compare usage and choose the standard implementation.
2.  **Refactor `DetailView.tsx`**: Rename/Structuralize if necessary.
3.  **Refactor `SearchableSelect.tsx`**: Align CSS classes with `Input.tsx`.
4.  **Batch Refactor Detail Modals**: Update all detail modals to use the authoritative components.
5.  **Verification**: Build and Visual check of Detail Modals.
