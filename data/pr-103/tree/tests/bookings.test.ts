import { describe, expect, it } from "vitest";
import { bookRoom } from "@/app/bookings/actions";
import { fakeDb } from "./support/fake-db";

const EMPLOYEE = "employee.one@example.test";

describe("bookRoom", () => {
  it("AC-DEMO-01: free room is booked for the requested hours", async () => {
    const db = fakeDb();
    const result = await bookRoom(db, { room: "Orion", date: "2026-11-20", from: "10:00", to: "11:00", by: EMPLOYEE });
    expect(result).toEqual({ ok: true, message: "Booking confirmed" });
    expect(db.busy("Orion", "2026-11-20")).toEqual([["10:00", "11:00"]]);
  });

  it("AC-DEMO-02: overlapping booking is refused with the existing hours", async () => {
    const db = fakeDb([{ room: "Orion", date: "2026-11-20", from: "10:00", to: "11:00" }]);
    const result = await bookRoom(db, { room: "Orion", date: "2026-11-20", from: "10:30", to: "11:30", by: EMPLOYEE });
    expect(result).toEqual({ ok: false, message: "The room is already booked for this time: 10:00–11:00" });
  });

  it("books the room for the whole day", async () => {
    const db = fakeDb();
    const result = await bookRoom(db, { room: "Orion", date: "2026-11-23", wholeDay: true, by: EMPLOYEE });
    expect(result.ok).toBe(true);
    expect(db.busy("Orion", "2026-11-23")).toEqual([["00:00", "24:00"]]);
  });
});
