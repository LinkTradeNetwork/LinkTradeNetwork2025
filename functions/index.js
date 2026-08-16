const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { Resend } = require("resend");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

const FROM_EMAIL = "LinkTradeNetwork Team <team@linktradenetwork.com>";
const REPLY_TO = "team@linktradenetwork.com";
const OTP_TTL_MINUTES = 10;

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function makeCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function htmlWrap(title, body) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff">
    <div style="background:#ea6a00;padding:22px;text-align:center;border-radius:10px 10px 0 0">
      <h2 style="color:#fff;margin:0;font-size:24px">LinkTradeNetwork</h2>
      <p style="color:#fff;margin:6px 0 0;font-weight:700">Trades on the Rise</p>
    </div>

    <div style="padding:26px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">
      <h2 style="color:#172033;margin-top:0">${title}</h2>

      ${body}

      <p style="font-size:12px;color:#64748b;margin-top:26px">
        LinkTradeNetwork Team<br>
        <a href="mailto:${REPLY_TO}">${REPLY_TO}</a>
      </p>
    </div>
  </div>`;
}

async function sendEmail(apiKey, to, subject, html, text) {
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    text,
    reply_to: REPLY_TO
  });
}


/* =========================================================
   REQUEST VERIFICATION CODE
   ========================================================= */

exports.requestVerificationCode = onCall(
  { region: "us-central1", secrets: [RESEND_API_KEY] },

  async (request) => {
    const data = request.data || {};

    const email = cleanEmail(data.email);
    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();

    const fullName = String(
      data.fullName || `${firstName} ${lastName}`
    ).trim();

    const consent = data.consent === true;

    if (!email) {
      throw new HttpsError(
        "invalid-argument",
        "Email is required."
      );
    }

    if (!consent) {
      throw new HttpsError(
        "failed-precondition",
        "Consent is required."
      );
    }

    const code = makeCode();

    const expiresAt =
      Date.now() +
      OTP_TTL_MINUTES * 60 * 1000;

    await db
      .collection("emailVerifications")
      .doc(email)
      .set(
        {
          email,
          firstName,
          lastName,
          fullName,
          code,
          verified: false,
          expiresAt,

          userAgent:
            String(data.userAgent || ""),

          createdAt:
            admin.firestore.FieldValue.serverTimestamp(),

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp()
        },

        { merge: true }
      );

    const html = htmlWrap(
      "Your verification code",
      `
      <p>Hi ${firstName || "there"},</p>

      <p>
        Your LinkTradeNetwork verification code is:
      </p>

      <div style="
        font-size:38px;
        font-weight:800;
        letter-spacing:8px;
        color:#ea6a00;
        text-align:center;
        background:#fff7ed;
        border:1px solid #fed7aa;
        border-radius:10px;
        padding:18px;
        margin:20px 0
      ">
        ${code}
      </div>

      <p>
        This code expires in
        <b>${OTP_TTL_MINUTES} minutes</b>.
      </p>

      <p>
        If you did not request this,
        you can ignore this email.
      </p>
      `
    );

    await sendEmail(
      RESEND_API_KEY.value(),
      email,
      "Your LinkTradeNetwork verification code",
      html,
      `Your LinkTradeNetwork verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`
    );

    return {
      success: true,
      message: "Verification code sent."
    };
  }
);


/* =========================================================
   VERIFY SIGNUP CODE
   ========================================================= */

exports.verifySignupCode = onCall(
  { region: "us-central1" },

  async (request) => {
    const data = request.data || {};

    const email = cleanEmail(data.email);
    const code = String(data.code || "").trim();

    if (!email || !code) {
      throw new HttpsError(
        "invalid-argument",
        "Email and code are required."
      );
    }

    const ref =
      db.collection("emailVerifications").doc(email);

    const snap = await ref.get();

    if (!snap.exists) {
      throw new HttpsError(
        "not-found",
        "No verification code found."
      );
    }

    const saved = snap.data() || {};

    if (String(saved.code || "") !== code) {
      throw new HttpsError(
        "permission-denied",
        "Invalid code."
      );
    }

    if (
      Date.now() >
      Number(saved.expiresAt || 0)
    ) {
      throw new HttpsError(
        "deadline-exceeded",
        "Code expired."
      );
    }

    await ref.set(
      {
        verified: true,

        verifiedAt:
          admin.firestore.FieldValue.serverTimestamp(),

        updatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      },

      { merge: true }
    );

    return {
      success: true,
      verified: true
    };
  }
);


/* =========================================================
   CREATE VERIFIED USER
   ========================================================= */

exports.createVerifiedUser = onCall(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY]
  },

  async (request) => {
    const data = request.data || {};

    const email = cleanEmail(data.email);
    const password = String(data.password || "").trim();
    const firstName = String(data.firstName || "").trim();
    const lastName = String(data.lastName || "").trim();

    const fullName = String(
      data.fullName || `${firstName} ${lastName}`
    ).trim();

    if (!email) {
      throw new HttpsError(
        "invalid-argument",
        "Email is required."
      );
    }

    if (!/^\d{6}$/.test(password)) {
      throw new HttpsError(
        "invalid-argument",
        "Password must be exactly 6 numbers."
      );
    }

    const verifyRef =
      db.collection("emailVerifications").doc(email);

    const verifySnap =
      await verifyRef.get();

    if (
      !verifySnap.exists ||
      verifySnap.data().verified !== true
    ) {
      throw new HttpsError(
        "failed-precondition",
        "Please verify your email first."
      );
    }

    let userRecord;

    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: fullName || email,
        emailVerified: true
      });

    } catch (err) {

      if (
        err.code ===
        "auth/email-already-exists"
      ) {
        throw new HttpsError(
          "already-exists",
          "That email is already registered. Please sign in."
        );
      }

      throw new HttpsError(
        "internal",
        err.message ||
        "Could not create account."
      );
    }


    /* =====================================================
       SAVE USER TO FIRESTORE
       ===================================================== */

    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          email,
          firstName,
          lastName,
          fullName,

          displayName:
            fullName || email,

          role: "",

          createdAt:
            admin.firestore.FieldValue.serverTimestamp(),

          updatedAt:
            admin.firestore.FieldValue.serverTimestamp(),

          signInCount: 0
        },

        { merge: true }
      );


    /* =====================================================
       WELCOME EMAIL
       ===================================================== */

    const html = htmlWrap(
      "Welcome to LinkTradeNetwork!",
      `

      <p>
        Hi ${firstName || "there"},
      </p>

      <p>
        Your account is verified and ready to use.
      </p>


      <div style="
        background:#fff7ed;
        border:1px solid #fed7aa;
        border-radius:10px;
        padding:16px;
        margin:18px 0
      ">

        <p style="
          font-size:16px;
          margin-top:0;
          color:#172033;
        ">
          <b>Start here:</b>
        </p>


        <!-- ============================================
             10 SECOND VIDEO
             ============================================ -->

        <div style="
          background:#ffffff;
          border:2px solid #ea6a00;
          border-radius:10px;
          padding:14px;
          margin:14px 0;
        ">

          <p style="
            margin:0 0 6px;
            font-size:17px;
            color:#172033;
          ">
            🎥 <b>Upload Your 10-Second Trade Video</b>
          </p>

          <p style="
            margin:0 0 10px;
            color:#475569;
            line-height:1.5;
          ">
            Show your skills, your work, a trade tip,
            a project, or something you've learned on the job.
          </p>

          <a
            href="https://www.linktradenetwork.com/dashboard/"
            style="
              display:inline-block;
              background:#ea6a00;
              color:#ffffff;
              padding:10px 16px;
              border-radius:7px;
              text-decoration:none;
              font-weight:800;
              font-size:14px;
            "
          >
            Upload Your 10-Second Video →
          </a>

        </div>


        <!-- ============================================
             SKILL CHALLENGE
             ============================================ -->

        <div style="
          background:#ffffff;
          border:2px solid #ea6a00;
          border-radius:10px;
          padding:14px;
          margin:14px 0;
        ">

          <p style="
            margin:0 0 6px;
            font-size:17px;
            color:#172033;
          ">
            🏆 <b>Take the Skill Challenge &amp; Win</b>
          </p>

          <p style="
            margin:0 0 10px;
            color:#475569;
            line-height:1.5;
          ">
            Test your trade knowledge,
            compete with other LinkTradeNetwork members,
            advance through the challenge,
            and compete for cash prizes.
          </p>

          <a
            href="https://www.linktradenetwork.com/SkillChallenge/"
            style="
              display:inline-block;
              background:#172033;
              color:#ffffff;
              padding:10px 16px;
              border-radius:7px;
              text-decoration:none;
              font-weight:800;
              font-size:14px;
            "
          >
            Take the Skill Challenge →
          </a>

        </div>


        <!-- ============================================
             ORIGINAL START HERE ITEMS
             ============================================ -->

        <p>
          ✅ Go to <b>Edit Profile</b>
          and complete your information.
        </p>

        <p>
          ✅ Mark whether you are an
          <b>Apprentice/Student</b>
          or an
          <b>Instructor</b>.
        </p>

        <p>
          ✅ <b>Instructors:</b>
          add your instructor/class code
          so students can connect to your class.
        </p>

        <p>
          ✅ <b>Students/Apprentices:</b>
          enter the instructor code provided by
          your instructor or trade school.
        </p>

        <p>
          ✅ Students can use
          <b>Track My Progress</b>
          to follow training units,
          hours, and assignments.
        </p>

        <p>
          ✅ Instructors can use the
          <b>Instructor Dashboard</b>
          to review students,
          training progress,
          assignments,
          and class activity.
        </p>

      </div>


      <p style="
        text-align:center;
        margin:24px 0
      ">

        <a
          href="https://www.linktradenetwork.com/dashboard/"
          style="
            background:#ea6a00;
            color:#fff;
            padding:14px 24px;
            border-radius:8px;
            text-decoration:none;
            font-weight:800
          "
        >
          Go to Dashboard
        </a>

      </p>


      <p>
        Thank you for joining LinkTradeNetwork.
      </p>

      `
    );


    await sendEmail(
      RESEND_API_KEY.value(),
      email,

      "Welcome to LinkTradeNetwork!",

      html,

      `Welcome to LinkTradeNetwork!

