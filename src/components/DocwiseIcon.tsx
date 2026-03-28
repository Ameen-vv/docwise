type DocwiseIconProps = {
  className?: string;
  alt?: string;
};

export function DocwiseIcon({
  className = "h-8 w-8",
  alt = "DocWise",
}: DocwiseIconProps) {
  return (
    <img
      src="/docwise-icon.svg"
      alt={alt}
      width={512}
      height={512}
      className={className}
      draggable={false}
    />
  );
}
