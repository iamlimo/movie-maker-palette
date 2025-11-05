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
  to: string
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
  
  // Don't show on auth pages
  if (pathname === "/auth") return false;
  
  return true;
}

export function parseDeepLink(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // Handle signaturetv:// scheme
    if (urlObj.protocol === "signaturetv:") {
      const path = urlObj.hostname + urlObj.pathname;
      
      // Map deep link paths to app routes
      const pathMap: Record<string, string> = {
        "": "/",
        "home": "/",
        "movies": "/movies",
        "search": "/movies",
        "rentals": "/watchlist",
        "profile": "/profile",
      };

      // Handle watch/:id pattern
      if (path.startsWith("watch/")) {
        const id = path.split("/")[1];
        return `/movie-preview/${id}`;
      }

      // Handle search with query
      if (path === "search" && urlObj.searchParams.has("q")) {
        const query = urlObj.searchParams.get("q");
        return `/movies?search=${encodeURIComponent(query || "")}`;
      }

      return pathMap[path] || "/";
    }

    return null;
  } catch (error) {
    console.error("Failed to parse deep link:", error);
    return null;
  }
}
