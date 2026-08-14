import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react';
import { useCarFilters } from '../useCarFilters';
import CarList from '../../components/CarList';
import { Car } from '../../types/car';

const mockCars: Car[] = [
  {
    id: '1',
    make: 'Toyota',
    model: 'Camry',
    year: 2021,
    price: 24000,
    mileage: 15000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    bodyType: 'Sedan',
    color: 'Silver',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
    imageUrl: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb',
    images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb'],
    features: ['Bluetooth', 'Backup Camera'],
    description: 'Reliable sedan in excellent condition.',
  },
  {
    id: '2',
    make: 'Honda',
    model: 'Civic',
    year: 2020,
    price: 22000,
    mileage: 30000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    bodyType: 'Sedan',
    color: 'Blue',
    image: 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5',
    imageUrl: 'https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5',
    images: ['https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5'],
    features: ['Apple CarPlay', 'Lane Assist'],
    description: 'Compact and fuel-efficient.',
  },
  {
    id: '3',
    make: 'Ford',
    model: 'Mustang',
    year: 2022,
    price: 35000,
    mileage: 8000,
    fuelType: 'Gasoline',
    transmission: 'Manual',
    bodyType: 'Coupe',
    color: 'Red',
    image: 'https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd',
    imageUrl: 'https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd',
    images: ['https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd'],
    features: ['Leather Seats', 'Navigation'],
    description: 'Powerful performance and iconic design.',
  },
  {
    id: '4',
    make: 'Toyota',
    model: 'Corolla',
    year: 2020,
    price: 19000,
    mileage: 45000,
    fuelType: 'Hybrid',
    transmission: 'Automatic',
    bodyType: 'Sedan',
    color: 'White',
    image: 'https://images.unsplash.com/photo-1590362891988-f77804703061',
    imageUrl: 'https://images.unsplash.com/photo-1590362891988-f77804703061',
    images: ['https://images.unsplash.com/photo-1590362891988-f77804703061'],
    features: ['Adaptive Cruise Control'],
    description: 'Great fuel economy and low maintenance.',
  },
  {
    id: '5',
    make: 'BMW',
    model: '3 Series',
    year: 2019,
    price: 31000,
    mileage: 50000,
    fuelType: 'Gasoline',
    transmission: 'Automatic',
    bodyType: 'Sedan',
    color: 'Black',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e',
    imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e',
    images: ['https://images.unsplash.com/photo-1555215695-3004980ad54e'],
    features: ['Sunroof', 'Heated Seats', 'Premium Audio'],
    description: 'Luxury sport sedan with premium features.',
  },
];

