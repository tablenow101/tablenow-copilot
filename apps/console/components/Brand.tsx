import Image from "next/image";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <span className={`tn-brand ${className}`}>
      <Image
        className="tn-logo-dark"
        src="/brand/tablenow-os.png"
        width={2172}
        height={724}
        alt="TableNow OS"
        priority
      />
      <Image className="tn-logo-clear" src="/brand/tablenow-os-black.png" width={2172} height={724} alt="TableNow OS" priority />
    </span>
  );
}
