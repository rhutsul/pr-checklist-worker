// UAT зрізу «Бронювання переговорної»: «Тоді» — дослівно з AC (requirements/01-room-booking.md).
import { expect, test } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/employee.json" }); // синтетичний employee.one@example.test

test("AC-DEMO-01: employee books a free room", async ({ page }) => {
  await page.goto("/bookings/new?room=Orion&date=2026-11-20");
  await page.getByLabel("From").fill("10:00");
  await page.getByLabel("To").fill("11:00");
  await page.getByRole("button", { name: "Book room" }).click();
  await test.step('Тоді: the employee sees "Booking confirmed" and the room "Orion" is busy from 10:00 to 11:00', async () => {
    await expect(page.getByRole("status")).toHaveText("Booking confirmed");
    await expect(page.getByTestId("busy-Orion")).toContainText("10:00–11:00");
  });
});

test("AC-DEMO-02: overlapping booking is refused", async ({ page }) => {
  await page.goto("/bookings/new?room=Orion&date=2026-11-20");
  await page.getByLabel("From").fill("10:30");
  await page.getByLabel("To").fill("11:30");
  await page.getByRole("button", { name: "Book room" }).click();
  await test.step('Тоді: the employee sees "The room is already booked for this time: 10:00–11:00"', async () => {
    await expect(page.getByRole("alert")).toHaveText("The room is already booked for this time: 10:00–11:00");
  });
});
