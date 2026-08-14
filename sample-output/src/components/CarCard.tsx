import React from 'react';
import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import { Car } from '../types/car';
import ResponsiveCarImage, { ResponsiveImageSources } from './ResponsiveCarImage';

export interface CarCardProps {
  car: Car;
  images?: ResponsiveImageSources;
  imageSrc?: string;
  onClick?: (car: Car) => void;
  className?: string;
  sx?: SxProps<Theme>;
}

export default function CarCard({
  car,
  images,
  imageSrc,
  onClick,
  className,
  sx,
}: CarCardProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(car);
    }
  };

  const cardContent = (
    <>
      <ResponsiveCarImage
        car={car}
        images={images}
        src={imageSrc}
        height={200}
        objectFit="cover"
        alt={`${car.year} ${car.make} ${car.model}`}
      />
      <CardContent>
        <Typography variant="h6" component="div" gutterBottom noWrap>
          {car.year} {car.make} {car.model}
        </Typography>

        <Stack spacing={0.5} sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            <strong>Make:</strong> {car.make}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Model:</strong> {car.model}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Year:</strong> {car.year}
          </Typography>
          {car.color && (
            <Typography variant="body2" color="text.secondary">
              <strong>Color:</strong> {car.color}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
          {car.color && (
            <Chip label={car.color} size="small" variant="outlined" />
          )}
          {car.mileage !== undefined && (
            <Chip
              label={`${car.mileage.toLocaleString()} mi`}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>

        {car.price !== undefined && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="h6" color="primary" fontWeight="bold">
              ${car.price.toLocaleString()}
            </Typography>
          </Box>
        )}
      </CardContent>
    </>
  );

  return (
    <Card
      className={className}
      sx={{
        maxWidth: 345,
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: 2,
        ...sx,
      }}
    >
      {onClick ? (
        <CardActionArea onClick={handleClick}>{cardContent}</CardActionArea>
      ) : (
        cardContent
      )}
    </Card>
  );
}
