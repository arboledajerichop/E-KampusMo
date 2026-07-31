import type { Metadata } from "next";
import LegalPageLayout from "@/components/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the E-KampusMo student companion.",
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Terms"
      title="Terms of Service"
      summary="These terms describe the basic rules for using E-KampusMo and the responsibilities that come with maintaining a private student account."
    >
      <section>
        <h2>The service</h2>
        <p>
          E-KampusMo is a personal organization tool for students. It helps you
          manage schedules, assignments, internship logs, expenses, and
          reminders. It does not act as a school, employer, registrar,
          learning management system, or official record-keeping authority.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You are responsible for providing accurate account information,
          protecting your password and devices, and promptly reporting
          unauthorized access. You may not share an account in a way that
          compromises another person’s privacy or the security of the service.
        </p>
      </section>

      <section>
        <h2>Your records</h2>
        <p>
          You retain responsibility for the content you add. You confirm that
          you have the right to store and export that content. Do not add
          unlawful material or content that invades another person’s privacy.
        </p>
        <p>
          Internship entries are personal records unless separately verified by
          the relevant institution. E-KampusMo does not certify their accuracy
          or acceptance.
        </p>
      </section>

      <section>
        <h2>Google Classroom connection</h2>
        <p>
          The optional Google Classroom activity view is a read-only
          convenience feature provided through Google&apos;s services. You
          choose the current-semester start date and may manually mark an item
          completed in E-KampusMo when it was submitted outside Classroom. You
          remain responsible for checking titles, deadlines, and submission
          requirements against the official information in Google Classroom.
        </p>
        <p>
          Google Classroom availability is governed by Google, your school,
          and any administrator restrictions on your institutional account.
          E-KampusMo does not guarantee that every course or item will be
          available and does not submit or modify work on your behalf.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Access another student’s account or private information.</li>
          <li>Bypass security, rate limits, or access-control measures.</li>
          <li>Use the service to distribute harmful or illegal content.</li>
          <li>Interfere with the service or attempt unauthorized testing.</li>
          <li>Misrepresent personal records as independently verified records.</li>
        </ul>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          The service may change as features are improved. Maintenance, network
          conditions, third-party services, or other events may occasionally
          interrupt access. You should keep independent copies of records that
          are essential for school, internship, financial, or legal purposes.
        </p>
      </section>

      <section>
        <h2>Account closure</h2>
        <p>
          You may stop using E-KampusMo and request account deletion. Access may
          also be restricted when necessary to address security threats,
          unlawful use, or material violations of these terms. Where practical,
          notice and an opportunity to export personal data will be provided.
        </p>
      </section>

      <section>
        <h2>Production review</h2>
        <p>
          These terms are a clear product draft and should be reviewed by
          qualified counsel before public production launch, particularly for
          consumer, privacy, education, and data-protection requirements that
          apply to the service operator.
        </p>
      </section>
    </LegalPageLayout>
  );
}
