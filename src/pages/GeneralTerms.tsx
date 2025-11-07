import React, { useEffect, useState } from "react";

export default function TermsAndConditions() {
  const [darkMode, setDarkMode] = useState(false);

  // Automatically detect system theme
  useEffect(() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    setDarkMode(prefersDark);
  }, []);

  const toggleDarkMode = () => setDarkMode(!darkMode);
  const handlePrint = () => window.print();

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        darkMode ? "bg-gray-900 text-gray-100" : "bg-white text-gray-800"
      }`}
    >
      {/* Header */}
      <header
        className={`sticky top-0 z-10 flex items-center justify-between p-4 border-b ${
          darkMode ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-white"
        }`}
      >
        <h1 className="text-lg font-semibold text-[#FF8001]">
          Terms & Conditions — Signature Pictures Network / Signature TV & App
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium border rounded-md hover:opacity-80 transition"
            style={{ borderColor: "#FF8001", color: "#FF8001" }}
          >
            Print / Save as PDF
          </button>
          <button
            onClick={toggleDarkMode}
            className="px-4 py-2 text-sm font-medium rounded-md bg-[#FF8001] text-white hover:bg-[#e67300] transition"
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10 leading-relaxed">
        <div
          className={`mb-6 px-3 py-2 rounded-md text-sm font-medium w-fit ${
            darkMode ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700"
          }`}
        >
          Effective Date: 15th September, 2025 | Last Updated: 15th September,
          2025
        </div>

        <section className="space-y-6 text-justify">
          <h2 className="text-xl font-semibold text-[#FF8001]">
            1. Introduction
          </h2>
          <p>
            Welcome to Signature Pictures Network / Signature TV & App ("we").
            These Terms & Conditions (“Terms”) govern your access to and use of
            our platforms and services including video-on-demand, licensed
            content, and interactive media. By accessing or using our services,
            you agree to be legally bound by these Terms. If you do not agree,
            please do not use our platform.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            2. Definitions
          </h2>
          <ul className="list-disc pl-6">
            <li>
              <strong>User/You:</strong> Any person or entity that accesses or
              uses the Signature TV & App or Signature Pictures Network content.
            </li>
            <li>
              <strong>Platform:</strong> Signature TV & App, available on web,
              mobile, and smart devices.
            </li>
            <li>
              <strong>Content:</strong> Includes video, audio, images, text,
              graphics, and interactive media.
            </li>
            <li>
              <strong>Subscription / Rental:</strong> Paid or free access tier
              for content.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            3. Eligibility
          </h2>
          <p>
            To use Signature TV & App, you must be at least 18 years old (or
            have parental consent), possess legal capacity, and comply with
            Nigerian and international laws.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            4. Account Registration & Security
          </h2>
          <p>
            You agree to provide accurate information during registration and
            keep your credentials secure. Sharing or unauthorized access will
            result in suspension or termination.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            5. Subscriptions, Billing & Payment
          </h2>
          <ul className="list-disc pl-6">
            <li>
              All charges are billed in Nigerian Naira (₦) and processed through
              PCI-DSS compliant gateways.
            </li>
            <li>
              Refunds apply only under the Consumer Protection Policy (e.g.,
              duplicate billing or technical failure).
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            6. Acceptable Use Policy
          </h2>
          <p>
            You agree not to engage in illegal activities, harassment, malware
            distribution, or intellectual property infringement. Violations may
            result in account suspension or termination.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            7. Intellectual Property Rights
          </h2>
          <p>
            All platform content is owned or licensed by Signature Pictures
            Network and protected by copyright and trademark laws. You may only
            access content for personal, non-commercial use.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            8. User-Generated Content (UGC)
          </h2>
          <p>
            You retain ownership of your UGC but grant us a royalty-free,
            worldwide license to use, display, and adapt your content. We may
            remove UGC that violates these Terms or the law.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            9. Content Availability & Changes
          </h2>
          <p>
            Content availability varies by region. We may update or discontinue
            features or titles at any time with reasonable notice.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            10. Privacy and Data Protection
          </h2>
          <p>
            We collect and process data in accordance with the Nigeria Data
            Protection Act (NDPA 2023). See our Privacy Policy for details.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            11. Disclaimers & Limitation of Liability
          </h2>
          <p>
            Services are provided “as is.” We make no guarantees of
            uninterrupted access or error-free operation. Our liability is
            limited to the subscription fee paid in the last 3 months.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            12. Suspension & Termination
          </h2>
          <p>
            We may suspend or terminate access for violations, fraud, or
            unauthorized use. Termination may result in loss of content access.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            13. Governing Law & Dispute Resolution
          </h2>
          <p>
            Governed by Nigerian law. Disputes should be resolved through our
            support team, FCCPC, NCC, or Lagos courts.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            14. Changes to Terms
          </h2>
          <p>
            We may update these Terms and will notify users via email or in-app
            notices. Continued use indicates acceptance.
          </p>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            15. Contact Us
          </h2>
          <ul className="list-none pl-0">
            <li>📧 Email: signaturepicturesnetwork@gmail.com</li>
            <li>📞 Phone: +2348162059633</li>
            <li>🌐 Website: www.signaturetv.co</li>
            <li>📬 Mail: Signature Pictures Network, Lagos, Nigeria</li>
          </ul>

          <h2 className="text-xl font-semibold text-[#FF8001]">
            16. Entire Agreement
          </h2>
          <p>
            These Terms, along with our Privacy Policy and Consumer Protection
            Policy, constitute the full agreement between you and Signature
            Pictures Network.
          </p>
        </section>
      </main>
    </div>
  );
}
