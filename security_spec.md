# Security Specification - TaskFlow Pro Manager

## 1. Data Invariants
- A `Registration` must belong to a valid section and have a non-empty name.
- A `Report` must have a valid `userId` and `sectionId`.
- Only a user with `role == 'admin'` can create or modify `Registrations`.
- Users can only create `Reports`.
- Users can only read their own profile details (PII isolation).

## 2. The "Dirty Dozen" Payloads (Denial Tests)

1. **Identity Spoofing**: User A attempts to create a report with User B's `userId`.
2. **Privilege Escalation**: User attempts to update their own `role` to 'admin'.
3. **Ghost Section**: Admin attempts to create a registration in a section with a 2MB ID string.
4. **Invalid Update**: User attempts to edit a `Registration` entry (Admin-only).
5. **PII Leak**: User A attempts to 'get' User B's private profile.
6. **State Skip**: User attempts to create a registration bypassing the `isHelping` boolean.
7. **Size Attack**: User attempts to upload 1MB of text in the `name` field of a report.
8. **Owner Change**: Admin A attempts to change the `ownerId` of an existing registration (Immutable field).
9. **Rogue Field**: User attempts to add `isAdminVerified: true` to their profile during registration.
10. **Timestamp Fraud**: User attempts to set a manual `createdAt` in the past.
11. **Path Poisoning**: User attempts to access a document with ID `../../secrets`.
12. **Blind List**: User attempts to list all reports without a `where` clause filtering by their `userId`.

## 3. Test Runner (Mock Logic)

The `firestore.rules` will be verified against these payloads to ensure `PERMISSION_DENIED`.

```typescript
// firestore.rules.test.ts logic
// Expect: db.collection('registrations').add({ ... }) to fail if role != 'admin'
// Expect: db.collection('users').doc(otherUid).get() to fail
```
