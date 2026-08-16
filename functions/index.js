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
   ORIGINAL WORKING CODE
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
          userAgent: String(data.userAgent || ""),

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
   ORIGINAL WORKING CODE
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

    const password =
      String(data.password || "").trim();

    const firstName =
      String(data.firstName || "").trim();

    const lastName =
      String(data.lastName || "").trim();

    const fullName =
      String(
        data.fullName ||
        `${firstName} ${lastName}`
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
       NEW LINKTRADENETWORK WELCOME EMAIL
       ===================================================== */

    const html = htmlWrap(
      "Welcome to LinkTradeNetwork!",
      `

      <p>
        Hi ${firstName || "there"},
      </p>

      <p style="
        font-size:17px;
        line-height:1.6;
        color:#172033;
      ">
        <b>
          Your account is verified and you're officially
          part of LinkTradeNetwork.
        </b>
      </p>

      <p style="
        font-size:16px;
        line-height:1.6;
        color:#475569;
      ">
        LinkTradeNetwork is the
        <b>career and training platform built for the skilled trades.</b>
        Learn, showcase your skills, challenge your knowledge,
        connect with the trade community, and grow your career.
      </p>


      <div style="
        text-align:center;
        background:#172033;
        color:#ffffff;
        border-radius:10px;
        padding:15px;
        margin:20px 0;
      ">

        <div style="
          color:#ff8a1f;
          font-size:18px;
          font-weight:800;
        ">
          LEARN • SHOW YOUR SKILLS • COMPETE • CONNECT • GROW
        </div>

      </div>


      <!-- ===============================================
           10 SECOND VIDEO
           =============================================== -->

      <div style="
        background:#fff7ed;
        border:2px solid #ea6a00;
        border-radius:10px;
        padding:18px;
        margin:18px 0;
      ">

        <p style="
          font-size:18px;
          margin:0 0 8px;
          color:#172033;
        ">
          <b>
            🎥 Upload Your 10-Second Trade Video
          </b>
        </p>

        <p style="
          margin:0;
          line-height:1.6;
          color:#475569;
        ">
          Show the LinkTradeNetwork community what you can do.
          Upload a 10-second video of your work, skills,
          a trade tip, or something you've learned on the job.
        </p>

      </div>


      <!-- ===============================================
           SKILL CHALLENGE
           =============================================== -->

      <div style="
        background:#fff7ed;
        border:2px solid #ea6a00;
        border-radius:10px;
        padding:18px;
        margin:18px 0;
      ">

        <p style="
          font-size:18px;
          margin:0 0 8px;
          color:#172033;
        ">
          <b>
            🏆 Take the Skill Challenge &amp; Compete to Win
          </b>
        </p>

        <p style="
          margin:0;
          line-height:1.6;
          color:#475569;
        ">
          Test your trade knowledge, compete with other
          LinkTradeNetwork members, and qualify for
          cash-prize Skill Challenges.
        </p>

      </div>


      <!-- ===============================================
           INTERACTIVE TRAINING
           =============================================== -->

      <div style="
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:10px;
        padding:18px;
        margin:18px 0;
      ">

        <p style="
          font-size:18px;
          margin:0 0 8px;
          color:#172033;
        ">
          <b>
            🎓 Join Interactive Training
          </b>
        </p>

        <p style="
          margin:0;
          line-height:1.6;
          color:#475569;
        ">
          Join live skilled-trades training directly inside
          LinkTradeNetwork.
          No separate Zoom or Teams login is required.
        </p>

      </div>


      <!-- ===============================================
           PROFILE
           =============================================== -->

      <div style="
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:10px;
        padding:18px;
        margin:18px 0;
      ">

        <p style="
          font-size:18px;
          margin:0 0 8px;
          color:#172033;
        ">
          <b>
            👤 Build Your Trade Profile
          </b>
        </p>

        <p style="
          margin:0;
          line-height:1.6;
          color:#475569;
        ">
          Go to <b>Edit Profile</b> and add your trade,
          experience, skills, certifications,
          accomplishments, and real work.
        </p>

      </div>


      <!-- ===============================================
           APPRENTICES / STUDENTS
           =============================================== -->

      <div style="
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:10px;
        padding:18px;
        margin:18px 0;
      ">

        <p style="
          font-size:18px;
          margin:0 0 8px;
          color:#172033;
        ">
          <b>
            📈 Apprentices &amp; Students
          </b>
        </p>

        <p style="
          margin:0;
          line-height:1.6;
          color:#475569;
        ">
          Use <b>Track My Progress</b> to follow
          your training units, hours, skills,
          assignments, and accomplishments.
        </p>

        <p style="
          margin:10px 0 0;
          line-height:1.6;
          color:#475569;
        ">
          Enter the instructor code provided by
          your instructor or trade school to
          connect with your class.
        </p>

      </div>


      <!-- ===============================================
           INSTRUCTORS
           =============================================== -->

      <div style="
        background:#f8fafc;
        border:1px solid #e2e8f0;
        border-radius:10px;
        padding:18px;
        margin:18px 0;
      ">

        <p style="
          font-size:18px;
          margin:0 0 8px;
          color:#172033;
        ">
          <b>
            👨‍🏫 Instructors
          </b>
        </p>

        <p style="
          margin:0;
          line-height:1.6;
          color:#475569;
        ">
          Add your instructor/class code and use the
          <b>Instructor Dashboard</b> to connect with
          students, review training progress,
          assignments, and class activity.
        </p>

      </div>


      <!-- ===============================================
           DASHBOARD BUTTON
           =============================================== -->

      <p style="
        text-align:center;
        margin:28px 0;
      ">

        <a
          href="https://www.linktradenetwork.com/dashboard/"
          style="
            display:inline-block;
            background:#ea6a00;
            color:#ffffff;
            padding:15px 28px;
            border-radius:8px;
            text-decoration:none;
            font-weight:800;
            font-size:16px;
          "
        >
          Enter LinkTradeNetwork →
        </a>

      </p>


      <p style="
        text-align:center;
        font-size:17px;
        font-weight:800;
        color:#172033;
        margin-top:26px;
      ">
        Learn It. Build It. Show It. Grow It.
      </p>


      <p style="
        text-align:center;
        color:#ea6a00;
        font-weight:800;
        font-size:16px;
      ">
        Trades on the Rise
      </p>


      <p>
        Thank you for joining LinkTradeNetwork.
      </p>

      `
    );


    /* =====================================================
       SEND WELCOME EMAIL
       ===================================================== */

    await sendEmail(
      RESEND_API_KEY.value(),
      email,

      "Welcome to LinkTradeNetwork!",

      html,

      `Welcome to LinkTradeNetwork!

Your account is verified and ready to use.

LinkTradeNetwork is the career and training platform built for the skilled trades.

Start exploring:

- Upload your 10-second trade video and showcase your skills.
- Take the Skill Challenge and compete to win.
- Join Interactive Training directly inside LinkTradeNetwork.
- Complete your trade profile.
- Track apprenticeship hours, skills and training progress.
- Instructors can use the Instructor Dashboard to manage students and training.
- Students and apprentices can connect with their instructor or trade school using an instructor code.

Enter LinkTradeNetwork:
https://www.linktradenetwork.com/dashboard/

Learn It. Build It. Show It. Grow It.

Trades on the Rise.

LinkTradeNetwork Team
team@linktradenetwork.com`
    );


    /* =====================================================
       MARK ACCOUNT CREATED
       ===================================================== */

    await verifyRef.set(
      {
        accountCreated: true,

        uid: userRecord.uid,

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
   ORIGINAL WORKING CODE
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
      count: snap.data().count || 0
    };
  }
);
