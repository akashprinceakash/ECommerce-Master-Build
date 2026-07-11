// Stable, publicly-reachable source photos used as the "person" input for
// IDM-VTON. Served from the API server's own /api/public/avatars/ path so
// they resolve correctly via toAbsoluteUrl in the lookbook route.
export const AVATAR_IMAGE_PATHS: Record<"male" | "female", string> = {
  male: "/api/public/avatars/avatar-male.png",
  female: "/api/public/avatars/avatar-female.png",
};
