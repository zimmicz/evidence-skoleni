# Evidence školení

Overview of employee training compliance for HR: who is trained, whose training is expiring, and whom to book into which limited-capacity session.

## Language

### People

**Employee** (zaměstnanec):
A person on the institution's staff list, identified by employee id.
_Avoid_: worker, user, person

**Employment status** (stav):
One of active (aktivní), parental leave (rodičovská), terminated (ukončen). Terminated employees stay in the data; HR hides them by default.
_Avoid_: state

**Department** (útvar):
Organisational unit an Employee belongs to.
_Avoid_: unit, team, oddělení

**Position** (pozice):
An Employee's job role, e.g. Řidič, Vedoucí.
_Avoid_: role, title

### Trainings

**Training** (školení):
A kind of training from the catalog, identified by its code, with a validity length and a rule saying who must take it.
_Avoid_: course, kurz

**Validity length** (platnost_mesicu):
How long a Completion stays valid. Zero means one-time (never expires); empty means the Training is optional.
_Avoid_: duration

**Completion** (absolvované školení):
A record that an Employee finished a Training on a given date.
_Avoid_: attendance, record, certificate

**Valid until** (platnost do):
End of a Completion's validity. Taken from the Completion itself when present, otherwise Completion date plus the Training's Validity length.
_Avoid_: expiry date, deadline

**Session** (termín):
A scheduled occurrence of a Training with a date, place and seat capacity.
_Avoid_: event, slot, class

**Reference date**:
The date compliance is evaluated against. Defaults to the export date 1. 10. 2026; HR may change it.
_Avoid_: today, now

### Data import

**Import**:
Loading the four exports into the app. Data is untrusted until it passes validation.

**Normalization**:
An unambiguous cleanup applied automatically on Import (whitespace, letter case, accepted date formats incl. Excel serial dates, decimal comma). Always listed to HR as cleaned.
_Avoid_: fix, correction

**Inconsistency** (nesrovnalost):
A value in an Import that violates a strict rule of what is acceptable and cannot be Normalized. Reported to HR on Import; either unresolved or resolved.
_Avoid_: error, warning, bug

**Rejected row**:
A structurally broken row (repeated header, wrong column count, missing key). Shown to HR, never used. Bad values in an otherwise well-formed row are Inconsistencies, not Rejected rows.

**Resolution**:
HR's decision on an Inconsistency: a **Mapping** (bad value → known value, applies to every row with that value), an **Exclusion** (row not used), or **Ignore** (row kept as is).

### Compliance

**Requirement** (povinnost):
A Training an Employee must hold, derived from the Training's rule (everyone, Department, or Position).
_Avoid_: obligation, mandatory training

**Requirement status**:
Valid, expiring, expired, missing (never completed), or before start (never completed, Employee starts after the Reference date). Expiring means Valid until falls within the Expiring window. Before start is not counted in compliance stats; such an Employee is only booked into a Session on or before the start date.

**Expiring window**:
How far after the Reference date a Valid until counts as expiring. Default 90 days.

**Extra completion** (nad rámec):
A Completion of a Training that is not a Requirement for that Employee. Shown, never counted.

### Booking

**Free seats**:
A Session's capacity minus seats already taken in the export minus Confirmed bookings.

**Booking candidate**:
An active Employee (not on parental leave, not terminated) with a Requirement that is missing, expired, or expiring. No grace period for new hires.

**Suggested booking**:
The app's proposal to put a Booking candidate into a specific Session.

**Confirmed booking**:
A Suggested booking HR accepted (possibly after moving it to another Session). Takes a seat and stays fixed when suggestions are recomputed.

**Unplaceable** (nelze umístit):
A Booking candidate for whom no Session has Free seats.
