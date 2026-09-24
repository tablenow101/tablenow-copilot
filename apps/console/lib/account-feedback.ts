import { api, ApiError } from "./api";

/** Bound account requests without retrying a code or an email automatically. */
export async function accountRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    return await api<T>(path, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError(0, "ACCOUNT_TIMEOUT", "Le serveur n’a pas confirmé le résultat à temps. Votre saisie est conservée. Réessayez lorsque la connexion est rétablie.");
    if (error instanceof SyntaxError) throw new ApiError(0, "ACCOUNT_RESPONSE_UNCERTAIN", "La réponse du serveur est incomplète. Vérifiez l’état de votre demande avant de réessayer.");
    if (error instanceof TypeError) throw new ApiError(0, "ACCOUNT_NETWORK", "La connexion a été interrompue. Votre saisie est conservée. Vérifiez votre connexion internet, puis réessayez.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function accountFeedback(error: unknown): { message: string; restart: boolean; action?: "signup" } {
  if (!(error instanceof ApiError)) return { message: "Un problème technique empêche la vérification. Votre saisie est conservée. Réessayez.", restart: false };
  if (error.code === "ACCOUNT_METHOD_CHANGED") return { message: "Votre vérification utilise désormais un code reçu par e-mail. Recommencez la connexion.", restart: true };
  if (error.code === "ACCOUNT_CHALLENGE_EXPIRED") return { message: "Cette vérification a expiré. Relancez la connexion ; vos informations déjà enregistrées sont conservées.", restart: true };
  if (error.code === "ACCOUNT_CHALLENGE_UNAVAILABLE") return { message: "Cette vérification n’est plus disponible. Recommencez pour continuer.", restart: true };
  if (error.code === "ACCOUNT_SIGNUP_REQUIRED") return { message: "Votre adresse e-mail est vérifiée, mais aucun compte TableNow n’y est associé. Inscrivez-vous pour créer votre compte.", restart: false, action: "signup" };
  if (error.code === "ACCOUNT_EMAIL_UNAVAILABLE") return { message: "L’envoi de l’e-mail est indisponible. Réessayez dans quelques minutes.", restart: false };
  if (error.status >= 500) return { message: "Le service de vérification rencontre un problème technique. Votre saisie est conservée. Réessayez dans un instant.", restart: false };
  if (error.status === 429) return { message: "Trop de tentatives. Patientez avant de réessayer. Ne créez pas un nouveau compte.", restart: false };
  return { message: error.message, restart: false };
}

/** Reconcile only outcomes whose server result is unknown, never an explicit failure. */
export function shouldReconcileAccountFailure(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export function missingAccountProgressFeedback(verificationStarted: boolean, originalError?: unknown): { message: string; restart: boolean } {
  if (verificationStarted) return { message: "Cette vérification n’est plus disponible. Recommencez pour continuer.", restart: true };
  return originalError ? accountFeedback(originalError) : {
    message: "La demande n’a pas pu être confirmée. Votre saisie est conservée. Réessayez.",
    restart: false,
  };
}