describe('useCarFilters', () => {
  describe('initialization and default options', () => {
    it('returns cars sorted by make in ascending order by default', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      expect(result.current.searchTerm).toBe('');
      expect(result.current.selectedYear).toBe('');
      expect(result.current.sortField).toBe('make');
      expect(result.current.sortOrder).toBe('asc');

      const makes = result.current.filteredCars.map((c) => c.make);
      expect(makes).toEqual(['BMW', 'Ford', 'Honda', 'Toyota', 'Toyota']);
    });

    it('initializes with custom options when provided', () => {
      const { result } = renderHook(() =>
        useCarFilters(mockCars, {
          initialSearch: 'Toyota',
          initialYear: 2020,
          initialSortField: 'price',
          initialSortOrder: 'desc',
        })
      );

      expect(result.current.searchTerm).toBe('Toyota');
      expect(result.current.selectedYear).toBe(2020);
      expect(result.current.sortField).toBe('price');
      expect(result.current.sortOrder).toBe('desc');
      expect(result.current.filteredCars).toHaveLength(1);
      expect(result.current.filteredCars[0]!.model).toBe('Corolla');
    });

    it('handles empty car array gracefully', () => {
      const { result } = renderHook(() => useCarFilters([]));

      expect(result.current.filteredCars).toEqual([]);
      expect(result.current.availableYears).toEqual([]);
    });

    it('computes unique available years in descending order', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      expect(result.current.availableYears).toEqual([2022, 2021, 2020, 2019]);
    });
  });

  describe('search filtering', () => {
    it('filters cars by make ignoring case', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSearchTerm('toyota');
      });

      expect(result.current.filteredCars).toHaveLength(2);
      expect(result.current.filteredCars.every((c) => c.make === 'Toyota')).toBe(true);
    });

    it('filters cars by model ignoring case and trimming whitespace', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSearchQuery('  civic  ');
      });

      expect(result.current.filteredCars).toHaveLength(1);
      expect(result.current.filteredCars[0]!.model).toBe('Civic');
    });

    it('updates search via alias setModelSearch', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setModelSearch('mustang');
      });

      expect(result.current.filteredCars).toHaveLength(1);
      expect(result.current.modelSearch).toBe('mustang');
      expect(result.current.filteredCars[0]!.make).toBe('Ford');
    });

    it('returns empty array when search query matches nothing', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSearchTerm('nonexistent vehicle');
      });

      expect(result.current.filteredCars).toEqual([]);
    });
  });

  describe('year filtering', () => {
    it('filters cars by specific numeric year', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSelectedYear(2020);
      });

      expect(result.current.filteredCars).toHaveLength(2);
      expect(result.current.filteredCars.map((c) => c.model)).toEqual(['Civic', 'Corolla']);
    });

    it('filters cars by string year', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setYearFilter('2022');
      });

      expect(result.current.filteredCars).toHaveLength(1);
      expect(result.current.filteredCars[0]!.year).toBe(2022);
    });

    it('shows all cars when year filter is set to "all" or empty string', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSelectedYear('all');
      });
      expect(result.current.filteredCars).toHaveLength(5);

      act(() => {
        result.current.setSelectedYear('');
      });
      expect(result.current.filteredCars).toHaveLength(5);
    });
  });

  describe('sorting behavior', () => {
    it('sorts by make ascending with model tie-breaking', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSortField('make');
        result.current.setSortOrder('asc');
      });

      const models = result.current.filteredCars.map((c) => `${c.make} ${c.model}`);
      expect(models).toEqual([
        'BMW 3 Series',
        'Ford Mustang',
        'Honda Civic',
        'Toyota Camry',
        'Toyota Corolla',
      ]);
    });

    it('sorts by make descending with model tie-breaking', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSortBy('make');
        result.current.setSortDirection('desc');
      });

      const models = result.current.filteredCars.map((c) => `${c.make} ${c.model}`);
      expect(models).toEqual([
        'Toyota Corolla',
        'Toyota Camry',
        'Honda Civic',
        'Ford Mustang',
        'BMW 3 Series',
      ]);
    });

    it('sorts by model ascending and descending', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSortField('model');
        result.current.setSortOrder('asc');
      });
      expect(result.current.filteredCars.map((c) => c.model)).toEqual([
        '3 Series',
        'Camry',
        'Civic',
        'Corolla',
        'Mustang',
      ]);

      act(() => {
        result.current.setSortOrder('desc');
      });
      expect(result.current.filteredCars.map((c) => c.model)).toEqual([
        'Mustang',
        'Corolla',
        'Civic',
        'Camry',
        '3 Series',
      ]);
    });

    it('sorts by year ascending and descending', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSortField('year');
        result.current.setSortOrder('asc');
      });
      expect(result.current.filteredCars.map((c) => c.year)).toEqual([2019, 2020, 2020, 2021, 2022]);

      act(() => {
        result.current.setSortOrder('desc');
      });
      expect(result.current.filteredCars.map((c) => c.year)).toEqual([2022, 2021, 2020, 2020, 2019]);
    });

    it('sorts by price ascending and descending', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSortField('price');
        result.current.setSortOrder('asc');
      });
      expect(result.current.filteredCars.map((c) => c.price)).toEqual([19000, 22000, 24000, 31000, 35000]);

      act(() => {
        result.current.setSortOrder('desc');
      });
      expect(result.current.filteredCars.map((c) => c.price)).toEqual([35000, 31000, 24000, 22000, 19000]);
    });

    it('sorts by mileage ascending and descending', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSortField('mileage');
        result.current.setSortOrder('asc');
      });
      expect(result.current.filteredCars.map((c) => c.mileage)).toEqual([8000, 15000, 30000, 45000, 50000]);

      act(() => {
        result.current.setSortOrder('desc');
      });
      expect(result.current.filteredCars.map((c) => c.mileage)).toEqual([50000, 45000, 30000, 15000, 8000]);
    });

    it('handles undefined or missing properties gracefully while sorting', () => {
      const partialCars = [
        { id: '1', make: undefined as unknown as string, model: undefined as unknown as string, price: undefined as unknown as number },
        { id: '2', make: 'Audi', model: 'A4', price: 20000 },
      ] as unknown as Car[];

      const { result } = renderHook(() => useCarFilters(partialCars));

      act(() => {
        result.current.setSortField('make');
      });
      expect(result.current.filteredCars).toHaveLength(2);

      act(() => {
        result.current.setSortField('price');
      });
      expect(result.current.filteredCars).toHaveLength(2);
    });
  });

  describe('resetFilters and clearFilters', () => {
    it('resets all filter and sort fields to defaults', () => {
      const { result } = renderHook(() =>
        useCarFilters(mockCars, {
          initialSearch: 'Civic',
          initialYear: 2020,
          initialSortField: 'price',
          initialSortOrder: 'desc',
        })
      );

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.searchTerm).toBe('');
      expect(result.current.selectedYear).toBe('');
      expect(result.current.sortField).toBe('make');
      expect(result.current.sortOrder).toBe('asc');
      expect(result.current.filteredCars).toHaveLength(5);
    });

    it('clears filters using clearFilters alias', () => {
      const { result } = renderHook(() => useCarFilters(mockCars));

      act(() => {
        result.current.setSearchTerm('BMW');
        result.current.clearFilters();
      });

      expect(result.current.searchTerm).toBe('');
      expect(result.current.filteredCars).toHaveLength(5);
    });
  });
});

