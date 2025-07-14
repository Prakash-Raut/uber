import { TRPCError } from "@trpc/server";
import { db } from "db";
import { geolocation } from "redis-geo";
import z from "zod";
import { haversineDistance } from "@/lib/utils";
import { publicProcedure, router } from "../lib/trpc";

export const BASIC_FARE = 50;
export const RATE_PER_KM = 20;
export const RADIUS_KM = 10;

export const bookingRouter = router({
	create: publicProcedure
		.input(
			z.object({
				passengerId: z.string(),
				sourceLat: z.number(),
				sourceLong: z.number(),
				destLat: z.number(),
				destLong: z.number(),
			}),
		)
		.mutation(async ({ input }) => {
			const distance = haversineDistance(
				input.sourceLat,
				input.sourceLong,
				input.destLat,
				input.destLong,
			);

			const fare = Math.floor(BASIC_FARE + distance * RATE_PER_KM);

			const booking = await db.booking.create({
				data: {
					passengerId: input.passengerId,
					sourceLat: input.sourceLat,
					sourceLong: input.sourceLong,
					destLat: input.destLat,
					destLong: input.destLong,
					fare,
					distanceKm: distance,
					status: "PENDING",
					requestedAt: new Date(),
				},
			});

			if (!booking) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create booking",
				});
			}

			const nearByDrivers = await geolocation.findNearByDrivers(
				{ longitude: booking.sourceLong, latitude: booking.sourceLat },
				RADIUS_KM,
			);

			if (nearByDrivers.length === 0) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No drivers found near by",
				});
			}

			const driverIds: string[] = [];

			for (const driverId of nearByDrivers) {
				const driverSocketId = await geolocation.getDriverSocketId(driverId);
				if (driverSocketId) {
					driverIds.push(driverId);
					// await socket.to(driverSocketId).emit("New_Booking", booking);
				}
			}

			await geolocation.storeNotifiedDrivers(booking.id, driverIds);

			return booking;
		}),

	accept: publicProcedure
		.input(
			z.object({
				bookingId: z.string(),
				driverId: z.string(),
			}),
		)
		.mutation(async ({ input }) => {
			const booking = await db.booking.update({
				where: { id: input.bookingId },
				data: { driverId: input.driverId, status: "ACCEPTED" },
			});

			if (!booking) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Booking not found",
				});
			}

			const notifiedDrivers = await geolocation.getNotifiedDrivers(booking.id);

			if (!notifiedDrivers) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No drivers found near by",
				});
			}

			for (const driverId of notifiedDrivers) {
				const driverSocketId = await geolocation.getDriverSocketId(driverId);
				if (driverSocketId) {
					// await socket.to(driverSocketId).emit("Booking_Accepted", booking);
				} else {
					// await socket.to(driverSocketId).emit("Booking_Cancelled", booking);
				}
			}

			return booking;
		}),
});
