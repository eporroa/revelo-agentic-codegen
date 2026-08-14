import { describe, it, expect } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import CarList from '../CarList';
import { useCarFilters } from '../../hooks/useCarFilters';
import { Car } from '../../types/car';

const mockCars: Car[] = [
  {
    id: '1',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 25000,
    mileage: 15000,
    transmission: 'Automatic',
  },
  {
    id: '2',
    make: 'Honda',
    model: 'Civic',
    year: 2020,
    price: 22000,
    mileage: 30000,
    transmission: 'Automatic',
  },
  {
    id: '3',
    make: 'Ford',
    model: 'Mustang',
    year: 2021,
    price: 35000,
    mileage: 10000,
    transmission: 'Manual',
  },
  {
    id: '4',
    make: 'Toyota',
    model: 'Corolla',
    year: 2020,
    price: 20000,
    mileage: 25000,
    transmission: 'Automatic',
  },
];

describe('useCarFilters hook', () => {
  it('should initialize with default state and provide available years', () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedYear).toBe('');
    expect(result.current.sortField).toBe('make');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.availableYears).toEqual([2022, 2021, 2020]);
    expect(result.current.filteredCars).toHaveLength(4);
  });

  it('should filter cars by search term matching make or model', () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    act(() => {
      result.current.setSearchTerm('toyota');
    });
    expect(result.current.filteredCars).toHaveLength(2);
    expect(result.current.filteredCars.map((c) => c.model)).toEqual(['Camry', 'Corolla']);

    act(() => {
      result.current.setSearchTerm('civic');
    });
    expect(result.current.filteredCars).toHaveLength(1);
    expect(result.current.filteredCars[0]?.model).toBe('Civic');
  });

  it('should filter cars by selected year', () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    act(() => {
      result.current.setSelectedYear(2020);
    });
    expect(result.current.filteredCars).toHaveLength(2);
    expect(result.current.filteredCars.every((c) => c.year === 2020)).toBe(true);

    act(() => {
      result.current.setSelectedYear('all');
    });
    expect(result.current.filteredCars).toHaveLength(4);
  });

  it('should sort cars by make ascending and descending with model tie-breaker', () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    // Default make asc: Ford Mustang, Honda Civic, Toyota Camry, Toyota Corolla
    expect(result.current.filteredCars.map((c) => c.make)).toEqual([
      'Ford',
      'Honda',
      'Toyota',
      'Toyota',
    ]);
    expect(result.current.filteredCars[2]?.model).toBe('Camry');
    expect(result.current.filteredCars[3]?.model).toBe('Corolla');

    act(() => {
      result.current.setSortOrder('desc');
    });
    expect(result.current.filteredCars[0]?.make).toBe('Toyota');
    expect(result.current.filteredCars[3]?.make).toBe('Ford');
  });

  it('should sort cars by price, year, model, and mileage', () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    // Sort by price asc
    act(() => {
      result.current.setSortField('price');
      result.current.setSortOrder('asc');
    });
    expect(result.current.filteredCars.map((c) => c.price)).toEqual([
      20000, 22000, 25000, 35000,
    ]);

    // Sort by price desc
    act(() => {
      result.current.setSortOrder('desc');
    });
    expect(result.current.filteredCars.map((c) => c.price)).toEqual([
      35000, 25000, 22000, 20000,
    ]);

    // Sort by year asc
    act(() => {
      result.current.setSortField('year');
      result.current.setSortOrder('asc');
    });
    expect(result.current.filteredCars.map((c) => c.year)).toEqual([
      2020, 2020, 2021, 2022,
    ]);

    // Sort by mileage asc
    act(() => {
      result.current.setSortField('mileage');
      result.current.setSortOrder('asc');
    });
    expect(result.current.filteredCars.map((c) => c.mileage)).toEqual([
      10000, 15000, 25000, 30000,
    ]);

    // Sort by model asc
    act(() => {
      result.current.setSortField('model');
      result.current.setSortOrder('asc');
    });
    expect(result.current.filteredCars.map((c) => c.model)).toEqual([
      'Camry', 'Civic', 'Corolla', 'Mustang',
    ]);
  });

  it('should reset filters to default values', () => {
    const { result } = renderHook(() =>
      useCarFilters(mockCars, {
        initialSearch: 'Ford',
        initialYear: 2021,
        initialSortField: 'price',
        initialSortOrder: 'desc',
      })
    );

    expect(result.current.filteredCars).toHaveLength(1);

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.selectedYear).toBe('');
    expect(result.current.sortField).toBe('make');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.filteredCars).toHaveLength(4);
  });

  it('should support alias setters and getters', () => {
    const { result } = renderHook(() => useCarFilters(mockCars));

    act(() => {
      result.current.setModelSearch('Toyota');
      result.current.setYearFilter(2022);
      result.current.setSortBy('price');
      result.current.setSortDirection('desc');
    });

    expect(result.current.searchQuery).toBe('Toyota');
    expect(result.current.modelSearch).toBe('Toyota');
    expect(result.current.yearFilter).toBe(2022);
    expect(result.current.sortBy).toBe('price');
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.filteredCars).toHaveLength(1);
    expect(result.current.filteredCars[0]?.model).toBe('Camry');

    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.searchQuery).toBe('');
    expect(result.current.filteredCars).toHaveLength(4);
  });
});

describe('CarList component', () => {
  it('renders loading skeleton when loading or isLoading is true', () => {
    const { rerender } = render(<CarList loading={true} />);
    expect(screen.getByTestId('car-list-loading')).toBeInTheDocument();

    rerender(<CarList isLoading={true} />);
    expect(screen.getByTestId('car-list-loading')).toBeInTheDocument();
  });

  it('renders error message when error prop is provided', () => {
    render(<CarList error="Network connection failed" />);
    expect(screen.getByTestId('car-list-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load cars')).toBeInTheDocument();
    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
  });

  it('renders empty message when no cars are provided or cars array is empty', () => {
    const { rerender } = render(<CarList cars={[]} />);
    expect(screen.getByTestId('car-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No cars found matching your criteria.')).toBeInTheDocument();

    rerender(<CarList cars={[]} emptyMessage="Custom empty notice" />);
    expect(screen.getByText('Custom empty notice')).toBeInTheDocument();
  });

  it('renders list of cars successfully', () => {
    render(<CarList cars={mockCars} />);
    expect(screen.getByTestId('car-list')).toBeInTheDocument();
    expect(screen.getByText(/Camry/i)).toBeInTheDocument();
    expect(screen.getByText(/Civic/i)).toBeInTheDocument();
    expect(screen.getByText(/Mustang/i)).toBeInTheDocument();
    expect(screen.getByText(/Corolla/i)).toBeInTheDocument();
  });
});
