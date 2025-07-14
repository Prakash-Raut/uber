import { TRPCError } from "@trpc/server";
import { db } from "db";
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
});
