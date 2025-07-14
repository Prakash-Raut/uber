import { TRPCError } from "@trpc/server";
import { db } from "db";
import { geolocation } from "redis-geo";
import z from "zod";
import { publicProcedure, router } from "../lib/trpc";

export const driverRouter = router({
	getBookings: publicProcedure
		.input(
			z.object({
				driverId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const driverBookings = await db.booking.findMany({
				where: {
					driverId: input.driverId,
				},
			});

			if (!driverBookings) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No bookings found",
				});
			}

			return driverBookings;
		}),

	updateLocation: publicProcedure
		.input(
			z.object({
				driverId: z.string(),
				latitude: z.number(),
				longitude: z.number(),
			}),
		)
		.mutation(async ({ input }) => {
			await geolocation.addDriverLocation(
				input.driverId,
				input.latitude,
				input.longitude,
			);

			const updatedDriverLocation = await db.user.update({
				where: { id: input.driverId },
				data: { latitude: input.latitude, longitude: input.longitude },
			});

			if (!updatedDriverLocation) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Driver not found",
				});
			}

			return updatedDriverLocation;
		}),
});
