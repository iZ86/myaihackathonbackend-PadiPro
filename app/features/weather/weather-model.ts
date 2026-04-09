export interface WeatherData {
  mobile_no: string;
  updated_at: string;

  weatherCondition?: string | undefined;
  temperature?: Temperature | undefined;
  dewPoint?: Temperature | undefined;
  heatIndex?: Temperature | undefined;
  windChill?: Temperature | undefined;
  relativeHumidity?: number | undefined;
  uvIndex?: number | undefined;
  precipitation?: {
  probability: {
    percent: number;
    type: string;
  };
  qpf: QuantityValue;
} | undefined;
  thunderstormProbability?: number | undefined;
  airPressure?: {
  meanSeaLevelMillibars: number;
} | undefined;
  wind?: {
  direction: {
    degrees: number;
    cardinal: string;
  };
  speed: ValueWithUnit;
  gust: ValueWithUnit;
} | undefined;
  cloudCover?: number | undefined;
  currentConditionsHistory?: {
  temperatureChange: Temperature;
  maxTemperature: Temperature;
  minTemperature: Temperature;
  qpf: QuantityValue;
} | undefined;
}

export interface WeatherApiData {
  currentTime: string;
  timeZone: {
    id: string;
  };
  isDaytime: boolean;
  weatherCondition: {
    iconBaseUri: string;
    description: {
      text: string;
      languageCode: string;
    };
    type: string;
  };
  temperature: Temperature;
  feelsLikeTemperature: Temperature;
  dewPoint: Temperature;
  heatIndex: Temperature;
  windChill: Temperature;
  relativeHumidity: number;
  uvIndex: number;
  precipitation: {
    probability: {
      percent: number;
      type: string;
    };
    qpf: QuantityValue;
  };
  thunderstormProbability: number;
  airPressure: {
    meanSeaLevelMillibars: number;
  };
  wind: {
    direction: {
      degrees: number;
      cardinal: string;
    };
    speed: ValueWithUnit;
    gust: ValueWithUnit;
  };
  visibility: {
    distance: number;
    unit: string;
  };
  cloudCover: number;
  currentConditionsHistory: {
    temperatureChange: Temperature;
    maxTemperature: Temperature;
    minTemperature: Temperature;
    qpf: QuantityValue;
  };
}

interface Temperature {
  degrees: number;
  unit: string;
}

interface QuantityValue {
  quantity: number;
  unit: string;
}

interface ValueWithUnit {
  value: number;
  unit: string;
}
