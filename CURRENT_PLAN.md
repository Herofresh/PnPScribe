# PnPScribe — Current Plan

This plan replaces the earlier entity-extraction rollout plan as the active product scope.

## Scope Locked In
- A `GM` is the owner of a system and can create systems, create groups, and invite players.
- A normal player account exists first, with a later option to enable `GM mode`.
- `GM mode` means the user can also create and own systems/groups. This is planned as a future settings upgrade and may later be paywalled.
- Initial onboarding and invitations use invite links, not real email delivery.
- Deployment should be done in small, understandable steps with Hetzner as the target host.

## Product Direction

### GM capabilities
- Create and own systems.
- Upload files to a system.
- Ask system-wide rules questions in a chat interface.
- Create groups/parties inside a system.
- Invite players to groups with invite links.
- View player profiles relevant to their systems/groups.

### Player capabilities
- See all systems/groups they are invited to.
- Upload files for their character.
- Ask game rules questions.
- Ask character-specific questions grounded in their uploaded character files.

### Entity analysis direction
- Expand document meta analysis into a stronger indexed catalog of entity types.
- Store where likely entities appear in the file by page/section/group/chunk.
- Use that catalog to improve future extraction passes for items, creatures, and other entity types.

## Phase 1 — Data Model + Auth Foundation
- [ ] Design Prisma models for `User`, `Account`, `Session`, `InviteLink`, `SystemMembership`, `Group`, `GroupMembership`, and character documents.
- [ ] Decide the minimum role model:
  - `player`
  - `gm_enabled`
- [ ] Add authentication with:
  - email + password
  - Google login
- [ ] Add session handling and protected routes.
- [ ] Add a simple profile/settings surface.

## Phase 2 — Ownership + Permissions
- [ ] Make systems owned by a user.
- [ ] Restrict system creation to GM-enabled users.
- [ ] Add system memberships and group memberships.
- [ ] Add permission checks to all relevant API routes:
  - system creation
  - uploads
  - rules ask
  - group creation
  - invite creation
- [ ] Keep the authorization rules simple and explicit.

## Phase 3 — Invites + Groups
- [ ] Add group/party creation within a system.
- [ ] Add invite-link generation for players.
- [ ] Add invite acceptance flow for:
  - existing users
  - new users
- [ ] Add a GM view for group membership and player summaries.

## Phase 4 — Chat Surfaces
- [ ] Replace the current MVP ask flow with stored chat threads/messages.
- [ ] Add system-level rules chat for GMs and eligible players.
- [ ] Add player character chat grounded in character-specific uploads.
- [ ] Keep rules chat and character chat as separate retrieval scopes.

## Phase 5 — Character Documents
- [ ] Add character-level document ownership under a player.
- [ ] Add upload flow for character sheets / character reference files.
- [ ] Index character files separately from system rulebooks.
- [ ] Add retrieval mode that combines:
  - game/system rules
  - player character context

## Phase 6 — Entity Meta Index V2
- [ ] Upgrade document `entityMetaJson` from a loose type summary to a reusable index.
- [ ] Store:
  - detected entity types
  - aliases
  - confidence
  - section titles
  - page ranges
  - chunk/group references
  - detection signals
- [ ] Use the meta index to guide later extraction passes.
- [ ] Add debug/admin visibility for the indexed results.

## Phase 7 — Deployment in Small Steps
- [ ] Prepare the app for production config:
  - environment variables
  - build/start commands
  - persistent uploads
- [ ] Create a simple Docker Compose production setup for:
  - web
  - postgres
  - redis
  - ocr-worker
  - entity-worker
- [ ] Add reverse proxy + HTTPS.
- [ ] Provision a Hetzner server.
- [ ] Point the domain to the server.
- [ ] Deploy once locally reproducible.

## Recommended Implementation Order
1. Auth + Prisma user model
2. System ownership + permissions
3. Groups + invite links
4. Stored chat threads/messages
5. Character uploads + character-aware retrieval
6. Entity meta index v2
7. Hetzner deployment

## Notes
- Deployment should wait until auth and permissions are at least minimally in place. Exposing the current single-user MVP online would create avoidable cleanup work.
- Google login is useful, but email/password should be implemented first if we want the fastest path through auth and testing.
- Real email sending can be added later once invite links and account flows are stable.
