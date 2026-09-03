import {
  ArrowUpRight,
  Facebook,
  Instagram,
  Mail,
  Music2,
  Youtube,
} from "lucide-react";

type BioLink = {
  label: string;
  detail: string;
  href: string;
  icon: typeof Instagram;
};

// Replace the placeholder URLs below with the team's live destinations.
const socialLinks: BioLink[] = [
  {
    label: "Instagram",
    detail: "Behind the scenes and new releases",
    href: "https://www.instagram.com/signaturetvapp?igsh=NHZ0enljdnM5ZGZy&utm_source=qr",
    icon: Instagram,
  },
  {
    label: "TikTok",
    detail: "Short Trailers. Big energy.",
    href: "https://www.tiktok.com/@signaturetvapp?_t=ZS-905b5iqXdzu&_r=1",
    icon: Music2,
  },
  {
    label: "YouTube",
    detail: "Trailers, BTS, and Intervies",
    href: "https://www.youtube.com/@spicturesnetwork",
    icon: Youtube,
  },
  {
    label: "Facebook",
    detail: "Join the Signature TV page and community",
    href: "https://www.facebook.com/share/19qNut6WKf/?mibextid=wwXIfr",
    icon: Facebook,
  },
];

const Bio = () => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#11100e] text-white selection:bg-orange-400 selection:text-[#11100e]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 top-[-18rem] h-[38rem] w-[38rem] rounded-full bg-orange-500/20 blur-[110px]" />
        <div className="absolute -right-40 bottom-[-20rem] h-[40rem] w-[40rem] rounded-full bg-red-500/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <header className="animate-slide-in-up flex flex-col items-center text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/15 bg-black/30 p-4 shadow-2xl shadow-orange-950/40 backdrop-blur-sm">
            <img
              src="/signature logo/1b.svg"
              alt="Signature TV"
              className="h-auto w-full"
            />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            Africa&apos;s home of real stories
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Signature TV
          </h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-white/65">
            Premium films, shows, and stories made for you. Watch anywhere,
            anytime.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="watch-heading">
          <h2
            id="watch-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/45"
          >
            Watch on your device
          </h2>
          <a
            href="https://apps.apple.com/in/app/signature-tv/id6755007386"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4 border border-orange-300/30 bg-orange-400 px-5 py-4 text-[#17120d] shadow-xl shadow-orange-950/30 transition duration-300 hover:-translate-y-1 hover:bg-orange-300"
          >
            <img
              src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
              alt="Download on the App Store"
              className="h-11 w-auto"
            />
            <span className="flex-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] opacity-65">
                Download for iPhone
              </span>
            </span>
            <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=co.signature.tv"
            target="_blank"
            rel="noreferrer"
            className="group mt-3 flex items-center gap-4 border border-white/15 bg-white/[0.07] px-5 py-4 text-white backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12]"
          >
            <img
              src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
              alt="Get it on Google Play"
              className="h-14 w-auto object-contain"
            />
            <span className="flex-1">
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Download for Android
              </span>
            </span>
            <ArrowUpRight className="h-5 w-5 text-white/60 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
          </a>
        </section>

        <section className="mt-10" aria-labelledby="connect-heading">
          <h2
            id="connect-heading"
            className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-white/45"
          >
            Stay connected
          </h2>
          <div className="space-y-3">
            {socialLinks.map(({ label, detail, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-4 border border-white/10 bg-white/[0.045] px-5 py-4 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:border-orange-300/40 hover:bg-white/[0.09]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 text-orange-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{label}</span>
                  <span className="mt-1 block text-sm text-white/45">
                    {detail}
                  </span>
                </span>
                <ArrowUpRight className="h-5 w-5 text-white/35 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-orange-300" />
              </a>
            ))}
          </div>
        </section>

        <footer className="mt-10 flex items-center justify-center gap-2 pb-2 text-sm text-white/40">
          <Mail className="h-4 w-4" />
          <a
            className="transition-colors hover:text-orange-300"
            href="mailto:sales@signaturetv.co"
          >
            sales@signaturetv.co
          </a>
        </footer>
      </div>
    </main>
  );
};

export default Bio;
