import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// bare clerkMiddleware() attaches the auth context but protects NOTHING. without
// this matcher a signed-out user reached /dashboard and /appointments, the pages
// rendered, and every server action inside threw - producing 500s instead of a
// sign-in redirect.
//
// note this only enforces "is signed in". the admin check stays where it is:
// in src/app/admin/page.tsx and in each admin-only server action, since a
// "use server" export is addressable regardless of which page ran.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/appointments(.*)',
  '/admin(.*)',
  '/voice(.*)',
  '/pro(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
