export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type RidePoint = Coordinates & {
  id?: string;
  label: string;
  subtitle?: string;
};

export type Tariff = 'economy' | 'comfort' | 'business';
export type PaymentMethod = 'cash' | 'card';

export type RideStage = 'landing' | 'verify' | 'confirm' | 'status' | 'cta';

export type RouteInstruction = {
  distance: number;
  time: number;
  text: string;
  streetName: string;
  sign: number;
  interval: [number, number];
};

export type RouteSummary = {
  distance: number;
  time: number;
  coordinates: [number, number][];
  bbox: [number, number, number, number];
  instructions: RouteInstruction[];
};

export type RideDraft = {
  pickup: RidePoint;
  destination?: RidePoint;
  route?: RouteSummary;
  tariff: Tariff;
  paymentMethod: PaymentMethod;
  phone?: string;
};

export type RideOrder = RideDraft & {
  id: string;
  status: RideStatus;
  etaMinutes: number;
  fareEstimate: number;
  driver?: {
    name: string;
    car: string;
    plate: string;
    rating: number;
  };
};

export type RideStatus = 'searching' | 'driver_assigned' | 'driver_arriving' | 'in_progress' | 'completed';
