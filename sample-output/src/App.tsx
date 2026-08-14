import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Box,
  CssBaseline,
} from '@mui/material';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { useCars } from './hooks/useCars';
import { useCarFilters } from './hooks/useCarFilters';
import CarFilterControls from './components/CarFilterControls';
import CarList from './components/CarList';
import AddCarForm from './components/AddCarForm';
import CarDetailsModal from './components/CarDetailsModal';
import { Car } from './types/car';

export default function App() {
  const { cars, loading, error, refetch } = useCars();
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null);

  const {
    filteredCars,
    searchTerm,
    setSearchTerm,
    selectedYear,
    setSelectedYear,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    resetFilters,
    availableYears,
  } = useCarFilters(cars);

  const handleCarClick = (car: Car) => {
    if (car.id) {
      setSelectedCarId(car.id);
    }
  };

  const handleCloseModal = () => {
    setSelectedCarId(null);
  };

  const handleAddCarSuccess = () => {
    refetch();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'grey.50' }}>
      <CssBaseline />

      {/* Header Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <DirectionsCarIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            Car Inventory Manager
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Container maxWidth="xl" sx={{ py: 4, flex: 1 }}>
        <Grid container spacing={4}>
          {/* Left Column: Add Car Form */}
          <Grid item xs={12} md={4} lg={3.5}>
            <Box sx={{ position: { md: 'sticky' }, top: { md: 24 } }}>
              <AddCarForm onSuccess={handleAddCarSuccess} />
            </Box>
          </Grid>

          {/* Right Column: Filters and Inventory List */}
          <Grid item xs={12} md={8} lg={8.5}>
            <CarFilterControls
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              setSearchTerm={setSearchTerm}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              setSelectedYear={setSelectedYear}
              sortField={sortField}
              onSortFieldChange={setSortField}
              setSortField={setSortField}
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              setSortOrder={setSortOrder}
              availableYears={availableYears}
              onReset={resetFilters}
              resetFilters={resetFilters}
            />

            <CarList
              cars={filteredCars ?? cars}
              loading={loading}
              error={error ? error.message : null}
              onCarClick={handleCarClick}
            />
          </Grid>
        </Grid>
      </Container>

      {/* Car Details Modal */}
      <CarDetailsModal
        open={Boolean(selectedCarId)}
        onClose={handleCloseModal}
        carId={selectedCarId}
      />
    </Box>
  );
}
