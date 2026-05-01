export function determineIdentityProfileEvent(
  previousSurname: string | null,
): "StudentProfileCompleted" | "StudentProfileUpdated" {
  return previousSurname === null ? "StudentProfileCompleted" : "StudentProfileUpdated";
}
