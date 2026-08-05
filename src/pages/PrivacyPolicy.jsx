import { LegalPageLayout } from '../components/LegalPageLayout.jsx';

export function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p>
        What&apos;s in the Fridge? (&quot;the App&quot;) helps households track shared kitchen inventory,
        shopping lists, recipes, and supermarket deals. This policy explains what we collect, how we use
        it, and the choices you have. By using the App, you agree to this policy.
      </p>

      <section>
        <h2 className="text-heading text-base font-bold">Who we are</h2>
        <p>
          The App is operated as a household productivity service. For privacy questions, contact the
          operator through the support channel listed in the App or your deployment administrator.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">What we collect</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-heading">Account information</strong> — email address and
            authentication credentials are handled by{' '}
            <a
              href="https://firebase.google.com/support/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-700 underline dark:text-emerald-400"
            >
              Firebase Authentication
            </a>
            . We store your account record and household membership in our database.
          </li>
          <li>
            <strong className="text-heading">Household data</strong> — inventory items, shopping list
            status, expiry dates, saved recipes, app settings, onboarding preferences, and restock
            history. This data is scoped to your household and shared with members you invite.
          </li>
          <li>
            <strong className="text-heading">Push notification tokens</strong> — if you enable
            notifications, we store a device token to send expiry alerts and shopping pings via
            Firebase Cloud Messaging.
          </li>
          <li>
            <strong className="text-heading">Technical data</strong> — standard server logs (IP
            address, request timestamps) for security, rate limiting, and abuse prevention.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Where data is stored</h2>
        <p>
          Household inventory and settings are stored in{' '}
          <strong className="text-heading">MongoDB Atlas</strong> (cloud database). Data is isolated
          per household using server-side access controls — other households cannot read your
          inventory. Authentication is processed by Google Firebase; session tokens are issued by our
          API after Firebase verifies your identity.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Third-party services</h2>
        <p>We use the following services to operate the App:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Firebase (authentication and push notifications)</li>
          <li>MongoDB Atlas (household data storage)</li>
          <li>Open Food Facts / Open Products Facts (optional barcode lookups from your device)</li>
          <li>TheMealDB (optional recipe search, via our server proxy)</li>
          <li>Vercel (application hosting)</li>
          <li>Resend (optional transactional email)</li>
        </ul>
        <p className="mt-3 font-semibold text-slate-700 dark:text-slate-300">
          We do not sell your personal information or household data to third parties.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">How we use your data</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide and sync household inventory and shopping features</li>
          <li>Send optional push notifications you enable (expiry alerts, partner shopping pings)</li>
          <li>Improve reliability and security (rate limiting, error monitoring)</li>
          <li>Comply with legal obligations where applicable</li>
        </ul>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Household sharing</h2>
        <p>
          When you join a household with an invite code, your inventory and settings are visible to
          other members of that household. Only share invite codes with people you trust. Household
          owners may remove members from Settings.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Account deletion</h2>
        <p>
          You can delete your account at any time from{' '}
          <strong className="text-heading">Settings → Delete account</strong>. Deleting your account
          removes your user record. If you are the last member of a household, household inventory
          data for that household may also be deleted. If other members remain, your access is
          removed but the household data is retained for them.
        </p>
        <p>
          You may also request password reset or account removal through Firebase Authentication
          where applicable.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Data retention</h2>
        <p>
          We retain household data while your account and household are active. Server logs are
          retained for a limited period for security purposes. You can clear inventory items at any
          time within the App.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Children</h2>
        <p>
          The App is intended for household use by adults. We do not knowingly collect personal
          information from children under 13 without parental consent.
        </p>
      </section>

      <section>
        <h2 className="text-heading text-base font-bold">Changes</h2>
        <p>
          We may update this policy from time to time. Material changes will be reflected on this
          page with an updated date. Continued use of the App after changes constitutes acceptance.
        </p>
      </section>
    </LegalPageLayout>
  );
}
