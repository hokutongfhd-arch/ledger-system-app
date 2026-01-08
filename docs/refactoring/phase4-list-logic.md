# Phase 4: List Screen Logic Standardization

## Objectives
- Eliminate boilerplate code in List Views.
- Standardize behavior for Table operations (Sort, Filter, Paginate).
- Standardize File I/O operations (CSV Export, Excel Import).

## Hook Design

### 1. `useDataTable<T>`
**Purpose**: Manage all table state (data, view, selection).

**Interface**:
```typescript
interface UseDataTableProps<T> {
  data: T[];
  initialPageSize?: number;
  searchKeys?: (keyof T)[]; // keys to filter by string match
  filterFn?: (item: T, term: string) => boolean; // custom filter
}

returns {
  // States
  searchTerm, setSearchTerm,
  currentPage, setCurrentPage,
  pageSize, setPageSize,
  sortCriteria, setSortCriteria, toggleSort,
  selectedIds, setSelectedIds, handleSelectAll, handleCheckboxChange,
  
  // Derived Data
  paginatedData,
  filteredData,
  sortedData,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  isAllSelected
}
```

### 2. `useCSVExport<T>`
**Purpose**: Handle CSV validation and download.

**Interface**:
```typescript
interface UseCSVExportProps<T> {
  data: T[];
  headers: string[];
  filename: string;
  transform: (item: T) => (string | number | null | undefined)[];
}

returns {
  handleExport
}
```

### 3. `useFileImport`
**Purpose**: Handle Excel file reading and basic structure validation.

**Interface**:
```typescript
interface UseFileImportProps {
  requiredHeaders: string[];
  onImport: (data: any[]) => Promise<void>; // Row processing callback
  onValidate?: (data: any[]) => Promise<string[]>; // Optional custom validation returning errors
}

returns {
  handleImportClick, // triggers hidden file input
  fileInputRef, // assign to <input type="file" />
  handleFileChange, // assign to onChange
}
```

## Implementation Steps
1. Create `src/hooks/useDataTable.ts`
2. Create `src/hooks/useCSVExport.ts`
3. Create `src/hooks/useFileImport.ts`
4. Refactor `EmployeeListPage`
5. Test `EmployeeListPage`
6. Refactor `AddressListPage`
7. Refactor Device Pages
