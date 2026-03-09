export type ShareServiceDetailResult = "shared" | "copied" | "cancelled" | "unavailable";

interface ShareServiceDetailOptions {
  currentUrl: string;
  serviceId: string;
  serviceName: string;
  statusLabel: string;
  summary?: string | null;
  share?: Navigator["share"];
  clipboard?: Pick<Clipboard, "writeText"> | null;
}

function cleanBasePath(pathname: string) {
  const normalized = String(pathname || "").replace(/\/+$/, "");
  const statusMarker = normalized.lastIndexOf("/status/");
  if (statusMarker >= 0) {
    return normalized.slice(0, statusMarker);
  }
  return normalized;
}

export function buildServiceDetailShareUrl(currentUrl: string, serviceId: string) {
  const shareUrl = new URL(currentUrl);
  const cleanServiceId = String(serviceId || "").trim().toLowerCase();
  const nextPath = `/status/${cleanServiceId}`.replace(/\/{2,}/g, "/");

  if (shareUrl.hash.startsWith("#/")) {
    shareUrl.pathname = `${shareUrl.pathname.replace(/\/+$/, "")}${nextPath}`.replace(/\/{2,}/g, "/");
    shareUrl.hash = "";
    shareUrl.search = "";
    return shareUrl;
  }

  const basePath = cleanBasePath(shareUrl.pathname);
  shareUrl.pathname = `${basePath}${nextPath}`.replace(/\/{2,}/g, "/");
  shareUrl.search = "";
  return shareUrl;
}

function buildShareText(serviceName: string, statusLabel: string, summary?: string | null) {
  const headline = `${serviceName} - ${statusLabel}`;
  const detail = String(summary || "").trim();
  return detail ? `${headline}\n${detail}` : headline;
}

export async function shareServiceDetail(
  options: ShareServiceDetailOptions
): Promise<ShareServiceDetailResult> {
  const shareUrl = buildServiceDetailShareUrl(options.currentUrl, options.serviceId);
  const shareText = buildShareText(options.serviceName, options.statusLabel, options.summary);

  if (typeof options.share === "function") {
    try {
      await options.share({
        title: options.serviceName,
        text: shareText,
        url: shareUrl.toString(),
      });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (options.clipboard?.writeText) {
    try {
      await options.clipboard.writeText(shareUrl.toString());
      return "copied";
    } catch {
      // Continue to unavailable state.
    }
  }

  return "unavailable";
}
