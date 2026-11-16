> Джерело: синтетичний приклад для golden data працівника (вигадана вимога, вигадані AC ID)

# Вимога 1. Бронювання переговорної

Працівник бронює переговорну на частину дня або на весь день. Дві броні тієї самої кімнати не перетинаються.

## Критерії приймання

- AC-DEMO-01: Given the room "Orion" is free on 2026-11-20. When the employee books it from 10:00 to 11:00. Then the employee sees "Booking confirmed" and the room "Orion" is busy from 10:00 to 11:00.
- AC-DEMO-02: Given the room "Orion" is booked on 2026-11-20 from 10:00 to 11:00. When the employee books it from 10:30 to 11:30. Then the employee sees "The room is already booked for this time: 10:00–11:00".
- AC-DEMO-03: Given the room "Orion" is free on 2026-11-23. When the employee books it for the whole day. Then the room "Orion" is busy for the whole day on 2026-11-23.
