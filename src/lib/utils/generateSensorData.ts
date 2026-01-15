import { faker } from '@faker-js/faker';

import type { SensorData } from "$lib/types/sensorData";

export function generateSensorData(kiosk_id: number): SensorData {
	return {
		kiosk: kiosk_id,
		time: new Date(),
		temperature: faker.number.int(100),
		humidity: faker.number.int({min: 30, max: 60}),
		pressure: faker.number.int(100),
		air_quality: faker.number.int(10),
		current: faker.number.int(10),
		voltage: faker.number.int(12),
	}
}
