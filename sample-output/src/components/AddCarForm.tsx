import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useCars } from '../hooks/useCars';

export interface AddCarFormProps {
  onSuccess?: () => void;
}

export default function AddCarForm({ onSuccess }: AddCarFormProps) {
  const { addCar, addCarLoading, addCarError } = useCars();

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!make.trim()) {
      newErrors.make = 'Make is required';
    }

    if (!model.trim()) {
      newErrors.model = 'Model is required';
    }

    const currentYear = new Date().getFullYear();
    const parsedYear = Number(year);
    if (!year.trim()) {
      newErrors.year = 'Year is required';
    } else if (isNaN(parsedYear) || !Number.isInteger(parsedYear)) {
      newErrors.year = 'Year must be a valid whole number';
    } else if (parsedYear < 1886 || parsedYear > currentYear + 2) {
      newErrors.year = `Year must be between 1886 and ${currentYear + 2}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);

    if (!validate()) {
      return;
    }

    try {
      const result = await addCar({
        make: make.trim(),
        model: model.trim(),
        year: parseInt(year, 10),
        color: color.trim() || undefined,
      });

      if (result) {
        setMake('');
        setModel('');
        setYear('');
        setColor('');
        setErrors({});
        setSubmitSuccess(true);
        onSuccess?.();
      }
    } catch {
      // Error handled by addCarError from useCars
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Add New Car
        </Typography>

        {submitSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Car successfully added!
          </Alert>
        )}

        {addCarError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {addCarError.message || 'Failed to add car. Please try again.'}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Make"
              name="make"
              value={make}
              onChange={(e) => {
                setMake(e.target.value);
                if (errors.make) setErrors((prev) => ({ ...prev, make: '' }));
              }}
              error={Boolean(errors.make)}
              helperText={errors.make}
              required
              fullWidth
              disabled={addCarLoading}
            />

            <TextField
              label="Model"
              name="model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                if (errors.model) setErrors((prev) => ({ ...prev, model: '' }));
              }}
              error={Boolean(errors.model)}
              helperText={errors.model}
              required
              fullWidth
              disabled={addCarLoading}
            />

            <TextField
              label="Year"
              name="year"
              type="number"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                if (errors.year) setErrors((prev) => ({ ...prev, year: '' }));
              }}
              error={Boolean(errors.year)}
              helperText={errors.year}
              required
              fullWidth
              disabled={addCarLoading}
              inputProps={{ min: 1886, max: new Date().getFullYear() + 2 }}
            />

            <TextField
              label="Color"
              name="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              fullWidth
              disabled={addCarLoading}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={addCarLoading}
              startIcon={addCarLoading ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {addCarLoading ? 'Adding Car...' : 'Add Car'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