describe('CarList Component', () => {
  it('renders loading skeletons when loading is true', () => {
    render(React.createElement(CarList, { loading: true }));

    expect(screen.getByTestId('car-list-loading')).toBeInTheDocument();
  });

  it('renders loading skeletons when isLoading is true', () => {
    render(React.createElement(CarList, { isLoading: true }));

    expect(screen.getByTestId('car-list-loading')).toBeInTheDocument();
  });

  it('renders error message when error prop is provided', () => {
    render(React.createElement(CarList, { error: 'Network error occurred' }));

    expect(screen.getByTestId('car-list-error')).toBeInTheDocument();
    expect(screen.getByText('Failed to load cars')).toBeInTheDocument();
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
  });

  it('renders empty message when no cars are provided', () => {
    render(React.createElement(CarList, { cars: [] }));

    expect(screen.getByTestId('car-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No cars found matching your criteria.')).toBeInTheDocument();
  });

  it('renders custom empty message when specified', () => {
    render(React.createElement(CarList, { cars: [], emptyMessage: 'Custom empty list message' }));

    expect(screen.getByText('Custom empty list message')).toBeInTheDocument();
  });

  it('renders list of car cards when cars are provided', () => {
    render(React.createElement(CarList, { cars: mockCars }));

    expect(screen.getByTestId('car-list')).toBeInTheDocument();
    expect(screen.getAllByText(/Camry/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Civic/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Mustang/i)[0]).toBeInTheDocument();
  });

  it('triggers onCarClick handler when a car card is clicked', () => {
    const handleCarClick = vi.fn();
    render(React.createElement(CarList, { cars: [mockCars[0]!], onCarClick: handleCarClick }));

    const card = screen.getAllByText(/Camry/i)[0]!;
    fireEvent.click(card);

    expect(handleCarClick).toHaveBeenCalled();
  });

  it('triggers onSelectCar handler when provided', () => {
    const handleSelectCar = vi.fn();
    render(React.createElement(CarList, { cars: [mockCars[0]!], onSelectCar: handleSelectCar }));

    const card = screen.getAllByText(/Camry/i)[0]!;
    fireEvent.click(card);

    expect(handleSelectCar).toHaveBeenCalled();
  });
});
