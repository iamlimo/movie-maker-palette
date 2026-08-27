type NavigationDirection = "forward" | "backward" | "tab";

const tabRoutes = ["/", "/movies", "/watchlist", "/profile"];
const routeHierarchy = [
  "/",
  "/movies",
  "/movie-preview",
  "/tv-show-preview",
  "/watchlist",
  "/profile",
  "/wallet",
];

export function getNavigationDirection(
  from: string,
  to: string,
): NavigationDirection {
  // Check if both are tab routes
  const fromIsTab = tabRoutes.includes(from);
  const toIsTab = tabRoutes.includes(to);

  if (fromIsTab && toIsTab) {
    return "tab";
  }

  // Check hierarchy for forward/backward
  const fromIndex = routeHierarchy.findIndex((route) => from.startsWith(route));
  const toIndex = routeHierarchy.findIndex((route) => to.startsWith(route));

  if (fromIndex === -1 || toIndex === -1) {
    return "forward";
  }

  return toIndex > fromIndex ? "forward" : "backward";
}

export function isBottomNavRoute(pathname: string): boolean {
  // Don't show bottom nav on admin routes
  if (pathname.startsWith("/admin")) return false;

  // The bio page is a standalone public link hub.
  if (pathname === "/bio") return false;

  // Don't show on auth pages
  if (pathname === "/auth") return false;

  // Don't show on watch (video playback) - it overlaps player controls
  if (pathname.startsWith("/watch")) return false;

  return true;
}

export function parseDeepLink(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Handle signaturetv:// scheme
    if (urlObj.protocol === "signaturetv:") {
      const path = `${urlObj.hostname}${urlObj.pathname}`.replace(/\/+$/, "");
      const query = urlObj.search;

      // Map deep link paths to app routes
      const pathMap: Record<string, string> = {
        "": "/",
        home: "/",
        movies: "/movies",
        search: "/movies",
        rentals: "/watchlist",
        profile: "/profile",
        wallet: "/wallet",
        "payment/callback": "/payment/callback",
      };

      // Handle watch/:slug pattern
      if (path.startsWith("watch/")) {
        const slug = path.split("/")[1];
        return `/movie/${slug}${query}`;
      }

      // Handle search with query
      if (path === "search" && urlObj.searchParams.has("q")) {
        const queryValue = urlObj.searchParams.get("q");
        return `/movies?search=${encodeURIComponent(queryValue || "")}`;
      }

      if (path === "payment/callback") {
        return `/payment/callback${query}`;
      }

      if (pathMap[path]) {
        return `${pathMap[path]}${query}`;
      }

      if (path) {
        return `/${path}${query}`;
      }

      return "/";
    }

    return null;
  } catch (error) {
    console.error("Failed to parse deep link:", error);
    return null;
  }
}
