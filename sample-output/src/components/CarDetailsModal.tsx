import React from 'react';
import { useQuery } from '@apollo/client';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Box,
  IconButton,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { GET_CAR, GetCarData, GetCarVariables } from '../graphql/carQueries';
import ResponsiveCarImage from './ResponsiveCarImage';

export interface CarDetailsModalProps {
  open: boolean;
  onClose: () => void;
  carId?: string | null;
}

export default function CarDetailsModal({
  open,
  onClose,
  carId,
}: CarDetailsModalProps) {
  const { data, loading, error } = useQuery<GetCarData, GetCarVariables>(
    GET_CAR,
    {
      variables: { id: carId ?? '' },
      skip: !open || !carId,
      fetchPolicy: 'cache-and-network',
    }
  );

  const car = data?.car;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="car-details-dialog-title"
    >
      <DialogTitle
        id="car-details-dialog-title"
        sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Typography variant="h6" component="span" fontWeight="bold">
          {car ? `${car.year} ${car.make} ${car.model}` : 'Car Details'}
        </Typography>
        <IconButton
          aria-label="close"
          onClick={onClose}
          size="small"
          sx={{ color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ my: 2 }}>
            Failed to load car details: {error.message}
          </Alert>
        )}

        {!loading && !error && car && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ width: '100%', borderRadius: 1, overflow: 'hidden' }}>
              <ResponsiveCarImage
                car={car}
                height={240}
                objectFit="cover"
                alt={`${car.year} ${car.make} ${car.model}`}
              />
            </Box>

            <Divider />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Make
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {car.make}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Model
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {car.model}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Year
                </Typography>
                <Typography variant="body1">
                  {car.year}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Color
                </Typography>
                <Typography variant="body1">
                  {car.color || 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Price
                </Typography>
                <Typography variant="body1" color="primary.main" fontWeight="bold">
                  {car.price != null ? `$${car.price.toLocaleString()}` : 'N/A'}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Mileage
                </Typography>
                <Typography variant="body1">
                  {car.mileage != null ? `${car.mileage.toLocaleString()} mi` : 'N/A'}
                </Typography>
              </Grid>

              {car.vin && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    VIN
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {car.vin}
                  </Typography>
                </Grid>
              )}

              {car.createdAt && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Added On
                  </Typography>
                  <Typography variant="body2">
                    {new Date(car.createdAt).toLocaleDateString()}
                  </Typography>
                </Grid>
              )}

              {car.updatedAt && (
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {new Date(car.updatedAt).toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        )}

        {!loading && !error && !car && carId && (
          <Alert severity="info" sx={{ my: 2 }}>
            No car found with the specified ID.
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} variant="outlined" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
