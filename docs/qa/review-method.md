# Review method

How a prompt's work is checked before it is called done. The tests, the smoke
walk, the inventory lint and the layout audit run on every push; this file holds
the checks a machine cannot run.

- Any change to routing is walked on the live site with a real sign-out and
  sign-in, because the mock cannot cover MSAL: the auth response arrives in the
  URL fragment, and a router that rewrites the fragment before
  `handleRedirectPromise` reads it signs nobody in (prompt 47.1 Part 1).
