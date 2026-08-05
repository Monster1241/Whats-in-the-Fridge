import { LegalPageLayout } from '../components/LegalPageLayout.jsx';

export function TermsOfService() {
  return (
    <LegalPageLayout title="Terms of Service">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of What&apos;s in the Fridge?
        (&quot;the App&quot;), a progressive web application for household inventory and grocery
        planning. By accessing or using the App, you agree to these Terms.
      </p>

      <section>
        <h2 className="text-heading text-base font-bold">The service</h2>
        <p>
          The App is provided as a <strong className="text-heading">progressive web app (PWA)</strong>{' '}
          you access through a web browser on your phone, tablet, or computer. You may add it to your
          home screen for an app-like experience. No native app store download is required unless you
          choose to install it that way in the future.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Eligibility & accounts</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>You must provide a valid email address and keep your login credentials secure.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>You must verify your email when prompted to access household features.</li>
          <li>You must be at least 13 years old (or the minimum age in your jurisdiction).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Household invites</h2>
        <p>
          Households are shared spaces linked by an invite code. When you create or join a household:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>All members can view and edit the shared inventory and shopping list.</li>
          <li>Only share invite codes with people you trust to access your household data.</li>
          <li>Household owners may remove members; members may leave at any time from Settings.</li>
          <li>You agree not to join households without permission from existing members.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Third-party content & accuracy</h2>
        <p>
          The App aggregates information from third-party sources for your convenience. This includes
          but is not limited to:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-heading">Supermarket deals and catalogues</strong> — sourced from
            publicly available weekly promotion data and retailer links. Prices, availability, and
            promotions may change without notice. Always confirm in store or on the retailer&apos;s
            website before purchasing.
          </li>
          <li>
            <strong className="text-heading">Recipes</strong> — built-in recipes and imports from{' '}
            <a
              href="https://www.themealdb.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              TheMealDB
            </a>
            . We do not guarantee nutritional accuracy, allergen information, or suitability for your
            diet.
          </li>
          <li>
            <strong className="text-heading">Barcode product data</strong> — from Open Food Facts and
            Open Products Facts. Product names and categories may be incomplete or incorrect.
          </li>
        </ul>
        <p className="mt-3">
          We provide this content &quot;as is&quot; for informational purposes. We are not affiliated
          with Coles, Woolworths, ALDI, Harris Farm, Costco, or other retailers unless explicitly
          stated.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Food safety & health</h2>
        <p>
          Expiry dates and consumption estimates are guides only. Always follow package labels, your
          own judgment, and food safety advice. The App is not a substitute for professional dietary
          or medical advice.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Acceptable use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Abuse, scrape, or overload the App or its APIs</li>
          <li>Attempt to access another household&apos;s data without authorization</li>
          <li>Use the App for unlawful purposes</li>
          <li>Reverse engineer or resell the service without permission</li>
        </ul>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Availability & changes</h2>
        <p>
          We may modify, suspend, or discontinue features at any time. We strive for high
          availability but do not guarantee uninterrupted access. Beta features may change or be
          removed without notice.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Disclaimer of warranties</h2>
        <p>
          THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY
          KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL,
          ARISING FROM YOUR USE OF THE APP, INCLUDING RELIANCE ON DEAL PRICES, RECIPES, OR EXPIRY
          ESTIMATES.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Termination</h2>
        <p>
          You may stop using the App and delete your account at any time from Settings. We may suspend
          or terminate access if you violate these Terms or if required for security or legal reasons.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Governing law</h2>
        <p>
          These Terms are governed by the laws of Australia. Any disputes will be subject to the
          courts of Australia, without regard to conflict-of-law principles.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Contact & updates</h2>
        <p>
          We may update these Terms from time to time. The &quot;Last updated&quot; date at the top
          reflects the latest version. Continued use after changes constitutes acceptance. See our{' '}
          <a href="/privacy" className="text-emerald-700 underline dark:text-emerald-400">
            Privacy Policy
          </a>{' '}
          for how we handle your data.
        </p>
      </section>
    </LegalPageLayout>
  );
}
