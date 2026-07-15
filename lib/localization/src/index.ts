export type SupportedLocale = "en" | "es" | "fr";

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  "en",
  "es",
  "fr",
];

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
};

export function normalizeLocale(input?: string | null): SupportedLocale {
  if (!input) return DEFAULT_LOCALE;
  const value = input.toLowerCase();
  if (value.startsWith("es")) return "es";
  if (value.startsWith("fr")) return "fr";
  return "en";
}

function interpolate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const value = values[key];
    return value == null ? `{${key}}` : String(value);
  });
}

export function tFromCatalog(
  locale: SupportedLocale,
  catalogs: Record<SupportedLocale, Record<string, string>>,
  key: string,
  values?: Record<string, string | number>,
): string {
  const msg = catalogs[locale][key] ?? catalogs.en[key] ?? key;
  return interpolate(msg, values);
}

export const WEB_CATALOG: Record<SupportedLocale, Record<string, string>> = {
  en: {
    "layout.brandTagline": "Cognitive Architecture",
    "layout.downloadApp": "Download App",
    "layout.statusOnline": "SYS.ONLINE",
    "layout.statusNominal": "OP.NOMINAL",
    "layout.openNavigation": "Open navigation",
    "layout.navigation": "Navigation",
    "layout.locale": "Language",
    "layout.overview": "OVERVIEW",
    "nav.overview": "Overview",
    "nav.hub": "Hub",
    "nav.commons": "Commons",
    "nav.simulations": "Simulations",
    "nav.terminal": "Terminal",
    "nav.chat": "Chat",
    "nav.environment": "Environment",
    "nav.inquiry": "Inquiry",
    "nav.media": "Media",
    "nav.studio": "Studio",
    "nav.personality": "Personality",
    "nav.memory": "Memory",
    "nav.worldModel": "World Model",
    "nav.journal": "Journal",
    "nav.personas": "Personas",
    "nav.hieroCode": "Hiero-Code",
    "nav.beliefs": "Beliefs",
    "nav.evolution": "Evolution",
    "nav.analytics": "Analytics",
    "download.title": "DOWNLOAD PYRI",
    "download.subtitle":
      "Native desktop app (runs fully offline) — every installer served straight from this app",
    "download.latest": "Latest v{version}",
    "download.autoUpdateStrong":
      "Install once — the desktop app keeps itself current.",
    "download.autoUpdateBody":
      "On every launch it checks for a newer release and updates silently in the background when online. The Android APK is sideloaded — grab the newest build here whenever you want to update.",
    "download.yourOs": "Your OS",
    "download.yourDevice": "Your device",
    "download.installApk": "Install APK",
    "download.downloadExt": "Download {ext}",
    "download.couldNotReach":
      "Couldn't reach the download service right now. You can browse all installers directly on the GitHub Releases page.",
    "download.nonePublished":
      "No installers are published yet. Installers (.dmg/.exe/.AppImage/.deb/.apk) have to be built on their target OS — this app can't build them itself. Once a build is committed to the deploy's downloads/ folder or attached to a GitHub Release, it appears here automatically and stays up to date.",
    "download.openReleases": "Open Releases",
    "download.everyInstaller":
      "Every installer is served directly by this app — bundled if present, otherwise proxied from the latest release.",
    "download.allVersions": "All versions & release notes",
    "download.noteMac": "Apple Silicon & Intel (.dmg)",
    "download.noteWin":
      "Windows 10/11 — installer (.exe, auto-updates) or portable (.zip)",
    "download.noteLinux": "AppImage (portable) or .deb (Debian/Ubuntu)",
    "download.noteAndroid":
      "Android 8+ — sideload the .apk (enable unknown sources)",
    "chat.error.auth_invalid":
      "Authentication failed. Check your API key.",
    "chat.error.endpoint_unreachable":
      "Could not reach the model endpoint.",
    "chat.error.timeout":
      "The request timed out. Try again.",
    "chat.error.model_not_found":
      "The configured model was not found.",
    "chat.error.rate_limited":
      "Provider rate limit reached. Retry shortly.",
    "chat.error.malformed_response":
      "The provider returned an invalid response.",
    "chat.error.provider_error":
      "Generation failed on the provider.",
    "chat.error.title": "Generation error",
    "chat.error.networkTitle": "Network error",
    "chat.error.networkDescription": "Could not reach the API",
    "chat.status.fallback":
      "Cloud provider unavailable — switched to local offline model.",
  },
  es: {
    "layout.brandTagline": "Arquitectura cognitiva",
    "layout.downloadApp": "Descargar aplicación",
    "layout.statusOnline": "SIS.ENLÍNEA",
    "layout.statusNominal": "OP.NOMINAL",
    "layout.openNavigation": "Abrir navegación",
    "layout.navigation": "Navegación",
    "layout.locale": "Idioma",
    "layout.overview": "RESUMEN",
    "nav.overview": "Resumen",
    "nav.hub": "Hub",
    "nav.commons": "Comunes",
    "nav.simulations": "Simulaciones",
    "nav.terminal": "Terminal",
    "nav.chat": "Chat",
    "nav.environment": "Entorno",
    "nav.inquiry": "Consulta",
    "nav.media": "Medios",
    "nav.studio": "Estudio",
    "nav.personality": "Personalidad",
    "nav.memory": "Memoria",
    "nav.worldModel": "Modelo del mundo",
    "nav.journal": "Diario",
    "nav.personas": "Personas",
    "nav.hieroCode": "Hiero-Code",
    "nav.beliefs": "Creencias",
    "nav.evolution": "Evolución",
    "nav.analytics": "Analítica",
    "download.title": "DESCARGAR PYRI",
    "download.subtitle":
      "Aplicación de escritorio nativa (funciona totalmente sin conexión) — cada instalador se sirve desde esta app",
    "download.latest": "Última v{version}",
    "download.autoUpdateStrong":
      "Instala una vez: la app de escritorio se mantiene actualizada.",
    "download.autoUpdateBody":
      "En cada inicio comprueba nuevas versiones y se actualiza en segundo plano cuando hay conexión. El APK de Android se instala por sideload: descarga aquí la versión más reciente cuando quieras actualizar.",
    "download.yourOs": "Tu sistema",
    "download.yourDevice": "Tu dispositivo",
    "download.installApk": "Instalar APK",
    "download.downloadExt": "Descargar {ext}",
    "download.couldNotReach":
      "No se pudo acceder al servicio de descargas ahora mismo. Puedes ver todos los instaladores en la página de GitHub Releases.",
    "download.nonePublished":
      "Aún no hay instaladores publicados. Los instaladores (.dmg/.exe/.AppImage/.deb/.apk) deben construirse en su SO objetivo; esta app no puede crearlos por sí sola. Cuando una compilación se agregue a downloads/ o a un GitHub Release, aparecerá aquí automáticamente.",
    "download.openReleases": "Abrir Releases",
    "download.everyInstaller":
      "Cada instalador se sirve directamente desde esta app: empaquetado si está disponible o proxy desde la última release.",
    "download.allVersions": "Todas las versiones y notas",
    "download.noteMac": "Apple Silicon e Intel (.dmg)",
    "download.noteWin":
      "Windows 10/11 — instalador (.exe, autoactualizable) o portable (.zip)",
    "download.noteLinux": "AppImage (portable) o .deb (Debian/Ubuntu)",
    "download.noteAndroid":
      "Android 8+ — instala el .apk por sideload (fuentes desconocidas)",
    "chat.error.auth_invalid":
      "Autenticación fallida. Revisa tu clave API.",
    "chat.error.endpoint_unreachable":
      "No se pudo conectar al endpoint del modelo.",
    "chat.error.timeout":
      "La solicitud agotó el tiempo de espera. Inténtalo de nuevo.",
    "chat.error.model_not_found":
      "No se encontró el modelo configurado.",
    "chat.error.rate_limited":
      "Límite de tasa del proveedor alcanzado. Reintenta en breve.",
    "chat.error.malformed_response":
      "El proveedor devolvió una respuesta no válida.",
    "chat.error.provider_error":
      "La generación falló en el proveedor.",
    "chat.error.title": "Error de generación",
    "chat.error.networkTitle": "Error de red",
    "chat.error.networkDescription": "No se pudo alcanzar la API",
    "chat.status.fallback":
      "Proveedor en la nube no disponible: se cambió al modelo local sin conexión.",
  },
  fr: {
    "layout.brandTagline": "Architecture cognitive",
    "layout.downloadApp": "Télécharger l'application",
    "layout.statusOnline": "SYS.EN LIGNE",
    "layout.statusNominal": "OP.NOMINAL",
    "layout.openNavigation": "Ouvrir la navigation",
    "layout.navigation": "Navigation",
    "layout.locale": "Langue",
    "layout.overview": "APERÇU",
    "nav.overview": "Aperçu",
    "nav.hub": "Hub",
    "nav.commons": "Commun",
    "nav.simulations": "Simulations",
    "nav.terminal": "Terminal",
    "nav.chat": "Chat",
    "nav.environment": "Environnement",
    "nav.inquiry": "Enquête",
    "nav.media": "Médias",
    "nav.studio": "Studio",
    "nav.personality": "Personnalité",
    "nav.memory": "Mémoire",
    "nav.worldModel": "Modèle du monde",
    "nav.journal": "Journal",
    "nav.personas": "Personas",
    "nav.hieroCode": "Hiero-Code",
    "nav.beliefs": "Croyances",
    "nav.evolution": "Évolution",
    "nav.analytics": "Analytique",
    "download.title": "TÉLÉCHARGER PYRI",
    "download.subtitle":
      "Application bureau native (fonctionne totalement hors ligne) — chaque installateur est servi par cette application",
    "download.latest": "Dernière v{version}",
    "download.autoUpdateStrong":
      "Installez une fois — l'app bureau se met à jour automatiquement.",
    "download.autoUpdateBody":
      "À chaque lancement, elle vérifie une nouvelle version et se met à jour en arrière-plan quand elle est en ligne. L'APK Android se sideload: téléchargez ici la dernière version pour mettre à jour.",
    "download.yourOs": "Votre OS",
    "download.yourDevice": "Votre appareil",
    "download.installApk": "Installer l'APK",
    "download.downloadExt": "Télécharger {ext}",
    "download.couldNotReach":
      "Impossible d'atteindre le service de téléchargement pour le moment. Vous pouvez consulter tous les installateurs sur la page GitHub Releases.",
    "download.nonePublished":
      "Aucun installateur n'est encore publié. Les installateurs (.dmg/.exe/.AppImage/.deb/.apk) doivent être construits sur leur OS cible; cette application ne peut pas les générer elle-même. Une fois ajoutés dans downloads/ ou à une GitHub Release, ils apparaîtront ici automatiquement.",
    "download.openReleases": "Ouvrir Releases",
    "download.everyInstaller":
      "Chaque installateur est servi directement par cette application: intégré si présent, sinon proxy depuis la dernière release.",
    "download.allVersions": "Toutes les versions et notes",
    "download.noteMac": "Apple Silicon et Intel (.dmg)",
    "download.noteWin":
      "Windows 10/11 — installateur (.exe, auto-mise à jour) ou portable (.zip)",
    "download.noteLinux": "AppImage (portable) ou .deb (Debian/Ubuntu)",
    "download.noteAndroid":
      "Android 8+ — sideload du .apk (activer sources inconnues)",
    "chat.error.auth_invalid":
      "Échec d'authentification. Vérifiez votre clé API.",
    "chat.error.endpoint_unreachable":
      "Impossible de joindre l'endpoint du modèle.",
    "chat.error.timeout":
      "La requête a expiré. Réessayez.",
    "chat.error.model_not_found":
      "Le modèle configuré est introuvable.",
    "chat.error.rate_limited":
      "Limite de débit du fournisseur atteinte. Réessayez bientôt.",
    "chat.error.malformed_response":
      "Le fournisseur a renvoyé une réponse invalide.",
    "chat.error.provider_error":
      "La génération a échoué côté fournisseur.",
    "chat.error.title": "Erreur de génération",
    "chat.error.networkTitle": "Erreur réseau",
    "chat.error.networkDescription": "Impossible de joindre l'API",
    "chat.status.fallback":
      "Fournisseur cloud indisponible — bascule vers le modèle local hors ligne.",
  },
};

