import { useQuery, useMutation, ApolloError } from '@apollo/client';
import {
  Car,
  CarInput,
  GetCarsData,
  AddCarData,
  AddCarVariables,
  GET_CARS,
  ADD_CAR,
} from '../types/car';

export interface UseCarsReturn {
  cars: Car[];
  loading: boolean;
  error: ApolloError | undefined;
  addCar: (input: CarInput) => Promise<Car | null>;
  addCarLoading: boolean;
  addCarError: ApolloError | undefined;
  refetch: () => Promise<unknown>;
}

export function useCars(): UseCarsReturn {
  const { data, loading, error, refetch } = useQuery<GetCarsData>(GET_CARS);

  const [addCarMutation, { loading: addCarLoading, error: addCarError }] = useMutation<
    AddCarData,
    AddCarVariables
  >(ADD_CAR, {
    refetchQueries: [{ query: GET_CARS }],
    update(cache, { data: mutationData }) {
      if (!mutationData?.addCar) return;
      try {
        const existingData = cache.readQuery<GetCarsData>({ query: GET_CARS });
        if (existingData) {
          cache.writeQuery<GetCarsData>({
            query: GET_CARS,
            data: {
              cars: [...existingData.cars, mutationData.addCar],
            },
          });
        }
      } catch {
        // Cache read may fail if GET_CARS has not been fetched yet
      }
    },
  });

  const addCar = async (input: CarInput): Promise<Car | null> => {
    const result = await addCarMutation({
      variables: { input },
    });
    return result.data?.addCar ?? null;
  };

  return {
    cars: data?.cars ?? [],
    loading,
    error,
    addCar,
    addCarLoading,
    addCarError,
    refetch,
  };
}

export default useCars;
