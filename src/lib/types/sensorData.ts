export type SensorData = {
	kiosk: number;
	time: Date;
	temperature: number;
	humidity: number; // relative humidity
    pressure: number;
	air_quality: number; // Uk Daily Air Quality Index https://uk-air.defra.gov.uk/air-pollution/daqi?view=more-info
	current: number;
	voltage: number;
};
