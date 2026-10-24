# Urgency greedy for Suggested bookings, not an optimal solver

Suggested bookings come from a greedy pass: Booking candidates sorted missing → expired (oldest Valid until first) → expiring (nearest first), each placed into the earliest Session of that Training with Free seats (and before their end of employment). Seats exceed candidates for every Training in the export, so the bottleneck is timing, not capacity, and an optimizer gains little while being harder to explain to HR and reshuffling everyone whenever a booking is confirmed.

## Considered Options

- **Lapse-prevention greedy**: fill each Session first with people who would lapse before the next Session.
- **Optimal assignment** (min-cost flow / LP): requires choosing an objective; "fewest lapses" and "fewest non-compliant days" disagree on real data.

## Consequences

Known trade-off on the export (Reference date 1. 10. 2026): BOZP-Z has one Free seat before February (T015, 7. 10.; T016 overbooked, T017 cancelled). It goes to an Employee with a missing BOZP, so the ~5 Employees expiring before February lapse until T018 (3. 2. 2027). Revisit if capacity becomes the bottleneck.
