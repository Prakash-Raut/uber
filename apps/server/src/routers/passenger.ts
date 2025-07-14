import { TRPCError } from "@trpc/server";
import { db } from "db";
import z from "zod";
import { publicProcedure, router } from "../lib/trpc";

export const passengerRouter = router({
	getBookings: publicProcedure
		.input(
			z.object({
				passengerId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const passengerBookings = await db.booking.findMany({
				where: {
					passengerId: input.passengerId,
				},
			});

			if (!passengerBookings) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "No bookings found",
				});
			}

			return passengerBookings;
		}),

	feedback: publicProcedure
		.input(
			z.object({
				bookingId: z.string(),
				rating: z.number().min(1).max(5),
				feedback: z.string().min(1).max(255),
			}),
		)
		.mutation(async ({ input }) => {
			const booking = await db.booking.update({
				where: { id: input.bookingId },
				data: { rating: input.rating, feedback: input.feedback },
			});

			if (!booking) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Booking not found",
				});
			}

			return booking;
		}),
});
