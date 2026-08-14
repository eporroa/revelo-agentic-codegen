import { gql } from '@apollo/client';

export interface Car {
  id: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  price?: number;
  mileage?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CarInput {
  make: string;
  model: string;
  year: number;
  color?: string;
  vin?: string;
  price?: number;
  mileage?: number;
}

export interface GetCarsData {
  cars: Car[];
}

export interface GetCarData {
  car: Car;
}

export interface GetCarVariables {
  id: string;
}

export interface AddCarData {
  addCar: Car;
}

export interface AddCarVariables {
  input: CarInput;
}

export const GET_CARS = gql`
  query GetCars {
    cars {
      id
      make
      model
      year
      color
      vin
      price
      mileage
      createdAt
      updatedAt
    }
  }
`;

export const GET_CAR = gql`
  query GetCar($id: ID!) {
    car(id: $id) {
      id
      make
      model
      year
      color
      vin
      price
      mileage
      createdAt
      updatedAt
    }
  }
`;

export const ADD_CAR = gql`
  mutation AddCar($input: CarInput!) {
    addCar(input: $input) {
      id
      make
      model
      year
      color
      vin
      price
      mileage
      createdAt
      updatedAt
    }
  }
`;
