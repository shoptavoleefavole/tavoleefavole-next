import Image, { type ImageProps } from "next/image";
import { smartImageLoader } from "@/lib/cloudinary-loader";

type Props = Omit<ImageProps, "loader"> & {
  alt: string;
};

export function SmartImage({ alt, ...props }: Props) {
  return (
    <Image
      {...props}
      alt={alt}
      loader={smartImageLoader}
      loading={props.priority ? "eager" : "lazy"}
    />
  );
}