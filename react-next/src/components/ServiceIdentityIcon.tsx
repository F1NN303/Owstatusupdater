import { getIconComponent } from "@/data/servers";
import { cn } from "@/lib/utils";
import { buildPublicAssetUrl, resolveServiceBrandAsset } from "@/lib/serviceBranding";

interface ServiceIdentityIconProps {
  serviceId?: string | null;
  iconName?: string | null;
  size?: number;
  containerClassName?: string;
  fallbackClassName?: string;
}

const ServiceIdentityIcon = ({
  serviceId,
  iconName,
  size = 18,
  containerClassName,
  fallbackClassName = "text-primary",
}: ServiceIdentityIconProps) => {
  const brandAsset = resolveServiceBrandAsset(serviceId);
  const pixelSize = Math.max(12, Math.round(size));

  if (brandAsset) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl bg-secondary",
          brandAsset.containerClassName,
          containerClassName
        )}
      >
        <img
          src={buildPublicAssetUrl(brandAsset.assetPath)}
          alt=""
          aria-hidden="true"
          width={pixelSize}
          height={pixelSize}
          className="pointer-events-none select-none object-contain"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
    );
  }

  const IconComponent = getIconComponent(iconName || "Globe");
  return (
    <div className={cn("flex items-center justify-center rounded-xl bg-secondary", containerClassName)}>
      <IconComponent size={pixelSize} className={fallbackClassName} aria-hidden="true" />
    </div>
  );
};

export default ServiceIdentityIcon;
