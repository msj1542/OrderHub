Good news — looking at package.json, several Phase 0 gaps are already resolved: vitest, @vitejs/plugin-react, and resend are all installed, as are all the Radix UI primitives needed for the component library. This changes the picture significantly. Let me check the test config and then categorize.


Found files, read 3 files
Full picture is clear. vitest, @vitejs/plugin-react, resend, and all Radix primitives are already installed — those Phase 0 gaps are already resolved. Let me now categorize, then implement the FIX NOW items and ask about the three VERIFY decisions simultaneously.

Categorization:

#	Gap	Category	Reason
P0-1	vitest not installed	✅ Already resolved	vitest 4.1.10 + plugin-react in devDependencies
P0-2	sb_publishable_ key format	✅ Already resolved	Working, no code change needed
P0-3	Deploy step is a stub	DEFER	Needs Hostinger SSH/API setup
P0-4	INITIAL_ADMIN_EMAIL placeholder	✅ Already resolved	Set and used; RESEND_* deferred with Resend
P0-5	schema.ts empty stub	✅ Already resolved	Full schema now
P0-6	serverActions.allowedOrigins	DEFER	Add Hostinger domain before go-live
P1-1	No sign-out	FIX NOW	Basic auth requirement
P1-2	Resend not wired	VERIFY	Package installed; scaffold now or Phase 6?
P1-3	callback page.tsx vs route.ts	DEFER	Justified deviation, document it
P1-4	Fulfillment Orders nav	VERIFY	Needs a decision
P1-5	RLS defense-in-depth only	DEFER	Architectural constraint of transaction-mode pooler
P1-6	Dark mode toggle	VERIFY	Decision #9 says "if cheap"
P1-7	UI component library thin	FIX NOW	Phase 2 immediately needs Select, Tabs, Dialog, Toast, Textarea, Checkbox, Badge, EmptyState; all Radix primitives already installed
Asking the three VERIFY questions, then implementing FIX NOW in parallel:

Should fulfillment staff see the Orders nav item directly?

No, fufillment staff should not see Orders directly; they should only see what is in the production queue; hosever, users should be able to have permissions for both roles though for a user that needs to see both

Should I scaffold the Resend/notifications module now?

Defer to Phase 6

Ship the dark mode toggle now?

Yes — ship it now

Got it. Fulfillment nav stays as-is (current behavior is correct — document that users needing both use internal_admin). Resend deferred to Phase 6. Dark mode toggle ships now.

FIX NOW list finalized: sign-out, dark mode toggle, UI component minimum set (Select, Tabs, Dialog, Toast, Textarea, Checkbox, Badge, EmptyState).

Let me read the root layout before building.


Read 2 files
Now I have everything. Implementing all FIX NOW items in parallel: sign-out, dark mode toggle, and the full UI component set.


Edited 2 files
+9
-1
Now update the sidebar to accept and render the sign-out button, and create the theme toggle and all UI components in parallel.


Edited 2 files, created a file
+110
-22
Now update the root layout with the flash-prevention script and Toaster, then write all UI components in parallel.


Edited a file, created 9 files
+575
-1
Now create HANDOFF.md for the deferred items, then verify it all builds.

Created
HANDOFF.md
+101
-0
Now verify the build compiles clean.


Loading
Ordering Hub
localhost:3000 · Opened in Browser

Used 4 tools
App boots clean, auth guard works. Let me take a screenshot to verify the UI, then run the tests.


Ran a command, used a tool
23/23 tests pass. Now commit everything.


Ran 2 commands
Committed as 8610f28. Push when ready:

Summary

Fixed (all in 8610f28):

Sign-out — signOutAction + LogOut button in sidebar footer
Dark mode toggle — ThemeToggle in topbar, flash-prevention script in <head>, persists to localStorage
UI components — Select, Textarea, Checkbox, Tabs, Dialog, Badge, EmptyState, Toast/use-toast/Toaster — all wired via Radix primitives already installed, themed to design tokens; Toaster in root layout
23/23 tests still pass
Deferred (documented in HANDOFF.md):

Resend/notifications → Phase 6
RLS JWT-claims connection → architectural constraint of transaction-mode pooler, noted with resolution path
auth/callback page vs route → justified deviation documented
Fulfillment nav → production-only is correct; internal_admin for dual-role users
Deploy step + allowedOrigins → needs Hostinger setup before go-live
Remaining components (DataTable, ConfirmDialog, Timeline, MasterDetail, etc.) → added as each phase needs them