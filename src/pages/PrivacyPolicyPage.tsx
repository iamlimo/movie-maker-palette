import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Sun, Moon } from "lucide-react";

export default function PrivacyPolicyPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const toggleTheme = () => setDarkMode(!darkMode);

  const brandColor = "#FF8001";
  const hoverBrand = "#CC6600";

  return (
    <div
      className={`min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-300 ${
        darkMode ? "bg-[#0B0B0D] text-gray-100" : "bg-white text-gray-900"
      }`}
    >
      {/* Sidebar */}
      <aside
        className={`md:w-64 w-full border-r p-6 md:sticky md:top-0 h-fit md:h-screen flex flex-col justify-between transition-colors duration-300 ${
          darkMode
            ? "bg-[#121214] border-[#1E1E22]"
            : "bg-gray-100 border-gray-300"
        }`}
      >
        <div>
          <div className="flex items-center justify-between md:block">
            <h1
              className="text-2xl font-bold mb-4"
              style={{ color: brandColor }}
            >
              Signature TV
            </h1>
            <button
              onClick={toggleTheme}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              className="ml-2 p-2 rounded focus:outline-none focus:ring-2"
              style={{ outlineColor: brandColor }}
            >
              {darkMode ? (
                <Sun className="text-yellow-400" />
              ) : (
                <Moon className="text-gray-800" />
              )}
            </button>

            <button
              className="md:hidden text-gray-300 focus:outline-none focus:ring-2 rounded"
              style={{ outlineColor: brandColor }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        <div className="mt-8 hidden md:block">
          <Button
            className={`w-full text-white focus:ring-2 focus:ring-offset-2`}
            style={{ backgroundColor: brandColor, borderColor: brandColor }}
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 md:p-10 space-y-6">
        <h2
          className="text-3xl font-semibold mb-6"
          style={{ color: brandColor }}
        >
          Privacy Policy
        </h2>

        <div className="space-y-4">
          <p>
            <strong>Effective Date:</strong> 9th September 2025
          </p>
          <p>
            <strong>Applies To:</strong> Signature Pictures Network, Signature
            TV & App, and associated services
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            1. Introduction
          </h3>
          <p>
            Signature Pictures Network / Signature TV & App (“we,” “our,” or
            “us”) are committed to safeguarding your privacy and personal data.
            This Privacy Policy explains how we collect, use, store, disclose,
            and protect your information when you use our websites, mobile
            applications, digital streaming platforms, or interact with any of
            our services. We are fully compliant with the Nigerian Data
            Protection Regulation (NDPR) and other applicable data protection
            laws. By accessing or using our services, you agree to the terms of
            this Privacy Policy.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            2. Scope and Application
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Visitors to our website(s)</li>
            <li>Registered users of Signature TV & App</li>
            <li>Subscribers to our video-on-demand services</li>
            <li>
              Users of Signature Pictures Network production and Entertainment
              services
            </li>
            <li>
              Anyone interacting with our customer service or communications
            </li>
          </ul>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            3. Definitions
          </h3>
          <p>
            <strong>Personal Data:</strong> Any information relating to an
            identified or identifiable individual (e.g., name, email, device
            ID).
          </p>
          <p>
            <strong>Processing:</strong> Any operation performed on personal
            data (collection, use, storage, sharing, deletion).
          </p>
          <p>
            <strong>User:</strong> Any individual who uses our services or
            platform.
          </p>
          <p>
            <strong>Platform:</strong> Signature TV & App and related websites,
            apps, or services.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            4. Information We Collect
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Account & Identity Data:</strong> Full name, Email
              address, Phone number, Date of birth, Gender, Profile photo.
            </li>
            <li>
              <strong>Payment & Transaction Data:</strong> Billing address,
              Payment method (processed via secure third parties), Purchase and
              subscription history.
            </li>
            <li>
              <strong>Usage & Technical Data:</strong> Content watched, IP
              address, Device identifiers, Log data, cookies, session times.
            </li>
            <li>
              <strong>Communications & Support Data:</strong> Feedback,
              inquiries, complaints, Support tickets, In-app messages.
            </li>
          </ul>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            5. How We Use Your Information
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and personalize our services</li>
            <li>To process subscriptions, rentals, and payments</li>
            <li>To manage your account and preferences</li>
            <li>To communicate updates and support</li>
            <li>To comply with legal obligations</li>
            <li>To improve user experience and performance</li>
          </ul>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            6. Legal Basis for Processing
          </h3>
          <p>
            We process your personal data based on consent, contractual
            necessity, legal obligations, or legitimate interests. You may
            withdraw consent at any time.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            7. Data Sharing and Disclosure
          </h3>
          <p>
            We do not sell personal data. We share it with service providers,
            affiliates, law enforcement (if required), or acquirers during
            mergers.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            8. Cookies & Tracking
          </h3>
          <p>
            We use cookies to maintain sessions, analyze behavior, and enable
            features. You can manage cookies via browser settings.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            9. Data Retention
          </h3>
          <p>
            Data is retained only as necessary. Account info – active duration;
            Payment records – 6 years; Usage logs – 12 months; Communications –
            2 years.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            10. Data Security
          </h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Encryption (HTTPS/TLS, at rest)</li>
            <li>Access Control</li>
            <li>Secure Payment Handling</li>
            <li>Regular Audits and Incident Response</li>
          </ul>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            11. Your Data Rights
          </h3>
          <p>
            Under NDPR, you have the rights of access, rectification, erasure,
            restriction, objection, and portability. Contact our DPO to exercise
            these rights.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            12. Children's Privacy
          </h3>
          <p>
            Our services are not directed to children under 13. We delete data
            collected inadvertently from minors.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            13. International Data Transfers
          </h3>
          <p>
            Data transfers outside Nigeria comply with NDPR and international
            standards.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            14. Contact Us
          </h3>
          <p>
            <strong>Data Protection Officer (DPO)</strong>
            <br />
            Signature Pictures Network / Signature TV & App
            <br />
            📧 Email: signaturepicturesnetwork@gmail.com
            <br />
            📞 Tel: +2348162059633
            <br />
            📍 Address: Scandic Court 1, Our Daily Manner Road Lekki, 101233
            Nigeria
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            15. Updates to This Privacy Policy
          </h3>
          <p>
            We may update this policy and notify you via email, in-app alerts,
            or public notice. Changes take effect 30 days after notice.
          </p>

          <h3
            className="text-xl font-semibold mt-6"
            style={{ color: brandColor }}
          >
            16. Governing Law
          </h3>
          <p>
            This policy is governed by the laws of the Federal Republic of
            Nigeria. Disputes shall be under the jurisdiction of Nigerian
            courts.
          </p>
        </div>

        <div className="mt-10 md:hidden">
          <Button
            className={`w-full text-white focus:ring-2 focus:ring-offset-2`}
            style={{ backgroundColor: brandColor, borderColor: brandColor }}
            onClick={() => window.print()}
          >
            Print / Save as PDF
          </Button>
        </div>
      </main>
    </div>
  );
}
