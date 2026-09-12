import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="tn-welcome">
      <Image src="/brand/restaurant-stitch.jpg" alt="" fill priority sizes="100vw" className="tn-welcome-photo" />
      <Link href="/login" className="tn-welcome-start">Commencer</Link>
    </main>
  );
}