Your account is verified and ready to use.

START HERE:

1. Upload Your 10-Second Trade Video
Show your skills, your work, a trade tip, a project, or something you've learned on the job.

https://www.linktradenetwork.com/dashboard/

2. Take the Skill Challenge & Win
Test your trade knowledge, compete with other LinkTradeNetwork members, advance through the challenge, and compete for cash prizes.

https://www.linktradenetwork.com/SkillChallenge/

3. Go to Edit Profile and complete your information.

4. Mark whether you are an Apprentice/Student or an Instructor.

5. Instructors: add your instructor/class code so students can connect to your class.

6. Students/Apprentices: enter the instructor code provided by your instructor or trade school.

7. Students can use Track My Progress to follow training units, hours, and assignments.

8. Instructors can use the Instructor Dashboard to review students, training progress, assignments, and class activity.

Go to Dashboard:
https://www.linktradenetwork.com/dashboard/

Thank you for joining LinkTradeNetwork.

LinkTradeNetwork Team
team@linktradenetwork.com`
    );


    await verifyRef.set(
      {
        accountCreated: true,

        uid:
          userRecord.uid,

        accountCreatedAt:
          admin.firestore.FieldValue.serverTimestamp()
      },

      { merge: true }
    );


    return {
      success: true,
      uid: userRecord.uid,
      message: "Account created successfully."
    };
  }
);


/* =========================================================
   GET MEMBER COUNT
   ========================================================= */

exports.getMemberCount = onCall(
  { region: "us-central1" },

  async () => {
    const snap =
      await db
        .collection("users")
        .count()
        .get();

    return {
      success: true,
      count:
        snap.data().count || 0
    };
  }
);
