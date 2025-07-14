import { createClient } from "redis";

interface Location {
	setDriverSocketId(driverId: string, socketId: string): Promise<void>;
	getDriverSocketId(driverId: string): Promise<string | null>;
	deleteDriverSocketId(driverId: string): Promise<void>;
	addDriverLocation(
		driverId: string,
		longitude: number,
		latitude: number,
	): Promise<void>;
	removeDriverLocation(driverId: string): Promise<void>;
	findNearByDrivers(
		source: { longitude: number; latitude: number },
		radius: number,
	): Promise<string[]>;
	storeNotifiedDrivers(bookingId: string, driverIds: string[]): Promise<void>;
	getNotifiedDrivers(bookingId: string): Promise<string[] | undefined>;
}

const client = await createClient()
	.on("error", (err) => console.log("Redis Client Error", err))
	.connect();

class LocationService implements Location {
	private readonly client: typeof client;

	constructor() {
		this.client = client;
	}

	async setDriverSocketId(driverId: string, socketId: string): Promise<void> {
		await this.client.set(`driver:${driverId}`, socketId);
	}

	async getDriverSocketId(driverId: string): Promise<string | null> {
		return await this.client.get(`driver:${driverId}`);
	}

	async deleteDriverSocketId(driverId: string): Promise<void> {
		await this.client.del(`driver:${driverId}`);
	}

	async addDriverLocation(
		driverId: string,
		longitude: number,
		latitude: number,
	): Promise<void> {
		await this.client.geoAdd("drivers", {
			longitude,
			latitude,
			member: driverId,
		});
	}

	async removeDriverLocation(driverId: string): Promise<void> {
		await this.client.geoRemove("drivers", driverId);
	}

	async findNearByDrivers(
		source: { longitude: number; latitude: number },
		radius: number,
	): Promise<string[]> {
		return await this.client.geoRadius(
			"drivers",
			{
				longitude: source.longitude,
				latitude: source.latitude,
			},
			radius,
			"km",
			{ COUNT: 10, SORT: "ASC" },
		);
	}

	async storeNotifiedDrivers(
		bookingId: string,
		driverIds: string[],
	): Promise<void> {
		for (const driverId of driverIds) {
			await this.client.sAdd(`booking:${bookingId}`, driverId);
		}
	}

	async getNotifiedDrivers(bookingId: string): Promise<string[] | undefined> {
		const driverIds = await this.client.get(`booking:${bookingId}`);
		return driverIds ? JSON.parse(driverIds) : undefined;
	}
}

export const geolocation = new LocationService();
