import React from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  SelectChangeEvent,
  Stack,
  Button,
  InputAdornment,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { SortField, SortOrder } from '../hooks/useCarFilters';

export interface CarFilterControlsProps {
  searchTerm?: string;
  onSearchTermChange?: (value: string) => void;
  modelSearch?: string;
  onModelSearchChange?: (value: string) => void;
  setSearchTerm?: (value: string) => void;
  setModelSearch?: (value: string) => void;

  selectedYear?: string | number;
  onYearChange?: (value: string | number) => void;
  yearFilter?: string | number;
  setSelectedYear?: (value: string | number) => void;
  setYearFilter?: (value: string | number) => void;
  availableYears?: number[];

  sortField?: SortField;
  onSortFieldChange?: (value: SortField) => void;
  sortBy?: SortField;
  setSortField?: (value: SortField) => void;
  setSortBy?: (value: SortField) => void;

  sortOrder?: SortOrder;
  onSortOrderChange?: (value: SortOrder) => void;
  sortDirection?: SortOrder;
  setSortOrder?: (value: SortOrder) => void;
  setSortDirection?: (value: SortOrder) => void;

  onReset?: () => void;
  resetFilters?: () => void;
  clearFilters?: () => void;
}

export function CarFilterControls({
  searchTerm,
  onSearchTermChange,
  modelSearch,
  onModelSearchChange,
  setSearchTerm,
  setModelSearch,
  selectedYear,
  onYearChange,
  yearFilter,
  setSelectedYear,
  setYearFilter,
  availableYears = [],
  sortField,
  onSortFieldChange,
  sortBy,
  setSortField,
  setSortBy,
  sortOrder,
  onSortOrderChange,
  sortDirection,
  setSortOrder,
  setSortDirection,
  onReset,
  resetFilters,
  clearFilters,
}: CarFilterControlsProps) {
  const currentSearch = searchTerm ?? modelSearch ?? '';
  const currentYear = selectedYear !== undefined ? selectedYear : (yearFilter ?? '');
  const currentSortField = sortField ?? sortBy ?? 'make';
  const currentSortOrder = sortOrder ?? sortDirection ?? 'asc';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onSearchTermChange?.(value);
    onModelSearchChange?.(value);
    setSearchTerm?.(value);
    setModelSearch?.(value);
  };

  const handleClearSearch = () => {
    onSearchTermChange?.('');
    onModelSearchChange?.('');
    setSearchTerm?.('');
    setModelSearch?.('');
  };

  const handleYearChange = (e: SelectChangeEvent<string | number>) => {
    const value = e.target.value;
    onYearChange?.(value);
    setSelectedYear?.(value);
    setYearFilter?.(value);
  };

  const handleSortFieldChange = (e: SelectChangeEvent<SortField>) => {
    const value = e.target.value as SortField;
    onSortFieldChange?.(value);
    setSortField?.(value);
    setSortBy?.(value);
  };

  const handleToggleSortOrder = () => {
    const nextOrder: SortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    onSortOrderChange?.(nextOrder);
    setSortOrder?.(nextOrder);
    setSortDirection?.(nextOrder);
  };

  const handleReset = () => {
    onReset?.();
    resetFilters?.();
    clearFilters?.();
  };

  const hasActiveFilters =
    currentSearch !== '' ||
    (currentYear !== '' && currentYear !== 'all') ||
    currentSortField !== 'make' ||
    currentSortOrder !== 'asc';

  const showReset = Boolean(onReset || resetFilters || clearFilters);

  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        boxShadow: 1,
        mb: 3,
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        flexWrap="wrap"
      >
        {/* Model/Make Search Input */}
        <TextField
          label="Search Model or Make"
          placeholder="e.g. Civic, Camry, Tesla..."
          variant="outlined"
          size="small"
          value={currentSearch}
          onChange={handleSearchChange}
          sx={{ flex: { xs: 1, sm: 2 }, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: currentSearch ? (
              <InputAdornment position="end">
                <IconButton
                  aria-label="clear search"
                  onClick={handleClearSearch}
                  edge="end"
                  size="small"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />

        {/* Year Filter Dropdown */}
        <FormControl size="small" sx={{ minWidth: 140, flex: { xs: 1, sm: 1 } }}>
          <InputLabel id="car-year-filter-label">Year</InputLabel>
          <Select
            labelId="car-year-filter-label"
            id="car-year-filter-select"
            value={currentYear}
            label="Year"
            onChange={handleYearChange}
          >
            <MenuItem value="">
              <em>All Years</em>
            </MenuItem>
            {availableYears.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Sort Field Control */}
        <FormControl size="small" sx={{ minWidth: 140, flex: { xs: 1, sm: 1 } }}>
          <InputLabel id="car-sort-field-label">Sort By</InputLabel>
          <Select
            labelId="car-sort-field-label"
            id="car-sort-field-select"
            value={currentSortField}
            label="Sort By"
            onChange={handleSortFieldChange}
          >
            <MenuItem value="make">Make</MenuItem>
            <MenuItem value="year">Year</MenuItem>
            <MenuItem value="model">Model</MenuItem>
            <MenuItem value="price">Price</MenuItem>
            <MenuItem value="mileage">Mileage</MenuItem>
          </Select>
        </FormControl>

        {/* Sort Order Toggle Button */}
        <Tooltip
          title={
            currentSortOrder === 'asc'
              ? 'Ascending order (Click to switch to Descending)'
              : 'Descending order (Click to switch to Ascending)'
          }
        >
          <IconButton
            onClick={handleToggleSortOrder}
            aria-label="toggle sort order"
            size="medium"
            color="primary"
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1,
              alignSelf: { xs: 'flex-start', sm: 'center' },
            }}
          >
            {currentSortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
          </IconButton>
        </Tooltip>

        {/* Reset / Clear Filters Button */}
        {showReset && (
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            sx={{
              height: 40,
              textTransform: 'none',
              alignSelf: { xs: 'stretch', sm: 'center' },
            }}
          >
            Reset Filters
          </Button>
        )}
      </Stack>
    </Box>
  );
}

export default CarFilterControls;
