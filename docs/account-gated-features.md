# Account-Gated Features

## Product Rule

`Friends` and `Pro` are account-only surfaces. A user must have a real authenticated session before the app shows either entry point or allows those workflows to open from visible UI.

Guest mode remains limited to `Play`, `Local`, `vs AI`, local device history, theme controls, and account CTA actions through the Account panel.

## Guest Experience

- Header shows `Play`, `Guest`, the theme toggle, and Account panel access to `Login` and `Register`.
- Header does not show the `Friends` tab.
- Header does not show the `Pro` button.
- Play mode `Friend Link` is hidden or disabled for guests.
- Guest history is stored only on the current device.
- Guests must not write profile, friends, room, leaderboard, or cloud game data to Supabase.

## Signed-In Experience

- Header shows `Play`, `Friends`, `Account`, the theme toggle, and `Pro`.
- `Friends` opens account-backed search, incoming and outgoing requests, accepted friends, and challenge room creation.
- `Pro` opens the upgrade/pro modal and any premium controls.
- Profile, leaderboard sync, cloud history, friends, and room links use the authenticated account identity.

## Friends Access Rules

- The UI gate must rely on `session !== null`.
- Guests must not see `Friends` as a full header tab or primary navigation item.
- Direct internal state must not leave a signed-out user in the `Friends` view after session loss; the view should resolve back to `Play`.
- Friends search, requests, accepted friends, and challenge room actions remain protected by service-level authenticated account checks.
- Challenge actions are enabled only for accepted friends and authenticated users.

## Pro Access Rules

- The `Pro` entry point must rely on `session !== null`.
- Guests must not see the `Pro` header button or any equivalent visible premium entry point.
- Signed-in users can open the Pro modal from the header.
- Premium controls must be reachable only through account-authenticated UI.

## Acceptance Criteria

- Guest cannot see the `Friends` tab in the header.
- Guest cannot see the `Pro` button in the header.
- Signed-in user sees both `Friends` and `Pro`.
- Signed-in user can open the Pro modal.
- Direct internal state must not allow opening `Friends` from a visible guest control.
- Existing account-only Friends and Room logic remains protected.

## Test Checklist

- Component: guest `queryByRole("button", { name: /friends/i })` is `null` in the header.
- Component: guest `queryByRole("button", { name: /^pro$/i })` is `null`.
- Component: signed-in account sees `Friends`.
- Component: signed-in account sees `Pro`.
- Component: signed-in account can open the Pro modal.
- Component or unit: session loss while `Friends` is active resolves the visible view back to `Play`.
- Service/unit: Friends and Room services reject unauthenticated create, join, search, request, accept, and remove actions.
- E2E: guest can play `Local` and `vs AI`, but cannot open the friend room workflow.
- E2E: signed-in users can complete the friend request and challenge room flow.

Run before merging:

```bash
npm test
npm run lint -- --quiet
npm run build
```
