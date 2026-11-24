# Security Specification — Vamos Al Cine

## 1. Data Invariants
1. **Owner-Only User Profiles (`/users/{userId}`)**: A user profile document can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **Owner-Only Favorites (`/users/{userId}/favorites/{movieId}`)**: A favorite movie document cannot exist without a valid `userId` matching both `{userId}` and `request.auth.uid`, valid alphanumeric/hyphen path IDs (`<= 128` chars), bounded strings, and server-verified timestamps (`request.time`).
3. **No Shadow Fields**: Both `create` and `update` reject any unexpected keys via `keys().hasOnly(...)` and `affectedKeys().hasOnly(...)`.
4. **Immutable Creation Metadata**: `uid` on `UserProfile` and `userId`, `movieId`, `createdAt` on `FavoriteMovie` cannot be altered after creation.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Profile Read**: Anonymous `get` on `/users/user123` -> `PERMISSION_DENIED`.
2. **Cross-User Profile Read (PII Leak)**: User `alice` reads `/users/bob` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Profile Create**: User `alice` creates `/users/alice` with `{ uid: "bob", ... }` -> `PERMISSION_DENIED`.
4. **Unverified Email Write**: User with `email_verified: false` attempts write on `/users/alice` -> `PERMISSION_DENIED`.
5. **Shadow Role Field Injection**: User `alice` creates `/users/alice` with `{ uid: "alice", displayName: "Alice", isAdmin: true, updatedAt: request.time }` -> `PERMISSION_DENIED`.
6. **Profile UID Mutation**: User `alice` updates `/users/alice` changing `uid` -> `PERMISSION_DENIED`.
7. **Oversized Path ID Poisoning**: Request targeting `/users/alice/favorites/<150-char-id>` or invalid chars (`../`) -> `PERMISSION_DENIED`.
8. **Cross-User Favorite Create**: User `alice` writes `/users/bob/favorites/603` -> `PERMISSION_DENIED`.
9. **Favorite Ownership Spoofing**: User `alice` creates `/users/alice/favorites/603` with `userId: "bob"` -> `PERMISSION_DENIED`.
10. **Client-Forged Timestamp**: User `alice` creates `/users/alice/favorites/603` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
11. **Value Poisoning / Type Mismatch**: User `alice` creates `/users/alice/favorites/603` with `movieId: "not-an-int"` or `title` > 200 chars -> `PERMISSION_DENIED`.
12. **Global Collection List Scraping**: User `alice` attempts `list` on `/users` -> `PERMISSION_DENIED`.