export const DESKTOP_CATALOG: Record<SupportedLocale, Record<string, string>> = {
  en: {
    "app.windowTitle": "ENGRAM — PYRI",
    "app.settingsTitle": "ENGRAM — Settings",
    "menu.file": "File",
    "menu.view": "View",
    "menu.settings": "Settings…",
    "menu.checkUpdates": "Check for Updates…",
    "dialog.updateAvailable.title": "Update available",
    "dialog.updateAvailable.message": "A new version of ENGRAM is available.",
    "dialog.updateAvailable.detail":
      "It is downloading now and you'll be prompted to restart when it's ready.",
    "dialog.upToDate.title": "You're up to date",
    "dialog.upToDate.message":
      "ENGRAM is already running the latest version.",
    "dialog.updateFailed.title": "Update check failed",
    "dialog.updateFailed.message": "Could not check for updates.",
    "dialog.updateReady.title": "Update ready",
    "dialog.updateReady.message": "ENGRAM {version} has been downloaded.",
    "dialog.updateReady.detail":
      "Restart now to apply the update, or keep working and it'll install the next time you quit.",
    "dialog.restartNow": "Restart now",
    "dialog.later": "Later",
    "dialog.updatesUnavailable.title": "Updates unavailable",
    "dialog.updatesUnavailable.message":
      "Automatic updates only run in the packaged app.",
    "dialog.startFailed.title": "ENGRAM failed to start",
    "dialog.startFailed.message":
      "The embedded server could not start.",
    "settings.title": "Model Connection",
    "settings.subtitle":
      "Choose how PYRI reaches a language model. Changes restart the embedded engine.",
    "settings.modeLegend": "Mode",
    "settings.mode.offline": "Offline (local model)",
    "settings.mode.online": "Online (cloud)",
    "settings.languageLegend": "Language",
    "settings.offlineLegend": "Offline — local OpenAI-compatible server",
    "settings.onlineLegend": "Online — cloud provider",
    "settings.baseUrl": "Base URL",
    "settings.model": "Model",
    "settings.apiKey": "API Key",
    "settings.offlineHint":
      "Point this at Ollama, LM Studio, or any local OpenAI-compatible endpoint. No API key required.",
    "settings.keyHintSet": "A key is set.",
    "settings.keyHintMissing": "No key set yet.",
    "settings.keyHintEncrypted":
      "Keys are encrypted with your OS keychain and saved securely.",
    "settings.keyHintSession":
      "OS keychain unavailable — the key is kept for this session only and is never written to disk, so you'll re-enter it next launch.",
    "settings.aboutLegend": "About",
    "settings.version": "Version",
    "settings.updates": "Updates",
    "settings.checkUpdates": "Check for Updates",
    "settings.cancel": "Cancel",
    "settings.saveRestart": "Save & Restart",
    "settings.validation.offlineBaseUrl":
      "Offline Base URL must be a valid http(s) URL.",
    "settings.validation.onlineBaseUrl":
      "Online Base URL must be a valid http(s) URL.",
    "settings.validation.offlineModel":
      "Offline model is required.",
    "settings.validation.onlineModel":
      "Online model is required.",
    "settings.validation.onlineApiKey":
      "An API key is required for online mode.",
    "settings.validation.connectionFailed":
      "Online provider test connection failed",
    "settings.status.restarting": "Restarting engine…",
    "settings.status.errorPrefix": "Error: ",
    "settings.status.unavailable": "Not available in this build",
    "settings.status.checking": "Checking for updates…",
    "settings.status.available":
      "Update {version} found — downloading…",
    "settings.status.availableGeneric": "Update found — downloading…",
    "settings.status.downloading": "Downloading update… {percent}%",
    "settings.status.downloaded": "Restart to update",
    "settings.status.error": "Update check failed",
    "settings.status.upToDate": "Up to date",
  },
  es: {
    "app.windowTitle": "ENGRAM — PYRI",
    "app.settingsTitle": "ENGRAM — Configuración",
    "menu.file": "Archivo",
    "menu.view": "Ver",
    "menu.settings": "Configuración…",
    "menu.checkUpdates": "Buscar actualizaciones…",
    "dialog.updateAvailable.title": "Actualización disponible",
    "dialog.updateAvailable.message": "Hay una nueva versión de ENGRAM.",
    "dialog.updateAvailable.detail":
      "Se está descargando y se te pedirá reiniciar cuando esté lista.",
    "dialog.upToDate.title": "Está actualizado",
    "dialog.upToDate.message":
      "ENGRAM ya está ejecutando la versión más reciente.",
    "dialog.updateFailed.title": "Falló la búsqueda de actualizaciones",
    "dialog.updateFailed.message": "No se pudo buscar actualizaciones.",
    "dialog.updateReady.title": "Actualización lista",
    "dialog.updateReady.message": "ENGRAM {version} se ha descargado.",
    "dialog.updateReady.detail":
      "Reinicia ahora para aplicar la actualización o continúa y se instalará al salir.",
    "dialog.restartNow": "Reiniciar ahora",
    "dialog.later": "Más tarde",
    "dialog.updatesUnavailable.title": "Actualizaciones no disponibles",
    "dialog.updatesUnavailable.message":
      "Las actualizaciones automáticas solo funcionan en la app empaquetada.",
    "dialog.startFailed.title": "ENGRAM no pudo iniciar",
    "dialog.startFailed.message":
      "No se pudo iniciar el servidor embebido.",
    "settings.title": "Conexión del modelo",
    "settings.subtitle":
      "Elige cómo PYRI se conecta a un modelo de lenguaje. Los cambios reinician el motor embebido.",
    "settings.modeLegend": "Modo",
    "settings.mode.offline": "Sin conexión (modelo local)",
    "settings.mode.online": "En línea (nube)",
    "settings.languageLegend": "Idioma",
    "settings.offlineLegend": "Sin conexión — servidor OpenAI compatible local",
    "settings.onlineLegend": "En línea — proveedor en la nube",
    "settings.baseUrl": "URL base",
    "settings.model": "Modelo",
    "settings.apiKey": "Clave API",
    "settings.offlineHint":
      "Apunta a Ollama, LM Studio o cualquier endpoint local compatible con OpenAI. No requiere clave API.",
    "settings.keyHintSet": "Hay una clave configurada.",
    "settings.keyHintMissing": "Aún no hay clave.",
    "settings.keyHintEncrypted":
      "Las claves se cifran con el llavero del sistema y se guardan de forma segura.",
    "settings.keyHintSession":
      "Llavero no disponible: la clave se mantiene solo esta sesión y nunca se escribe en disco.",
    "settings.aboutLegend": "Acerca de",
    "settings.version": "Versión",
    "settings.updates": "Actualizaciones",
    "settings.checkUpdates": "Buscar actualizaciones",
    "settings.cancel": "Cancelar",
    "settings.saveRestart": "Guardar y reiniciar",
    "settings.validation.offlineBaseUrl":
      "La URL base sin conexión debe ser una URL http(s) válida.",
    "settings.validation.onlineBaseUrl":
      "La URL base en línea debe ser una URL http(s) válida.",
    "settings.validation.offlineModel":
      "El modelo sin conexión es obligatorio.",
    "settings.validation.onlineModel":
      "El modelo en línea es obligatorio.",
    "settings.validation.onlineApiKey":
      "Se requiere una clave API para el modo en línea.",
    "settings.validation.connectionFailed":
      "Falló la prueba de conexión del proveedor en línea",
    "settings.status.restarting": "Reiniciando motor…",
    "settings.status.errorPrefix": "Error: ",
    "settings.status.unavailable": "No disponible en esta compilación",
    "settings.status.checking": "Buscando actualizaciones…",
    "settings.status.available":
      "Actualización {version} encontrada — descargando…",
    "settings.status.availableGeneric":
      "Actualización encontrada — descargando…",
    "settings.status.downloading": "Descargando actualización… {percent}%",
    "settings.status.downloaded": "Reinicia para actualizar",
    "settings.status.error": "Falló la búsqueda de actualizaciones",
    "settings.status.upToDate": "Actualizado",
  },
  fr: {
    "app.windowTitle": "ENGRAM — PYRI",
    "app.settingsTitle": "ENGRAM — Paramètres",
    "menu.file": "Fichier",
    "menu.view": "Affichage",
    "menu.settings": "Paramètres…",
    "menu.checkUpdates": "Rechercher des mises à jour…",
    "dialog.updateAvailable.title": "Mise à jour disponible",
    "dialog.updateAvailable.message":
      "Une nouvelle version d'ENGRAM est disponible.",
    "dialog.updateAvailable.detail":
      "Le téléchargement est en cours et vous serez invité à redémarrer quand elle sera prête.",
    "dialog.upToDate.title": "À jour",
    "dialog.upToDate.message":
      "ENGRAM exécute déjà la dernière version.",
    "dialog.updateFailed.title": "Échec de la recherche de mises à jour",
    "dialog.updateFailed.message":
      "Impossible de rechercher des mises à jour.",
    "dialog.updateReady.title": "Mise à jour prête",
    "dialog.updateReady.message": "ENGRAM {version} a été téléchargé.",
    "dialog.updateReady.detail":
      "Redémarrez maintenant pour appliquer la mise à jour, ou continuez et elle s'installera à la prochaine fermeture.",
    "dialog.restartNow": "Redémarrer",
    "dialog.later": "Plus tard",
    "dialog.updatesUnavailable.title": "Mises à jour indisponibles",
    "dialog.updatesUnavailable.message":
      "Les mises à jour automatiques ne fonctionnent que dans l'application empaquetée.",
    "dialog.startFailed.title": "Échec du démarrage d'ENGRAM",
    "dialog.startFailed.message":
      "Le serveur embarqué n'a pas pu démarrer.",
    "settings.title": "Connexion au modèle",
    "settings.subtitle":
      "Choisissez comment PYRI contacte un modèle de langage. Les changements redémarrent le moteur embarqué.",
    "settings.modeLegend": "Mode",
    "settings.mode.offline": "Hors ligne (modèle local)",
    "settings.mode.online": "En ligne (cloud)",
    "settings.languageLegend": "Langue",
    "settings.offlineLegend":
      "Hors ligne — serveur local compatible OpenAI",
    "settings.onlineLegend": "En ligne — fournisseur cloud",
    "settings.baseUrl": "URL de base",
    "settings.model": "Modèle",
    "settings.apiKey": "Clé API",
    "settings.offlineHint":
      "Pointez vers Ollama, LM Studio, ou tout endpoint local compatible OpenAI. Pas de clé API requise.",
    "settings.keyHintSet": "Une clé est définie.",
    "settings.keyHintMissing": "Aucune clé pour le moment.",
    "settings.keyHintEncrypted":
      "Les clés sont chiffrées avec le trousseau système et sauvegardées en sécurité.",
    "settings.keyHintSession":
      "Trousseau indisponible : la clé reste uniquement pour cette session et n'est jamais écrite en clair.",
    "settings.aboutLegend": "À propos",
    "settings.version": "Version",
    "settings.updates": "Mises à jour",
    "settings.checkUpdates": "Rechercher des mises à jour",
    "settings.cancel": "Annuler",
    "settings.saveRestart": "Enregistrer et redémarrer",
    "settings.validation.offlineBaseUrl":
      "L'URL de base hors ligne doit être une URL http(s) valide.",
    "settings.validation.onlineBaseUrl":
      "L'URL de base en ligne doit être une URL http(s) valide.",
    "settings.validation.offlineModel":
      "Le modèle hors ligne est requis.",
    "settings.validation.onlineModel":
      "Le modèle en ligne est requis.",
    "settings.validation.onlineApiKey":
      "Une clé API est requise pour le mode en ligne.",
    "settings.validation.connectionFailed":
      "Le test de connexion du fournisseur en ligne a échoué",
    "settings.status.restarting": "Redémarrage du moteur…",
    "settings.status.errorPrefix": "Erreur : ",
    "settings.status.unavailable": "Indisponible dans cette build",
    "settings.status.checking": "Recherche de mises à jour…",
    "settings.status.available":
      "Mise à jour {version} trouvée — téléchargement…",
    "settings.status.availableGeneric":
      "Mise à jour trouvée — téléchargement…",
    "settings.status.downloading":
      "Téléchargement de la mise à jour… {percent}%",
    "settings.status.downloaded": "Redémarrer pour mettre à jour",
    "settings.status.error":
      "Échec de la recherche de mises à jour",
    "settings.status.upToDate": "À jour",
  },
};

