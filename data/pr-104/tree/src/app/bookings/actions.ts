"use server";
// Синтетичний фрагмент реалізації для golden data працівника.
import { overlaps, type Booking, type Db } from "@/lib/bookings";

export async function bookRoom(db: Db, input: Booking) {
  const clash = (await db.bookings(input.room, input.date)).find((b) => overlaps(b, input));
  if (clash) return { ok: false, message: `The room is already booked for this time: ${clash.from}–${clash.to}` };
  await db.insert(input);
  return { ok: true, message: "Booking confirmed" };
}
