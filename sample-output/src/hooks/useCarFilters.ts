import { useState, useMemo } from 'react';
import { Car } from '../types/car';

export type SortField = 'make' | 'year' | 'model' | 'price' | 'mileage';
export type SortOrder = 'asc' | 'desc';

export interface UseCarFiltersOptions {
  initialSearch?: string;
  initialYear?: number | string;
  initialSortField?: SortField;
  initialSortOrder?: SortOrder;
}

export function useCarFilters(cars: Car[] = [], options: UseCarFiltersOptions = {}) {
  const [searchTerm, setSearchTerm] = useState<string>(options.initialSearch ?? '');
  const [selectedYear, setSelectedYear] = useState<string | number>(options.initialYear ?? '');
  const [sortField, setSortField] = useState<SortField>(options.initialSortField ?? 'make');
  const [sortOrder, setSortOrder] = useState<SortOrder>(options.initialSortOrder ?? 'asc');

  const availableYears = useMemo(() => {
    const years = Array.from(new Set(cars.map((car) => car.year)));
    return years.sort((a, b) => b - a);
  }, [cars]);

  const filteredCars = useMemo(() => {
    return cars
      .filter((car) => {
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase().trim();
          const matchesModel = car.model?.toLowerCase().includes(query);
          const matchesMake = car.make?.toLowerCase().includes(query);
          if (!matchesModel && !matchesMake) {
            return false;
          }
        }

        if (selectedYear !== '' && selectedYear !== 'all') {
          if (car.year !== Number(selectedYear)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'make') {
          comparison = (a.make || '').localeCompare(b.make || '');
          if (comparison === 0) {
            comparison = (a.model || '').localeCompare(b.model || '');
          }
        } else if (sortField === 'year') {
          comparison = (a.year || 0) - (b.year || 0);
        } else if (sortField === 'model') {
          comparison = (a.model || '').localeCompare(b.model || '');
        } else if (sortField === 'price') {
          comparison = (a.price || 0) - (b.price || 0);
        } else if (sortField === 'mileage') {
          comparison = (a.mileage || 0) - (b.mileage || 0);
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [cars, searchTerm, selectedYear, sortField, sortOrder]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedYear('');
    setSortField('make');
    setSortOrder('asc');
  };

  return {
    searchTerm,
    setSearchTerm,
    modelSearch: searchTerm,
    setModelSearch: setSearchTerm,
    searchQuery: searchTerm,
    setSearchQuery: setSearchTerm,
    selectedYear,
    setSelectedYear,
    yearFilter: selectedYear,
    setYearFilter: setSelectedYear,
    sortField,
    setSortField,
    sortBy: sortField,
    setSortBy: setSortField,
    sortOrder,
    setSortOrder,
    sortDirection: sortOrder,
    setSortDirection: setSortOrder,
    filteredCars,
    availableYears,
    resetFilters,
    clearFilters: resetFilters,
  };
}

export default useCarFilters;
