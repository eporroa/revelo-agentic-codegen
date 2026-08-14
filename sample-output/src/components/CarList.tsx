import React from 'react';
import {
  Grid,
  Box,
  Typography,
  Skeleton,
  SxProps,
  Theme,
} from '@mui/material';
import { Car } from '../types/car';
import CarCard from './CarCard';

export interface CarListProps {
  cars?: Car[];
  loading?: boolean;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onCarClick?: (car: Car) => void;
  onSelectCar?: (car: Car) => void;
  onClick?: (car: Car) => void;
  className?: string;
  sx?: SxProps<Theme>;
}

export default function CarList({
  cars = [],
  loading = false,
  isLoading = false,
  error = null,
  emptyMessage = 'No cars found matching your criteria.',
  onCarClick,
  onSelectCar,
  onClick,
  className,
  sx,
}: CarListProps) {
  const isCurrentlyLoading = loading || isLoading;
  const handleItemClick = onCarClick || onSelectCar || onClick;

  if (isCurrentlyLoading) {
    return (
      <Grid container spacing={3} className={className} sx={sx} data-testid="car-list-loading">
        {Array.from({ length: 6 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={4} key={`skeleton-${index}`} display="flex" justifyContent="center">
            <Box
              sx={{
                width: '100%',
                maxWidth: 345,
                borderRadius: 2,
                overflow: 'hidden',
                boxShadow: 2,
              }}
            >
              <Skeleton variant="rectangular" height={200} animation="wave" />
              <Box sx={{ p: 2 }}>
                <Skeleton variant="text" width="75%" height={32} animation="wave" />
                <Box sx={{ my: 1 }}>
                  <Skeleton variant="text" width="50%" height={20} animation="wave" />
                  <Skeleton variant="text" width="60%" height={20} animation="wave" />
                  <Skeleton variant="text" width="40%" height={20} animation="wave" />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, my: 1 }}>
                  <Skeleton variant="rounded" width={50} height={24} animation="wave" />
                  <Skeleton variant="rounded" width={70} height={24} animation="wave" />
                </Box>
                <Skeleton variant="text" width="35%" height={32} sx={{ mt: 1.5 }} animation="wave" />
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error) {
    return (
      <Box
        className={className}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          px: 2,
          textAlign: 'center',
          width: '100%',
          ...sx,
        }}
        data-testid="car-list-error"
      >
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load cars
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!cars || cars.length === 0) {
    return (
      <Box
        className={className}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 8,
          px: 2,
          textAlign: 'center',
          width: '100%',
          ...sx,
        }}
        data-testid="car-list-empty"
      >
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {emptyMessage}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Try adjusting your search query or filter options.
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={3} className={className} sx={sx} data-testid="car-list">
      {cars.map((car, index) => {
        const key =
          car.id !== undefined
            ? car.id
            : `${car.make}-${car.model}-${car.year}-${index}`;

        return (
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            key={key}
            display="flex"
            justifyContent="center"
          >
            <CarCard
              car={car}
              onClick={handleItemClick}
              sx={{ width: '100%', height: '100%' }}
            />
          </Grid>
        );
      })}
    </Grid>
  );
}
