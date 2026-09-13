import Image from "next/image";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`tn-brand ${className}`}>
      <Image
        src="/brand/tablenow-os.png"
        width={1600}
        height={525}
        alt="TableNow OS"
        priority
      />
    </span>
  );
}
