import type { Metadata } from "next";
import LegalPageLayout from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How E-KampusMo handles student account and personal record data.",
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="E-KampusMo is designed as a private student companion. This policy explains what information the service handles and the choices available to you."
    >
      <section>
        <h2>Information you provide</h2>
        <p>
          We handle the account and student-planning information you choose to
          add. This may include your name, email address, subjects, schedules,
          assignments, internship logs, expenses, and reminders.
        </p>
        <p>
          Personal internship records in E-KampusMo are user-created records.
          They are not official records issued or verified by a school,
          employer, or government agency.
        </p>
      </section>

      <section>
        <h2>How information is used</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Provide the planning and tracking features you request.</li>
          <li>Authenticate your account and protect access to private data.</li>
          <li>Synchronize records across your signed-in devices.</li>
          <li>Generate exports you request from your own information.</li>
          <li>Maintain reliability, security, and abuse prevention.</li>
        </ul>
      </section>

      <section>
        <h2>Storage and service providers</h2>
        <p>
          E-KampusMo uses Supabase for account authentication, database
          storage, and synchronization. The website may also use a hosting
          provider to deliver the application. These providers process data only
          as needed to operate the service and are subject to their own security
          and privacy commitments.
        </p>
      </section>

      <section>
        <h2>Optional Google Classroom connection</h2>
        <p>
          If you choose to connect Google Classroom, E-KampusMo requests
          read-only access to the names of your active and archived classes,
          your published coursework, and whether your own work is turned in,
          returned, or late. The integration does not request submission
          contents or individual grades. The connection cannot submit, edit,
          grade, or delete anything in Google Classroom. Classroom information
          is requested when you load or refresh the activity view. Your chosen
          semester start date and any manual completion overrides are saved
          privately to your E-KampusMo account.
        </p>
        <p>
          Google access credentials are encrypted in an HttpOnly cookie on
          your browser and are bound to your signed-in E-KampusMo account. They
          are not saved in Supabase or exposed to browser JavaScript. You may
          disconnect Google Classroom at any time. Disconnecting removes the
          connection credential but retains your semester setting and manual
          completion choices unless you change or delete your account.
        </p>
      </section>

      <section>
        <h2>Offline data and synchronization</h2>
        <p>
          Some application records may be saved on your device so core features
          remain useful without a network connection. The application will
          distinguish between information saved locally, waiting to sync, and
          confirmed as synchronized. Signing out or removing the application
          may affect locally cached information that has not synchronized.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You may review and update your profile and personal records. Account
          settings provide an option to permanently delete your account after
          email verification. You may also disconnect optional third-party
          connections independently. Deletion may require recent
          authentication and may take a limited time to complete across backup
          systems.
        </p>
      </section>

      <section>
        <h2>Security and retention</h2>
        <p>
          We use account-level access controls intended to keep each student’s
          information separate. No online service can guarantee absolute
          security, so you should use a strong, unique password and protect
          access to your devices. Information is kept only as long as needed to
          provide the service, meet legal obligations, resolve disputes, and
          protect the platform.
        </p>
      </section>

      <section>
        <h2>Policy changes</h2>
        <p>
          If this policy changes materially, E-KampusMo will provide a clear
          notice in the application or through the email associated with your
          account. A production release should have this policy reviewed for
          the laws that apply to its operator and users.
        </p>
      </section>
    </LegalPageLayout>
  );
}