export const MOBILE_CATALOG: Record<SupportedLocale, Record<string, string>> = {
  en: {
    "tabs.personas": "Personas",
    "tabs.feed": "Feed",
    "tabs.chat": "Chat",
    "tabs.inquiry": "Inquiry",
    "common.noEngram": "No engram selected",
    "index.kicker": "ENGRAM // REGISTRY",
    "index.title": "Personas",
    "index.subtitle":
      "Select an engram to make it active across feed, chat, and inquiry.",
    "index.connectionLost": "Connection lost",
    "index.connectionLostSub":
      "Could not reach the ENGRAM core. Pull to retry.",
    "index.noEngrams": "No engrams yet",
    "index.noEngramsSub":
      "The registry is empty. Seed engrams from the dashboard to begin.",
    "feed.noEngramSub":
      "Choose an engram from the Personas tab to monitor its live transmissions.",
    "feed.kicker": "LIVE FEED // {symbol}",
    "feed.titleDefault": "Transmissions",
    "feed.awaitingSignal": "Awaiting signal",
    "feed.awaitingSignalSub":
      "This engram has not transmitted yet. Tap the bolt to provoke one now.",
    "chat.noEngramSub":
      "Pick an engram from the Personas tab to speak with it in its own voice.",
    "chat.kicker": "DIRECT LINK // {symbol}",
    "chat.titleDefault": "Chat",
    "chat.emptyTitle": "Speak with {name}",
    "chat.emptySub":
      "Replies stream in this engram's own voice and formatting.",
    "chat.inputPlaceholder": "Transmit a message…",
    "chat.interrupted": "[ signal interrupted — try again ]",
    "chat.error.auth_invalid":
      "Authentication failed. Check your API key.",
    "chat.error.endpoint_unreachable":
      "Could not reach the model endpoint.",
    "chat.error.timeout":
      "The request timed out. Try again.",
    "chat.error.model_not_found":
      "The configured model was not found.",
    "chat.error.rate_limited":
      "Provider rate limit reached. Retry shortly.",
    "chat.error.malformed_response":
      "The provider returned an invalid response.",
    "chat.error.provider_error":
      "Generation failed on the provider.",
    "chat.status.fallback":
      "Cloud provider unavailable — switched to local offline model.",
    "inquiry.kicker": "INQUIRY // {symbol}",
    "inquiry.title": "Interrogate",
    "inquiry.probe": "probe",
    "inquiry.develop": "develop",
    "inquiry.askNoChange": "Ask, no change",
    "inquiry.reshapeConfig": "Reshape config",
    "inquiry.placeholderProbe": "What do you remember about…?",
    "inquiry.placeholderDevelop": "Become more curious about…",
    "inquiry.submitProbe": "Probe",
    "inquiry.submitDevelop": "Develop",
    "inquiry.history": "History",
    "inquiry.none": "No inquiries yet.",
    "inquiry.noEngramSub":
      "Choose an engram to probe its mind or guide its development.",
    "inquiry.configDelta": "config delta",
    "card.autonomous": "autonomous",
    "card.dormant": "dormant",
    "transmission.signal": "signal",
    "transmission.mood": "mood · {mood}",
    "time.justNow": "just now",
    "time.mAgo": "{count}m ago",
    "time.hAgo": "{count}h ago",
    "time.dAgo": "{count}d ago",
    "header.back": "Back",
  },
  es: {
    "tabs.personas": "Personas",
    "tabs.feed": "Flujo",
    "tabs.chat": "Chat",
    "tabs.inquiry": "Consulta",
    "common.noEngram": "Ningún engrama seleccionado",
    "index.kicker": "ENGRAM // REGISTRO",
    "index.title": "Personas",
    "index.subtitle":
      "Selecciona un engrama para activarlo en flujo, chat y consulta.",
    "index.connectionLost": "Conexión perdida",
    "index.connectionLostSub":
      "No se pudo conectar al núcleo de ENGRAM. Desliza para reintentar.",
    "index.noEngrams": "Aún no hay engramas",
    "index.noEngramsSub":
      "El registro está vacío. Carga engramas desde el panel para comenzar.",
    "feed.noEngramSub":
      "Elige un engrama desde la pestaña Personas para ver sus transmisiones.",
    "feed.kicker": "FLUJO EN VIVO // {symbol}",
    "feed.titleDefault": "Transmisiones",
    "feed.awaitingSignal": "Esperando señal",
    "feed.awaitingSignalSub":
      "Este engrama aún no ha transmitido. Pulsa el rayo para provocarlo.",
    "chat.noEngramSub":
      "Elige un engrama desde Personas para hablar con su propia voz.",
    "chat.kicker": "ENLACE DIRECTO // {symbol}",
    "chat.titleDefault": "Chat",
    "chat.emptyTitle": "Habla con {name}",
    "chat.emptySub":
      "Las respuestas llegan en la voz y formato propios de este engrama.",
    "chat.inputPlaceholder": "Transmitir un mensaje…",
    "chat.interrupted": "[ señal interrumpida — inténtalo de nuevo ]",
    "chat.error.auth_invalid":
      "Autenticación fallida. Revisa tu clave API.",
    "chat.error.endpoint_unreachable":
      "No se pudo conectar al endpoint del modelo.",
    "chat.error.timeout":
      "La solicitud agotó el tiempo de espera. Inténtalo de nuevo.",
    "chat.error.model_not_found":
      "No se encontró el modelo configurado.",
    "chat.error.rate_limited":
      "Límite de tasa del proveedor alcanzado. Reintenta en breve.",
    "chat.error.malformed_response":
      "El proveedor devolvió una respuesta no válida.",
    "chat.error.provider_error":
      "La generación falló en el proveedor.",
    "chat.status.fallback":
      "Proveedor en la nube no disponible: se cambió al modelo local sin conexión.",
    "inquiry.kicker": "CONSULTA // {symbol}",
    "inquiry.title": "Interrogar",
    "inquiry.probe": "sondear",
    "inquiry.develop": "desarrollar",
    "inquiry.askNoChange": "Pregunta, sin cambios",
    "inquiry.reshapeConfig": "Reconfigurar",
    "inquiry.placeholderProbe": "¿Qué recuerdas sobre…?",
    "inquiry.placeholderDevelop": "Vuélvete más curioso sobre…",
    "inquiry.submitProbe": "Sondear",
    "inquiry.submitDevelop": "Desarrollar",
    "inquiry.history": "Historial",
    "inquiry.none": "Todavía no hay consultas.",
    "inquiry.noEngramSub":
      "Elige un engrama para sondear su mente o guiar su desarrollo.",
    "inquiry.configDelta": "delta de configuración",
    "card.autonomous": "autónomo",
    "card.dormant": "inactivo",
    "transmission.signal": "señal",
    "transmission.mood": "estado · {mood}",
    "time.justNow": "ahora mismo",
    "time.mAgo": "hace {count} min",
    "time.hAgo": "hace {count} h",
    "time.dAgo": "hace {count} d",
    "header.back": "Atrás",
  },
  fr: {
    "tabs.personas": "Personas",
    "tabs.feed": "Flux",
    "tabs.chat": "Chat",
    "tabs.inquiry": "Enquête",
    "common.noEngram": "Aucun engramme sélectionné",
    "index.kicker": "ENGRAM // REGISTRE",
    "index.title": "Personas",
    "index.subtitle":
      "Sélectionnez un engramme pour l'activer dans flux, chat et enquête.",
    "index.connectionLost": "Connexion perdue",
    "index.connectionLostSub":
      "Impossible de joindre le noyau ENGRAM. Tirez pour réessayer.",
    "index.noEngrams": "Aucun engramme",
    "index.noEngramsSub":
      "Le registre est vide. Initialisez des engrammes depuis le tableau de bord.",
    "feed.noEngramSub":
      "Choisissez un engramme dans l'onglet Personas pour suivre ses transmissions.",
    "feed.kicker": "FLUX LIVE // {symbol}",
    "feed.titleDefault": "Transmissions",
    "feed.awaitingSignal": "En attente de signal",
    "feed.awaitingSignalSub":
      "Cet engramme n'a pas encore transmis. Touchez l'éclair pour en provoquer un.",
    "chat.noEngramSub":
      "Choisissez un engramme dans Personas pour lui parler avec sa propre voix.",
    "chat.kicker": "LIEN DIRECT // {symbol}",
    "chat.titleDefault": "Chat",
    "chat.emptyTitle": "Parler avec {name}",
    "chat.emptySub":
      "Les réponses arrivent avec la voix et le style de cet engramme.",
    "chat.inputPlaceholder": "Transmettre un message…",
    "chat.interrupted": "[ signal interrompu — réessayez ]",
    "chat.error.auth_invalid":
      "Échec d'authentification. Vérifiez votre clé API.",
    "chat.error.endpoint_unreachable":
      "Impossible de joindre l'endpoint du modèle.",
    "chat.error.timeout":
      "La requête a expiré. Réessayez.",
    "chat.error.model_not_found":
      "Le modèle configuré est introuvable.",
    "chat.error.rate_limited":
      "Limite de débit du fournisseur atteinte. Réessayez bientôt.",
    "chat.error.malformed_response":
      "Le fournisseur a renvoyé une réponse invalide.",
    "chat.error.provider_error":
      "La génération a échoué côté fournisseur.",
    "chat.status.fallback":
      "Fournisseur cloud indisponible — bascule vers le modèle local hors ligne.",
    "inquiry.kicker": "ENQUÊTE // {symbol}",
    "inquiry.title": "Interroger",
    "inquiry.probe": "sonder",
    "inquiry.develop": "développer",
    "inquiry.askNoChange": "Questionner, sans changer",
    "inquiry.reshapeConfig": "Reconfigurer",
    "inquiry.placeholderProbe": "Que te rappelles-tu de… ?",
    "inquiry.placeholderDevelop": "Deviens plus curieux à propos de…",
    "inquiry.submitProbe": "Sonder",
    "inquiry.submitDevelop": "Développer",
    "inquiry.history": "Historique",
    "inquiry.none": "Aucune enquête pour le moment.",
    "inquiry.noEngramSub":
      "Choisissez un engramme pour sonder son esprit ou guider son développement.",
    "inquiry.configDelta": "delta de config",
    "card.autonomous": "autonome",
    "card.dormant": "dormant",
    "transmission.signal": "signal",
    "transmission.mood": "humeur · {mood}",
    "time.justNow": "à l'instant",
    "time.mAgo": "il y a {count} min",
    "time.hAgo": "il y a {count} h",
    "time.dAgo": "il y a {count} j",
    "header.back": "Retour",
  },
};
