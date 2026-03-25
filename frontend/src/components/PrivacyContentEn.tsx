/**
 * PrivacyContentEn component
 * English translation of the Photlas Privacy Policy
 */
export function PrivacyContentEn() {
  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm text-gray-700">
          The Photlas operator (hereinafter referred to as &quot;the Operator&quot;) hereby
          establishes this Privacy Policy (hereinafter referred to as &quot;this Policy&quot;)
          regarding the handling of users&apos; personal information in the service
          &quot;Photlas&quot; (hereinafter referred to as &quot;the Service&quot;). The Operator
          complies with the Act on the Protection of Personal Information (APPI) and
          other applicable laws and regulations, and handles users&apos; personal
          information appropriately.
        </p>
      </section>

      <section>
        <h2 className="mb-3">Article 1 (Basic Policy)</h2>
        <p className="text-sm text-gray-700 mb-2">
          The Operator recognizes the protection of personal information as an
          important responsibility and handles personal information appropriately in
          accordance with this Policy, while complying with the APPI and other
          applicable laws, regulations, and guidelines. This Policy governs the
          handling of personal information within the Service (photlas.jp).
        </p>
        <p className="text-sm text-gray-700">
          In this Policy, &quot;personal information&quot; refers to &quot;personal
          information&quot; as defined by the APPI, meaning information relating to a
          living individual that can identify a specific individual by email address,
          username, or other descriptions contained in the information.
        </p>
      </section>

      <section>
        <h2 className="mb-3">Article 2 (Information We Collect)</h2>
        <p className="text-sm text-gray-700 mb-2">
          The Operator collects the following information in order to provide the
          Service.
        </p>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(1) Account Information</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Email address</li>
          <li>Username</li>
          <li>Password (stored in encrypted form)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(2) Profile Information</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Profile image</li>
          <li>SNS account links (up to 3)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(3) Posted Data</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Photo files</li>
          <li>Title, facility name, categories, weather information</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(4) Photo Metadata (EXIF Information)</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Date and time of capture</li>
          <li>GPS coordinates (latitude and longitude)</li>
          <li>Camera body name</li>
          <li>Lens name</li>
          <li>Focal length, aperture (f-number), shutter speed, ISO sensitivity</li>
          <li>Image size</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(5) Location Information</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>GPS coordinates of the shooting location (automatically extracted from photo EXIF data or manually entered by the user)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(6) Usage Data</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Favorites information</li>
          <li>Report information (reason for report, reported content)</li>
          <li>Content moderation information (review results, violation history, sanction information)</li>
          <li>Location suggestion data (suggested coordinates, suggestion status)</li>
        </ul>

        <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1">(7) Technical Information</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>IP address (temporarily collected for rate limiting purposes; not stored permanently)</li>
          <li>Error information (collected through the external service &quot;Sentry&quot;; only a portion of all errors are transmitted)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">Article 3 (How We Collect Information)</h2>
        <p className="text-sm text-gray-700 mb-2">
          The Operator collects information through the following methods.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Information directly entered by users (during account registration, profile editing, and photo posting)</li>
          <li>Information automatically extracted from photo files (date and time of capture, GPS coordinates, camera information, and other data contained in EXIF information)</li>
          <li>Information automatically collected during use of the Service (IP address, error information)</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">Article 4 (Purpose of Use)</h2>
        <p className="text-sm text-gray-700 mb-2">
          The Operator collects and uses personal information for the following
          purposes.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Provision, operation, and improvement of the Service</li>
          <li>User identity verification and authentication</li>
          <li>Displaying photo shooting locations on maps</li>
          <li>Displaying photo shooting information (camera, lens, settings, etc.)</li>
          <li>Notifying users of new features, updates, maintenance, and other information</li>
          <li>Responding to password reset requests</li>
          <li>Detection and prevention of unauthorized use (rate limiting, prevention of unauthorized access)</li>
          <li>Responding to violations of the Terms of Service</li>
          <li>Advertising, promotion, and marketing of the Service (using posted data)</li>
          <li>Responding to user inquiries</li>
          <li>Purposes incidental to the above</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">Article 5 (Data Storage and Security)</h2>
        <p className="text-sm text-gray-700 mb-2">
          The Operator manages collected information securely through the following
          measures.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Passwords are encrypted (hashed) using BCrypt and stored securely. No one, including the Operator, can view the original passwords.</li>
          <li>Photo files and profile images are stored on Amazon Web Services (AWS) cloud storage.</li>
          <li>JSON Web Tokens (JWT) are used for authentication, and tokens are stored in the user&apos;s browser.</li>
          <li>All communications are encrypted via HTTPS.</li>
          <li>Rate limiting is implemented to prevent unauthorized access.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">Article 6 (Third-Party Disclosure and External Services)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            The Operator will not provide personal information to third parties
            without the prior consent of the user, except in the following cases:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>When required by law</li>
              <li>When necessary to protect a person&apos;s life, body, or property, and obtaining the individual&apos;s consent is difficult</li>
              <li>When especially necessary to improve public health or promote the sound development of children, and obtaining the individual&apos;s consent is difficult</li>
              <li>When cooperation is necessary for a national or local government body, or an entity entrusted by them, to carry out duties prescribed by law, and obtaining the individual&apos;s consent would impede the performance of such duties</li>
            </ul>
          </li>
          <li>
            In the event the Operator transfers the business related to the Service
            to another party, personal information may be provided to the transferee
            as part of such business transfer.
          </li>
          <li>
            The Operator uses the following external services in providing the
            Service. Some user information may be transmitted to these services.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>
                <span className="font-semibold">Amazon Web Services (AWS S3, CloudFront, SES, Rekognition)</span>: Used
                for storing and delivering image files, sending emails, and automated
                content review. Data is processed in the AWS Tokyo Region
                (ap-northeast-1).
              </li>
              <li>
                <span className="font-semibold">Mapbox</span>: Used for displaying maps,
                showing shooting location information, and place search. Please refer
                to
                <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">Mapbox&apos;s Privacy Policy</a>
                .
              </li>
              <li>
                <span className="font-semibold">Google Analytics 4</span>: Used for access
                analysis to improve the Service. Anonymized data such as page views
                and usage patterns are collected. Please refer to
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">Google&apos;s Privacy Policy</a>
                .
              </li>
              <li>
                <span className="font-semibold">Sentry</span>: Used for application error
                monitoring. Technical error information is transmitted when errors
                occur (only a portion of all errors). Please refer to
                <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">Sentry&apos;s Privacy Policy</a>
                .
              </li>
            </ul>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 7 (Handling of EXIF Information)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            The Operator automatically extracts date and time of capture, GPS
            coordinates, camera information, lens information, shooting settings,
            and other data from the EXIF information contained in photo files
            uploaded by users.
          </li>
          <li>
            Extracted shooting information (camera name, lens name, focal length,
            aperture, shutter speed, ISO sensitivity, etc.) is displayed to other
            users on the Service&apos;s interface.
          </li>
          <li>
            Location information (GPS coordinates) is displayed on the map as a
            shooting spot. Users shall understand and consent to the fact that
            location information will be made publicly available on the Service when
            posting photos.
          </li>
          <li>
            The Service automatically strips EXIF information from photo files upon
            upload before storing them on the server. However, images displayed in
            the browser may be technically cached. The Operator does not guarantee
            complete protection of image data.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 8 (Automated Content Review)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            To ensure compliance with the Content Policy, the Operator conducts
            automated image analysis of photos posted by users using AI technology
            (Amazon Rekognition Content Moderation).
          </li>
          <li>
            The automated review analyzes whether posted images contain
            inappropriate content (sexual content, violent content, child sexual
            exploitation, etc.). Image data is processed in the AWS Tokyo Region,
            and only the analysis results are stored.
          </li>
          <li>
            Posts determined to be inappropriate by the automated review are
            temporarily made private (quarantined) and subject to manual review by
            the Operator.
          </li>
          <li>
            The results of automated reviews and violation history are retained for
            the purposes of content moderation and account management.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 9 (Use of Cookies)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            The Service does not use cookies for authentication purposes.
            Authentication is performed using JSON Web Tokens (JWT), which are
            stored in the browser as follows:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>When &quot;Remember me&quot; is selected at login: localStorage (persists after closing the browser, valid for 24 hours)</li>
              <li>When not selected: sessionStorage (deleted when the browser is closed)</li>
            </ul>
          </li>
          <li>
            The Service uses Google Analytics 4, and Google may use cookies to
            collect access information. The data collected is anonymized and does not
            identify individuals. A cookie consent banner is displayed on your first
            visit, allowing you to accept or decline. If you accept, full analytics
            with cookies will be performed; if you decline, only anonymous basic
            analytics without cookies will be performed.
          </li>
          <li>
            Other external services (Mapbox, Sentry, etc.) may independently use
            cookies. Please refer to the respective privacy policies of these
            services for details on their cookie practices.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 10 (Disclosure, Correction, and Deletion of Personal Information)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            Users have the following rights regarding their personal information:
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>The right to request disclosure of personal information</li>
              <li>The right to request correction, addition, or deletion of personal information</li>
              <li>The right to request suspension of use of personal information</li>
            </ul>
          </li>
          <li>
            Such requests are accepted via email at support@photlas.jp. The Operator
            will respond within a reasonable period after verifying the
            requester&apos;s identity.
          </li>
          <li>
            Certain profile information (username, profile image, SNS account links)
            can be changed or deleted by the user directly through the Service.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 11 (Data Handling Upon Account Deletion)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            When a user withdraws from the Service, the following data will be
            retained for 90 days for the purpose of investigating and responding to
            fraudulent use, after which it will be permanently deleted, including
            backups. However, this does not apply to posted data that has already
            been made public for promotional purposes under the Terms of Service.
            <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
              <li>Account information (email address, username, etc.)</li>
              <li>Profile information (profile image, SNS account links)</li>
              <li>Posted data (photo files, metadata, etc.)</li>
              <li>Favorites and report information</li>
            </ul>
          </li>
          <li>
            Data cannot be recovered after deletion.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 12 (Use by Minors)</h2>
        <p className="text-sm text-gray-700">
          Minors must obtain consent from a legal guardian (parent) before using the
          Service. If a minor uses the Service, it shall be deemed that the consent
          of a legal guardian has been obtained.
        </p>
      </section>

      <section>
        <h2 className="mb-3">Article 13 (Changes to Purpose of Use)</h2>
        <p className="text-sm text-gray-700">
          The Operator may change the purpose of use of personal information only
          when the change is reasonably deemed to be related to the original purpose.
          When the purpose of use is changed, the Operator will notify users or
          publicly announce the updated purpose on the Service.
        </p>
      </section>

      <section>
        <h2 className="mb-3">Article 14 (Changes to Privacy Policy)</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>
            The Operator may revise this Policy in response to changes in applicable
            laws or modifications to the Service.
          </li>
          <li>
            Users will be notified in advance of any significant changes to this
            Policy.
          </li>
          <li>
            The revised Privacy Policy shall take effect from the time it is
            published on the Service.
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3">Article 15 (Legal Basis for Processing Personal Data)</h2>
        <p className="text-sm text-gray-700 mb-2">
          The Operator processes personal data based on the following legal grounds:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">Consent</span> (GDPR Art. 6(1)(a)): Analytics via Google Analytics 4. Users may accept or decline via the cookie consent banner.</li>
          <li><span className="font-semibold">Performance of a contract</span> (GDPR Art. 6(1)(b)): Account management, service delivery, and map functionality (Mapbox).</li>
          <li><span className="font-semibold">Legitimate interests</span> (GDPR Art. 6(1)(f)): Error monitoring (Sentry), detection and prevention of misuse, and ensuring service security.</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">Article 16 (Rights Under the EU General Data Protection Regulation)</h2>
        <p className="text-sm text-gray-700 mb-2">
          Users residing in the European Economic Area (EEA) have the following rights under the GDPR. To exercise these rights, please contact us at support@photlas.jp.
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">Right of access</span>: The right to request a copy of your personal data.</li>
          <li><span className="font-semibold">Right to rectification</span>: The right to request correction of inaccurate personal data.</li>
          <li><span className="font-semibold">Right to erasure (right to be forgotten)</span>: The right to request deletion of your personal data.</li>
          <li><span className="font-semibold">Right to restriction of processing</span>: The right to request restriction of processing of your personal data.</li>
          <li><span className="font-semibold">Right to data portability</span>: The right to receive your personal data in a structured, machine-readable format.</li>
          <li><span className="font-semibold">Right to object</span>: The right to object to processing based on legitimate interests.</li>
          <li><span className="font-semibold">Right to withdraw consent</span>: The right to withdraw consent at any time for consent-based processing (you can withdraw cookie consent by clearing this site&apos;s data from your browser settings, which will cause the cookie consent banner to reappear).</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-3">Article 17 (International Data Transfers)</h2>
        <p className="text-sm text-gray-700 mb-2">
          Your personal data may be transferred to the following regions as necessary for providing the Service:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li><span className="font-semibold">Japan (AWS Tokyo Region)</span>: Image file storage and delivery, database, content moderation.</li>
          <li><span className="font-semibold">United States</span>: Analytics data via Google Analytics 4, error monitoring data via Sentry.</li>
        </ul>
        <p className="text-sm text-gray-700 mt-2">
          These service providers implement appropriate data protection measures in accordance with their respective privacy policies and data processing agreements.
        </p>
      </section>

      <section>
        <h2 className="mb-3">Article 18 (Contact)</h2>
        <p className="text-sm text-gray-700">
          For inquiries regarding this Policy, please contact us at the following.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          Operator: Photlas<br />
          Email: support@photlas.jp
        </p>
      </section>

      <section className="pt-6 border-t">
        <p className="text-sm text-gray-500">
          Enacted: February 16, 2026<br />
          Last revised: March 25, 2026
        </p>
      </section>
    </div>
  )
}
